"use client";
// Small pieces both screens use: the mark, the countdown, a drawing, a player chip.
import { useEffect, useState } from "react";
import type { Drawing } from "@/lib/protocol";
import { INKS } from "@/lib/protocol";

export function Mark({ size = 26 }: { size?: number }) {
  // Two speech bubbles on one line: people talking over each other.
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="2" y="6" width="17" height="13" rx="6.5" fill="var(--accent)" />
      <path d="M7 18.5 5 24l6-4.8" fill="var(--accent)" />
      <rect x="13" y="12" width="17" height="13" rx="6.5" fill="#fff" />
      <path d="M25 24.5 27 30l-6-4.8" fill="#fff" />
    </svg>
  );
}

export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Seconds left as a ring. Turns accent under 10 s (the one place the accent means "hurry"). */
export function Timer({ deadline, total, size = 64 }: { deadline: number; total: number; size?: number }) {
  const now = useNow();
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const frac = Math.max(0, Math.min(1, left / total));
  const r = 26, c = 2 * Math.PI * r;
  const low = secs <= 10;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`${secs} seconds left`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={low ? "var(--accent)" : "#fff"} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 250ms linear" }} />
      </svg>
      <span className={`font-mono font-medium tabular-nums ${low ? "text-accent" : ""}`} style={{ fontSize: size * 0.34 }}>{secs}</span>
    </div>
  );
}

/** A phone drawing, drawn as SVG paths on a white card. */
export function DrawingView({ drawing, className = "" }: { drawing: Drawing; className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={`block aspect-square rounded-[var(--radius)] bg-white ${className}`} role="img" aria-label="A player's drawing">
      {drawing.map((s, i) => <path key={i} d={pathOf(s.p)} fill="none" stroke={INKS[s.c] ?? INKS[0]} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
export function pathOf(p: number[]): string {
  if (p.length < 2) return "";
  if (p.length === 2) return `M${p[0]} ${p[1]}l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  // Smooth through midpoints (quadratic), so finger strokes don't look jagged.
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i]! + p[i + 2]!) / 2, my = (p[i + 1]! + p[i + 3]!) / 2;
    d += `Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  d += `L${p[p.length - 2]} ${p[p.length - 1]}`;
  return d;
}

export function Avatar({ name, color, size = 40, dim = false }: { name: string; color: string; size?: number; dim?: boolean }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-[#0d060b]" style={{ width: size, height: size, background: color, fontSize: size * 0.42, opacity: dim ? 0.35 : 1 }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
