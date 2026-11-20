// The public landing page at "/", one static HTML document (app/route.ts serves it). It is built on the taste skill's
// kit (public/assets: system.css, layout, motion, moments), which is plain CSS and scripts written for a static page,
// so this is plain HTML rather than React. Every picture on it is a real Partyline screen captured from a real game
// (public/shots). DESIGN.md has the plan.
import config from "@/studio.config";
import { GAMES } from "@/lib/engine";

const app = config.app;
const ARROW = `<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>`;
const MARK = `<svg class="pl-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="17" height="13" rx="6.5" fill="var(--p-accent)"/><path d="M7 18.5 5 24l6-4.8" fill="var(--p-accent)"/><rect x="13" y="12" width="17" height="13" rx="6.5" fill="currentColor"/><path d="M25 24.5 27 30l-6-4.8" fill="currentColor"/></svg>`;
const shot = (file: string, alt: string, w: number, h: number, extra = "") =>
  `<img src="/shots/${file}.webp" alt="${alt}" width="${w}" height="${h}" ${extra} data-source="client" data-subject="${alt}">`;
const BIG = (file: string, alt: string, extra = "") => shot(file, alt, 1440, 900, extra);
const PHONE = (file: string, alt: string, extra = "") => shot(file, alt, 390, 844, extra);
// Prompts the AI really wrote during test games on 2026-11-20 (local model), for the marquee.
const AI_PROMPTS = ["A city built entirely on water", "The worst job for a superhero sidekick", "a cat in a spaceship", "The most unlikely thing to find in a time machine", "a giant eggplant at a desk", "The worst thing to hear from your pizza delivery guy", "a robot trying to fit in", "The most annoying thing about your alarm clock", "a pirate eating a sandwich", "A mysterious noise from your fridge at midnight"];

