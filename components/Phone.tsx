"use client";
// The phone: a controller. One action per screen, the main button in the bottom third (law 13), no scrolling while
// writing. It never repeats what the big screen shows, so eyes stay up.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, Mark, Timer, pathOf } from "@/components/bits";
import { usePhone } from "@/lib/net";
import { CODE_RE, INKS, cleanCode, cleanName, type Action, type Drawing, type Stroke, type View } from "@/lib/protocol";

type Send = (a: Action) => boolean;

const NAME_KEY = "partyline:name";

export function Phone({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => { setName(localStorage.getItem(NAME_KEY) ?? ""); }, []);

  if (!code) return <JoinForm initialCode={initialCode} name={name} setName={setName} onJoin={(c, n) => { localStorage.setItem(NAME_KEY, n); setName(n); setCode(c); }} />;
  return <InRoom code={code} name={name} onLeave={() => setCode(null)} />;
}

function Shell({ children, code, me }: { children: React.ReactNode; code?: string; me?: { name: string; color: string } }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-display text-lg font-semibold"><Mark size={22} />Partyline</Link>
        <div className="flex items-center gap-2">
          {code && <span className="rounded-full border border-line px-3 py-1.5 font-mono text-sm">{code}</span>}
          {me && <span className="flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-medium"><Avatar name={me.name} color={me.color} size={24} />{me.name}</span>}
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 pb-4">{children}</main>
    </div>
  );
}

function JoinForm({ initialCode, name, setName, onJoin }: { initialCode: string; name: string; setName: (n: string) => void; onJoin: (code: string, name: string) => void }) {
  const [code, setCode] = useState(cleanCode(initialCode));
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (CODE_RE.test(code)) nameRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = cleanCode(code), n = cleanName(name);
    if (!CODE_RE.test(c)) return setErr("The room code is the 4 letters on the big screen.");
    if (!n) return setErr("Add a name so people know who's funny.");
    onJoin(c, n);
  };
  return (
    <Shell>
      <form onSubmit={submit} className="flex flex-1 flex-col pt-[6vh]" noValidate>
        <h1 className="text-[40px] leading-[1]">Join the game</h1>
        <p className="mt-3 text-muted">Type the code on the big screen.</p>
        <label className="mt-8 block text-sm font-medium" htmlFor="code">Room code</label>
        <input id="code" value={code} onChange={(e) => { setCode(cleanCode(e.target.value)); setErr(null); }} inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={6} placeholder="ABCD"
          className="mt-2 h-20 w-full rounded-[var(--radius-sm)] border border-line bg-card px-5 font-mono text-[44px] uppercase tracking-[.3em] outline-none placeholder:text-white/15 focus:border-accent focus:shadow-[var(--focus)]" />
        <label className="mt-5 block text-sm font-medium" htmlFor="name">Your name</label>
        <input id="name" ref={nameRef} value={name} onChange={(e) => { setName(e.target.value.slice(0, 12)); setErr(null); }} autoComplete="nickname" maxLength={12} placeholder="12 letters max"
          className="mt-2 h-14 w-full rounded-[var(--radius-sm)] border border-line bg-card px-5 text-xl outline-none placeholder:text-white/25 focus:border-accent focus:shadow-[var(--focus)]" />
        {err && <p className="sk-shake mt-4 text-danger" role="alert">{err}</p>}
        <div className="mt-auto pt-8"><button type="submit" className="sk-btn !min-h-14 w-full !text-lg">Join</button></div>
      </form>
    </Shell>
  );
}

function InRoom({ code, name, onLeave }: { code: string; name: string; onLeave: () => void }) {
  const { view, status, hostOnline, error, send } = usePhone(code);
  const joined = useRef(false);
  useEffect(() => { if (status === "open") { joined.current = true; send({ type: "join", name }); } }, [status, name, send]);
  // Only some views carry your name and colour; keep the last one so the header chip stays put.
  const meRef = useRef<{ name: string; color: string } | undefined>(undefined);
  if (view && "name" in view && view.name && "color" in view && view.color) meRef.current = { name: view.name, color: view.color };
  const me = meRef.current;

  let body: React.ReactNode;
  if (error) body = (
    <Center>
      <h1 className="sk-shake text-[34px] leading-tight">{error.startsWith("There's no room") ? "No room with that code" : "You're out of the room"}</h1>
      <p className="mt-3 text-muted" role="alert">{error}</p>
      <Bottom><button type="button" className="sk-btn !min-h-14 w-full !text-lg" onClick={onLeave}>Try another code</button></Bottom>
    </Center>
  );
  else if (!view) body = <Center><p className="flex items-center gap-3 text-muted"><span className="sk-spinner" aria-hidden />{status === "reconnecting" ? "Reconnecting…" : "Joining…"}</p></Center>;
  else body = <ViewScreen view={view} send={send} />;

  return (
    <Shell code={code} me={me}>
      {(!hostOnline || status === "reconnecting") && !error && (
        <p className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-card px-4 py-3 text-sm" role="status"><span className="sk-spinner" aria-hidden />{status === "reconnecting" ? "Reconnecting to the room…" : "Waiting for the big screen to come back…"}</p>
      )}
      {body}
    </Shell>
  );
}

