// The game, run by the big screen. Phones send actions; this decides what happens and what every phone shows.
// State is plain JSON so the rooms worker can keep a copy and a refreshed big screen resumes mid-round.
import { BOT_ANSWERS, BOT_LIES, BOT_TITLES, COMEBACK, FAKEOUT, SKETCHY, draw, shuffle } from "./decks";
import type { Action, Drawing, GameId, View } from "./protocol";
import { cleanName } from "./protocol";

export type Spice = "clean" | "spicy";
export const PLAYER_COLORS = ["#ffb020", "#3ddc97", "#5ab9fc", "#ff7a45", "#c6f432", "#4de1e1", "#ff8a80", "#e8d3a8"];
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
const BOT_NAMES = ["Botley", "Unit 7", "Gizmo", "Sprocket", "Pixel", "Toaster"];

export const T = {
  intro: 4_500, write: 80_000, finalWrite: 60_000, vote: 20_000, cbResult: 6_500,
  lie: 45_000, title: 40_000, pick: 20_000, bluffResult: 9_000, draw: 75_000, scores: 7_000, aiTimeout: 9_000,
};

/** Testing only (\`/app?fast=0.25\` in dev): scale every timer. */
export function scaleTimers(f: number) { if (f > 0 && f < 1) for (const k of Object.keys(T) as (keyof typeof T)[]) if (k !== "aiTimeout") T[k] = Math.round(T[k] * f); }

export const GAMES: Record<GameId, { title: string; kind: string; blurb: string; players: string; minutes: string }> = {
  comeback: { title: "Comeback", kind: "Funny answers, then a vote", blurb: "Two of you answer the same prompt. Everyone else votes for the funnier one.", players: "3–8 players", minutes: "15 min" },
  fakeout: { title: "Fakeout", kind: "Bluff the answer", blurb: "A weird true fact with a blank. Write a lie good enough to fool your friends, then find the truth.", players: "3–8 players", minutes: "12 min" },
  sketchy: { title: "Sketchy", kind: "Draw and guess", blurb: "Draw something strange on your phone. Everyone invents a fake title. Who can spot the real one?", players: "3–8 players", minutes: "15 min" },
};

export interface Player { pid: string; name: string; color: string; score: number; online: boolean; bot?: boolean; sitOut?: boolean }
export interface Match { id: string; prompt: string; players: string[]; ans: Record<string, string> }
export interface BluffItem { id: string; prompt: string; truth: string; also: string[]; artist?: string; drawing?: Drawing }
export interface Option { id: string; text: string; owners: string[]; truth: boolean }
export interface Gain { pid: string; pts: number; why: string }

export type Stage =
  | { k: "lobby" }
  | { k: "loading"; label: string }
  | { k: "intro"; title: string; sub: string; deadline: number; then: Stage }
  | { k: "cb-write"; round: number; matches: Match[]; deadline: number }
  | { k: "cb-vote"; round: number; matches: Match[]; i: number; votes: Record<string, string>; deadline: number }
  | { k: "cb-result"; round: number; matches: Match[]; i: number; votes: Record<string, string>; gains: Gain[]; deadline: number }
  | { k: "sk-draw"; items: BluffItem[]; deadline: number }
  | { k: "bl-write"; game: "fakeout" | "sketchy"; items: BluffItem[]; i: number; lies: Record<string, string>; deadline: number }
  | { k: "bl-pick"; game: "fakeout" | "sketchy"; items: BluffItem[]; i: number; lies: Record<string, string>; options: Option[]; picks: Record<string, string>; deadline: number }
  | { k: "bl-result"; game: "fakeout" | "sketchy"; items: BluffItem[]; i: number; options: Option[]; picks: Record<string, string>; gains: Gain[]; deadline: number }
  | { k: "scores"; label: string; deadline: number; then: Stage | "podium"; before: Record<string, number> }
  | { k: "podium" };

export interface State {
  v: 1;
  players: Player[];
  game: GameId;
  spice: Spice;
  stage: Stage;
  used: string[];
  line: { id: number; text: string } | null;
  /** Errors to show one phone (a lie that is the truth), keyed by pid. */
  errors: Record<string, string>;
}

