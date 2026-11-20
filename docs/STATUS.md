# BrainRacer — Status (as of 2026-11-20)

**City (day), Factory (night), Beach (sunset into night), Mine, and Farm (golden hour) are playable.** Active development is on `dev`.

Next work is planned in **[docs/NEXT.md](NEXT.md)**. The original design is in [docs/PLAN.md](PLAN.md), which this file supersedes where they differ.

## How to play / test
- Full game: `play.bat`, or `npm run dev` → http://localhost:5173/ (press A / Space three times to start).
- Skip menus: `/?race=1` or `/?race=2`, plus `&seed=N`, `&round=60` (short round), `&debug=1` (physics outlines), or `&questions=off` (disable questions for this race).
- **Launch options** (not in the Setup menu; URL params, also work with `npm run dev`, e.g. `http://localhost:5173/?round=240&every=12&music=0.5&sfx=0.7`): `round` = round length in seconds (default 300, accepted 10..3600), `every` = seconds of driving between question breaks (default 10, accepted 1..120), `music` / `sfx` = volume 0..1 (defaults 0.6 / 0.8; clamped). Invalid values fall back to the defaults; saved settings never override them. `play.bat --round 240 --every 12 --music 0.5 --sfx 0.7` (alongside `--questions-off`) turns the flags into these params. Logic + tests: `src/config/launchOptions.ts`.
- **Questions are mandatory in normal play** (no "Off" in the setup menu; `?questions=off` is ignored). The ability to turn them off exists only when started with `VITE_ALLOW_QUESTIONS_OFF=1`: `npm run dev` does this automatically (`.env.development`) and also defaults questions to off (`VITE_QUESTIONS=off`); `npm run dev:questions` has the ability but questions stay on; `play.bat --questions-off` enables it for a built game; Playwright's webServer sets it. For a manual `npm run build && npm run preview` set `VITE_ALLOW_QUESTIONS_OFF=1` first. Logic: `src/config/questionsPolicy.ts`.
- Map quick launch: `/?race=2&map=industrial&seed=3&questions=off` or `&map=farm`. Use `race=1` for solo or `map=city` to select City explicitly. Free farm camera: `?dev=FarmView&seed=7&zoom=0.3` (WASD pan, Q/E zoom, R/T rotate).
- Beach quick launch: `/?race=2&map=harbor&seed=3&questions=off`. Add `&harbor=now` to see the first tide and drawbridge cycle sooner, or `&bomb=now` to spawn the homing bomb after two seconds of driving on any map.
- Mine quick launch: `/?race=2&map=underground&seed=3&questions=off`.
- Test hooks: `&dino=now` (dino appears next to players in 2 s), `&laser=now` (dino fires lasers soon and often), `&train=near` (Industrial: a wagon passes P1's nearest rail point), `&dinohits=N` / `&dinoride=N` (dino hits to defeat / ride seconds; console `__dinoDefeat()`), `&heat=100` (police chase P1), `&rewards=1` (keys 6/7/8/9 = rainbow/shockwave/ghost/magnet).
- Dev scenes: `?dev=ArtGallery | DriveTest | CameraTest | WorldTest | HudTest | InputTest | AudioTest | ChallengeTest | ResultsTest`.
- F2 anywhere: raw controller input overlay. `window.__race` = live RaceContext; `window.__challenge` = challenge state hook (used by e2e).
- E2e starts a fresh production preview. If port 4173 is occupied, set `BRAINRACER_E2E_PORT` to a free port before running `npm run e2e -- --workers=2`.

## How the game plays now
- **Menus:** The bottom face button joins (up to 2 players) and confirms. In Setup, use left/right to change options and Confirm on any option to start. Moving up from the first row wraps to the last row.
  Setup includes per-player difficulty and car, question content, and map. **Answer mode** lives in Advanced and defaults to **Stop & Answer**. Round length, question interval, and volumes also support launch options.
- **Camera:** facing-up. Each player's view rotates so their car points up (car at 52% height). 2 players = always split screen.
- **Question breaks (default "Stop & Answer"):** shared team timer. Every ~10 s of driving the world freezes for everyone, but the round clock keeps counting down (a break still in progress when time runs out is dropped). The four answer positions match the face-button diamond. Xbox shows Y/X/B/A (top/left/right/bottom), and Switch Pro shows X/Y/A/B for the same positions. Answer with face buttons, D-pad buttons, WASD/arrows, 1–4 (P1) or `, . / M` (P2). Wrong → sad sound + new question. Right → ✓ (2P waits for teammate). All right → "GO!" → turbo + boost jump for everyone.
- **"While Driving" style:** three answers (left, top, and right face buttons) in a panel centered below the car, a timer bar, and a slowdown after a miss.
- **Right answer reward:** turbo (1.6× speed, flames), a **boost jump** over traffic/buildings (lands on drivable ground), **punch-through** (traffic/props thrown aside, speed kept), plus a random bonus (rainbow/shockwave/ghost/magnet).
- **Guide buddies:** a pink flying dino (dino-car) or a twinkling star (kart) leads directly toward the destination, including when it is off-screen. It circles the goal when near or waiting. Each player sees only their own buddy. There is no on-screen destination text: players follow their buddy, and the goal ring marks the place. The team score and timer sit at the top left in single player and at the top center in split screen.
- **Goals:** shared place destinations (bakery, school, …). Both players must arrive (20 s teammate wait). Jumping through counts. +3 points per arriving car.
- **Dinosaur:** when one player reaches the goal early (2P), the dino drops in and slowly circles the goal until the teammate arrives, sometimes sweeping laser eyes. Three qualifying hits defeat it, with a team hit counting twice when both players ram it within 1.5 s. Each player gets 2 points. The dizzy dino is boardable for 8 s. **Press the right face button once within 435 px of its center** to board it ahead of other vehicles. The ridden dino walks over buildings and tosses traffic. The rider stays on for the full 20 s of driving, then returns to a car and the dino poofs. The ride timer pauses during questions. In solo it appears at half time at the current goal.
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
- The traditional four-sail mill spins on the pond hill, separate from the turbine row. Hay wagons swing on a physical hitch when rammed. A dino toss detaches the wagon, and it becomes a solid, free rolling obstacle again after landing.

## Player speed, bomb, and Beach & Harbor

- Starter cars top out at 310 px/s (dino car) or 285 px/s (kart). Acceleration, reverse, turbo, punch-through, and boost-jump distance use the half-speed balance. Steering rates stay the same. Dino lasers, ride speed, guide lead, crash impacts, freight smash threshold, and police pursuit have been retuned.
- A large homing bomb first appears after 25 s of driving. Its fuse throws sparks and a fiery orange glow. It moves at half its target's top speed, then knocks the target into a spin on contact. A later bomb can spawn 35 s after it explodes. Tune in `HOMING_BOMB`.
- The bomb, its shadow, and its fuse stay upright as each player's camera rotates.
- Pick **Beach & Harbor** in Setup. Tire tracks fade in the sand. Seeded beach groups include umbrellas, towels, coolers, beach balls and sandcastles. Use the beach ramps for jumps and drive through the pennant-marked market gaps. Cars can flatten sandcastles and scatter fruit crates, fish crates, barrels and buoys. Disturbed props return after they leave both players' views.
- The waterfront has a red-and-white lighthouse, ice cream cart, market stalls, and convertible sports cars. Two beachgoer designs with varying colors jump clear. Surfers, sailboats and gulls move around the channel. The suspension bridge has towers and cables, and the drawbridge shows a water gap, flashing lights and striped barriers when the ship passes.
- On the default five-minute round, sunset begins fading at four minutes remaining and reaches full night when two minutes remain. Wind gusts roll beach balls and the tidal surge pushes cars and loose shore props inland. Timing and strength are tuned in `HARBOR`.
- **Easy word pool:** dam remains eligible. Church and city now appear at higher levels.
- Harbor update verification: the 33-test Edge suite passed. After fixing traffic spawns on the drawbridge, typecheck, all 377 unit tests, and the three focused Harbor and Bomb browser tests passed.

## Mine

- Pick **Mine** in Setup. Cyan neon strips mark the race routes through dark caverns and across three reinforced causeways over a glowing, bubbling lava river. Each neon train pulls two illuminated ore wagons. The engines and wagons collide with road vehicles, and a heavy impact can derail the wagons.
- The caves include crystal clusters, glowing mushrooms, rock formations, glowing fissures, lanterns, floodlights, mining elevators, ore chutes and bins, timber portals, steam vents, drifting embers, pools, safety barriers, chevrons, and jump ramps. The map has its own music, "Crystal Switchback".
- A crystal rock monster guards Mine goals. Ram it to tame it, then use the right face button nearby to ride it. `&dino=now` forces the encounter for a quick check.
- Five boardable vehicles drive the cave roads: Cave Buggy, Crystal Runner, Survey Rover, Ore Hauler, and Rock Crusher. They accelerate faster and have higher top speeds when driven by a player. The Rock Crusher remains the slowest and heaviest. Hit ore crates or smaller vehicles head-on while driving it to smash crates and shove traffic aside.

## Factory

- Pick **Factory** in Setup's **Map** row. City is the default for new and older saved settings. Setup remembers the map selection, and quick launch can override it for that session. Factory is always night.
- Six lit canal bridges, a canal-side bypass, and factory cross streets connect the districts. The new southernmost bridge connects the loading loop to the east factory road. The south freight yard has an eastbound ramp. Oversized freight trucks serve the loading yards.
- The train stays on a closed rail circuit. Two sets of lights warn about the approaching train. The road network offers a bypass for either occupied crossing.
- Both cars have headlights in Industrial. Its music starts at GO and resumes after the dino cue.

## Playtest follow-ups

- Night is decided by the map: Factory is always night, City always day (the old City-lighting option and `?night=` are gone).
- A strong collision adds vehicle damage. Repeated hits lead to smoke, flames, and a comic burst when the engine stops. Tap pad **B** to highlight a nearby vehicle. Tap again within half a second to hop over as the camera follows. Your old vehicle stays behind. Keyboard controls are **B** for P1 and **N** for P2. A stopped car is replaced on a clear nearby road after eight seconds if the player stays in it. Cars take twice the hits they used to before breaking down (`VEHICLE_CONDITION.wreckDamage` 200). **Press Y (pad) twice quickly (R for P1 / Y for P2 on keyboard) to reset to your own starting car** on a clear nearby road, clearing damage; ignored during questions. **A correct answer repairs your car** (damage cleared, a stopped car drives again).
- When you take over a sedan, it drives about as fast as a starter car. Police cruisers are faster. Trucks have a lower top speed and extra weight to push traffic aside.
- The dino and rock monster toss traffic and loose props they walk into, knock loose train cars, and scatter Farm fence sections. Wild monsters can also knock a slow player car into the air and damage it.
- Up to two police cruisers pursue each player at once.
- Completing a goal activates the next goal immediately and redirects the guide buddy. Destination-ring glow fades to full transparency at the edges.

## Known gaps (also tracked in NEXT.md)
- Unused config keys: `WORLD.bigAirSec`. HudTest still emits a "Nice jump!" popup (ignored).
- Police bump picks the nearest cruiser to the crash point; no traffic right-of-way at junctions.
- Nothing has been checked by ear (audio) or with real Xbox pads yet; see the playtest checklist in NEXT.md.

## Advanced settings

Hold both triggers and press **Start** on a gamepad, or press **F9** on a keyboard. The game keeps these shortcuts hidden. Use left/right to adjust an option and Confirm from that row to accept and close. Advanced pauses every other running scene and resumes them on close. In a race the Start press also opens the pause menu underneath. Source: `src/scenes/ConfigScene.ts`.

- **Music / Sound FX volume**, **Round length**, **Time between questions**: saved in the normal settings (URL params `?round ?every ?music ?sfx` only override when actually present). Round/interval apply to the next race.
- **Audio mode** Live / Pre-render / Files (`audioMode`, default Files since 2026-11-20: it fixed the ONN box's audio clock from ~0.6x to ~1.0x). **Files** plays pre-rendered Ogg Opus files shipped in `public/audio/` (rendered once on the dev PC by `npm run audio:render`), so a weak box never synthesises or renders anything: at unlock it fetches `audio/manifest.json`, decodes the 35 sfx/loop files and the engine loop (about 0.3 s on a desktop), then decodes the 7 music tracks one after another (title first; whole set about 0.6 s on a desktop). Decoding uses a 32 kHz (music) / 44.1 kHz (sfx) `OfflineAudioContext` and each buffer is trimmed/padded to the manifest's exact sample length, so Opus padding never moves the loop points; they then go through the same buffer playback paths as Pre-render (engine Sample uses the file's loop too). Until a track is decoded its music stays silent (never live-synthesised); sfx fall back to live synthesis until their file is in. If the manifest cannot be fetched the sfx are rendered offline instead; a missing music/engine file is rendered offline too. Debug readout line 3 shows `mode files  sfx n/N  music k/M`. Pre-render details (same playback code): Pre-render renders sounds once into AudioBuffers (Tone.Offline) and plays them with plain native nodes, so the race audio graph is a few AudioBufferSourceNodes instead of live synths (for boxes whose audio render thread cannot keep up; symptom: debug `clock` well below 1.00x). Applies live: switching on starts the background render (sfx first, ~35 buffers in a few seconds on desktop; then the 7 music tracks, title first; about 20 s total on a desktop, expect much longer on a weak box; the buffers are not persisted, every page load re-renders). Until a sound or track is ready the live version plays, and a running track swaps to its buffer at the same phase with a 0.3 s crossfade. Switching to Live stops using buffers (they stay cached). Details: sfx = mono 44.1 kHz buffers (rate 1, pan 0, trimmed) played through StereoPanner and Gain with the same TRIM/voice limits; `siren` (both loudness variants) and `skid` are seamless loop buffers; music = stereo 32 kHz, one loop (ring-out folded back onto the start) per track, rendered in 4 s windows because one big offline render is several times slower. Memory is about 65 MB of buffers once everything is cached. A `rate` option on sfx now also changes the length (it is a playbackRate), where live mode only scales pitch. Code: `src/audio/bufferUtils.ts` (pure helpers, tested), `sfx.ts`, `musicPlayer.ts`, `engineSound.ts`.
- **Re-rendering the files**: `npm run audio:render` (needs ffmpeg on PATH and Edge; takes about 40 s). It starts vite on port 5186, runs the dev scene `src/scenes/dev/AudioRender.ts` in a muted headless Edge (same offline code as Pre-render, incl. MIDI overrides), and encodes Opus (music 96 kbps stereo, sfx/loops 64 kbps mono) into `public/audio/{sfx,music}/` plus `manifest.json` (exact sample length and rate of each source PCM, loop flag, bpm/beats/loop seconds, `sourceHash`). Short loops (siren x2, skid, engine) are encoded as 3 back-to-back copies and the middle one is used. `sourceHash` covers `src/audio/{sfx,musicPlayer,engineSound,bufferUtils,musicTheory}.ts` and `src/audio/music/**` (CRLF-normalised); `scripts/audioManifest.test.ts` fails with 'audio sources changed: run npm run audio:render' when they differ. Commit the regenerated `public/audio`. Total about 3.8 MB.
- **Engine sound** Full / Lite (one saw + lowpass) / Sample / Off. Live. Sample = a 2 s idle-pitch loop (saw + square -> lowpass, no vibrato) rendered once and played as a looping buffer; playbackRate follows speed (55..170 Hz ratio), gain follows the Full curve, boost is +5% rate and +0.04 gain. Independent of Audio mode.
- **Audio buffer** Fast / Balanced / Safe = Web Audio `latencyHint` interactive / balanced / playback. Applies after reload.
- **Schedule ahead** 0.1 / 0.2 / 0.3 s Tone look-ahead. Live. Larger = more starvation tolerance, more latency.
- **Compressor** On/Off: master -> compressor -> limiter -> out, or master -> out. Live.
- **Frame-rate cap** 60 / 30 (Phaser `fps.limit`). Applies after reload.
- **Debug readout** (bottom-left, always on top): `FPS`, audio `state`, `clock` (audio-clock advance / wall-clock over the last second; ~1.00 healthy, lower = audio starving), `stalls` (1 s windows with clock < 0.5 while visible), `lat` base/output latency ms, `ahead` look-ahead s, `sfx` live sfx voices, `eng` engine mode. A third line adds `mode live|pre`, `sfxReady n/N` (pre-rendered sfx buffers incl. 3 loops), `music cached k/7` and `RENDERING` while offline jobs are queued or running.
- **Traffic** Normal / Reduced (~50%) / Minimal (~25%) (`traffic`, applies to the next race). `scaledCount(n, level)` in `deviceTuning.ts` (rounds up, never below 1 for a positive count) scales every ambient-vehicle limit in `TrafficSystem.init` (city/harbor/underground cars, industrial regulars + freight trucks, farm pickups/tractors/combines), read once at race start. Police, dino, parked and story vehicles are untouched. Spawns stay seeded; there are just fewer.
- **P1 gas / P2 gas** A button / Trigger / Auto (`gas: [p1, p2]`, gamepads only, keyboards unchanged). A = max(RT, A) as before; Trigger = only RT gives throttle (A still confirms/answers); Auto = full throttle unless LT > 0.1 (so braking/reversing still works). Why: on the ONN in TV Bro, holding a button on the second controller flips TV Bro into controller-as-mouse mode; analog triggers avoid it. Applied only in `InputManager.get(player)` (races), so `any()`, menus and the LT+RT+Start combo always see the raw pad. Logic: `gasThrottle` in `src/input/mapping.ts`.
- **Input readout** (with Debug readout on): a top-right block (clear of the bottom timer bar and the centered scoreboard) lists each connected pad as `p0 Xbox b[0,7] L.00 R.85 x.12 y-.50` (pressed button indices, LT/RT values, left stick) and `keys <last 3 key codes> + age`. It reads `navigator.getGamepads()` and `window` keydown directly (a deliberate exception to rule 8, diagnostics only).
- Audio also tries `resume()` on `statechange`, tab-visible, and any key/pointer press if the context is not running.
