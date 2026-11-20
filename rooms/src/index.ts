// Partyline rooms. One Durable Object per 4-letter room code.
//
// The game runs in the host's browser (the laptop). This object only:
//   - hands out room codes, each with a secret host key (POST /new);
//   - relays what phones do to the host ({t:"act"}), and what the host wants each phone to show ({t:"view"});
//   - remembers each phone's last screen and the host's saved game, so a refresh on either side picks up where it was;
//   - forgets the room 6 hours after the last message.
//
// Host socket:   GET /room/<CODE>/ws?role=host&key=<KEY>
// Phone socket:  GET /room/<CODE>/ws?role=player&pid=<PID>
import { DurableObject } from "cloudflare:workers";

interface Env { ROOM: DurableObjectNamespace<Room> }

const LETTERS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels: no words, no 0/O or 1/I mix-ups
const CODE = /^[A-Z]{4}$/;
const PID = /^[a-z0-9]{6,24}$/;
const IDLE_MS = 6 * 60 * 60 * 1000;
const MAX_PLAYER_MSG = 200_000; // a drawing fits easily; anything bigger is not a phone playing
const MAX_HOST_MSG = 1_000_000;

const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

function randomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(b, (x) => LETTERS[x % LETTERS.length]).join("");
}
function randomKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (x) => x.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "partyline-rooms" });

    if (url.pathname === "/new" && req.method === "POST") {
      for (let i = 0; i < 12; i++) {
        const code = randomCode();
        const key = randomKey();
        const ok = await env.ROOM.get(env.ROOM.idFromName(code)).claim(key);
        if (ok) return json({ code, key });
      }
      return json({ error: "No free room codes right now. Try again." }, 503);
    }

    const m = url.pathname.match(/^\/room\/([A-Za-z]{4})(\/ws|\/check)$/);
    if (!m) return json({ error: "Not found" }, 404);
    const code = m[1]!.toUpperCase();
    if (!CODE.test(code)) return json({ error: "Bad room code" }, 400);
    const stub = env.ROOM.get(env.ROOM.idFromName(code));
    if (m[2] === "/check") return json(await stub.info());
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return json({ error: "Expected a websocket" }, 426);
    return stub.fetch(req);
  },
};

type Tag = "host" | `p:${string}`;

export class Room extends DurableObject<Env> {
  /** A new room, or a room nobody has used for 6 hours, can be claimed with a fresh host key. */
  async claim(key: string): Promise<boolean> {
    const existing = await this.ctx.storage.get<string>("key");
    const last = (await this.ctx.storage.get<number>("last")) ?? 0;
    if (existing && Date.now() - last < IDLE_MS) return false;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put({ key, last: Date.now() });
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    return true;
  }

  async info(): Promise<{ open: boolean; host: boolean }> {
    const key = await this.ctx.storage.get<string>("key");
    return { open: !!key, host: this.ctx.getWebSockets("host").length > 0 };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const key = await this.ctx.storage.get<string>("key");
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const refuse = (error: string) => {
      this.ctx.acceptWebSocket(server, ["dead"]);
      server.send(JSON.stringify({ t: "error", error }));
      server.close(4000, error.slice(0, 100));
      return new Response(null, { status: 101, webSocket: client });
    };

    if (!key) return refuse("There's no room with that code. Check the code on the big screen.");

    if (role === "host") {
      if (url.searchParams.get("key") !== key) return refuse("This room belongs to another screen.");
      for (const old of this.ctx.getWebSockets("host")) old.close(4001, "Opened on another tab");
      this.ctx.acceptWebSocket(server, ["host"]);
      const players = this.ctx.getWebSockets().flatMap((ws) => this.tag(ws)?.startsWith("p:") ? [this.tag(ws)!.slice(2)] : []);
      const save = await this.ctx.storage.get("save");
      server.send(JSON.stringify({ t: "hello", online: [...new Set(players)], save: save ?? null }));
      this.toPlayers({ t: "host", online: true });
      await this.touch();
      return new Response(null, { status: 101, webSocket: client });
    }

    const pid = url.searchParams.get("pid") ?? "";
    if (role !== "player" || !PID.test(pid)) return refuse("Bad join link.");
    for (const old of this.ctx.getWebSockets(`p:${pid}`)) old.close(4001, "Opened on another tab");
    this.ctx.acceptWebSocket(server, [`p:${pid}`]);
    const view = await this.ctx.storage.get(`v:${pid}`);
    server.send(JSON.stringify({ t: "hello", host: this.ctx.getWebSockets("host").length > 0, view: view ?? null }));
    this.toHost({ t: "online", pid });
    await this.touch();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const tag = this.tag(ws);
    if (!tag || typeof raw !== "string") return;
    if (raw === "ping") { ws.send("pong"); return; }
    let msg: { t?: string; [k: string]: unknown };
    try { msg = JSON.parse(raw); } catch { return; }

    if (tag === "host") {
      if (raw.length > MAX_HOST_MSG) return;
      if (msg.t === "views" && msg.views && typeof msg.views === "object") {
        const views = msg.views as Record<string, unknown>;
        const puts: Record<string, unknown> = {};
        for (const [pid, view] of Object.entries(views)) {
          if (!PID.test(pid)) continue;
          puts[`v:${pid}`] = view;
          const out = JSON.stringify({ t: "view", view });
          for (const p of this.ctx.getWebSockets(`p:${pid}`)) p.send(out);
        }
        if (msg.save !== undefined) puts.save = msg.save;
        if (Object.keys(puts).length) await this.ctx.storage.put(puts);
      } else if (msg.t === "kick" && typeof msg.pid === "string") {
        for (const p of this.ctx.getWebSockets(`p:${msg.pid}`)) p.close(4002, "Removed by the host");
        await this.ctx.storage.delete(`v:${msg.pid}`);
      } else if (msg.t === "end") {
        this.toPlayers({ t: "ended" });
        for (const s of this.ctx.getWebSockets()) s.close(1000, "Room closed");
        await this.ctx.storage.deleteAll();
        return;
      }
      await this.touch();
      return;
    }

    if (tag.startsWith("p:")) {
      if (raw.length > MAX_PLAYER_MSG) { ws.send(JSON.stringify({ t: "error", error: "That was too big to send." })); return; }
      if (msg.t === "act") this.toHost({ t: "act", pid: tag.slice(2), a: msg.a });
      await this.touch();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const tag = this.tag(ws);
    if (tag === "host") { if (this.ctx.getWebSockets("host").filter((s) => s !== ws).length === 0) this.toPlayers({ t: "host", online: false }); }
    else if (tag?.startsWith("p:")) {
      const pid = tag.slice(2);
      if (this.ctx.getWebSockets(tag).filter((s) => s !== ws).length === 0) this.toHost({ t: "offline", pid });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> { await this.webSocketClose(ws); }

  async alarm(): Promise<void> {
    const last = (await this.ctx.storage.get<number>("last")) ?? 0;
    if (Date.now() - last >= IDLE_MS) {
      for (const s of this.ctx.getWebSockets()) s.close(1000, "Room expired");
      await this.ctx.storage.deleteAll();
    } else await this.ctx.storage.setAlarm(last + IDLE_MS);
  }

  private tag(ws: WebSocket): Tag | undefined { return this.ctx.getTags(ws)[0] as Tag | undefined; }
  private toHost(msg: unknown) { const s = JSON.stringify(msg); for (const h of this.ctx.getWebSockets("host")) h.send(s); }
  private toPlayers(msg: unknown) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) if (this.tag(ws)?.startsWith("p:")) ws.send(s);
  }
  private async touch() { await this.ctx.storage.put("last", Date.now()); }
}
