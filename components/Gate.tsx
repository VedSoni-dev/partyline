"use client";
// Sign in with publik in front of the big screen (/app). The landing and /join (phones) stay open. Signed in is enough
// (usesAi: false): the AI is picked separately in the mode pill, and the built-in decks work with no AI at all.
// Once open, the app renders inside <StudioProvider>, which counts usage for the builds hub and publik.
import Link from "next/link";
import type { ReactNode } from "react";
import { StudioProvider } from "@/kit/react/studio";
import { usePublikGate } from "@/kit/react/gate";
import type { GateAction } from "@/kit/ai/publik"; // types only
import { Mark } from "@/components/bits";
import config from "@/studio.config";

export function Gate({ children }: { children: ReactNode }) {
  const g = usePublikGate({ usesAi: false });
  if (g.open) return <StudioProvider>{children}</StudioProvider>;

  const shown = g.shown;
  const asking = g.signingIn || g.loading;
  const title = asking ? "Sign in to open the big screen" : shown?.screen.title ?? "Sign in with publik";
  const body = asking
    ? "Partyline is free. Sign in with publik once on the laptop that shows the game. Friends join from their phones with no sign-in."
    : shown?.screen.body ?? "";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-xl font-semibold"><Mark />Partyline</Link>
        <a href={config.app.repo} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm text-muted transition-colors duration-150 hover:text-fg">Open source</a>
      </header>
      <main className="mx-auto grid max-w-6xl gap-12 px-4 pb-24 pt-10 sm:px-6 sm:pt-20 lg:grid-cols-[1.2fr_1fr] lg:items-center" aria-busy={g.busy}>
        <section className="sk-stagger max-w-xl">
          <h1 className="text-4xl leading-[1.02] sm:text-6xl">{title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {g.loading && <span className="sk-btn inline-flex items-center opacity-70" aria-label="Loading"><span className="sk-spinner" aria-hidden /></span>}
            {g.needsInstall && <button type="button" className="sk-btn !min-h-12" disabled={g.busy} onClick={() => void g.provision()}>Sign in with publik</button>}
            {shown?.screen.buttons.map((b, i) => <GateButton key={b.action} action={b.action} label={b.label} primary={i === 0} href={g.hrefFor(b.action)} busy={g.busy} onAct={g.act} />)}
          </div>
          {g.note && (
            <p className="mt-5 flex items-center gap-2.5 text-sm text-muted" role="status">
              {g.waiting && <span className="sk-spinner" aria-hidden />}
              {g.note}
            </p>
          )}
          {g.signingIn && <p className="mt-5 text-sm text-muted">publik opens in a new tab the first time. Come back here once you&rsquo;re signed in.</p>}
          <noscript><p className="mt-5 text-sm text-muted">Turn on JavaScript to sign in with publik.</p></noscript>
        </section>
        <aside className="rounded-[var(--radius)] bg-card p-6">
          <p className="text-sm text-muted">Joining a game on a phone?</p>
          <Link href="/join" className="sk-btn sk-btn-quiet mt-3 !min-h-12 w-full">Join with a room code</Link>
          <ul className="mt-6 grid gap-2 border-t border-line pt-5 text-sm text-muted">
            <li>Three party games, 3 to 8 players, free.</li>
            <li>A free alternative to {config.app.alternativeTo} Party Packs. Open source, MIT.</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}

function GateButton({ action, label, primary, href, busy, onAct }: { action: GateAction; label: string; primary: boolean; href: string | null; busy: boolean; onAct: (a: GateAction) => Promise<void> }) {
  const cls = `sk-btn !min-h-12 ${primary ? "" : "sk-btn-quiet"}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} inline-flex items-center`}
        onClick={() => void onAct(action)} onAuxClick={(e) => { if (e.button === 1) void onAct(action); }}>{label}</a>
    );
  }
  return <button type="button" className={cls} disabled={busy} onClick={() => void onAct(action)}>{label}</button>;
}
