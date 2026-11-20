"use client";
// The big screen: the laptop or TV everyone looks at. One focal thing per stage (law 3); type sized from the viewport
// so it reads from the couch.
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ModeButton } from "@/kit/react/ModePanel";
import { useStudio } from "@/kit/react/studio";
import { Avatar, DrawingView, Mark, Timer, useNow } from "@/components/bits";
import { Engine, GAMES, scaleTimers, MAX_PLAYERS, MIN_PLAYERS, T, type Gain, type Option, type Player, type Stage, type State } from "@/lib/engine";
import { useEngineState, useHostRoom } from "@/lib/net";
import type { GameId } from "@/lib/protocol";

let scaled = false;
export function Host() {
  if (!scaled && typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    scaled = true;
    const f = Number(new URLSearchParams(window.location.search).get("fast"));
    if (f) scaleTimers(f);
  }
  const studio = useStudio();
  const aiOn = !!studio.status?.active;
  const room = useHostRoom(aiOn);
  const s = useEngineState(room.engine);
  const eng = room.engine;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="flex items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-xl font-semibold"><Mark />Partyline</Link>
        <div className="flex items-center gap-2">
          {s && s.stage.k !== "lobby" && room.code && <span className="hidden rounded-full border border-line px-4 py-2 font-mono text-sm text-muted sm:inline">Join: <b className="text-fg">{room.code}</b></span>}
          {s && "deadline" in s.stage && s.stage.k !== "intro" && <button type="button" className="sk-btn sk-btn-quiet" onClick={() => eng?.skip()}>Skip</button>}
          {s && s.stage.k !== "lobby" && <button type="button" className="sk-btn sk-btn-quiet" onClick={() => eng?.backToLobby()}>End game</button>}
          <ModeButton />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col px-5 sm:px-8">
        {room.error ? <Problem message={room.error} onRetry={room.retry} onNew={room.newRoom} />
          : !s || !eng || !room.code ? <Connecting status={room.status} />
          : <StageView s={s} eng={eng} code={room.code} aiOn={aiOn} />}
        {room.status === "reconnecting" && <p className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm" role="status"><span className="sk-spinner mr-2 inline-block align-middle" aria-hidden />Reconnecting…</p>}
      </main>

      {s && s.stage.k !== "lobby" && <PlayerStrip s={s} />}
    </div>
  );
}

function Connecting({ status }: { status: string }) {
  return <div className="grid flex-1 place-items-center"><p className="flex items-center gap-3 text-xl text-muted"><span className="sk-spinner" aria-hidden />{status === "reconnecting" ? "Reconnecting to your room…" : "Opening a room…"}</p></div>;
}
function Problem({ message, onRetry, onNew }: { message: string; onRetry: () => void; onNew: () => void }) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="sk-shake max-w-lg text-center">
        <h1 className="text-4xl">The room didn&rsquo;t open</h1>
        <p className="mt-4 text-lg text-muted" role="alert">{message}</p>
        <div className="mt-8 flex justify-center gap-3"><button type="button" className="sk-btn !min-h-12" onClick={onRetry}>Try again</button><button type="button" className="sk-btn sk-btn-quiet !min-h-12" onClick={onNew}>Open a new room</button></div>
      </div>
    </div>
  );
}

