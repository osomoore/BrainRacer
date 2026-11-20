# BrainRacer — Status (as of 2026-11-19)

**City (day), Industrial (night), Farm (golden hour), and Beach & Harbor (sunset into night) are playable.** Branch `dev` (local only, never pushed; `main` still has only the old prototype).

Next work is planned in **[docs/NEXT.md](NEXT.md)**. The original design is in [docs/PLAN.md](PLAN.md), which this file supersedes where they differ.

## How to play / test
- Full game: `play.bat`, or `npm run dev` → http://localhost:5173/ (press A / Space three times to start).
- Skip menus: `/?race=1` or `/?race=2`, plus `&seed=N`, `&round=60` (short round), `&debug=1` (physics outlines), or `&questions=off` (disable questions for this race).
- **Launch options** (not in the Setup menu; URL params, also work with `npm run dev`, e.g. `http://localhost:5173/?round=240&every=12&music=0.5&sfx=0.7`): `round` = round length in seconds (default 300, accepted 10..3600), `every` = seconds of driving between question breaks (default 10, accepted 1..120), `music` / `sfx` = volume 0..1 (defaults 0.6 / 0.8; clamped). Invalid values fall back to the defaults; saved settings never override them. `play.bat --round 240 --every 12 --music 0.5 --sfx 0.7` (alongside `--questions-off`) turns the flags into these params. Logic + tests: `src/config/launchOptions.ts`.
- **Questions are mandatory in normal play** (no "Off" in the setup menu; `?questions=off` is ignored). The ability to turn them off exists only when started with `VITE_ALLOW_QUESTIONS_OFF=1`: `npm run dev` does this automatically (`.env.development`) and also defaults questions to off (`VITE_QUESTIONS=off`); `npm run dev:questions` has the ability but questions stay on; `play.bat --questions-off` enables it for a built game; Playwright's webServer sets it. For a manual `npm run build && npm run preview` set `VITE_ALLOW_QUESTIONS_OFF=1` first. Logic: `src/config/questionsPolicy.ts`.
- Map quick launch: `/?race=2&map=industrial&seed=3&questions=off` or `&map=farm`. Use `race=1` for solo or `map=city` to select City explicitly. Free farm camera: `?dev=FarmView&seed=7&zoom=0.3` (WASD pan, Q/E zoom, R/T rotate).
- Beach & Harbor quick launch: `/?race=2&map=harbor&seed=3&questions=off`. Add `&harbor=now` to see the first tide and drawbridge cycle sooner, or `&bomb=now` to spawn the homing bomb after two seconds of driving on any map.
- Test hooks: `&dino=now` (dino appears next to players in 2 s), `&laser=now` (dino fires lasers soon and often), `&train=near` (Industrial: a wagon passes P1's nearest rail point), `&dinohits=N` / `&dinoride=N` (dino hits to defeat / ride seconds; console `__dinoDefeat()`), `&heat=100` (police chase P1), `&rewards=1` (keys 6/7/8/9 = rainbow/shockwave/ghost/magnet).
- Dev scenes: `?dev=ArtGallery | DriveTest | CameraTest | WorldTest | HudTest | InputTest | AudioTest | ChallengeTest | ResultsTest`.
- F2 anywhere: raw controller input overlay. `window.__race` = live RaceContext; `window.__challenge` = challenge state hook (used by e2e).
- E2e starts a fresh production preview. If port 4173 is occupied, set `BRAINRACER_E2E_PORT` to a free port before running `npm run e2e -- --workers=2`.

## How the game plays now
- **Menus:** A joins (up to 2 players: pad or keyboard WASD / arrows); A again → Setup; A on any Setup row starts.
  Setup: per-player difficulty (Easy ★ / **Easy+ ★½** / Normal ★★ / Hard ★★★) + car; Question style (**Stop & Answer** default / While Driving); Questions (**Words** default / Math / Mix / Off); Map (City is always day, Industrial always night). Round length, question interval and volumes are launch options (see above).
- **Camera:** facing-up. Each player's view rotates so their car points up (car at 52% height). 2 players = always split screen.
- **Question breaks (default "Stop & Answer"):** shared team timer. Every ~10 s of driving the world freezes for everyone, but the round clock keeps counting down (a break still in progress when time runs out is dropped). Each player gets a big question with **4 answers in the controller diamond** (Y top, X left, B right, A bottom). Answer with face buttons, D-pad buttons, WASD/arrows, 1–4 (P1) or `, . / M` (P2). Wrong → sad sound + new question. Right → ✓ (2P waits for teammate). All right → "GO!" → turbo + boost jump for everyone.
- **"While Driving" style:** the old mode. 3 answers (X/Y/B) in a panel centered below the car, a timer bar, and a slowdown after a miss.
- **Right answer reward:** turbo (1.6× speed, flames), a **boost jump** over traffic/buildings (lands on drivable ground), **punch-through** (traffic/props thrown aside, speed kept), plus a random bonus (rainbow/shockwave/ghost/magnet).
- **Guide buddies:** a pink flying dino (dino-car) or a twinkling star (kart) leads directly toward the destination, including when it is off-screen. It circles the goal when near or waiting. Each player sees only their own buddy. There is no on-screen destination text: players follow their buddy, and the goal ring marks the place. The team score and timer sit at the top left in single player and at the top center in split screen.
- **Goals:** shared place destinations (bakery, school, …). Both players must arrive (20 s teammate wait). Jumping through counts. +3 points per arriving car.
- **Dinosaur:** when one player reaches the goal early (2P), the dino drops in and slowly circles the goal until the teammate arrives, sometimes sweeping laser eyes. Three qualifying hits defeat it, with a team hit counting twice when both players ram it within 1.5 s. Each player gets 2 points. The dizzy dino is boardable for 8 s. **Press B once within 435 px of its center** to board it ahead of other vehicles. The ridden dino walks over buildings and tosses traffic. The rider stays on for the full 20 s of driving, then returns to a car and the dino poofs. The ride timer pauses during questions. In solo it appears at half time at the current goal.
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

## Session 4 changes (2026-11-19)
- **Industrial:** a bit lighter (`INDUSTRIAL_LIGHTING.nightAlpha` 0.57), far busier (~220 seeded props: containers, pallets, barrels, tanks, conveyors, smoke stacks, lamp posts with warm pools, parked trucks, forklifts, pipes, fences, lit roofs; `INDUSTRIAL_PROPS`), more traffic (40 cars, 8 freight trucks), **5 canal bridges**.
- **Player police siren** louder and brighter (`POLICE.playerSirenVolume` 1.4; ≥ 1 switches to a triangle tone with an open filter).
- **Guide buddy (2P):** an arrived player who drives off while waiting for the teammate now gets the buddy back (`guideMath.nextGoalMode`, `GUIDE.leaveGoal` 600).
- **Ride the dino** (see Dinosaur above). Tunables `DINO.hitsToDefeat`, `DINO.teamHits`, `DINO_RIDE`. Events `dino:tamed`, `dino:ridden`, `dino:rideEnded`.
- **Farm map** (see below).
- Tests: 369 unit + 29 e2e; only the old "battered car smokes" e2e fails.

## Farm

- Pick **Farm** in Setup's Map row or `?map=farm`. Fixed golden late-afternoon sun: long soft shadows toward `world.farm.shadowAngle` (0.35 rad) for every building, tree, hay bale, fence and turbine/windmill (blades cast spinning shadows); warm grade layer (`FARM_LOOK`). Bouncy country music track `farm`.
- Generator `src/world/gen/farm.ts` + `farmBuild.ts` (`FARM_GEN`): paved county loop, village crossroads (houses/shops/bakery/school), 2-wide dirt farm lanes (`Tile.Dirt` with roadMask ≠ 0), a stream with 4 bridges, 3–4 farmsteads (barn, farmhouse, silo, shed), a corn maze plus corn fields, fenced pastures (2-tile gates), duck pond, windmill hill, orchard, woods, pumpkin patch, wind-turbine row, mud on lanes, a hay-bale ramp and hill crests. 13 place words (`FARM_PLACE_WORDS`). Layout mirrored per seed.
- Renderer `src/world/farmWorld.ts` / `farmGround.ts`, light `FarmLightSystem`. Players can drive through fence sections, which scatter and reassemble outside all player views.
- **Corn & mud** (`CornSystem`, `FARM_CORN`): corn caps speed at 60%, mud at 50% with a wobble; corn flattens into a stamped track that springs back as soon as it is off every player's view (or after 30 s). Rustle and splash sounds.
- **Animals** (`AnimalSystem`, `animalAI.ts`, `ANIMALS`): cows, sheep, pigs, horses in pastures, chickens in farmyards, ducks by the pond. They wander and scurry from fast cars; a hit sends them flying cartoon-style (star-eye tumble, spin, bounce, dazed, walk home). Never hurt, never damage cars (`CollisionSystem` skips animal contacts). Dino roar scatters them.
- **Farm traffic** (`farmTraffic.ts`, `FARM_TRAFFIC`): 25 pickups, 4 slow tractors with hay wagons (`HayWagon.ts`), 2 combines. All boardable and dino-tossable. Pickups drive like normal player cars when boarded. Tractors and combines use the player truck handling.

## Player speed, bomb, and Beach & Harbor

- Starter cars top out at 310 px/s (dino car) or 285 px/s (kart). Acceleration, reverse, turbo, punch-through, and boost-jump distance use the half-speed balance. Steering rates stay the same. Dino lasers, ride speed, guide lead, crash impacts, freight smash threshold, and police pursuit have been retuned.
- A large homing bomb first appears after 25 s of driving. Its fuse throws sparks and a fiery orange glow. It moves at half its target's top speed, then knocks the target into a spin on contact. A later bomb can spawn 35 s after it explodes. Tune in `HOMING_BOMB`.
- Pick **Beach & Harbor** in Setup. Tire tracks fade in the sand. Passing cars scatter umbrellas and beach balls, and beachgoers jump clear. The channel has animated surfers, sailboats, decorative docks, and a ship. A suspension bridge, timed drawbridge, and south crossing connect the two sides.
- The waterfront has a red-and-white lighthouse with a sweeping beam, ice cream cart, market stalls, and convertible sports car traffic. Sunset fades to night over the round. A brief tidal surge pushes cars and loose beach props inland. Time features are tuned in `HARBOR`.
- **Easy word pool:** dam remains eligible. Church and city now appear at higher levels.
- Verification: typecheck, 376 unit tests, and 32 Edge e2e tests passed with a fresh production build. The new scenarios cover split-screen fence restoration, single-press dino boarding, the harbor tide and drawbridge, sand tracks, and bomb knockback.

## Industrial at Night

- Pick **Industrial** in Setup's **Map** row. City is the default for new and older saved settings. Setup remembers the map selection, and quick launch can override it for that session. Industrial is always night.
- Five lit canal bridges, a canal-side bypass, and factory cross streets connect the districts. The north and south bridge roads run through open factory bays. The south freight yard has an eastbound ramp. Oversized freight trucks serve the loading yards.
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
