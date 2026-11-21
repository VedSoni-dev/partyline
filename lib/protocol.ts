// What travels between the big screen (host) and the phones, through the rooms worker.
// The host runs the game; phones only send actions and draw the view the host gives them.

export type GameId = "comeback" | "fakeout" | "sketchy";

/** A drawing: strokes of points on a 1000 × 1000 board. */
export interface Stroke { c: number; w: number; p: number[] } // c: colour index, w: width, p: x0,y0,x1,y1…
export type Drawing = Stroke[];
export const INKS = ["#14110f", "#ff488b", "#2b8cff", "#ffb020"] as const;

/** What a phone shows. */
export type View =
  | { s: "lobby"; name: string; color: string; players: number; first: boolean }
  | { s: "wait"; title: string; body?: string; name?: string; color?: string }
  | { s: "write"; kind: "answer" | "lie" | "title"; items: { id: string; prompt: string }[]; deadline: number; max: number; error?: string; errorFor?: string; hint?: string }
  | { s: "draw"; id: string; prompt: string; deadline: number }
  | { s: "choose"; id: string; title: string; options: { id: string; text: string }[]; deadline: number; picked?: string; note?: string }
  | { s: "end"; place: number; of: number; score: number; name: string; color: string };

/** What a phone sends. */
export type Action =
  | { type: "join"; name: string }
  | { type: "answer"; id: string; text: string }
  | { type: "draw"; id: string; drawing: Drawing }
  | { type: "choose"; id: string; option: string }
  | { type: "start" };

/** Socket messages. */
export type ToHost =
  | { t: "hello"; online: string[]; save: unknown }
  | { t: "online" | "offline"; pid: string }
  | { t: "act"; pid: string; a: Action }
  | { t: "error"; error: string };
export type ToPhone =
  | { t: "hello"; host: boolean; view: View | null }
  | { t: "view"; view: View }
  | { t: "host"; online: boolean }
  | { t: "ended" }
  | { t: "error"; error: string };

/** Partyline's own rooms worker. A fork deploys rooms/ and sets NEXT_PUBLIC_ROOMS_URL to its own. */
const HOSTED_ROOMS = "https://partyline-rooms.vedantn06soni.workers.dev";
export function roomsUrl(): string {
  const env = process.env.NEXT_PUBLIC_ROOMS_URL;
  if (env) return env.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:8787";
  const h = window.location.hostname;
  // Local dev (this machine, or its address on the Wi-Fi): the worker from `npm run rooms`. Anywhere else: the hosted one.
  if (h === "localhost" || /^(\d+\.){3}\d+$/.test(h) || h.endsWith(".local")) return `${window.location.protocol}//${h}:8787`;
  return HOSTED_ROOMS;
}
export const wsUrl = (path: string) => roomsUrl().replace(/^http/, "ws") + path;

export const CODE_RE = /^[A-Z]{4}$/;
/** Room codes skip vowels; accept what people type (lowercase, spaces, O for 0). */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
}
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 12);
}