function StageView({ s, eng, code, aiOn }: { s: State; eng: Engine; code: string; aiOn: boolean }) {
  const st = s.stage;
  const name = (pid: string) => s.players.find((p) => p.pid === pid);
  switch (st.k) {
    case "lobby": return <Lobby s={s} eng={eng} code={code} aiOn={aiOn} />;
    case "loading": return <Center><p className="flex items-center gap-4 text-[clamp(20px,2.4vw,36px)] text-muted"><span className="sk-spinner" aria-hidden />{st.label}</p></Center>;
    case "intro": return (
      <Center>
        <p className="pl-slam font-mono text-[clamp(14px,1.4vw,20px)] uppercase tracking-[.2em] text-accent">{GAMES[s.game].title}</p>
        <h1 className="pl-slam mt-4 text-center text-[clamp(56px,10vw,180px)] leading-[.9]" style={{ animationDelay: "80ms" }}>{st.title}</h1>
        <p className="pl-slam mt-8 max-w-[34ch] text-center text-[clamp(20px,2.2vw,34px)] text-muted" style={{ animationDelay: "160ms" }}>{st.sub}</p>
      </Center>
    );
    case "cb-write": return (
      <Center>
        <Timer deadline={st.deadline} total={st.round === 3 ? T.finalWrite : T.write} size={110} />
        <h1 className="mt-8 text-center text-[clamp(44px,6vw,110px)] leading-[.95]">{st.round === 3 ? st.matches[0]!.prompt : "Answer on your phones"}</h1>
        <p className="mt-6 text-[clamp(18px,1.8vw,28px)] text-muted">{st.round === 3 ? "Everyone answers. Votes are worth triple." : `Round ${st.round}: two prompts each. ${st.round === 2 ? "Votes count double." : "Be funnier than your rival."}`}</p>
      </Center>
    );
    case "cb-vote": case "cb-result": {
      const m = st.matches[st.i]!;
      const result = st.k === "cb-result";
      const tally = (pid: string) => Object.values(st.votes).filter((v) => v === pid).length;
      const max = Math.max(...m.players.map(tally));
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] pb-4">
          <div className="flex w-full items-start justify-between gap-6">
            <p className="font-mono text-sm uppercase tracking-[.2em] text-muted">{st.round === 3 ? "The last word" : `Round ${st.round} · ${st.i + 1} of ${st.matches.length}`}</p>
            {!result && <Timer deadline={st.deadline} total={T.vote} size={72} />}
          </div>
          <h1 key={m.id} className="pl-slam max-w-[22ch] text-center text-[clamp(34px,4.6vw,84px)] leading-[1]">{m.prompt}</h1>
          <div className={`grid w-full gap-[2vw] ${m.players.length === 2 ? "max-w-6xl grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
            {m.players.map((pid, k) => {
              const p = name(pid);
              const n = tally(pid);
              const won = result && n === max && n > 0;
              const voters = Object.entries(st.votes).filter(([, v]) => v === pid).map(([vp]) => name(vp)).filter(Boolean) as Player[];
              return (
                <div key={pid} className={`pl-slam relative flex min-h-[22vh] flex-col justify-between rounded-[var(--radius)] p-[clamp(16px,2vw,32px)] transition-opacity duration-200 ${won ? "pl-ring bg-fg text-bg" : "bg-card"} ${result && !won ? "opacity-50" : ""}`} style={{ animationDelay: `${120 + k * 90}ms` }}>
                  <p className={`font-display leading-[1.05] ${m.players.length === 2 ? "text-[clamp(28px,3.6vw,64px)]" : "text-[clamp(20px,2.2vw,38px)]"}`}>{m.ans[pid] || <span className="opacity-50">No answer</span>}</p>
                  {result && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-lg font-semibold"><Avatar name={p?.name ?? "?"} color={p?.color ?? "#999"} size={32} />{p?.name}</span>
                      <span className="flex items-center gap-1.5">
                        {voters.map((v, j) => <span key={v.pid} className="pl-pop size-6 rounded-full ring-2 ring-bg" style={{ background: v.color, animationDelay: `${300 + j * 60}ms` }} title={v.name} />)}
                        <span className="ml-2 font-mono text-xl">{n}</span>
                      </span>
                    </div>
                  )}
                  {result && <GainTag gains={st.gains.filter((g) => g.pid === pid)} />}
                </div>
              );
            })}
          </div>
          {result && <HostLine s={s} />}
        </div>
      );
    }
    case "sk-draw": return (
      <Center>
        <Timer deadline={st.deadline} total={T.draw} size={110} />
        <h1 className="mt-8 text-center text-[clamp(44px,6vw,110px)] leading-[.95]">Draw on your phones</h1>
        <p className="mt-6 text-[clamp(18px,1.8vw,28px)] text-muted">Your prompt is secret. Everyone will try to guess it.</p>
      </Center>
    );
    case "bl-write": case "bl-pick": case "bl-result": return <Bluff s={s} />;
    case "scores": return <Scores s={s} st={st} />;
    case "podium": return <Podium s={s} eng={eng} />;
  }
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center pb-10">{children}</div>;
}

function GainTag({ gains }: { gains: Gain[] }) {
  if (!gains.length) return null;
  return (
    <div className="pl-pop absolute -top-4 right-5 flex gap-2" style={{ animationDelay: "500ms" }}>
      {gains.map((g, i) => <span key={i} className="rounded-full bg-accent px-3 py-1 font-mono text-sm font-medium text-accent-fg">+{g.pts} {g.why === "Clean sweep" ? "· Clean sweep" : ""}</span>)}
    </div>
  );
}

function HostLine({ s }: { s: State }) {
  if (!s.line) return <div className="h-14" />;
  return (
    <p key={s.line.id} className="pl-slam flex max-w-4xl items-center gap-3 rounded-full bg-card-2 px-6 py-3 text-[clamp(16px,1.6vw,24px)]">
      <Mark size={24} /><span>{s.line.text}</span>
    </p>
  );
}

// ---- bluff games (Fakeout, Sketchy) -------------------------------------------------------------------------------

function Bluff({ s }: { s: State }) {
  const st = s.stage as Extract<Stage, { k: "bl-write" | "bl-pick" | "bl-result" }>;
  const item = st.items[st.i]!;
  const sketch = st.game === "sketchy";
  const artist = item.artist ? s.players.find((p) => p.pid === item.artist) : null;
  const total = st.k === "bl-write" ? (sketch ? T.title : T.lie) : T.pick;
  const head = (
    <div className="flex w-full items-start justify-between gap-6">
      <p className="font-mono text-sm uppercase tracking-[.2em] text-muted">{sketch ? `Drawing ${st.i + 1} of ${st.items.length}${artist ? ` · by ${artist.name}` : ""}` : `Fact ${st.i + 1} of ${st.items.length}`}</p>
      {st.k !== "bl-result" && <Timer deadline={st.deadline} total={total} size={72} />}
    </div>
  );
  const fact = (big: boolean) => {
    const [a, b] = item.prompt.split("_____");
    const blank = st.k === "bl-result" ? <span className="text-accent">{item.truth}</span> : <span className="inline-block w-[4ch] border-b-[0.08em] border-accent align-baseline" />;
    return <h1 key={item.id} className={`pl-slam max-w-[24ch] text-center leading-[1.02] ${big ? "text-[clamp(40px,5.4vw,100px)]" : "text-[clamp(28px,3.4vw,60px)]"}`}>{a}{blank}{b}</h1>;
  };

  if (st.k === "bl-write") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] pb-6">
        {head}
        {sketch ? <DrawingView drawing={item.drawing ?? []} className="pl-slam h-[56vh] w-auto shadow-[var(--shadow-3)]" /> : fact(true)}
        <p className="text-[clamp(18px,1.8vw,28px)] text-muted">{sketch ? "What is this? Write a fake title on your phone." : "Write a lie on your phone. Make it believable."}</p>
      </div>
    );
  }
  const result = st.k === "bl-result";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] pb-4">
      {head}
      <div className={`flex w-full items-center justify-center gap-[3vw] ${sketch ? "flex-row" : "flex-col"}`}>
        {sketch ? <DrawingView drawing={item.drawing ?? []} className="h-[52vh] w-auto shrink-0 shadow-[var(--shadow-3)]" /> : fact(false)}
        <div className={`grid w-full gap-3 ${sketch ? "max-w-2xl grid-cols-1" : "max-w-6xl grid-cols-2 lg:grid-cols-3"}`}>
          {st.options.map((o, k) => <OptionCard key={o.id} o={o} k={k} s={s} result={result} picks={st.picks} />)}
        </div>
      </div>
      {result && <HostLine s={s} />}
    </div>
  );
}

function OptionCard({ o, k, s, result, picks }: { o: Option; k: number; s: State; result: boolean; picks: Record<string, string> }) {
  const by = (pid: string) => s.players.find((p) => p.pid === pid);
  const pickers = Object.entries(picks).filter(([, x]) => x === o.id).map(([pid]) => by(pid)).filter(Boolean) as Player[];
  const delay = result ? (o.truth ? 200 + s.players.length * 0 + 900 : 120 + k * 80) : 80 + k * 60;
  return (
    <div className={`pl-slam relative flex min-h-16 flex-col justify-center rounded-[var(--radius-sm)] px-5 py-3 ${result && o.truth ? "pl-ring bg-fg text-bg" : "bg-card"} ${result && !o.truth && !pickers.length ? "opacity-45" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[clamp(18px,1.9vw,32px)] leading-tight">{o.text}</span>
        {result && <span className={`shrink-0 font-mono text-xs uppercase tracking-[.16em] ${o.truth ? "text-accent" : "text-muted"}`}>{o.truth ? "The truth" : o.owners.length ? `Lie by ${o.owners.map((x) => by(x)?.name).join(", ")}` : "House lie"}</span>}
      </div>
      {result && pickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pickers.map((p, j) => <span key={p.pid} className="pl-pop flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium text-[#0d060b]" style={{ background: p.color, animationDelay: `${delay + 200 + j * 60}ms` }}>{p.name}</span>)}
        </div>
      )}
    </div>
  );
}