export interface AIPort { call<R>(body: unknown): Promise<R> }
export interface Transport { views(views: Record<string, View>): void; save(state: State): void; kick(pid: string): void }

export const freshState = (): State => ({ v: 1, players: [], game: "comeback", spice: "clean", stage: { k: "lobby" }, used: [], line: null, errors: {} });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(a|an|the)\b/g, "").replace(/\s+/g, "").replace(/s$/, "");
const uid = () => Math.random().toString(36).slice(2, 10);

export class Engine {
  s: State;
  aiOn = false;
  private listeners = new Set<() => void>();
  private sent = new Map<string, string>();
  private stageSeq = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(private net: Transport, private ai: AIPort, saved?: State | null) {
    this.s = saved && saved.v === 1 ? saved : freshState();
    // A resumed big screen: everybody is offline until their phone reconnects.
    for (const p of this.s.players) if (!p.bot) p.online = false;
  }

  start() { this.ticker ??= setInterval(() => this.tick(), 250); this.emit(); this.resumeBots(); }
  stop() { if (this.ticker) clearInterval(this.ticker); this.ticker = null; }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.s;

  // ---- people -------------------------------------------------------------------------------------------------

  get playing() { return this.s.players.filter((p) => !p.sitOut); }
  get humans() { return this.playing.filter((p) => !p.bot); }
  player(pid: string) { return this.s.players.find((p) => p.pid === pid); }

  online(pid: string, on: boolean) {
    const p = this.player(pid);
    if (p) { p.online = on; this.emit(); }
    if (on) this.sent.delete(pid); // resend their view
    if (!on) this.checkDone();
  }

  private join(pid: string, raw: string) {
    let name = cleanName(raw) || "Player";
    const existing = this.player(pid);
    if (existing) {
      if (this.s.stage.k === "lobby" && name !== existing.name) existing.name = this.uniqueName(name, pid);
      existing.online = true;
      return;
    }
    if (this.s.players.filter((p) => !p.bot && (p.online || this.s.stage.k !== "lobby")).length >= MAX_PLAYERS) return this.net.views({ [pid]: { s: "wait", title: "This room is full", body: `${MAX_PLAYERS} players max. Watch from the couch this round.` } });
    // Phones that left, then bots, make room for people.
    if (this.s.players.length >= MAX_PLAYERS && this.s.stage.k === "lobby") this.pruneOffline();
    if (this.s.players.length >= MAX_PLAYERS) { const bot = [...this.s.players].reverse().find((p) => p.bot); if (bot && this.s.stage.k === "lobby") this.s.players = this.s.players.filter((p) => p !== bot); }
    name = this.uniqueName(name, pid);
    const used = new Set(this.s.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.s.players.length % PLAYER_COLORS.length]!;
    this.s.players.push({ pid, name, color, score: 0, online: true, sitOut: this.s.stage.k !== "lobby" });
  }

  private uniqueName(name: string, pid: string) {
    const taken = new Set(this.s.players.filter((p) => p.pid !== pid).map((p) => p.name.toLowerCase()));
    let out = name, n = 2;
    while (taken.has(out.toLowerCase())) out = `${name.slice(0, 10)} ${n++}`;
    return out;
  }

  /** Phones that left the room don't hold a seat into the next game. */
  private pruneOffline() {
    const gone = this.s.players.filter((p) => !p.bot && !p.online);
    if (!gone.length) return;
    this.s.players = this.s.players.filter((p) => p.bot || p.online);
    for (const p of gone) this.net.kick(p.pid);
  }