function Center({ children }: { children: React.ReactNode }) { return <div className="flex flex-1 flex-col justify-center pb-2">{children}</div>; }
function Bottom({ children }: { children: React.ReactNode }) { return <div className="mt-auto pt-6">{children}</div>; }

function ViewScreen({ view, send }: { view: View; send: Send }) {
  switch (view.s) {
    case "lobby": return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="pl-pop"><Avatar name={view.name} color={view.color} size={112} /></span>
          <h1 className="mt-6 text-[40px] leading-none">You&rsquo;re in, {view.name}</h1>
          <p className="mt-3 text-muted">{view.players} {view.players === 1 ? "player" : "players"} in the room. Look at the big screen.</p>
        </div>
        {view.first
          ? <Bottom><button type="button" className="sk-btn !min-h-14 w-full !text-lg" disabled={view.players < 3} onClick={() => send({ type: "start" })}>{view.players < 3 ? "Waiting for 3 players" : "Everyone's in. Start"}</button><p className="mt-3 text-center text-sm text-muted">You joined first, so you can start the game.</p></Bottom>
          : <Bottom><p className="text-center text-muted">The first player or the big screen starts the game.</p></Bottom>}
      </div>
    );
    case "wait": return (
      <Center>
        <div className="text-center">
          <h1 key={view.title} className="pl-slam text-[38px] leading-[1.05]">{view.title}</h1>
          {view.body && <p className="mt-4 text-lg text-muted">{view.body}</p>}
        </div>
      </Center>
    );
    case "write": return <Write key={view.items[0]?.id ?? "x"} view={view} send={send} />;
    case "draw": return <DrawPad key={view.id} view={view} send={send} />;
    case "choose": return <Choose key={view.id + view.title} view={view} send={send} />;
    case "end": return (
      <Center>
        <div className="text-center">
          <span className="pl-pop inline-block"><Avatar name={view.name} color={view.color} size={96} /></span>
          <h1 className="mt-6 text-[44px] leading-none">{view.place === 1 ? "You won!" : `${ordinal(view.place)} of ${view.of}`}</h1>
          <p className="mt-3 font-mono text-xl text-muted">{view.score.toLocaleString()} points</p>
          <p className="mt-8 text-muted">The big screen picks what&rsquo;s next.</p>
        </div>
      </Center>
    );
  }
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

function Write({ view, send }: { view: Extract<View, { s: "write" }>; send: Send }) {
  const item = view.items[0]!;
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const error = view.errorFor === item.id ? view.error : undefined;
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (error) { setSent(false); ref.current?.focus(); } }, [error]);
  const total = view.kind === "answer" ? (view.hint ? 60_000 : 80_000) : view.kind === "title" ? 40_000 : 45_000;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || sent) return;
    setSent(true);
    send({ type: "answer", id: item.id, text: t });
  };
  const label = view.kind === "lie" ? "Your lie" : view.kind === "title" ? "Your fake title" : "Your answer";
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 pt-2">
        <p className="text-sm text-muted">{view.kind === "answer" ? (view.items.length > 1 ? `${view.items.length} prompts left` : view.hint ?? "Last prompt") : view.kind === "lie" ? "Fool everyone" : "Make it believable"}</p>
        <Timer deadline={view.deadline} total={total} size={52} />
      </div>
      <h1 className="mt-3 text-[clamp(26px,7.5vw,34px)] leading-[1.1]">{item.prompt}</h1>
      <label htmlFor="ans" className="sr-only">{label}</label>
      <textarea id="ans" ref={ref} value={text} onChange={(e) => setText(e.target.value.slice(0, view.max))} rows={3} maxLength={view.max} placeholder={label} enterKeyHint="send"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(e); } }}
        className={`mt-5 w-full resize-none rounded-[var(--radius-sm)] border bg-card px-4 py-3.5 text-xl outline-none placeholder:text-white/25 focus:shadow-[var(--focus)] ${error ? "sk-shake border-danger" : "border-line focus:border-accent"}`} />
      <div className="mt-2 flex justify-between text-sm"><span className="text-danger" role="alert">{error}</span><span className="font-mono text-muted">{text.length}/{view.max}</span></div>
      <Bottom><button type="submit" className="sk-btn !min-h-14 w-full !text-lg" disabled={!text.trim() || sent}>{sent ? <span className="sk-spinner" aria-label="Sending" /> : "Send"}</button></Bottom>
    </form>
  );
}

