# BrainRacer — Status (as of 2026-11-19, end of session 1)

**Playable v1 (city biome), after 3 rounds of playtest feedback.** Branch `dev` (local only, never pushed; `main` still has only the old prototype).
Tests: 255 unit (`npm test`) + 6 browser e2e (`npm run e2e`), all passing. ~140 fps headless Edge (RTX 3060), 2 players.

Next work is planned in **[docs/NEXT.md](NEXT.md)**. The original design is in [docs/PLAN.md](PLAN.md), which this file supersedes where they differ.

## How to play / test
- Full game: `play.bat`, or `npm run dev` → http://localhost:5173/ (press A / Space three times to start).
- Skip menus: `/?race=1` or `/?race=2`, plus `&seed=N`, `&round=60` (short round), `&debug=1` (physics outlines).
- Test hooks: `&dino=now` (dino appears next to players in 2 s), `&heat=100` (police chase P1), `&rewards=1` (keys 6/7/8/9 = rainbow/shockwave/ghost/magnet).
- Dev scenes: `?dev=ArtGallery | DriveTest | CameraTest | WorldTest | HudTest | InputTest | AudioTest | ChallengeTest | ResultsTest`.
- F2 anywhere: raw controller input overlay. `window.__race` = live RaceContext; `window.__challenge` = challenge state hook (used by e2e).

## How the game plays now
- **Menus:** A joins (up to 2 players: pad or keyboard WASD / arrows); A again → Setup; A on any Setup row starts.
  Setup: per-player difficulty + car; Question style (**Stop & Answer** default / While Driving); Questions (**Words** default / Math / Mix); Questions every N s (default 10); round length; volumes.
- **Camera:** facing-up. Each player's view rotates so their car points up (car at 52% height). 2 players = always split screen.
- **Question breaks (default "Stop & Answer"):** shared team timer. Every ~10 s of driving the world freezes for everyone. Each player gets a big question with **4 answers in the controller diamond** (Y top, X left, B right, A bottom); answer with face buttons, D-pad/stick, WASD/arrows, 1–4 (P1) or `, . / M` (P2). Wrong → sad sound + new question; right → ✓ (2P: wait for teammate). All right → "GO!" → turbo + boost jump for everyone.
- **"While Driving" style:** the old mode. 3 answers (X/Y/B) in a panel centered below the car, a timer bar, and a slowdown after a miss.
- **Right answer reward:** turbo (1.6× speed, flames), a **boost jump** over traffic/buildings (lands on drivable ground), **punch-through** (traffic/props thrown aside, speed kept), plus a random bonus (rainbow/shockwave/ghost/magnet).
- **Guide buddies:** a pink flying dino (dino-car) or a twinkling star (kart) flies ahead of each car along the real street route and circles the goal when near or waiting. Each player sees only their own buddy. A destination card (icon + word) sits at the top of each view and pulses when a new goal appears; an upright label appears over the goal.
- **Goals:** shared place destinations (bakery, school, …). Both players must arrive (20 s teammate wait). Jumping through counts. +3 points per arriving car.
- **Dinosaur:** when one player reaches the goal early (2P), the dino drops in and slowly circles the goal until the teammate arrives. Ram it (health bar; turbo ×1.5; both players within 1.5 s = TEAM double); defeat = poof + 2 points each. 1P: appears at half time at the current goal.
- **World:** seeded 48×48 city, beveled 3D buildings, picture signs on place buildings, ramps, ~25 light traffic cars/trucks, police with a gentle siren (bump only, despawn off-screen).
- **Words:** `manifest.csv` labels → `src/data/wordAliases.json` (single simple words) → `src/data/wordMeta.json` (category, `simple`, `confusableWith`). Multi-word labels are Hard only. After edits: `npm run assets`.
- **Audio:** all synthesized (Tone.js). Music = JSON note tracks in `src/audio/music/tracks/` (optional `.mid` overrides in `src/audio/music/midi/`).

## Key tunables (all in `src/config/gameConfig.ts` unless noted)
`CAMERA` (facingUp, carScreenY, rotTau, maxAngVel, zooms) · `VEHICLE_MODEL` (pivotRate, unstick, recoil) · `CAR_SPECS` · `CHALLENGE` (wrongRetrySec, answerGuardSec, break timing) · `DIFFICULTY` · `REWARDS` (turbo, jump, miss slowdown) · `TRAFFIC` · `POLICE` · `GOALS` · `DINO` (guardSpeed, hp, damage) · `GUIDE` (buddy lead distance, orbit) · HUD layout in `src/ui/hud/hudConfig.ts`.

## Session 2 changes (2026-11-19)
- Easy: place challenges only use place words flagged `simple`; otherwise a normal challenge is asked. Normal no longer uses multi-word places.
- Answer inputs held when a question appears (gas/A, D-pad, stick, keys) must be released and pressed again (`src/systems/answerArming.ts`, e2e `tests/e2e/answerArming.spec.ts`).
- Break rewards (turbo, jump, bonus) wait for the panel to fade plus `CHALLENGE.rewardDelayAfterBreakSec` (0.7 s); the car glows in its player color meanwhile.
- Break panels sit below the scoreboard. The big "Drive to the …" banner is gone; the destination card pulses on a new goal, and a small "Waiting…" pill replaces the teammate-wait banner.
- Guide buddy hovers ~0.8 of the way from the car to its view edge (`GUIDE.edgeFrac`, `edgeMargin`, `topInset`, `seamInset`, `holdMax`; `lookAhead` 760).
- Tests: 272 unit + 7 e2e, all passing.

## Known gaps (also tracked in NEXT.md)
- Unused config keys: `WORLD.bigAirSec`, `GOALS.arrowBandFrac`, `GOALS.arrowBandMaxH`. HudTest still emits a "Nice jump!" popup (ignored).
- Police bump picks the nearest cruiser to the crash point; no traffic right-of-way at junctions.
- Nothing has been checked by ear (audio) or with real Xbox pads yet; see the playtest checklist in NEXT.md.
