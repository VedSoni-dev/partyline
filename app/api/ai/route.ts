// Partyline's AI, all through the kit (whatever mode the host picked: Claude key, publik, ChatGPT plan, local model).
// Only the big screen calls this; phones never do. Every task returns JSON, and the game falls back to the
// built-in decks when a call fails, so a slow or missing model never stops a round.
import { cookies } from "next/headers";
import { errorResponse, generateText, parseJSON, readMode, studioStatus } from "@/kit/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Spice = "clean" | "spicy";
type Body =
  | { task: "comeback"; count: number; spice: Spice; avoid?: string[] }
  | { task: "fakeout"; count: number; avoid?: string[] }
  | { task: "sketchy"; count: number; spice: Spice; avoid?: string[] }
  | { task: "bot"; kind: "answer" | "lie" | "title"; items: { id: string; prompt: string; truth?: string }[]; bots: string[] }
  | { task: "host"; event: string; spice: Spice };

const TONE: Record<Spice, string> = {
  clean: "Keep it family friendly: no sex, drugs, slurs or gore. Silly and clever beats edgy.",
  spicy: "Adults are playing: cheeky innuendo and dark jokes are fine, but no slurs, hate, sexual content about real people, or anything cruel about real people.",
};

const clamp = (n: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.floor(Number(n) || lo)));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const avoidList = (a?: string[]) => (a?.length ? `\nDon't repeat or closely echo any of these:\n${a.slice(-40).map((x) => `- ${str(x, 140)}`).join("\n")}` : "");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object" || !("task" in body)) return Response.json({ error: "Bad request." }, { status: 400 });
  try {
    switch (body.task) {
      case "comeback": {
        const n = clamp(body.count, 1, 12);
        const text = await generateText(req, {
          tier: "balanced", json: true,
          system: `You write prompts for a party game where two players each write the funniest answer to the same prompt and the room votes. ${TONE[body.spice] ?? TONE.clean}
Good prompts are short (under 14 words), open-ended, and invite a punchline: "The worst thing to hear from your pilot", "A rejected flavour of toothpaste". No questions about the players themselves. Vary the shapes. Return JSON only: {"prompts": ["…"]}`,
          messages: [{ role: "user", content: `Write ${n} fresh prompts.${avoidList(body.avoid)}` }],
        });
        const prompts = parseJSON<{ prompts: unknown[] }>(text).prompts.map((p) => str(p, 120)).filter(Boolean).slice(0, n);
        return Response.json({ prompts });
      }
      case "fakeout": {
        // Facts must be true. Small local models make them up (one swore a war began on the wrong day), so on a local
        // model the game plays the hand-checked deck instead.
        const jar = await cookies();
        if ((readMode(jar) ?? (await studioStatus(req, jar)).active) === "local") return Response.json({ facts: [] });
        const n = clamp(body.count, 1, 8);
        const text = await generateText(req, {
          tier: "smart", json: true,
          system: `You write questions for a bluffing trivia game. Each one is a surprising but TRUE, well documented fact written as one sentence with a single blank "_____" where a 1 to 3 word answer goes. Players invent fake answers, so the true answer should sound as unlikely as a lie.
Only use facts you are certain are true and widely documented (encyclopedias, museums, official records). No dates or numbers over 100 as answers, no trick wording, no facts about living private people.
Return JSON only: {"facts": [{"fact": "A group of flamingos is called a _____.", "truth": "flamboyance", "also": ["other spellings that also count as the truth"]}]}`,
          messages: [{ role: "user", content: `Write ${n} facts.${avoidList(body.avoid)}` }],
        });
        const facts = parseJSON<{ facts: { fact?: unknown; truth?: unknown; also?: unknown }[] }>(text).facts
          .map((f) => ({ fact: str(f.fact, 200).replace(/_{3,}/g, "_____"), truth: str(f.truth, 40), also: Array.isArray(f.also) ? f.also.map((a) => str(a, 40)).filter(Boolean).slice(0, 4) : [] }))
          .filter((f) => f.fact.split("_____").length === 2 && f.truth && !/\d{3,}/.test(f.truth))
          .slice(0, n);
        return Response.json({ facts });
      }
      case "sketchy": {
        const n = clamp(body.count, 1, 12);
        const text = await generateText(req, {
          tier: "balanced", json: true,
          system: `You write drawing prompts for a party game: each player draws one on their phone in 75 seconds, then everyone else invents fake titles for it. Good prompts are 3 to 8 words, concrete enough to draw, odd enough to be funny: "a nervous hot dog at a job interview", "a dragon doing taxes". No text-based or abstract prompts. ${TONE[body.spice] ?? TONE.clean}
Return JSON only: {"prompts": ["…"]}`,
          messages: [{ role: "user", content: `Write ${n} prompts, lowercase, no full stop.${avoidList(body.avoid)}` }],
        });
        const prompts = parseJSON<{ prompts: unknown[] }>(text).prompts.map((p) => str(p, 80)).filter(Boolean).slice(0, n);
        return Response.json({ prompts });
      }
      case "bot": {
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 12).map((i) => ({ id: str(i.id, 40), prompt: str(i.prompt, 240), truth: str(i.truth, 60) }));
        if (!items.length) return Response.json({ answers: {} });
        const how = {
          answer: "Write the funniest short answer (2 to 8 words) to each prompt, like a quick-witted friend at a party. No explanations.",
          lie: "Each item is a fact with a blank. Write a believable FAKE answer (1 to 3 words) that would fool people. Never the true answer given, and nothing close to it.",
          title: "Each item is what someone was asked to draw. Write a different, plausible title (3 to 8 words, lowercase) that someone might guess the drawing shows, to fool the other players. Not the real prompt.",
        }[body.kind];
        const text = await generateText(req, {
          tier: "fast", json: true,
          system: `You are playing a party game as a player. ${how} Family friendly. Return JSON only: {"answers": {"<id>": "<text>"}}`,
          messages: [{ role: "user", content: JSON.stringify(items.map((i) => (body.kind === "lie" ? i : { id: i.id, prompt: i.prompt }))) }],
        });
        const raw = parseJSON<{ answers: Record<string, unknown> }>(text).answers ?? {};
        const answers: Record<string, string> = {};
        for (const i of items) { const a = str(raw[i.id], 60); if (a) answers[i.id] = a; }
        return Response.json({ answers });
      }
      case "host": {
        const text = await generateText(req, {
          tier: "fast",
          system: `You are the host of a party game show on a big screen, with a dry, sassy wit. React to what just happened in ONE line under 18 words. Roast gently, never cruelly. ${TONE[body.spice] ?? TONE.clean} No emojis, no hashtags, no quotation marks around the line.`,
          messages: [{ role: "user", content: str(body.event, 1200) }],
        });
        return Response.json({ line: str(text.replace(/^["“]|["”]$/g, ""), 160) });
      }
      default:
        return Response.json({ error: "Unknown task." }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