function Choose({ view, send }: { view: Extract<View, { s: "choose" }>; send: Send }) {
  const [mine, setMine] = useState<string | undefined>(view.picked);
  useEffect(() => { setMine(view.picked); }, [view.picked]);
  const pick = (id: string) => { setMine(id); send({ type: "choose", id: view.id, option: id }); };
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 pt-2">
        <h1 className="text-[30px] leading-tight">{view.title}</h1>
        <Timer deadline={view.deadline} total={20_000} size={52} />
      </div>
      {view.note && <p className="mt-2 text-sm text-muted">{view.note}</p>}
      <div className="sk-stagger mt-5 grid gap-2.5" role="radiogroup" aria-label={view.title}>
        {view.options.map((o) => {
          const on = mine === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => pick(o.id)}
              className={`flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-sm)] border px-5 py-3 text-left text-xl transition-[transform,background-color,border-color] duration-120 active:scale-[.98] ${on ? "border-accent bg-accent text-accent-fg" : "border-line bg-card"}`}>
              <span className="leading-snug">{o.text}</span>
              {on && <svg viewBox="0 0 16 16" width="22" height="22" className="pl-pop shrink-0" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          );
        })}
      </div>
      {mine && <p className="mt-4 text-center text-sm text-muted">Locked in. Tap another to change your mind.</p>}
    </div>
  );
}

function DrawPad({ view, send }: { view: Extract<View, { s: "draw" }>; send: Send }) {
  const [strokes, setStrokes] = useState<Drawing>([]);
  const [ink, setInk] = useState(0);
  const [thick, setThick] = useState(false);
  const [sent, setSent] = useState(false);
  const live = useRef<Stroke | null>(null);
  const [, force] = useState(0);
  const box = useRef<SVGSVGElement>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const submit = () => {
    if (sent) return;
    setSent(true);
    send({ type: "draw", id: view.id, drawing: strokesRef.current });
  };
  // Time's up: send what's there a moment before the big screen moves on.
  useEffect(() => {
    const t = setTimeout(() => { if (strokesRef.current.length) submit(); }, Math.max(0, view.deadline - Date.now() - 1200));
    return () => clearTimeout(t);
  }, [view.deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  const pt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)].map((n) => Math.max(0, Math.min(1000, n))) as [number, number];
  };
  const down = (e: React.PointerEvent) => { if (sent) return; (e.target as Element).setPointerCapture(e.pointerId); live.current = { c: ink, w: thick ? 34 : 12, p: pt(e) }; force((n) => n + 1); };
  const move = (e: React.PointerEvent) => {
    const s = live.current; if (!s) return;
    const [x, y] = pt(e); const lx = s.p[s.p.length - 2]!, ly = s.p[s.p.length - 1]!;
    if (Math.hypot(x - lx, y - ly) < 6) return;
    s.p.push(x, y); force((n) => n + 1);
  };
  const up = () => { const s = live.current; if (!s) return; live.current = null; setStrokes((a) => [...a, s]); };

  const all = live.current ? [...strokes, live.current] : strokes;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 pt-1">
        <div><p className="text-sm text-muted">Draw this. It&rsquo;s secret.</p><h1 className="mt-1 text-[26px] leading-tight">{view.prompt}</h1></div>
        <Timer deadline={view.deadline} total={75_000} size={52} />
      </div>
      <svg ref={box} viewBox="0 0 1000 1000" className={`mt-3 aspect-square w-full touch-none select-none rounded-[var(--radius-sm)] bg-white ${sent ? "opacity-60" : ""}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Drawing pad">
        {all.map((s, i) => <path key={i} d={pathOf(s.p)} fill="none" stroke={INKS[s.c]} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Ink">
          {INKS.map((c, i) => <button key={c} type="button" role="radio" aria-checked={ink === i} aria-label={["Black", "Pink", "Blue", "Yellow"][i]} onClick={() => setInk(i)} className={`grid size-11 place-items-center rounded-full ${ink === i ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}><span className="size-7 rounded-full border border-white/30" style={{ background: c }} /></button>)}
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="sk-btn sk-btn-quiet !px-3" aria-pressed={thick} onClick={() => setThick((t) => !t)}>{thick ? "Thick" : "Thin"}</button>
          <button type="button" className="sk-btn sk-btn-quiet !px-3" disabled={!strokes.length || sent} onClick={() => setStrokes((a) => a.slice(0, -1))}>Undo</button>
        </div>
      </div>
      <Bottom><button type="button" className="sk-btn !min-h-14 w-full !text-lg" disabled={!strokes.length || sent} onClick={submit}>{sent ? "Sent" : "Done drawing"}</button></Bottom>
    </div>
  );
}