  addBot() {
    if (this.s.stage.k !== "lobby" || this.s.players.length >= MAX_PLAYERS) return;
    const names = new Set(this.s.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !names.has(n)) ?? `Bot ${this.s.players.length}`;
    const used = new Set(this.s.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? "#9a8f97";
    this.s.players.push({ pid: `bot${uid()}`, name, color, score: 0, online: true, bot: true });
    this.emit();
  }
  remove(pid: string) {
    const p = this.player(pid);
    if (!p || this.s.stage.k !== "lobby") return;
    this.s.players = this.s.players.filter((x) => x.pid !== pid);
    if (!p.bot) this.net.kick(pid);
    this.emit();
  }
  setGame(g: GameId) { if (this.s.stage.k === "lobby") { this.s.game = g; this.emit(); } }
  setSpice(sp: Spice) { if (this.s.stage.k === "lobby") { this.s.spice = sp; this.emit(); } }

  get canStart() { const here = this.playing.filter((p) => p.bot || p.online); return this.s.stage.k === "lobby" && here.length >= MIN_PLAYERS && here.some((p) => !p.bot); }

  // ---- actions from phones ------------------------------------------------------------------------------------

  act(pid: string, a: Action) {
    if (!a || typeof a !== "object") return;
    if (a.type === "join") { this.join(pid, String(a.name ?? "")); this.sent.delete(pid); this.emit(); return; }
    const p = this.player(pid);
    if (!p || p.sitOut) return;
    const st = this.s.stage;
    if (a.type === "start") { if (this.s.players[0]?.pid === pid || this.humans[0]?.pid === pid) void this.begin(); return; }

    if (a.type === "answer") {
      const text = String(a.text ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!text) return;
      if (st.k === "cb-write") {
        const m = st.matches.find((x) => x.id === a.id);
        if (m && m.players.includes(pid) && !m.ans[pid]) m.ans[pid] = text;
      } else if (st.k === "bl-write") {
        const item = st.items[st.i]!;
        if (a.id !== item.id || st.lies[pid] || item.artist === pid) return;
        const truthy = [item.truth, ...item.also].map(norm);
        if (truthy.includes(norm(text))) {
          this.s.errors[pid] = st.game === "sketchy" ? "That's the real title. Make one up!" : "That's the real answer! Write a lie.";
        } else { st.lies[pid] = text; delete this.s.errors[pid]; }
      }
    } else if (a.type === "draw") {
      if (st.k === "sk-draw") {
        const item = st.items.find((x) => x.id === a.id && x.artist === pid);
        if (item && !item.drawing) item.drawing = sanitizeDrawing(a.drawing);
      }
    } else if (a.type === "choose") {
      if (st.k === "cb-vote") {
        const m = st.matches[st.i]!;
        if (m.players.includes(pid) && m.players.length === 2) return;
        if (a.option === pid || !m.players.includes(a.option)) return;
        st.votes[pid] = a.option;
      } else if (st.k === "bl-pick") {
        const item = st.items[st.i]!;
        const opt = st.options.find((o) => o.id === a.option);
        if (!opt || opt.owners.includes(pid) || item.artist === pid) return;
        st.picks[pid] = opt.id;
      }
    }
    this.emit();
    this.checkDone();
  }

  // ---- flow ---------------------------------------------------------------------------------------------------

  async begin() {
    this.pruneOffline();
    if (!this.canStart) { this.emit(); return; }
    for (const p of this.s.players) { p.score = 0; p.sitOut = false; }
    this.board.clear();
    const g = this.s.game;
    this.go({ k: "loading", label: this.aiOn ? "Writing fresh prompts…" : "Shuffling the deck…" });
    const n = this.playing.length;
    if (g === "comeback") {
      const prompts = await this.content("comeback", n * 2 + 1);
      const r1 = this.pairUp(prompts.slice(0, n));
      const r2 = this.pairUp(prompts.slice(n, n * 2));
      this.pending = { r2, final: prompts[n * 2]! };
      this.go(this.intro("Round 1", "Answer two prompts on your phone. Each one has a rival.", { k: "cb-write", round: 1, matches: r1, deadline: 0 }));
    } else if (g === "fakeout") {
      const facts = await this.facts(Math.min(7, Math.max(5, n)));
      const items: BluffItem[] = facts.map((f) => ({ id: uid(), prompt: f.fact, truth: f.truth, also: f.also ?? [] }));
      this.go(this.intro("Fakeout", "Write a lie that sounds true. Then find the real answer.", { k: "bl-write", game: "fakeout", items, i: 0, lies: {}, deadline: 0 }));
    } else {
      const artists = this.humans;
      const prompts = await this.content("sketchy", artists.length);
      const items: BluffItem[] = artists.map((p, i) => ({ id: uid(), prompt: prompts[i]!, truth: prompts[i]!, also: [], artist: p.pid }));
      this.go(this.intro("Sketchy", "Draw your secret prompt. Don't make it too easy.", { k: "sk-draw", items, deadline: 0 }));
    }
  }

  /** Kept in memory only; a resumed big screen re-asks for content if it lost these. */
  private pending: { r2: Match[]; final: string } | null = null;

  private intro(title: string, sub: string, then: Stage): Stage { return { k: "intro", title, sub, deadline: Date.now() + T.intro, then }; }

  private pairUp(prompts: string[]): Match[] {
    const ps = shuffle(this.playing.map((p) => p.pid));
    return prompts.map((prompt, k) => ({ id: uid(), prompt, players: [ps[k % ps.length]!, ps[(k + 1) % ps.length]!], ans: {} }));
  }

  skip() { if ("deadline" in this.s.stage) this.advance(); }
  backToLobby() { this.pruneOffline(); for (const p of this.s.players) p.sitOut = false; this.go({ k: "lobby" }); }

  private go(stage: Stage) {
    const timed: Partial<Record<Stage["k"], number>> = { "cb-vote": T.vote, "bl-pick": T.pick, "sk-draw": T.draw };
    if (stage.k === "cb-write") stage.deadline = Date.now() + (stage.round === 3 ? T.finalWrite : T.write);
    else if (stage.k === "bl-write") stage.deadline = Date.now() + (stage.game === "sketchy" ? T.title : T.lie);
    else if ("deadline" in stage && timed[stage.k]) stage.deadline = Date.now() + timed[stage.k]!;
    this.s.stage = stage;
    this.s.errors = {};
    this.s.line = null;
    this.stageSeq++;
    this.emit();
    this.runBots();
    this.checkDone();
  }

  private tick() {
    const st = this.s.stage;
    if ("deadline" in st && st.deadline && Date.now() >= st.deadline) this.advance();
  }

  /** Move on early when every person who can act has acted. */
  private checkDone() {
    const st = this.s.stage;
    const active = (pid: string) => { const p = this.player(pid); return !!p && !p.sitOut && (p.bot || p.online); };
    let done = false;
    if (st.k === "cb-write") done = st.matches.every((m) => m.players.every((pid) => m.ans[pid] || !active(pid)));
    else if (st.k === "cb-vote") { const m = st.matches[st.i]!; const voters = this.voters(m); done = voters.length > 0 && voters.every((pid) => st.votes[pid] || !active(pid)); }
    else if (st.k === "sk-draw") done = st.items.every((it) => it.drawing || !active(it.artist!));
    else if (st.k === "bl-write") { const it = st.items[st.i]!; done = this.playing.filter((p) => p.pid !== it.artist).every((p) => st.lies[p.pid] || !active(p.pid)); }
    else if (st.k === "bl-pick") { const it = st.items[st.i]!; done = this.playing.filter((p) => p.pid !== it.artist).every((p) => st.picks[p.pid] || !active(p.pid) || st.options.every((o) => o.owners.includes(p.pid))); }
    if (done) setTimeout(() => { if (this.s.stage === st) this.advance(); }, 700);
  }

  private voters(m: Match) { return this.playing.filter((p) => m.players.length > 2 || !m.players.includes(p.pid)).map((p) => p.pid); }

  private advance() {
    const st = this.s.stage;
    switch (st.k) {
      case "intro": return this.go(st.then);
      case "cb-write": {
        // Unanswered prompts get the house answer, so the vote still happens.
        for (const m of st.matches) for (const pid of m.players) m.ans[pid] ||= "";
        const first = { k: "cb-vote", round: st.round, matches: st.matches, i: 0, votes: {}, deadline: 0 } as Stage;
        return this.go(first);
      }
      case "cb-vote": {
        const m = st.matches[st.i]!;
        const mult = st.round === 3 ? 3 : st.round;
        const tally: Record<string, number> = Object.fromEntries(m.players.map((p) => [p, 0]));
        for (const v of Object.values(st.votes)) if (v in tally) tally[v]!++;
        const total = Object.values(tally).reduce((a, b) => a + b, 0);
        const gains: Gain[] = [];
        for (const pid of m.players) {
          const pts = tally[pid]! * 100 * mult;
          if (pts) gains.push({ pid, pts, why: `${tally[pid]} vote${tally[pid] === 1 ? "" : "s"}` });
          if (m.players.length === 2 && total >= 2 && tally[pid] === total) gains.push({ pid, pts: 250 * mult, why: "Clean sweep" });
        }
        this.award(gains);
        this.hostLine(m, tally);
        return this.go({ k: "cb-result", round: st.round, matches: st.matches, i: st.i, votes: st.votes, gains, deadline: Date.now() + T.cbResult });
      }
      case "cb-result": {
        if (st.i + 1 < st.matches.length) return this.go({ k: "cb-vote", round: st.round, matches: st.matches, i: st.i + 1, votes: {}, deadline: 0 });
        if (st.round === 1) {
          const r2 = this.pending?.r2 ?? this.pairUp(draw(COMEBACK, this.playing.length, new Set(this.s.used), (x) => x));
          return this.scores("After round 1", this.intro("Round 2", "Same again. Every vote is worth double.", { k: "cb-write", round: 2, matches: r2, deadline: 0 }));
        }
        if (st.round === 2) {
          const prompt = this.pending?.final ?? draw(COMEBACK, 1, new Set(this.s.used), (x) => x)[0]!;
          const final: Match = { id: uid(), prompt, players: this.playing.map((p) => p.pid), ans: {} };
          return this.scores("After round 2", this.intro("The last word", "Everyone answers the same prompt. Votes are worth triple.", { k: "cb-write", round: 3, matches: [final], deadline: 0 }));
        }
        return this.scores("Final scores", "podium");
      }
      case "sk-draw": {
        const items = st.items.filter((it) => it.drawing && it.drawing.length);
        if (!items.length) return this.scores("Nobody drew anything", "podium");
        return this.go({ k: "bl-write", game: "sketchy", items, i: 0, lies: {}, deadline: 0 });
      }
      case "bl-write": {
        const item = st.items[st.i]!;
        const options: Option[] = [{ id: uid(), text: item.truth, owners: [], truth: true }];
        for (const [pid, lie] of Object.entries(st.lies)) {
          const same = options.find((o) => norm(o.text) === norm(lie));
          if (same && !same.truth) same.owners.push(pid);
          else if (!same) options.push({ id: uid(), text: lie, owners: [pid], truth: false });
        }
        // Too few lies makes it a giveaway: the house adds some.
        for (const lie of shuffle(st.game === "fakeout" ? BOT_LIES : ["a very tired dog", "my landlord", "breakfast in bed", "a bad haircut"])) {
          if (options.length >= 3) break;
          if (!options.some((o) => norm(o.text) === norm(lie))) options.push({ id: uid(), text: lie, owners: [], truth: false });
        }
        return this.go({ k: "bl-pick", game: st.game, items: st.items, i: st.i, lies: st.lies, options: shuffle(options), picks: {}, deadline: 0 });
      }
      case "bl-pick": {
        const item = st.items[st.i]!;
        const gains: Gain[] = [];
        const truth = st.options.find((o) => o.truth)!;
        for (const [pid, oid] of Object.entries(st.picks)) {
          const o = st.options.find((x) => x.id === oid);
          if (!o) continue;
          if (o.truth) {
            gains.push({ pid, pts: 1000, why: "Found the truth" });
            if (item.artist) gains.push({ pid: item.artist, pts: 500, why: "Drew it well" });
          } else for (const owner of o.owners) gains.push({ pid: owner, pts: 500, why: `Fooled ${this.player(pid)?.name ?? "someone"}` });
        }
        this.award(gains);
        const fooled = st.options.filter((o) => !o.truth).map((o) => `"${o.text}" by ${o.owners.map((x) => this.player(x)?.name).join(" and ") || "the house"} fooled ${Object.values(st.picks).filter((x) => x === o.id).length}`);
        this.hostEvent(`The real answer was "${truth.text}" (${item.artist ? "the drawing prompt" : item.prompt}). ${Object.values(st.picks).filter((x) => x === truth.id).length} of ${Object.keys(st.picks).length} found it. ${fooled.join("; ")}.`);
        return this.go({ k: "bl-result", game: st.game, items: st.items, i: st.i, options: st.options, picks: st.picks, gains, deadline: Date.now() + T.bluffResult });
      }
      case "bl-result": {
        if (st.i + 1 < st.items.length) {
          const next: Stage = { k: "bl-write", game: st.game, items: st.items, i: st.i + 1, lies: {}, deadline: 0 };
          return st.i + 1 === Math.ceil(st.items.length / 2) && st.items.length > 3 ? this.scores("Halfway", next) : this.go(next);
        }
        return this.scores("Final scores", "podium");
      }
      case "scores": return st.then === "podium" ? this.go({ k: "podium" }) : this.go(st.then);
    }
  }

  private scores(label: string, then: Stage | "podium") {
    const before = Object.fromEntries(this.s.players.map((p) => [p.pid, this.board.get(p.pid) ?? 0]));
    for (const p of this.s.players) this.board.set(p.pid, p.score);
    this.go({ k: "scores", label, deadline: Date.now() + T.scores, then, before });
  }
  /** Scores at the last scoreboard, so the next one can count up from there. */
  private board = new Map<string, number>();
  private award(gains: Gain[]) {
    for (const g of gains) { const p = this.player(g.pid); if (p) p.score += g.pts; }
  }

  // ---- content ------------------------------------------------------------------------------------------------

  private async content(kind: "comeback" | "sketchy", n: number): Promise<string[]> {
    const deck = kind === "comeback" ? COMEBACK : SKETCHY;
    const used = new Set(this.s.used);
    let out: string[] = [];
    if (this.aiOn) {
      try {
        const r = await withTimeout(this.ai.call<{ prompts: string[] }>({ task: kind, count: n, spice: this.s.spice, avoid: this.s.used }), T.aiTimeout * 2);
        out = (r.prompts ?? []).filter((p) => !used.has(p));
      } catch { /* the deck takes over */ }
    }
    if (out.length < n) out = [...out, ...draw(deck, n - out.length, used, (x) => x)];
    out = out.slice(0, n);
    this.s.used.push(...out);
    return out;
  }

  private async facts(n: number) {
    const used = new Set(this.s.used);
    let out: { fact: string; truth: string; also?: string[] }[] = [];
    if (this.aiOn) {
      try {
        const r = await withTimeout(this.ai.call<{ facts: typeof out }>({ task: "fakeout", count: n, avoid: this.s.used }), T.aiTimeout * 2);
        out = (r.facts ?? []).filter((f) => !used.has(f.fact));
      } catch { /* deck */ }
    }
    if (out.length < n) out = [...out, ...draw(FAKEOUT, n - out.length, used, (f) => f.fact)];
    out = out.slice(0, n);
    this.s.used.push(...out.map((f) => f.fact));
    return out;
  }

  // ---- the host's voice ---------------------------------------------------------------------------------------

  private hostLine(m: Match, tally: Record<string, number>) {
    const parts = m.players.map((pid) => `${this.player(pid)?.name}: "${m.ans[pid] || "(no answer)"}" got ${tally[pid]} votes`);
    this.hostEvent(`Prompt: "${m.prompt}". ${parts.join(". ")}.`);
  }
  private hostEvent(event: string) {
    if (!this.aiOn) return;
    const seq = this.stageSeq + 1;
    void withTimeout(this.ai.call<{ line: string }>({ task: "host", event, spice: this.s.spice }), T.aiTimeout)
      .then((r) => { if (r.line && this.stageSeq === seq) { this.s.line = { id: seq, text: r.line }; this.emit(); } })
      .catch(() => {});
  }

  // ---- bots ---------------------------------------------------------------------------------------------------

  private resumeBots() { this.runBots(); }

  private runBots() {
    const bots = this.playing.filter((p) => p.bot);
    if (!bots.length) return;
    const st = this.s.stage;
    const seq = this.stageSeq;
    const later = (ms: number, fn: () => void) => setTimeout(() => { if (this.stageSeq === seq) fn(); }, ms);
    const delay = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

    if (st.k === "cb-write") {
      const items = st.matches.flatMap((m) => m.players.filter((pid) => this.player(pid)?.bot && !m.ans[pid]).map((pid) => ({ id: `${m.id}:${pid}`, prompt: m.prompt })));
      if (!items.length) return;
      void this.botTexts("answer", items, BOT_ANSWERS).then((ans) => {
        for (const it of items) later(delay(2_000, 14_000), () => { const [mid, pid] = it.id.split(":"); this.act(pid!, { type: "answer", id: mid!, text: ans[it.id]! }); });
      });
    } else if (st.k === "bl-write") {
      const item = st.items[st.i]!;
      const who = bots.filter((b) => !st.lies[b.pid]);
      const items = who.map((b) => ({ id: b.pid, prompt: item.artist ? item.truth : item.prompt, truth: item.truth }));
      void this.botTexts(item.artist ? "title" : "lie", items, BOT_LIES).then((ans) => {
        for (const b of who) later(delay(3_000, 12_000), () => {
          let text = ans[b.pid]!;
          if ([item.truth, ...item.also].map(norm).includes(norm(text)) || overlap(text, item.truth) > 0.5) text = shuffle(item.artist ? BOT_TITLES : BOT_LIES)[0]!;
          this.act(b.pid, { type: "answer", id: item.id, text });
        });
      });
    } else if (st.k === "cb-vote") {
      const m = st.matches[st.i]!;
      for (const b of bots) if (this.voters(m).includes(b.pid)) later(delay(2_000, 8_000), () => {
        const choices = m.players.filter((p) => p !== b.pid && (m.ans[p] ?? ""));
        if (choices.length) this.act(b.pid, { type: "choose", id: m.id, option: shuffle(choices)[0]! });
      });
    } else if (st.k === "bl-pick") {
      for (const b of bots) later(delay(2_000, 8_000), () => {
        const opts = st.options.filter((o) => !o.owners.includes(b.pid));
        const truth = opts.find((o) => o.truth);
        const pick = truth && Math.random() < 0.4 ? truth : shuffle(opts)[0];
        if (pick) this.act(b.pid, { type: "choose", id: st.items[st.i]!.id, option: pick.id });
      });
    }
  }

  private async botTexts(kind: "answer" | "lie" | "title", items: { id: string; prompt: string; truth?: string }[], fallback: string[]) {
    let ans: Record<string, string> = {};
    if (this.aiOn) {
      try {
        const r = await withTimeout(this.ai.call<{ answers: Record<string, string> }>({ task: "bot", kind, items, bots: [] }), T.aiTimeout);
        ans = r.answers ?? {};
      } catch { /* fallback */ }
    }
    const spare = shuffle(fallback);
    for (const [k, it] of items.entries()) ans[it.id] ||= spare[k % spare.length]!;
    return ans;
  }

  // ---- what each phone sees -----------------------------------------------------------------------------------

  private viewFor(p: Player): View {
    const st = this.s.stage;
    const me = { name: p.name, color: p.color };
    const eyesUp = (title: string, body?: string): View => ({ s: "wait", title, body, ...me });
    if (p.sitOut) return eyesUp("You're in the next game", "This one already started. Watch the big screen.");
    switch (st.k) {
      case "lobby": return { s: "lobby", ...me, players: this.playing.length, first: this.humans[0]?.pid === p.pid };
      case "loading": return eyesUp("Get ready", st.label);
      case "intro": return eyesUp(st.title, st.sub);
      case "cb-write": {
        const items = st.matches.filter((m) => m.players.includes(p.pid) && !m.ans[p.pid]).map((m) => ({ id: m.id, prompt: m.prompt }));
        return items.length ? { s: "write", kind: "answer", items, deadline: st.deadline, max: 80, hint: st.round === 3 ? "Everyone answers this one." : undefined } : eyesUp("Answers in", "Wait for the others. Eyes on the big screen.");
      }
      case "cb-vote": {
        const m = st.matches[st.i]!;
        if (m.players.length === 2 && m.players.includes(p.pid)) return eyesUp("You're up", "Your answer is on the big screen. Look innocent.");
        const options = m.players.filter((x) => x !== p.pid).map((x) => ({ id: x, text: m.ans[x] || "(no answer)" }));
        return { s: "choose", id: m.id, title: m.players.length > 2 ? "Vote for your favourite" : "Which is funnier?", options, deadline: st.deadline, picked: st.votes[p.pid] };
      }
      case "cb-result": return eyesUp("Votes are in", "Eyes on the big screen.");
      case "sk-draw": {
        const it = st.items.find((x) => x.artist === p.pid);
        if (it && !it.drawing) return { s: "draw", id: it.id, prompt: it.prompt, deadline: st.deadline };
        return eyesUp("Nice art", "Wait for the other artists.");
      }
      case "bl-write": {
        const it = st.items[st.i]!;
        if (it.artist === p.pid) return eyesUp("That's your drawing", "Everyone is making up titles. Act natural.");
        if (st.lies[p.pid]) return eyesUp("Lie locked in", "Wait for the others.");
        return { s: "write", kind: st.game === "sketchy" ? "title" : "lie", items: [{ id: it.id, prompt: st.game === "sketchy" ? "Write a fake title for the drawing on the big screen" : it.prompt }], deadline: st.deadline, max: 40, error: this.s.errors[p.pid], errorFor: it.id };
      }
      case "bl-pick": {
        const it = st.items[st.i]!;
        if (it.artist === p.pid) return eyesUp("That's your drawing", "Let's see who knows what it is.");
        const options = st.options.filter((o) => !o.owners.includes(p.pid)).map((o) => ({ id: o.id, text: o.text }));
        return { s: "choose", id: it.id, title: st.game === "sketchy" ? "What's the real title?" : "Find the truth", options, deadline: st.deadline, picked: st.picks[p.pid], note: st.options.some((o) => o.owners.includes(p.pid) && o.owners.length > 1) ? "Someone wrote the same lie as you." : undefined };
      }
      case "bl-result": return eyesUp("The truth is out", "Eyes on the big screen.");
      case "scores": return eyesUp(st.label, `You have ${p.score.toLocaleString()} points.`);
      case "podium": {
        const ranked = [...this.playing].sort((a, b) => b.score - a.score);
        return { s: "end", place: ranked.findIndex((x) => x.pid === p.pid) + 1, of: ranked.length, score: p.score, ...me };
      }
    }
  }

  private emit() {
    const out: Record<string, View> = {};
    for (const p of this.s.players) {
      if (p.bot) continue;
      const v = this.viewFor(p);
      const j = JSON.stringify(v);
      if (this.sent.get(p.pid) !== j) { this.sent.set(p.pid, j); out[p.pid] = v; }
    }
    if (Object.keys(out).length) this.net.views(out);
    if (!this.saveTimer) this.saveTimer = setTimeout(() => { this.saveTimer = null; this.net.save(this.s); }, 1_200);
    this.s = { ...this.s }; // a new reference for React
    for (const fn of this.listeners) fn();
  }
}

function sanitizeDrawing(d: unknown): Drawing {
  if (!Array.isArray(d)) return [];
  const out: Drawing = [];
  let points = 0;
  for (const s of d.slice(0, 400)) {
    if (!s || !Array.isArray(s.p)) continue;
    const p = (s.p as unknown[]).slice(0, 2000).map((n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0))));
    if (p.length < 2) continue;
    points += p.length;
    if (points > 24_000) break;
    out.push({ c: Math.max(0, Math.min(3, Math.floor(Number(s.c) || 0))), w: Math.max(4, Math.min(60, Math.round(Number(s.w) || 10))), p });
  }
  return out;
}

/** Share of the truth's words a guess repeats: a bot's fake title that just rewords the prompt gives it away. */
function overlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["the", "and", "with", "for"].includes(w)));
  const A = words(a), B = words(b);
  if (!B.size) return 0;
  let n = 0; for (const w of B) if (A.has(w)) n++;
  return n / B.size;
}

function withTimeout<R>(p: Promise<R>, ms: number): Promise<R> {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
}
