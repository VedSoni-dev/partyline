# Partyline: design

Written before any UI code (the taste skill's brief), then kept true to what shipped.

- **Kind (taste skill):** gaming (page type software, site-kind gaming). Dealt: hero `photo`, palette `plum-black-pink`, type `mona`, radius round, moment `marquee-row`.
- **Theme:** mesh from the kit, overridden in `app/globals.css` with the dealt palette (mesh's violet accent is off-limits under the taste rules).
- **One-line feel:** a game show on your TV at 1 a.m.: near-black stage, one hot pink spotlight, huge type you can read from the couch.
- **Type:** Mona Sans (display 500, slightly wide, tracking -3%), Mona Sans text, Geist Mono for room codes, timers and scores.
  The big screen sizes from the viewport (`clamp()` on vw) so it reads from 3 m away; prompts are at least 4vw.
- **Colour:** ground `#0d060b`, surface `#1b0e17`, ink `#ffffff`, muted `#9a8f97`, ONE accent `#ff488b` (the primary action,
  the timer when it runs low, the winner). Players get their own colours (amber, mint, sky, orange, lime, cyan, coral, sand),
  used only for their name chips, avatars and vote dots. Never violet.
- **Two surfaces:**
  - **Big screen** (`/app`, the laptop or TV): the stage. One focal thing at a time: the room code in the lobby, the prompt
    while people write, the two answers while people vote, the drawing while people guess.
  - **Phone** (`/join`): one action per screen, the primary button in the bottom third, full width, 56 px tall. No scrolling
    while writing. The phone never shows what the big screen shows (eyes go up).
- **The hero moment (landing):** the real big screen and three real phone screens side by side, mid-round.
- **Signature motion:** answers slam onto the stage (scale 1.08 → 1 on the spring, a 2 % squash); vote dots fly from the
  player chips to the answer on arcs, one after another (stagger 40 ms); the winning card lifts and the loser dims to 40 %.
- **Every state designed:** empty lobby (the code and QR, "Waiting for 3 players", a bot can fill in) · loading (AI writing
  prompts: a progress line with what it's doing; decks used if it's slow or off) · error (a player's lie that is the truth
  shakes and says "That's the real answer. Write a lie."; a lost connection shows "Reconnecting" and resumes) · success
  (the winner's card gets one flourish ring; the final podium).
- **Reel shots:** 1) three phones joining the room code at once; 2) an AI prompt, two answers slamming in, votes flying;
  3) a phone drawing appearing on the big screen for everyone to guess.
