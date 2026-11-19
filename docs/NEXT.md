# BrainRacer — Next Conversation Plan

Start here in a new conversation. Read `CLAUDE.md`, `docs/STATUS.md` (current state) and this file.

## How we work (proven in session 1)
- **Main session = orchestrator (Opus):** owns contracts (`src/core/*`), `RaceScene`, merging, review, small glue fixes, docs.
- **Implementation = Sonnet sub-agents** (Haiku for mechanical chores), run in parallel with **disjoint file ownership**. The user prefers this to save usage.
- **Codex as driver:** if the user hands the wheel to Codex for a while, see `AGENTS.md` at the repo root (it acts as orchestrator and may commit on `dev`).
- **Codex (user runs it in another VS Code panel):** give it self-contained jobs that touch files nobody else is editing (data/JSON content such as music tracks or `wordMeta.json`). Codex must not run git; the orchestrator validates and commits its output.
- **Worktrees (manual, because the Agent tool's built-in `isolation: "worktree"` fails on this machine with a c:/C: drive-letter mismatch):**
  ```powershell
  git worktree add -q ".worktrees\X" -b "pkg/X" dev
  New-Item -ItemType Junction -Path ".worktrees\X\node_modules" -Target "$PWD\node_modules"
  # in the worktree: npm run assets
  ```
  Agent prompt must say: work only inside `.worktrees\X` with absolute paths, a unique dev-server port, one commit on `pkg/X`, never delete the junction, **never `git stash`** (shared across worktrees).
  **Removal (order matters!):** stop the agent's dev server, `cmd /c rmdir .worktrees\X\node_modules` (deletes the link only), THEN `git worktree remove --force .worktrees\X; git branch -D pkg/X`. Removing a worktree with the junction still present wipes the real `node_modules` (recover with `npm ci`).
- **Merge loop:** `git merge --no-ff pkg/X` → `npx tsc --noEmit` → `npm test` → `npm run e2e` → screenshot check via Playwright on Edge (`chromium.launch({ channel: 'msedge' })`) → update STATUS.
- Vite "Outdated Optimize Dep" after big merges → restart the dev server with `--force`.

## Queued playtest changes

Session 3 finished the queued playtest list and the map/gameplay ideas (destination text, round clock during breaks, launch options, day/night by map, darker Industrial, Easy+, player siren, freight smash, dino lasers, building gaps). See STATUS "Session 3 changes".

## Backlog

### Session 3 follow-ups
- Freight smash "+2" is a popup only. Add a `train:smashed { player, cars }` event so ScoreSystem awards real points. A smash also registers as a normal building crash (damage/shake); decide if it should.
- Proposed sounds (`SfxName`): `laser` (dino charge/fire; reuses turbo/shockwave/pop now) and `smash` (reuses crashBig/pop).
- Local texture keys not in `TEX`: `dino_laser_beam`, `dino_laser_glow`, `industrial_cargo_crate`. Promote to `assetKeys.ts` if wanted.
- Goal ring floor sprite sits under the Industrial darkness overlay (the glow/beacon compensate). Consider drawing it above `INDUSTRIAL_LIGHTING.nightDepth`.
- "Waiting…" pill still sits at `HUD.hint.y` 112, which was set below the old destination card; check it on screen. `hudMath.isOnScreen` is now only used by its test. `GUIDE.topInset` comment in GuideSystem still mentions destination cards.
- Easy+ blurb could read "Bigger sums, more words" instead of "A little bigger".
- e2e: "a battered car smokes…" fails (already failed before session 3). Industrial/dino specs can time out at startup under full-suite parallel load; consider `workers: 2`.
- **Never use `git stash` in agent worktrees:** the stash is shared by all worktrees, and two session-3 agents swapped each other's work that way (recovered).

### Session 2 follow-ups

Session 2 finished items 1–6 (Easy place words, reward delay, held-button arming, break panels vs scoreboard, goal banner → card pulse, guide buddy distance). See STATUS. Open follow-ups from that work:
- Words flagged `simple` but borderline for age 5: church, city, dam (`src/data/wordMeta.json`). User to decide.
- `CHALLENGE.rewardPanelClearSec` (1.05) mirrors HUD `panel.resultHoldSec + fadeSec` by hand; keep them in sync if the HUD fade changes.
- Guide buddy: `GUIDE.topInset`/`seamInset` keep it off the split-screen scoreboard. In single player it uses the full view and avoids the top-left scoreboard. Check the hand-off to the goal orbit (hover ~500 px vs `nearGoal` 450).
- Sub-agents writing files from PowerShell can produce Windows-1252 bytes (a "…" broke `vite build` in session 2). Tests and typecheck don't catch it; `npm run e2e` does (it builds).

## Playtest checklist (needs the user, real pads, projector)
- Xbox pads: steering, RT/LT, diamond answers with face or D-pad buttons, held-button behavior into a break or after a wrong answer, double-tap B to switch vehicles, Start = pause, hot-plug, rumble.
- Reward timing: turbo + jump should land ~0.7 s after the question panel fades (car glows in between).
- "Waiting…" pill readable and well placed now that the destination card is gone?
- Car feel: pivot turning, wall unstick, turbo and punch-through strength, boost-jump height and distance.
- Camera rotation smoothness (`CAMERA.rotTau`, `maxAngVel`), car screen height (`carScreenY`).
- Question breaks: interval (10 s) feel, wrong-answer retry delay (`CHALLENGE.wrongRetrySec` 0.5 s), dim strength.
- Guide buddies: easy to follow? Too fast or slow? Visible on the projector?
- Dino: guard speed (75 px/s), ram difficulty (hp 100), roar loudness.
- Audio by ear: boost, siren, roar, new music, overall balance.
- Readability of question cards from the back of the room.
- Session 3 by eye/ear: Industrial darkness on a projector (`INDUSTRIAL_LIGHTING.nightAlpha`), player siren loudness (`POLICE.playerSirenVolume`), dino laser fairness for 5-year-olds (`DINO_LASER.chargeSec`/`fireSec`), freight smash threshold and re-form time, whether the building alleys look intentional (`WORLD.maxBuildingRun`), Easy+ feel.

## Bigger roadmap (from PLAN.md Wave 5, not started)
- **Industrial at Night is playable in Setup.** The kickoff plan below records its scope. The projector, real-controller, and by-ear checks remain on the playtest checklist. Harbor is deferred until a layout can connect the docks without lots of dead ends.
- Optional minimap; button remapping UI for odd USB pads; more challenge types (subtraction, letter-by-letter spelling); high-score table; optional desktop wrapper (Electron/Tauri).
- Decide whether/when to merge `dev` → `main` and push to a remote.

## Farm kickoff plan (planned, not started)

A third map: sunny countryside at golden hour, with long shadows, animals, barns, farm trucks and corn fields. Start it only when the user kicks it off.

### Look and feel

- **Time of day:** late afternoon. A low sun in the west casts long, soft shadows to the east (about 2–3× an object's height), with warm golden light and cool blue shadows. Everything is lit; the map should not feel dark. Shadows stay fixed in world space, so they turn with each player's rotating camera like the buildings do today.
- **Shadows:** barns, silos, the farmhouse, windmills, trees, hay bales, fences, corn edges, trucks and animals all cast a baked directional shadow. Generalize the building shadow baker (`src/world/buildingTex.ts`) to take a direction and length instead of today's fixed short offset. No live Graphics.
- **Grading:** one cheap world-sized warm tint layer (the same technique as the night overlay, but golden and low alpha). HUD, goal rings and guide buddies stay at full contrast.
- **Music:** an original, bouncy country-style loop (plucky banjo-like synth, simple bass, light percussion). It starts at GO and resumes after the dino cue, the same way Industrial's track does.

### First playable map

- **Roads:** a paved county-road loop around the map, dirt farm lanes linking the farmsteads, and a small village crossroads with a few shops and houses for variety. Every road rejoins a loop, and short spurs end in a broad turnaround (same rule as Industrial).
- **Farmsteads (3–4):** a red barn, a silo, a farmhouse and a yard with hay bales and a tractor. Barns and the farmhouse obey the `WORLD.maxBuildingRun` gap rule.
- **Corn fields:** big fields of corn rows. Corn is drivable but slows cars (about 60% speed). Stalks bend flat under the car, leaving a trail like skid marks (baked into a render texture) that springs back up after ~10 s. One field is a simple corn maze with mown paths at full speed. Cars always draw above the corn so they stay visible. Corn is a fun shortcut when the guide buddy points straight across a field.
- **Pastures:** fenced fields with cows, sheep, pigs and horses. Fences are solid with bouncy collisions, and each pasture has wide open gates.
- **Water and features:** a duck pond, a stream with two little bridges, an orchard, a windmill hill, mud puddles (slow plus a brown splash), and a wind turbine row on the horizon edge. Ramps: a hay-bale ramp and a grassy hill crest with clear landings.
- **Place words (goals and picture signs):** start from `COUNTRY_CANDIDATES` in `src/data/places.ts`: farm, barn, windmill, wind turbine, campsite, lake, forest, well, cave. Add a few town words (house, shop, bakery, school) at the village. Every goal must be reachable and approachable without hitting a fence or water.

### Animals (kid-friendly)

- **Herds:** they graze and wander inside pastures. Free-roaming chickens and ducks sometimes waddle across farm lanes in a little line.
- **Animals are never hurt.** When a car comes close, they hop or scurry out of the way in time, with a feather or dust puff and a moo, baa, oink, cluck or quack. If a car somehow touches one, the animal bounces away and the car bounces too. Nothing is squashed.
- **Dino:** when it roars, nearby animals scatter, then calm down and wander back.
- **Optional later:** a "+1" for gently herding a lost sheep back through its gate.

### Farm traffic

- Pickup trucks on the county loop.
- Slow tractors pulling hay wagons on the dirt lanes, wide enough that players go around or jump them with a boost.
- A slow combine harvester that drives along a corn field and mows a full-speed path behind it.
- The police and the dino work as on the other maps. The Farm uses a farm-flavored police car, the same behavior with a different look.

### Contracts the orchestrator sets before dispatch

- `RaceMap` gains `'farm'`. `generateFarm(seed)` runs in RaceScene, and the Setup Map row and `?map=farm` quick launch get a Farm option.
- New tile types for corn, mown path, dirt lane, mud, fence, pond and stream, or a farm surface layer if that fits better.
- New `BodyOwner` kinds for animals and fences.
- New sounds (`SfxName` in `src/core/types.ts`): `moo`, `baa`, `oink`, `cluck`, `quack`, `cornRustle`, `mudSplash`.
- New `MusicTrack`: `'farm'`.
- New `TEX` keys for the farm art.
- A per-tile surface query (speed factor plus effect) that the vehicle model can read for corn and mud. Check the existing surface handling in the vehicle model first.

### Work packets

| Packet | Owns | Handoff |
|---|---|---|
| Map generation | `src/world/gen/farm.ts` + tests | Road loop, lanes, farmsteads, fields, pastures with gates, pond and stream bridges, ramps, spawns, traffic lanes, animal zones and reachable goals. Determinism across seeds; max building run rule. |
| Farm art | `src/art/farm.ts` | Tileset (grass, dirt, country road, corn rows, mown path, mud, water edges, fences), barn, silo, farmhouse, windmill, hay bales, orchard trees, 6 animals with a 2–3-frame walk, pickup, tractor + wagon, combine. Preview at driving zoom. |
| Rendering and light | `src/world/farmWorld.ts`, shadow baker generalization, golden-hour layer | Place art from the generator output, long directional shadows for every caster, warm grade; check both rotated split views. |
| Corn and mud | a surface/corn system + pure helper | Slowdown, flattened-stalk trail and spring-back, mud splash; combine mows paths. |
| Animals | `AnimalSystem` + pure `animalAI.ts` + tests | Grazing and wandering, flee-from-car with guaranteed escape, lane-crossing lines, dino scatter, sounds, cleanup on restart. |
| Farm traffic | farm traffic helper (like `industrialTraffic.ts`) | Pickups, tractors with wagons, combine; wide slow vehicles stay on their lanes. |
| Music and SFX | farm track JSON, animal and corn sounds in `src/audio/` | Validated loop; sounds mixed under the engine and siren. |
| Playtest coverage | `tests/e2e/` farm specs | Selection, `?race=2&map=farm&seed=3&questions=off`, corn slowdown, animals fleeing, restart into City. Solo and split screenshots. |

Order: contracts first, then generation, art and music in parallel. Next rendering/light, corn and mud, animals, and traffic. Coverage runs last on the integrated map.

### Decisions for the user before kickoff

- **Time of day:** golden-hour afternoon is assumed. Is a fixed time OK, or should the sun move during the round?
- **Corn:** drivable with a slowdown (assumed), or a solid maze wall?
- **Animals:** decoration and obstacles only (assumed), or should herding earn points?

## Industrial at Night kickoff plan

### First playable map

- Select City or Industrial in Setup. Industrial is a separate seeded map with a freight-yard loop and a factory loop, joined by two lit bridges over a service canal. Main roads rejoin a loop and any short spur ends in a broad turnaround. Bridge decks use ordinary road tiles so traffic and jump landings work on them.
- Drive through open factory bays with an entrance and exit, under gantry cranes, and along loading yards with truck traffic. Use a water tower and bridge approaches as landmarks. Give one yard a straight ramp approach and a clear landing.
- Run a freight train on its own track. Add one clearly marked grade crossing with warning lights before the train arrives, plus a bridge route that stays open. Keep goal rings clear of the tracks and give drivers room to stop or turn around.
- Keep every goal connected to the driving loops. Put goal rings at exits and open approaches where the buddy's direct bearing is easy to follow. Playtest both directions through factory bays and across the canal to catch goals that pull drivers toward walls or water.
- Use deep-blue shadows, cool pavement, and warm factory and crossing lights. Both player cars have soft headlights that rotate with them in world space. Keep bridge rails, the train, guides, and goal rings readable outside the beams. Check both rotating split views with the HUD at full contrast.
- Write an original looping industrial night-drive track with a steady bass line, a bright synth melody, and light metallic percussion. Leave room in the mix for the train warning and engine sounds. The track starts at GO, gives way to the dino cue, and resumes when the dino leaves or is defeated.

### Work packets for kickoff

The coordinator defines map selection, decoration placements, the rail route and crossing data, texture keys, and the music track ID before dispatch. Shared contracts, Setup and RaceScene wiring, and final integration stay with the coordinator. Lower-tier workers return their changed files, checks, and screenshots or audio notes.

| Packet | Owns | Handoff |
|---|---|---|
| Map generation | Industrial generator and tests under `src/world/gen/` | Connected road loops, two bridges, through-bays, turnarounds, reachable goals, and the rail route. Check determinism across seeds and that the road network stays connected while the grade crossing is blocked. |
| Industrial art | Industrial texture generators under `src/art/` | Factory bays, cranes, bridge rails, tracks, crossing lights, and a freight train. Provide a preview at driving zoom. |
| Music | Industrial track JSON, audio registration, and validation under `src/audio/` | A validated loop using the existing volume controls, with a listening note on the loop seam and SFX balance. |
| World rendering | Industrial decoration building under `src/world/` | Place industrial art and rail markings and keep bridge decks and factory bays passable. Clean up on race restart. |
| Freight train | Train and crossing behavior in a dedicated system | Make the warning readable before the train arrives, keep the train on its rail route, and verify that a blocked crossing leaves the bridge route usable. |
| Headlights and night look | Industrial-only lighting system and its beam assets | Use cached beam textures attached to car transforms. Verify the beams track turns and jumps in both camera views. |
| Playtest coverage | Industrial browser scenarios under `tests/e2e/` | Exercise selection, seeded quick launch, factory pass-throughs, the crossing and bridge bypass, split-screen lighting, and restarting into City. Capture solo and split views. |

Start map generation, art, and music in parallel after the contracts are set. Next dispatch world rendering, freight train, and headlights. Then have the coverage worker test the integrated map. The queued destination text, guide timing, and vehicle damage work can be scheduled independently.

### Integration and playtest

- Add a seeded quick launch such as `/?race=2&map=industrial&seed=3&questions=off`. Verify City is still the default for existing settings.
- Run typecheck, unit tests, and the production Edge suite. Drive both bridge routes and factory bays in solo and split screen. Check that the train warning gives enough time to turn or stop, the bypass stays open, and the guide brings players to every type of goal.
- Check nighttime contrast on a projector and listen through one complete music loop, a dino interruption, and the return to Industrial music.

## Small cleanups
- Remove unused config key `WORLD.bigAirSec`; remove the HudTest "Nice jump!" popup.
- Police bump should use the actual colliding cruiser (add an npc reference to `vehicle:crash`).
- Traffic right-of-way at junctions (optional).
