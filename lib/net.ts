"use client";
// Sockets to the rooms worker, for the big screen (useHostRoom) and a phone (usePhone). Both reconnect on their own.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Engine, type State } from "./engine";
import type { Action, ToHost, ToPhone, View } from "./protocol";
import { roomsUrl, wsUrl } from "./protocol";

type Status = "connecting" | "open" | "reconnecting" | "closed";

/** A websocket that comes back after drops (backoff up to 5 s) and pings so idle proxies keep it. */
class Live<In> {
  private ws: WebSocket | null = null;
  private tries = 0;
  private closed = false;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  constructor(private url: string, private on: { msg: (m: In) => void; status: (s: Status) => void; fatal?: (reason: string) => boolean }) { this.open(); }
  private open() {
    this.on.status(this.tries ? "reconnecting" : "connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; this.on.status("open"); this.ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 20_000); };
    ws.onmessage = (e) => { if (e.data === "pong") return; try { this.on.msg(JSON.parse(String(e.data)) as In); } catch { /* ignore */ } };
    ws.onclose = (e) => {
      if (this.ping) clearInterval(this.ping);
      if (this.closed) return;
      // 4000: refused (bad code); 4001: opened elsewhere; 4002: kicked; 1000: room ended. Those don't retry.
      if ([4000, 4001, 4002, 1000].includes(e.code) && (this.on.fatal?.(e.reason || String(e.code)) ?? true)) { this.on.status("closed"); return; }
      this.tries++;
      this.on.status("reconnecting");
      this.retry = setTimeout(() => this.open(), Math.min(5_000, 400 * 2 ** this.tries));
    };
  }
  send(m: unknown) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  close() { this.closed = true; if (this.retry) clearTimeout(this.retry); if (this.ping) clearInterval(this.ping); this.ws?.close(1000); }
}

// ---- big screen -------------------------------------------------------------------------------------------------

const HOST_KEY = "partyline:host";

export function useHostRoom(aiOn: boolean) {
  const [room, setRoom] = useState<{ code: string; key: string } | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const live = useRef<Live<ToHost> | null>(null);

  const create = useCallback(async (fresh = false) => {
    setError(null);
    try {
      const saved = fresh ? null : JSON.parse(localStorage.getItem(HOST_KEY) ?? "null") as { code: string; key: string } | null;
      if (saved?.code && saved.key) {
        const info = await fetch(`${roomsUrl()}/room/${saved.code}/check`).then((r) => r.json()).catch(() => null) as { open?: boolean } | null;
        if (info?.open) { setRoom(saved); return; }
      }
      const res = await fetch(`${roomsUrl()}/new`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? "Couldn't open a room.");
      const r = (await res.json()) as { code: string; key: string };
      localStorage.setItem(HOST_KEY, JSON.stringify(r));
      setRoom(r);
    } catch (e) {
      setError(e instanceof TypeError ? "Can't reach the rooms server. Check your connection and try again." : (e as Error).message);
      setStatus("closed");
    }
  }, []);

  useEffect(() => { void create(); }, [create]);

  useEffect(() => {
    if (!room) return;
    let eng: Engine | null = null;
    const ai = { call: async <R,>(body: unknown): Promise<R> => {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`AI ${r.status}`);
      return (await r.json()) as R;
    } };
    const l = new Live<ToHost>(wsUrl(`/room/${room.code}/ws?role=host&key=${room.key}`), {
      status: setStatus,
      fatal: (reason) => { setError(/another/i.test(reason) ? "This room is open in another tab." : reason); return true; },
      msg: (m) => {
        if (m.t === "error") { setError(m.error); return; }
        if (m.t === "hello") {
          if (!eng) {
            eng = new Engine({
              views: (views) => l.send({ t: "views", views }),
              save: (state) => l.send({ t: "views", views: {}, save: state }),
              kick: (pid) => l.send({ t: "kick", pid }),
            }, ai, m.save as State | null);
            eng.start();
            setEngine(eng);
          }
          for (const pid of m.online) eng.online(pid, true);
          return;
        }
        if (!eng) return;
        if (m.t === "online") eng.online(m.pid, true);
        else if (m.t === "offline") eng.online(m.pid, false);
        else if (m.t === "act") eng.act(m.pid, m.a);
      },
    });
    live.current = l;
    return () => { l.close(); eng?.stop(); setEngine(null); };
  }, [room]);

  useEffect(() => { if (engine) engine.aiOn = aiOn; }, [engine, aiOn]);

  const newRoom = useCallback(() => { live.current?.send({ t: "end" }); localStorage.removeItem(HOST_KEY); setRoom(null); setEngine(null); void create(true); }, [create]);
  return { code: room?.code ?? null, status, error, engine, retry: () => void create(), newRoom };
}

const noop = () => () => {};
export function useEngineState(engine: Engine | null): State | null {
  return useSyncExternalStore(engine?.subscribe ?? noop, engine ? engine.getState : () => null, () => null);
}

// ---- phone ------------------------------------------------------------------------------------------------------

const PID_KEY = "partyline:pid";
/** Per tab (sessionStorage): a refresh keeps your seat; a second tab on the same device is a second player. */
function pid(): string {
  let id = sessionStorage.getItem(PID_KEY);
  if (!id || !/^[a-z0-9]{6,24}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join(""); sessionStorage.setItem(PID_KEY, id); }
  return id;
}

export function usePhone(code: string | null) {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [hostOnline, setHostOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<Live<ToPhone> | null>(null);

  useEffect(() => {
    if (!code) return;
    setError(null); setView(null);
    const l = new Live<ToPhone>(wsUrl(`/room/${code}/ws?role=player&pid=${pid()}`), {
      status: setStatus,
      fatal: (reason) => { setError(/another/i.test(reason) ? "You opened this room in another tab." : /removed/i.test(reason) ? "The host removed you from the room." : /closed|expired|1000/i.test(reason) ? "This room has closed." : reason); return true; },
      msg: (m) => {
        if (m.t === "error") setError(m.error);
        else if (m.t === "hello") { setHostOnline(m.host); setView(m.view); }
        else if (m.t === "view") setView(m.view);
        else if (m.t === "host") setHostOnline(m.online);
        else if (m.t === "ended") setError("The host closed the room.");
      },
    });
    live.current = l;
    return () => l.close();
  }, [code]);

  const send = useCallback((a: Action) => live.current?.send({ t: "act", a }) ?? false, []);
  return { view, status, hostOnline, error, send };
}