// ---- scores --------------------------------------------------------------------------------------------------------

function Scores({ s, st }: { s: State; st: Extract<Stage, { k: "scores" }> }) {
  const ranked = [...s.players].filter((p) => !p.sitOut).sort((a, b) => b.score - a.score);
  const top = Math.max(1, ...ranked.map((p) => p.score));
  const now = useNow(50);
  const t = Math.min(1, (now - (st.deadline - T.scores) - 400) / 1200);
  const ease = t <= 0 ? 0 : 1 - Math.pow(1 - t, 3);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 pb-8">
      <h1 className="pl-slam text-[clamp(40px,5vw,88px)] leading-none">{st.label}</h1>
      <ol className="sk-stagger grid gap-2.5">
        {ranked.map((p, i) => {
          const from = st.before[p.pid] ?? 0;
          const shown = Math.round(from + (p.score - from) * ease);
          return (
            <li key={p.pid} className="flex items-center gap-4 rounded-[var(--radius-sm)] bg-card px-4 py-2.5">
              <span className="w-8 font-mono text-lg text-muted">{i + 1}</span>
              <Avatar name={p.name} color={p.color} size={38} />
              <span className="w-40 truncate text-xl font-semibold">{p.name}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-bg"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(shown / top) * 100}%`, background: p.color }} /></span>
              <span className="w-24 text-right font-mono text-xl tabular-nums">{shown.toLocaleString()}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Podium({ s, eng }: { s: State; eng: Engine }) {
  const ranked = [...s.players].filter((p) => !p.sitOut).sort((a, b) => b.score - a.score);
  const [first, second, third] = ranked;
  const order = [second, first, third].filter(Boolean) as Player[];
  const h = (p: Player) => (p === first ? "38vh" : p === second ? "26vh" : "18vh");
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-8 pb-6">
      <h1 className="pl-slam text-center text-[clamp(44px,6vw,110px)] leading-none">{!first ? "Game over" : second && second.score === first.score ? `It's a tie: ${ranked.filter((p) => p.score === first.score).map((p) => p.name).join(" and ")}` : `${first.name} wins`}</h1>
      <div className="flex items-end gap-[2vw]">
        {order.map((p, k) => (
          <div key={p.pid} className="flex w-[18vw] min-w-36 flex-col items-center gap-3">
            <Avatar name={p.name} color={p.color} size={p === first ? 88 : 64} />
            <span className="text-xl font-semibold">{p.name}</span>
            <span className="font-mono text-muted">{p.score.toLocaleString()}</span>
            <div className={`pl-slam w-full rounded-t-[var(--radius)] ${p === first ? "pl-ring" : ""}`} style={{ height: h(p), background: p.color, animationDelay: `${(2 - k) * 120 + 200}ms`, position: "relative" }} />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" className="sk-btn !min-h-14 !px-8 !text-lg" onClick={() => { eng.backToLobby(); setTimeout(() => void eng.begin(), 50); }}>Play {GAMES[s.game].title} again</button>
        <button type="button" className="sk-btn sk-btn-quiet !min-h-14 !px-8 !text-lg" onClick={() => eng.backToLobby()}>Pick another game</button>
      </div>
    </div>
  );
}

// ---- who's done ----------------------------------------------------------------------------------------------------

function doneSet(s: State): Set<string> {
  const st = s.stage, out = new Set<string>();
  if (st.k === "cb-write") for (const p of s.players) { const mine = st.matches.filter((m) => m.players.includes(p.pid)); if (mine.length && mine.every((m) => m.ans[p.pid])) out.add(p.pid); }
  if (st.k === "cb-vote") for (const pid of Object.keys(st.votes)) out.add(pid);
  if (st.k === "sk-draw") for (const it of st.items) if (it.drawing) out.add(it.artist!);
  if (st.k === "bl-write") for (const pid of Object.keys(st.lies)) out.add(pid);
  if (st.k === "bl-pick") for (const pid of Object.keys(st.picks)) out.add(pid);
  return out;
}

function PlayerStrip({ s }: { s: State }) {
  const done = doneSet(s);
  const acting = ["cb-write", "cb-vote", "sk-draw", "bl-write", "bl-pick"].includes(s.stage.k);
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 px-5 pb-4 pt-2">
      {s.players.filter((p) => !p.sitOut).map((p) => (
        <span key={p.pid} className={`flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-4 transition-transform duration-150 ${done.has(p.pid) ? "-translate-y-0.5" : ""}`}>
          <Avatar name={p.name} color={p.color} size={30} dim={!p.online && !p.bot} />
          <span className={`text-base font-medium ${!p.online && !p.bot ? "text-muted line-through" : ""}`}>{p.name}</span>
          {acting && done.has(p.pid) && <svg viewBox="0 0 16 16" width="16" height="16" className="pl-pop text-ok" aria-label="done"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      ))}
    </footer>
  );
}

// ---- lobby ---------------------------------------------------------------------------------------------------------

function Lobby({ s, eng, code, aiOn }: { s: State; eng: Engine; code: string; aiOn: boolean }) {
  const studio = useStudio();
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const joinUrl = origin ? `${origin}/join?code=${code}` : "";
  useEffect(() => { if (joinUrl) void QRCode.toString(joinUrl, { type: "svg", margin: 0, color: { dark: "#0d060bff", light: "#ffffffff" } }).then(setQr); }, [joinUrl]);
  const localOnly = /\/\/(localhost|127\.0\.0\.1)/.test(origin);
  const players = s.players.filter((p) => !p.sitOut);
  const need = Math.max(0, MIN_PLAYERS - players.filter((p) => p.bot || p.online).length);
  const host = origin.replace(/^https?:\/\//, "");

  return (
    <div className="grid min-h-0 flex-1 gap-[3vw] pb-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="flex min-h-0 flex-col justify-center" aria-label="How to join">
        <p className="text-[clamp(18px,1.8vw,28px)] text-muted">On your phone, go to <b className="text-fg">{host || "…"}/join</b> and type</p>
        <p className="mt-2 font-mono text-[clamp(96px,15vw,260px)] font-medium leading-[.9] tracking-[.06em]" aria-label={`Room code ${code.split("").join(" ")}`}>{code}</p>
        <div className="mt-[4vh] flex items-center gap-5">
          <div className="size-[clamp(96px,10vw,150px)] shrink-0 rounded-[var(--radius-sm)] bg-white p-2.5 [&_svg]:h-full [&_svg]:w-full" role="img" aria-label="QR code to join" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="max-w-[26ch] text-[clamp(15px,1.3vw,20px)] text-muted">Or scan this with your phone camera.{localOnly && <span className="mt-2 block text-accent">This page is on localhost, so phones can&rsquo;t reach it. Open it at this computer&rsquo;s network address instead.</span>}</p>
        </div>
      </section>

      <section className="flex min-h-0 flex-col justify-center gap-5" aria-label="Game setup">
        <div role="radiogroup" aria-label="Game" className="grid gap-2.5">
          {(Object.keys(GAMES) as GameId[]).map((g) => {
            const on = s.game === g;
            return (
              <button key={g} type="button" role="radio" aria-checked={on} onClick={() => eng.setGame(g)}
                className={`group flex items-center gap-4 rounded-[var(--radius-sm)] border px-5 py-3.5 text-left transition-[transform,background-color,border-color] duration-150 hover:-translate-y-0.5 active:scale-[.98] ${on ? "border-accent bg-card-2" : "border-line bg-card hover:border-white/25"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-accent" : "border-white/30"}`}>{on && <span className="pl-pop size-3 rounded-full bg-accent" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-3"><span className="font-display text-2xl">{GAMES[g].title}</span><span className="text-sm text-muted">{GAMES[g].kind}</span></span>
                  {on && <span className="mt-1 block text-[15px] leading-snug text-muted">{GAMES[g].blurb}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">
          <div role="radiogroup" aria-label="Tone" className="flex rounded-full bg-card p-1">
            {(["clean", "spicy"] as const).map((sp) => (
              <button key={sp} type="button" role="radio" aria-checked={s.spice === sp} onClick={() => eng.setSpice(sp)} className={`min-h-10 rounded-full px-4 transition-colors duration-150 ${s.spice === sp ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>{sp === "clean" ? "Family friendly" : "Adults only"}</button>
            ))}
          </div>
          {aiOn
            ? <span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-ok" aria-hidden />AI writes fresh prompts every round</span>
            : <button type="button" className="sk-link min-h-10 text-muted underline decoration-white/30 underline-offset-4 hover:text-fg" onClick={() => studio.openPicker()}>Using the built-in decks. Turn on AI for fresh prompts</button>}
        </div>

        <div className="rounded-[var(--radius)] bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Players <span className="font-mono text-muted">{players.length}/{MAX_PLAYERS}</span></h2>
            <button type="button" className="sk-btn sk-btn-quiet !min-h-10" onClick={() => eng.addBot()} disabled={s.players.length >= MAX_PLAYERS}>Add a bot</button>
          </div>
          {players.length === 0 ? <p className="py-4 text-center text-muted">Waiting for phones to join…</p> : (
            <ul className="flex flex-wrap gap-2">
              {players.map((p) => (
                <li key={p.pid} className="pl-pop flex items-center gap-2 rounded-full bg-bg py-1 pl-1 pr-1.5">
                  <Avatar name={p.name} color={p.color} size={30} dim={!p.online} />
                  <span className="font-medium">{p.name}{p.bot && <span className="ml-1.5 text-xs text-muted">bot</span>}</span>
                  <button type="button" className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-fg" aria-label={`Remove ${p.name}`} onClick={() => eng.remove(p.pid)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" className="sk-btn !min-h-16 w-full !text-xl" disabled={!eng.canStart} onClick={() => void eng.begin()}>
          {need > 0 ? `Need ${need} more player${need === 1 ? "" : "s"}` : players.every((p) => p.bot || !p.online) ? "Someone has to join on a phone" : `Start ${GAMES[s.game].title}`}
        </button>
      </section>
    </div>
  );
}