export function landingHTML(): string {
  const title = "Partyline: free party games for one laptop and your friends' phones";
  const desc = "Three party games you play on one laptop or TV while friends join from their phones with a room code. AI writes new prompts every round. Free and open source.";
  return `<!doctype html>
<html lang="en" data-type="software" data-radius="round" data-buttons="pill" data-motion>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="A free alternative to Jackbox Party Packs: one laptop, everyone's phones, AI-written prompts.">
<meta property="og:url" content="${app.url}/">
<meta property="og:image" content="${app.url}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="A free alternative to Jackbox Party Packs: one laptop, everyone's phones, AI-written prompts.">
<meta name="twitter:image" content="${app.url}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0d060b">
<link rel="canonical" href="${app.url}/">
<meta name="site-kind" content="gaming">
<meta name="page-type" content="software">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,400..600&family=Geist+Mono:wght@400..500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/system.css">
<link rel="stylesheet" href="/assets/ui/cards.css">
<link rel="stylesheet" href="/assets/motion/motion.css">
<link rel="stylesheet" href="/assets/backgrounds/backgrounds.css">
<link rel="stylesheet" href="/assets/layout/layout.css">
<link rel="stylesheet" href="/assets/icons/icon.css">
<style>
:root {
  --p-bg: #0d060b; --p-surface: #1b0e17; --p-ink: #ffffff; --p-muted: #9a8f97;
  --p-accent: #ff488b; --p-accent-ink: #0d060b; --p-action: #ff488b; --p-action-ink: #0d060b;
  --p-inv-bg: #ffffff; --p-inv-surface: #ebebeb; --p-inv-ink: #0d060b; --p-inv-muted: #5e575c;
  --p-inv-accent: #ff488b; --p-inv-accent-ink: #0d060b; --p-inv-action: #ff488b; --p-inv-action-ink: #0d060b;
  --font-display: "Mona Sans", system-ui, sans-serif;
  --font-text: "Mona Sans", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --display-weight: 500;
  --display-tracking: -0.03em;
  --display-tracking-xl: -0.04em;
  --display-stretch: 104%;
  --ly-scale: 0.96;
}
</style>
<link rel="stylesheet" href="/assets/ui/base.css">
<link rel="stylesheet" href="/landing.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
<script src="/assets/backgrounds/backgrounds.js"></script>
<script>document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)</script>
<link rel="modulepreload" href="/assets/moments/moments.js">
<link rel="modulepreload" href="/assets/moments/lib.js">
<link rel="modulepreload" href="/assets/moments/marquee-row/moment.js">
</head>
<body>
<!-- type: software (site-kind gaming: a party game you play in the browser) · category: free party games for a laptop and phones · main action: Open the big screen
     deal: hero triptych (re-dealt with --has ui: the real screens lead, per the studio rule "real product in every
           screenshot"; the first gaming deal, photo over a stand-in setting, found no usable Commons frames),
           nav nav-centre, close close-word, footer footer-dark, rhythm dark-band, buttons pill, mark initial (the app's
           own two-bubble mark in its place), palette plum-black-pink (a dark stage and one hot pink light, the colours of
           a game show at night), type mona, radius round
     effect: none (the hero's own loop is the collage); moments: marquee-row on #ai (the prompts the AI really wrote)
     screens at 1440x900: hero 1 · games 1 · how 1 · ai 1 · questions 1 · footer 1 -->
<header class="nav nav--centre">
  <div class="wrap nav__bar">
    <a class="skip-link" href="#top">Skip to content</a>
    <a class="nav__logo" href="#top">${MARK}Partyline</a>
    <nav class="nav__links" aria-label="Main">
      <div class="nav__item"><a class="nav__link" href="#games">Games</a></div>
      <div class="nav__item"><a class="nav__link" href="#how">How to play</a></div>
      <div class="nav__item"><a class="nav__link" href="#ai">AI</a></div>
      <div class="nav__item"><a class="nav__link" href="#questions">Free</a></div>
    </nav>
    <div class="nav__actions">
      <a class="nav__link" href="${app.repo}">GitHub</a>
      <a class="btn btn--secondary" href="/join">Join a game</a>
    </div>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
  </div>
</header>

<main id="top">
  <section class="hero hero--triptych" data-enter aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="span-3">
        <h1 id="hero-h">Party games for one laptop</h1>
        <p class="hero__lead">Friends join from their phones with a 4-letter code. Three games, new AI prompts every round, free.</p>
      </div>
      <div class="ly-collage span-6 start-4" role="img" aria-label="Partyline in play: the big screen showing a Comeback vote with a clean sweep, a Fakeout reveal and a Sketchy drawing, each beside the phone screen a player sees">
        <div class="ly-collage__set is-on">
          <div class="ly-piece pl-big" style="left: 4%; top: 5%; width: 84%; height: 45.6%">${BIG("comeback-result-6", "", 'loading="eager"')}</div>
          <div class="ly-piece pl-big" style="left: 4%; top: 54%; width: 54%; height: 29.3%">${BIG("comeback-vote-4", "")}</div>
          <div class="ly-piece pl-phone" style="left: 68%; top: 41%; width: 28%; height: 55%">${PHONE("phone-choose-comeback", "")}</div>
        </div>
        <div class="ly-collage__set" aria-hidden="true">
          <div class="ly-piece pl-big" style="left: 4%; top: 5%; width: 84%; height: 45.6%">${BIG("fakeout-result-6", "")}</div>
          <div class="ly-piece pl-big" style="left: 4%; top: 54%; width: 54%; height: 29.3%">${BIG("comeback-lobby", "")}</div>
          <div class="ly-piece pl-phone" style="left: 68%; top: 41%; width: 28%; height: 55%">${PHONE("phone-write-lie", "")}</div>
        </div>
        <div class="ly-collage__set" aria-hidden="true">
          <div class="ly-piece pl-big" style="left: 4%; top: 5%; width: 84%; height: 45.6%">${BIG("sketchy-result-3", "")}</div>
          <div class="ly-piece pl-big" style="left: 4%; top: 54%; width: 54%; height: 29.3%">${BIG("comeback-scores", "")}</div>
          <div class="ly-piece pl-phone" style="left: 68%; top: 41%; width: 28%; height: 55%">${PHONE("phone-draw", "")}</div>
        </div>
      </div>
      <div class="span-3 start-10 hero__cta"><a class="btn btn--primary" href="/app">Open the big screen</a></div>
    </div></div>
  </section>

  <section class="section" id="games" aria-labelledby="games-h" style="--hm: 2">
    <div class="wrap">
      <div class="section-head section-head--row">
        <div><h2 id="games-h">Three games in the pack. <span class="muted">3 to 8 players, about 15 minutes each.</span></h2></div>
        <a class="link" href="/app">Pick one on the big screen</a>
      </div>
      <div class="grid tiles3">
        <a class="tile span-4" href="/app"><div class="tile__media pl-tile">${BIG("comeback-result-6", "A Comeback vote on the big screen: the prompt A city built entirely on water, the answer unlimited breadsticks, no questions winning both votes for a clean sweep", 'loading="lazy"')}</div><div class="tile__head"><h3>${GAMES.comeback.title}, the answer game</h3></div><p class="t-small muted">${GAMES.comeback.blurb}</p></a>
        <a class="tile span-4" href="/app"><div class="tile__media pl-tile">${BIG("fakeout-result-6", "A Fakeout reveal: the national animal of Scotland is the unicorn, beside the lies pancake, committee and thistle with who wrote and who fell for each", 'loading="lazy"')}</div><div class="tile__head"><h3>${GAMES.fakeout.title}, the bluffing game</h3></div><p class="t-small muted">${GAMES.fakeout.blurb}</p></a>
        <a class="tile span-4" href="/app"><div class="tile__media pl-tile">${BIG("sketchy-result-3", "A Sketchy reveal: a smiling face with a crown drawn on a phone, beside four titles, the real one a giant eggplant at a desk", 'loading="lazy"')}</div><div class="tile__head"><h3>${GAMES.sketchy.title}, the drawing game</h3></div><p class="t-small muted">${GAMES.sketchy.blurb}</p></a>
      </div>
    </div>
  </section>

  <section class="section" id="how" aria-labelledby="how-h">
    <div class="wrap">
      <div class="grid pl-split">
        <div class="span-5 stack-6">
          <h2 id="how-h">Joining from a phone takes ten seconds</h2>
          <ol class="pl-steps">
            <li><b>Open the big screen</b><span>On the laptop, or the laptop plugged into the TV.</span></li>
            <li><b>Type the room code</b><span>Everyone goes to the join page and types the 4 letters, or scans the QR code.</span></li>
            <li><b>Pick a game</b><span>Short on people? Add a bot. It plays to win.</span></li>
          </ol>
          <p class="t-small">Nothing to install. Playing over a video call works too: share the big screen and send the code.</p>
        </div>
        <div class="span-6 start-7 pl-pair" role="img" aria-label="The Partyline lobby on the big screen with the room code RPLL, a QR code, the three games and four players, beside a phone showing You're in, Maya">
          <div class="pl-frame" aria-hidden="true">${BIG("comeback-lobby", "", 'loading="lazy"')}</div>
          <div class="pl-handset" aria-hidden="true">${PHONE("phone-lobby", "", 'loading="lazy"')}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="ai" aria-labelledby="ai-h" style="--hm: 2">
    <div class="wrap">
      <div class="grid pl-split">
        <div class="span-5 stack-6">
          <h2 id="ai-h">Partyline&apos;s AI writes every prompt</h2>
          <p class="t-lead">You won&apos;t see the same prompt twice. The AI writes them, a host on the big screen roasts the answers, and a bot fills an empty seat.</p>
          <div class="pl-free-shot pl-roast">${BIG("fakeout-result-6", "The host's line under a Fakeout reveal: another great team effort, mostly, except for Priya, who's clearly having a bit of a prickly morning", 'loading="lazy"')}</div>
        </div>
        <div class="span-6 start-7 stack-4">
          <p class="t-label">Four ways to power the AI, picked on the big screen</p>
          <dl class="pl-bill pl-bill--modes">
            <div><dt>Claude API key</dt><dd>Your key, encrypted on that laptop</dd></div>
            <div><dt>publik</dt><dd>Free daily answers, no key</dd></div>
            <div><dt>ChatGPT plan</dt><dd>When it runs on your computer</dd></div>
            <div><dt>Local model</dt><dd>Ollama or LM Studio, offline</dd></div>
          </dl>
        </div>
      </div>
      <div class="pl-marquee">
        <p class="t-label">Prompts the AI wrote during one evening of test games</p>
        <div data-moment="marquee-row" data-moment-opts='{"speed": 34}'>
          <ul class="mo-mq__track">${AI_PROMPTS.map((p) => `<li>${p}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="questions" aria-labelledby="questions-h" style="--hm: 2">
    <div class="wrap">
      <div class="grid pl-split">
        <div class="span-5 stack-6">
          <h2 id="questions-h">Partyline is free, and it stays free</h2>
          <dl class="pl-bill">
            <div><dt>Jackbox Party Packs 1 to 11, on Steam</dt><dd>$24.99 to $29.99 each</dd></div>
            <div><dt>Partyline, three games, MIT licensed</dt><dd class="pl-free">$0</dd></div>
          </dl>
          <div class="pl-free-shot">${BIG("comeback-scores", "The scoreboard after round 1 of Comeback: Priya 900, Botley 450, Maya 100, Jordan 100", 'loading="lazy"')}</div>
        </div>
        <div class="faq span-6 start-7">
          <div class="faq__item"><h3>Do friends need the Partyline app or an account?</h3><p>No. They open the join page in their phone&apos;s browser and type the code. Only the big screen signs in, once, with publik.</p></div>
          <div class="faq__item"><h3>Can a Partyline room work over a video call?</h3><p>Yes. The room code works from anywhere, so share the big screen on the call and send the code.</p></div>
          <div class="faq__item"><h3>Is Partyline made by Jackbox?</h3><p>No. Partyline has its own games, prompts and look, inspired by how party packs play. It isn&apos;t affiliated with Jackbox Games.</p></div>
          <div class="faq__item"><h3>What happens to a Partyline round when the AI is off?</h3><p>The games fall back to hand-written decks, so a round never stalls. Fakeout always uses checked facts on a local model.</p></div>
        </div>
      </div>
    </div>
  </section>
</main>

<footer class="footer footer--dark closing" id="contact" aria-labelledby="close-h">
  <div class="wrap">
    <div class="closing__cta close--word">
      <h2 id="close-h" class="pl-word">Game night</h2>
      <a class="btn btn--primary btn--xl" href="/app">Open the big screen${ARROW}</a>
    </div>
    <div class="closing__links">
      <div class="grid">
        <div class="span-4 stack-4">
          <a class="nav__logo" href="#top">${MARK}Partyline</a>
          <p class="footer__lede">Free, open-source party games, made by Vedant Soni.</p>
        </div>
        <div class="span-2 start-7 footer__col"><h3>Play</h3><ul><li><a href="/app">Big screen</a></li><li><a href="/join">Join a game</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Page</h3><ul><li><a href="#games">Games</a></li><li><a href="#questions">Questions</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Code</h3><ul><li><a href="${app.repo}">GitHub</a></li><li><a href="${app.repo}/issues">Report a bug</a></li></ul></div>
      </div>
      <div class="footer__legal">
        <span class="pl-legal"><span>&copy; 2026 Vedant Soni</span><a href="${app.repo}/blob/main/LICENSE">MIT licence</a></span>
        <span>Inspired by Jackbox Party Packs. Not affiliated with Jackbox Games.</span>
      </div>
    </div>
  </div>
</footer>
<nav class="actionbar" aria-label="Quick actions">
  <a class="btn btn--primary" href="/join">Join a game</a>
</nav>
<script type="module" src="/assets/system.js"></script>
<script type="module" src="/assets/motion/motion.js"></script>
<script type="module" src="/assets/layout/layout.js"></script>
<script type="module" src="/assets/moments/moments.js"></script>
</body>
</html>
`;
}
