# BrainRacer — Status (as of 2026-11-19)

**City (day) and Industrial (night) are playable.** A Farm map is planned in NEXT.md. Branch `dev` (local only, never pushed; `main` still has only the old prototype).

Next work is planned in **[docs/NEXT.md](NEXT.md)**. The original design is in [docs/PLAN.md](PLAN.md), which this file supersedes where they differ.

## How to play / test
- Full game: `play.bat`, or `npm run dev` → http://localhost:5173/ (press A / Space three times to start).
- Skip menus: `/?race=1` or `/?race=2`, plus `&seed=N`, `&round=60` (short round), `&debug=1` (physics outlines), or `&questions=off` (disable questions for this race).
- **Launch options** (not in the Setup menu; URL params, also work with `npm run dev`, e.g. `http://localhost:5173/?round=240&every=12&music=0.5&sfx=0.7`): `round` = round length in seconds (default 300, accepted 10..3600), `every` = seconds of driving between question breaks (default 10, accepted 1..120), `music` / `sfx` = volume 0..1 (defaults 0.6 / 0.8; clamped). Invalid values fall back to the defaults; saved settings never override them. `play.bat --round 240 --every 12 --music 0.5 --sfx 0.7` (alongside `--questions-off`) turns the flags into these params. Logic + tests: `src/config/launchOptions.ts`.
- **Questions are mandatory in normal play** (no "Off" in the setup menu; `?questions=off` is ignored). The ability to turn them off exists only when started with `VITE_ALLOW_QUESTIONS_OFF=1`: `npm run dev` does this automatically (`.env.development`) and also defaults questions to off (`VITE_QUESTIONS=off`); `npm run dev:questions` has the ability but questions stay on; `play.bat --questions-off` enables it for a built game; Playwright's webServer sets it. For a manual `npm run build && npm run preview` set `VITE_ALLOW_QUESTIONS_OFF=1` first. Logic: `src/config/questionsPolicy.ts`.
- Industrial quick launch: `/?race=2&map=industrial&seed=3&questions=off`. Use `race=1` for solo or `map=city` to select City explicitly.
- Test hooks: `&dino=now` (dino appears next to players in 2 s), `&laser=now` (dino fires lasers soon and often), `&train=near` (Industrial: a wagon passes P1's nearest rail point), `&heat=100` (police chase P1), `&rewards=1` (keys 6/7/8/9 = rainbow/shockwave/ghost/magnet).
- Dev scenes: `?dev=ArtGallery | DriveTest | CameraTest | WorldTest | HudTest | InputTest | AudioTest | ChallengeTest | ResultsTest`.
- F2 anywhere: raw controller input overlay. `window.__race` = live RaceContext; `window.__challenge` = challenge state hook (used by e2e).

## How the game plays now
- **Menus:** A joins (up to 2 players: pad or keyboard WASD / arrows); A again → Setup; A on any Setup row starts.
  Setup: per-player difficulty (Easy ★ / **Easy+ ★½** / Normal ★★ / Hard ★★★) + car; Question style (**Stop & Answer** default / While Driving); Questions (**Words** default / Math / Mix / Off); Map (City is always day, Industrial always night). Round length, question interval and volumes are launch options (see above).
- **Camera:** facing-up. Each player's view rotates so their car points up (car at 52% height). 2 players = always split screen.
- **Question breaks (default "Stop & Answer"):** shared team timer. Every ~10 s of driving the world freezes for everyone, but the round clock keeps counting down (a break still in progress when time runs out is dropped). Each player gets a big question with **4 answers in the controller diamond** (Y top, X left, B right, A bottom). Answer with face buttons, D-pad buttons, WASD/arrows, 1–4 (P1) or `, . / M` (P2). Wrong → sad sound + new question. Right → ✓ (2P waits for teammate). All right → "GO!" → turbo + boost jump for everyone.
- **"While Driving" style:** the old mode. 3 answers (X/Y/B) in a panel centered below the car, a timer bar, and a slowdown after a miss.
- **Right answer reward:** turbo (1.6× speed, flames), a **boost jump** over traffic/buildings (lands on drivable ground), **punch-through** (traffic/props thrown aside, speed kept), plus a random bonus (rainbow/shockwave/ghost/magnet).
- **Guide buddies:** a pink flying dino (dino-car) or a twinkling star (kart) leads directly toward the destination, including when it is off-screen. It circles the goal when near or waiting. Each player sees only their own buddy. There is no on-screen destination text: players follow their buddy, and the goal ring marks the place. The team score and timer sit at the top left in single player and at the top center in split screen.
- **Goals:** shared place destinations (bakery, school, …). Both players must arrive (20 s teammate wait). Jumping through counts. +3 points per arriving car.
- **Dinosaur:** when one player reaches the goal early (2P), the dino drops in and slowly circles the goal until the teammate arrives. Ram it (health bar; turbo ×1.5; both players within 1.5 s = TEAM double); defeat = poof + 2 points each. 1P: appears at half time at the current goal.
- **World:** seeded 48×48 city, beveled 3D buildings, picture signs on place buildings, ramps, ~25 light traffic cars/trucks, police with a gentle siren (bump only, despawn off-screen).
- **Words:** `manifest.csv` labels → `src/data/wordAliases.json` (single simple words) → `src/data/wordMeta.json` (category, `simple`, `confusableWith`). Multi-word labels are Hard only. After edits: `npm run assets`.
- **Audio:** all synthesized (Tone.js). Music = JSON note tracks in `src/audio/music/tracks/` (optional `.mid` overrides in `src/audio/music/midi/`).

## Key tunables (all in `src/config/gameConfig.ts` unless noted)
`CAMERA` (facingUp, carScreenY, rotTau, maxAngVel, zooms) · `VEHICLE_MODEL` (pivotRate, unstick, recoil) · `CAR_SPECS` · `CHALLENGE` (wrongRetrySec, answerGuardSec, break timing) · `DIFFICULTY` · `REWARDS` (turbo, jump, miss slowdown) · `TRAFFIC` · `POLICE` · `GOALS` · `DINO` (guardSpeed, hp, damage) · `GUIDE` (buddy lead distance, orbit) · HUD layout in `src/ui/hud/hudConfig.ts`.

## Session 2 changes (2026-11-19)
- Easy: place challenges only use place words flagged `simple`; otherwise a normal challenge is asked. Normal no longer uses multi-word places.
- Held answer buttons and keys must be released and pressed again. Controller stick movement steers and navigates menus. Question breaks read fresh button and key presses (`tests/e2e/answerArming.spec.ts`).
- Break rewards (turbo, jump, bonus) wait for the panel to fade plus `CHALLENGE.rewardDelayAfterBreakSec` (0.7 s); the car glows in its player color meanwhile.
- Break panels sit below the scoreboard. The big "Drive to the …" banner is gone, and so is the destination card and goal label; a small "Waiting…" pill replaces the teammate-wait banner.
- Guide buddy hovers ~0.8 of the way from the car to its view edge (`GUIDE.edgeFrac`, `edgeMargin`, `topInset`, `seamInset`, `holdMax`).
- Tests: 272 unit + 7 e2e, all passing.

## Session 3 changes (2026-11-19)
- **Round clock** keeps running during Stop & Answer breaks (`RaceScene` break branch + `ChallengeSystem` stops on `round:end`).
- **Launch options** replace the Setup rows for round length, question interval and volumes (see How to play). Day/night row removed: Industrial = night, City = day; `Settings.nightDriving` deleted.
- **Easy+ difficulty** (`DIFFICULTY.easyPlus`): addition with answers 2..19, about half teen sums (`teenChance`), near-miss distractors with "forgot to add one" (answer − 1) often first; word targets 65% simple / 35% any single word (`simpleTargetChance`), different-category distractors; any single-word place.
- **No destination text:** the destination card and goal label are gone (`GoalIndicator` deleted); guide buddies + goal ring remain.
- **Industrial night is much darker:** world-sized dark overlay (`INDUSTRIAL_LIGHTING.nightAlpha` 0.7, `nightColor`), longer/stronger headlights, goal glow, car halos, warm pools under bridges/bays. Vehicles draw above the darkness.
- **Player police siren:** driving a cruiser loops your own siren at `POLICE.playerSirenVolume` (0.55, AI 0.22) panned to your side; AI chase siren is muted for you meanwhile. All sirens stop on pause, question breaks and round end.
- **Freight smash:** a turbo hit or a hit ≥ `FREIGHT.smashImpactSpeed` (760 px/s) breaks the train at that wagon; wagons tumble, crates spill, poof, "+2" popup (cosmetic, not scored yet). Wagons re-form after `FREIGHT.reformSec` (9 s) when the slot is clear. Dev hook `&train=near`.
- **Dino laser eyes:** while guarding and a player is within 1100 px, the dino charges (eyes glow 1.1 s) then sweeps twin pink beams over ~86° for 2.2 s, every 9–15 s. Traffic gets the comic toss; players get a harmless bounce + spin + brief slowdown (no damage). Tunables `DINO_LASER`; dev hook `&laser=now` (with `&dino=now`).
- **Building gaps:** no straight run of building tiles longer than `WORLD.maxBuildingRun` (6) in City or Industrial; cuts are one-tile sidewalk alleys (City) or yard gaps (Industrial). Seeded layouts changed (e.g. the seed-3 fountain moved).
- Tests: 304 unit + 22 e2e. The e2e "battered car smokes" test failed before this session too; under full-suite load the Industrial/dino e2e specs can time out at startup (they pass alone).

## Industrial at Night

- Pick **Industrial** in Setup's **Map** row. City is the default for new and older saved settings. Setup remembers the map selection, and quick launch can override it for that session. Industrial is always night.
- Three lit canal bridges, a canal-side bypass, and factory cross streets connect the districts. The north and south bridge roads run through open factory bays. The south freight yard has an eastbound ramp. Oversized freight trucks serve the loading yards.
- The train stays on a closed rail circuit. Two sets of lights warn about the approaching train. The road network offers a bypass for either occupied crossing.
- Both cars have headlights in Industrial. Its music starts at GO and resumes after the dino cue.

## Playtest follow-ups

- Night is decided by the map: Industrial is always night, City always day (the old City-lighting option and `?night=` are gone).
- A strong collision adds vehicle damage. Repeated hits lead to smoke, flames, and a comic burst when the engine stops. Tap pad **B** to highlight a nearby vehicle. Tap again within half a second to hop over as the camera follows. Your old vehicle stays behind. Keyboard controls are **B** for P1 and **N** for P2. A stopped car is replaced on a clear nearby road after eight seconds if the player stays in it. Cars take twice the hits they used to before breaking down (`VEHICLE_CONDITION.wreckDamage` 200). **Press Y (pad) twice quickly (R for P1 / Y for P2 on keyboard) to reset to your own starting car** on a clear nearby road, clearing damage; ignored during questions. **A correct answer repairs your car** (damage cleared, a stopped car drives again).
- When you take over a sedan, it drives about as fast as a starter car. Police cruisers are faster. Trucks have a lower top speed and extra weight to push traffic aside.
- The dino can stomp and toss nearby traffic. It can also knock a slow player car into the air and damage it.
- Up to two police cruisers pursue each player at once.
- Completing a goal activates the next goal immediately and redirects the guide buddy. Destination-ring glow fades to full transparency at the edges.

## Known gaps (also tracked in NEXT.md)
- Unused config keys: `WORLD.bigAirSec`. HudTest still emits a "Nice jump!" popup (ignored).
- Police bump picks the nearest cruiser to the crash point; no traffic right-of-way at junctions.
- Nothing has been checked by ear (audio) or with real Xbox pads yet; see the playtest checklist in NEXT.md.
