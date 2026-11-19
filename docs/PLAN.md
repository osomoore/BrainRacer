# BrainRacer — Implementation Plan

> **Note (end of session 1):** this is the original plan. For the current game behavior see `docs/STATUS.md`; for the backlog and dev workflow see `docs/NEXT.md`.

Top-down open-world co-op racer (classic overhead-GTA feel) for 1–2 players, with picture, word and math challenges every few seconds. This document is the source of truth for the orchestrator and for implementation sub-agents.

---

## 1. Decisions (and why)

| Area | Decision | Why |
|---|---|---|
| Platform | **Browser game**: TypeScript + Vite + **Phaser 3.90** (pin exact versions on install) | The Gamepad API handles Xbox-style USB pads in Chrome/Edge with no drivers. It runs on any laptop or projector PC. It also lets agents check their work headlessly (Playwright screenshots, mocked gamepads). |
| Physics | Phaser's **Matter.js** plugin + a custom top-down tire model | Matter handles rotated-box collisions between cars, buildings and props. Our car model kills sideways velocity to give grip and drift. |
| Rendering | Fixed **1920×1080** logical resolution, `Scale.FIT`, letterboxed | Looks the same on a monitor or a projector. All UI is sized for 1080p and readable from across a room. |
| Art | **Procedurally drawn textures** (Phaser Graphics → `generateTexture`) at boot, plus the provided scene PNGs | No art pipeline needed, no IP risk, and the cars and dino are easy to restyle. |
| Music | **"MIDI-style" chiptune**: songs stored as note-event data (MIDI-like JSON) and played through **Tone.js** synths. `@tonejs/midi` can load real `.mid` files dropped into `public/music/` | Real MIDI playback in the browser needs a synth anyway. This gives authentic MIDI support plus music agents can write in code. |
| SFX | **ZzFX**-style procedural sounds + a few Web Audio graphs (engine hum, dino roar) | No sound files to source, and everything can be tuned in code. |
| Tests | **Vitest** for pure logic (challenge generation, worldgen, scoring); **Playwright** smoke tests with a mocked `navigator.getGamepads` | Gives sub-agents an objective "done" signal. |
| Run / ship | `npm run dev` for development; `npm run build` → static `dist/`; `play.bat` starts a local preview server and opens Edge/Chrome in kiosk/fullscreen | One double-click to play on the projector PC. |

The existing prototype (`index.html`, `game.js`) gets replaced in Wave 0.

---

## 2. Game design spec (with assumptions)

### 2.1 Session flow
1. **Title** → "Press A to join" (or Enter on the keyboard). The first to join is P1, the second is P2. With only one player joined, the game runs single-player in full screen.
2. **Setup**: per-player difficulty (Easy / Normal / Hard), challenge interval (default 5 s), round length (default 5:00), seed (random by default), music/SFX volume. Saved to `localStorage`.
3. **Race**: 3-2-1-GO, then a 5:00 countdown.
4. **Results**: team total, per-player breakdown (correct / attempted, goals reached), "Play again" (same settings, new seed).

### 2.2 Cars (distinct look *and* handling)
- **P1 – Dino-Car (green)**: a chunky green roadster with a dinosaur head hood ornament, spine plates along the roof and a stubby tail fin at the back. **Heavier**, higher top speed, wider turning circle.
- **P2 – Red Kart (red)**: a small round red go-kart. The driver wears a cap with a **white circle and a gold star** (no letters, no mustache, no mushroom motifs: inspired by retro karting, not copying it). **Lighter**, quick to accelerate, tight turning.
- Either player can pick either car in Setup. The defaults are as above.

### 2.3 Controls
| Action | Gamepad (standard mapping) | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Steer | Left stick X / D-pad | A / D | ← / → |
| Accelerate | RT (analog) or A | W | ↑ |
| Brake / reverse | LT (analog) | S | ↓ |
| Answer **left** | **X (blue)** | 1 | , |
| Answer **center** | **Y (yellow)** | 2 | . |
| Answer **right** | **B (red)** | 3 | / |
| Pause | Start | Esc | Esc |

- Gamepads are the main input. Plugging in or unplugging a controller mid-game is handled; unplugging pauses with a "reconnect controller" message.
- A debug overlay (F2) shows raw button and axis values for odd USB pads. Button remapping is a later stretch goal.

### 2.4 Screen layout & cameras
- **2 players far apart** → vertical split (left = P1, right = P2), each half following its car.
- **2 players close together** → **merged single camera** centered between both cars, zooming out to keep both on screen. If the needed zoom drops below `minZoom`, it splits. Hysteresis (separate split and merge thresholds) prevents flicker, and the transition animates over about 0.4 s.
- **HUD (separate UI scene, unaffected by camera zoom):**
  - **Top center:** big **TEAM SCORE**, with `P1 n | P2 n` underneath and the round timer.
  - **Top of each player's half:** that player's challenge panel. In merged mode the two panels sit top-left and top-right.
  - **Bottom of each half:** the challenge timer bar draining left to right, in the player's color.
  - **Screen edges:** goal arrow per player (with distance), plus the goal's place name and icon.
  - A small minimap in the top-right is a stretch goal.

### 2.5 Brain challenges
Each player has **their own** challenge stream, tuned to their difficulty.

**Types** (the 3 answer slots always map to X / Y / B, left to right):
1. **Picture → 3 words**: show a scene image; the answers are three words.
2. **Math → 3 numbers**: `a + b = ?` (addition only for now); the answers are three numbers.
3. **Word → 3 pictures**: show a word; the answers are three scene images.

**Presentation:** the challenge pops in large in the center of the player's view (scale-in, about 0.35 s), then slides up and shrinks into the top panel so it doesn't block driving. Under the three answers sit three colored button badges (blue **X**, yellow **Y**, red **B**) with the letters, so they're readable for colorblind players.

**Timing:**
- `period = config.challengeIntervalSec × difficulty.periodMultiplier`. A challenge stays on screen for the whole period and the bar drains over that period. A new challenge starts at the end of each period, so they keep coming.
- **One guess per challenge.** Correct: +1 point, a reward, a happy chime, and the answer flashes green. Wrong: a sad "wah-wah" sound, the chosen answer shakes and turns gray, then nothing more until the next challenge. This stops button mashing.
- Not answered in time: the panel fades out with a soft "tick" and no penalty.

**Place-triggered reading challenges:**
- The world contains **place buildings** (hospital, bakery, school, zoo, fire station, library, …; these are the 25 words from the two Community/Places grids). Each has a rooftop sign using one grid's art.
- When a player drives within `placeTriggerRadius` of a place they haven't been quizzed on in the last 60 s, **their next challenge** is about that place: either word → 3 pictures or picture → 3 words. If no challenge is showing at that moment, it appears immediately. The challenge uses the *other* grid's art, so the player has to recognize the place rather than match identical pictures.
- Otherwise the type is chosen randomly using the weights for that difficulty.

**Difficulty (per player, all values in config):**

| | Easy | Normal | Hard |
|---|---|---|---|
| Period multiplier (×5 s default) | 1.5 → 7.5 s | 1.0 → 5 s | 0.7 → 3.5 s |
| Math | a+b ≤ 10, single digits | sum ≤ 30, one two-digit + one single-digit | two-digit + two-digit with carrying, sum ≤ 150 |
| Math distractors | ±1–3, never negative | ±1–2 and ±10 | "forgot to carry" (±10), ±1, digits swapped |
| Words | single short words (≤ 6 letters) | any single word | includes multi-word labels ("fire station", "riding a bicycle") |
| Word distractors | random, different category | same category | same category, similar length or first letter |
| Type weights (pic→word / math / word→pic) | 30 / 30 / 40 | 34 / 33 / 33 | 40 / 35 / 25 |

**Content rules:**
- Answers are unique *words*. Images with the same word count as one answer.
- A hand-checked **confusables list** stops near-synonyms from appearing as distractors together (moon / crescent moon, star / yellow star / outline star, book / open book, sleeping / sleeping boy, boy / jumping boy, reading / open book, house / city, park / park bench / playground, …).
- Show each image or word no more than once per round per player until the pool runs out.

### 2.6 Rewards for a correct answer (big and obvious)
Every correct answer gives **TURBO**: 3 s at 1.6× top speed, flame exhaust, speed lines and a slight camera zoom-out. It also gives one random bonus flavor:
- **Rainbow Trail**: a glittering rainbow particle trail plus a star burst.
- **Shockwave**: a ring blast that shoves nearby traffic and police away.
- **Ghost**: 3 s of driving through traffic and police (semi-transparent).
- **Magnet Arrow**: the goal arrow turns gold and gets bigger for 5 s, and the goal beacon flares.

Every correct answer also shows a "+1" text popup flying to the team score. That's the "big and obvious" feel.

### 2.7 Goals (shared)
- One active **goal zone** at a time: a big glowing ring and a light beacon at a place building or open plaza. The HUD names it with its icon, e.g. "Drive to the **BAKERY** 🥖". This is extra reading practice.
- **Assumption:** a goal is completed when **both** cars have entered it (in single-player, one). After the first car arrives, a 20 s "Wait for your teammate!" timer starts; if it runs out, the goal completes anyway. Completing a goal gives **+3 team points** (configurable, can be 0) per car that arrived, shown in the per-player breakdown. Confetti and a fanfare play, then the next goal spawns 40–70 s of driving away.

### 2.8 World (procedural)
- Seeded RNG (mulberry32), so a seed always reproduces the same map. The map is finite: **48×48 tiles × 128 px** (about 6 k px square), with water around the edge.
- **Phase 1: City biome only.** A road grid with jittered block sizes (3–6 tiles), some removed segments (dead ends and plazas), 2-lane roads, avenues, sidewalks, buildings filling block edges (each one a solid static body), parks with trees, place buildings (≥ 1 of each of the 25 place words), parked cars, lamp posts and hydrants. Small props are breakable or pushable sensors, not solid walls.
- **Jumps:** ramps placed on long straight roads and in parks. A car hitting a ramp above 40% speed goes **airborne** for a time based on its speed. While airborne the sprite scales up with an offset shadow and collisions are off; landing gives dust particles and a small camera bump.
- **Later phases (Wave 5):** biome noise selects **Countryside** (dirt roads, farms, barns, tractors as slow traffic, windmills, wind turbines, lakes) and **Industrial** (factories, warehouses, smokestacks, lots of trucks, water tower). These add place words like *farm, barn, windmill, wind turbine, water tower, lighthouse, dam*.

### 2.9 Traffic, police and physics
- **Traffic:** AI cars and **trucks** (2× mass, longer and slower) follow a lane graph built from the roads. They obey simple following distance, turn randomly at junctions, and get knocked around realistically when hit. They spawn and despawn in a ring around the players, with a budget of about 35 vehicles.
- **Police (heat system):** each player builds **heat** by crashing into traffic, police or props. At heat ≥ threshold, 1–3 police cars spawn off-screen and chase that player with lights and siren. Police follow the road graph, steering straight at the player when close. **When a police car hits a player, it bumps them.** The bump is a sideways shove plus a brief wobble that cuts top speed for about 0.5 s and flashes red and blue. It's a minor disruption with **no stun and no point loss** (kid-friendly). Police have a 1.5 s cooldown between bumps on the same player. **A correct-answer TURBO is the way to escape**: police top speed sits between normal and turbo speed. A player who stays in turbo for a while gets more than `policeLoseDistance` away, and the police give up and their heat resets to half. Heat drops over time. A few police also patrol at a baseline level.
- **Collisions:** simple Matter impulses, with mass from a per-vehicle table. Buildings are static. Hitting a building hard gives a small camera shake, sparks, and a "clunk" sound. Cars are never destroyed.

### 2.10 The giant dinosaur
- Appears at **half time** (2:30 left): a "⚠ DINO ALERT ⚠" banner, a roar, and screen shake for both players.
- A top-down T-rex about 6 car-lengths long with animated legs, swaying tail and head. Its shadow is visible from afar, and the goal arrow area shows a dino warning icon when it's near the goal.
- **AI:** walks between waypoints at about 55% of car top speed. **60% of waypoints are the current goal zone** (or near it), so it's often in the way. It roars every 8–15 s and whenever a car comes within 400 px. Footsteps shake the camera of nearby players.
- **Contact:** a car touching the dino is launched with a big impulse and spin (no stun beyond the spin itself). Traffic it steps on is comically **squashed** flat and then removed. It walks over buildings, ignoring collisions, so it's an unstoppable force.

### 2.11 Audio
- **Music:** 3 looping tracks in note-data form: Title, Race (upbeat chiptune, 140 bpm), and a "Dino" variant (lower, heavier bass) that crossfades in when the dino arrives. A results jingle plays at the end.
- **SFX:** engine hum (one per car, pitch follows speed, panned by screen half), turbo whoosh, correct chime, wrong "wah-wah", timeout tick, crash, skid, siren, jump and landing, goal fanfare, countdown beeps, and the dino roar (layered low saw + noise + distortion + pitch drop) with footstep thuds.

---

## 3. Architecture

```
/
├─ index.html
├─ play.bat                     # build-if-needed + preview server + kiosk browser
├─ CLAUDE.md                    # conventions for every agent (written in Wave 0)
├─ docs/PLAN.md                 # this file
├─ images/                      # source art (as provided; grids are reference only)
├─ public/scenes/               # copied scene_###.png (by scripts/build-assets.ts)
├─ scripts/build-assets.ts      # manifest.csv -> src/data/scenes.json, copies PNGs
├─ src/
│  ├─ main.ts                   # Phaser game config, scene registration
│  ├─ config/gameConfig.ts      # ALL tunables (difficulty table, physics, timings)
│  ├─ core/                     # types.ts (shared contracts), events.ts (typed event bus), rng.ts, settings.ts
│  ├─ data/                     # scenes.json (generated), places.ts, confusables.ts, categories.ts
│  ├─ input/                    # InputManager, GamepadSource, KeyboardSource, PlayerSlots
│  ├─ challenge/                # generators (math/picToWord/wordToPic), ChallengeScheduler, difficulty  [pure TS, no Phaser]
│  ├─ world/gen/                # cityGen.ts, roadGraph.ts, biome.ts  [pure TS, no Phaser]
│  ├─ world/                    # WorldBuilder (tiles + static bodies), PlaceSigns, Ramps
│  ├─ art/                      # procedural texture generators (cars, traffic, police, truck, dino, tiles, buildings, fx)
│  ├─ entities/                 # Vehicle (tire model), PlayerCar, TrafficCar, PoliceCar, Dino
│  ├─ systems/                  # TrafficSystem, PoliceSystem, GoalSystem, ScoreSystem, RewardSystem, JumpSystem, DinoSystem, RoundTimer
│  ├─ camera/                   # SplitScreenManager
│  ├─ ui/                       # HudScene, ChallengePanel, TimerBar, ScoreBoard, GoalArrow, Banner
│  ├─ audio/                    # AudioManager, sfx.ts, engineSound.ts, roar.ts, music/ (tracks + player)
│  └─ scenes/                   # BootScene, TitleScene, SetupScene, RaceScene, ResultsScene
└─ tests/ (unit: *.test.ts beside sources; e2e/ for Playwright)
```

**Key rules:**
- **Pure logic stays Phaser-free** (`challenge/`, `world/gen/`, scoring rules), so it can be unit-tested and built in parallel.
- **Systems talk through the typed event bus** (`core/events.ts`), e.g. `challenge:answered {player, correct}`, `reward:granted`, `goal:reached`, `dino:spawned`, `heat:changed`, `player:busted`. No system imports another system's internals.
- **Every tunable lives in `gameConfig.ts`**; settings from the Setup screen override a copy at runtime.
- **The world is generated from data first, then rendered**: `cityGen(seed) → WorldData` (tiles, lots, places, ramps, lane graph, spawn points), then `WorldBuilder` turns `WorldData` into tilemap + bodies.

---

## 4. Work packages & agent orchestration

The orchestrator (main Opus session) runs the waves in order. Within a wave, packages run **in parallel** as sub-agents, each owning only its listed directories. Every package must deliver: code, unit tests where noted, `npm run typecheck && npm test` passing, and a short note on what to check by hand.

### Wave 0 — Foundation (Opus, orchestrator, sequential, about 1 session)
- **W0.1** Scaffold Vite + TS (strict) + Phaser + Matter + Vitest + Playwright + ESLint/Prettier; scripts `dev / build / preview / typecheck / test / e2e`. Delete the old prototype and rewrite the README.
- **W0.2** `CLAUDE.md`: conventions, directory ownership, "use the event bus, don't import other systems", "tunables go in gameConfig", how to run tests.
- **W0.3** **Contracts**: `core/types.ts` (PlayerId, Difficulty, Challenge, ChallengeAnswer, WorldData, LaneGraph, VehicleSpec, InputState, …), `core/events.ts`, `config/gameConfig.ts` (complete tables from §2), `core/rng.ts`.
- **W0.4** Skeleton scenes (Boot → Title → Setup → Race → Results) with placeholders, so every later package has somewhere to plug in.
- **W0.5** `scripts/build-assets.ts` → `src/data/scenes.json`. **`images/scenes/manifest.csv` is the only source of word labels.** Ignore the per-image `scene_###.txt` files and don't copy them to `public/`. Trim the UTF-8 BOM and quotes, and keep `source`/`row`/`column` (`source` identifies the two place grids); Playwright smoke test with a gamepad mock helper (`tests/e2e/gamepadMock.ts`).
- **W0.6** Commit the `images/` folder (scenes plus source grids).

### Wave 1 — Independent modules (5 Sonnet agents in parallel)
| ID | Package | Owns | Acceptance |
|---|---|---|---|
| **A** | Input system | `src/input/` | 0–4 pads + keyboard map to player slots; analog triggers and stick deadzone; edge-detected answer presses; hot-plug events; F2 debug overlay. Unit tests on the mapping logic. |
| **B** | Challenge engine | `src/challenge/`, `src/data/confusables.ts`, `categories.ts`, `places.ts` | Generators for all 3 types × 3 difficulties; confusables respected; no repeats; place-trigger API; scheduler driven by injected time. **≥ 30 unit tests**, including 10 k random generations checked for validity (exactly one correct answer, unique options, numbers in range). |
| **C** | City generator | `src/world/gen/` | `cityGen(seed)` is deterministic; all roads connected (flood-fill test); every place word present; ramps only on straight roads; lane graph has no dead edges; spawn points on road. Includes an ASCII map dump for debugging. |
| **D** | Audio | `src/audio/` | All SFX from §2.11, engine sound API `setSpeed(0..1)`, dino roar, music player (note-data + optional `.mid` via `@tonejs/midi`), 3 tracks + jingle, crossfade, volume settings. Audio unlocks on first input (browser autoplay rule). A `?audiotest` page plays every sound. |
| **E** | Procedural art | `src/art/` | Textures for both hero cars (top-down, clearly distinct shapes and colors), 3 traffic car colors, truck, police (with light-bar frames), dino (body + 4 leg frames + tail), road/sidewalk/grass/water tiles, building roofs in 6 styles, place-sign frames, ramp, particles (spark, smoke, flame, star, confetti, rainbow). A `?artgallery` page shows them all. |

### Wave 2 — Core gameplay (4 agents)
| ID | Package | Model | Owns | Acceptance |
|---|---|---|---|---|
| **F** | Vehicle physics + player cars | **Sonnet** (Opus review) | `src/entities/Vehicle.ts`, `PlayerCar.ts` | Tire model (grip, drift, reverse, analog throttle); per-car specs; collisions with buildings and each other; turbo/ghost hooks. Drives well on keyboard and pad in a test arena. |
| **G** | World builder | Sonnet | `src/world/` (not `gen/`) | Renders `WorldData` as a tilemap; static bodies (merged where adjacent); place signs with scene art; ramps as sensors; culling keeps 60 fps. |
| **H** | Split-screen camera | **Opus** | `src/camera/` | Split ↔ merge with hysteresis and an animated transition; single-player full screen; per-camera ignore lists so the HUD isn't rendered twice; works at 1080p and 720p. |
| **I** | HUD & challenge UI | Sonnet | `src/ui/` | Pop-in → slide-to-top animation; X/Y/B badges; drain bar; correct/wrong/timeout states; center team score with per-player breakdown; round timer; goal arrows; banner component. Readable from 4 m on a projector (min 40 px text at 1080p). |

### Wave 3 — Systems (6 Sonnet agents in parallel; all communicate via events)
| ID | Package | Owns |
|---|---|---|
| **J** | Traffic (cars + trucks on the lane graph, spawn ring, following, junction turns, knockback) | `systems/TrafficSystem.ts`, `entities/TrafficCar.ts` |
| **K** | Police heat, chase, bump-on-hit, lose-them-with-turbo | `systems/PoliceSystem.ts`, `entities/PoliceCar.ts` |
| **L** | Goals + score + round timer + results data | `systems/GoalSystem.ts`, `ScoreSystem.ts`, `RoundTimer.ts`, `scenes/ResultsScene.ts` |
| **M** | Rewards & FX (turbo, rainbow, shockwave, ghost, magnet; "+1" popups) | `systems/RewardSystem.ts`, `src/fx/` |
| **N** | Jumps (airborne state, shadow, landing) | `systems/JumpSystem.ts` |
| **O** | Dinosaur (spawn at half time, waypoint AI biased toward the goal, roar, stomp, knockback, squash) | `systems/DinoSystem.ts`, `entities/Dino.ts` |
| **P** | Title / Setup / Pause menus, controller join flow, settings persistence | `scenes/TitleScene.ts`, `SetupScene.ts`, `core/settings.ts` |

(P can start in Wave 2. It only needs Input and the config.)

### Wave 4 — Integration, tuning, playtest (Opus)
- Wire everything into `RaceScene`; run a code review of each package; run Playwright e2e (full 5-min round at 10× time scale with scripted inputs, no errors, score increases).
- Tune with the user using real controllers: car feel, challenge timing, dino aggression, traffic density.
- Performance check on the projector PC (target 60 fps, ≥ 45 worst case).
- **Milestone: playable v1 (city only).**

### Wave 5 — Expansion (Sonnet, after v1 feedback)
- Countryside and industrial biomes (generator + art + extra place words); biome-specific traffic (tractors, more trucks).
- Minimap, button remapping UI, more challenge types (subtraction, spelling), high-score table, optional Electron/Tauri wrapper if a desktop `.exe` is wanted.

### How the orchestrator spawns agents
- Use `Agent` with `subagent_type: "general-purpose"`, `model: "sonnet"` (or `"opus"` for H and integration), and `isolation: "worktree"` for each parallel package. Merge each worktree back after checking it's green (`typecheck + test`).
- **Prompt template** for each package: *"You are implementing package {ID} of BrainRacer. Read `CLAUDE.md` and `docs/PLAN.md` §2 and §{relevant}. Only modify: {owned paths}. The contracts in `src/core/types.ts`, `events.ts` and `gameConfig.ts` are fixed. If you need a change there, stop and report the proposed diff instead of editing. Deliver: {acceptance list}. Finish with: files changed, tests added, known gaps, and what a human should check by hand."*
- Contract changes go through the orchestrator only. That keeps parallel agents from conflicting.
- Use Haiku only for mechanical chores (e.g. regenerating `scenes.json`, bulk renames). Don't use it for design-sensitive code.

---

## 5. Model recommendation

**Sonnet can implement nearly all of this.** The packages are well bounded, the contracts are fixed in Wave 0, and acceptance is mostly test-checkable. Keep **Opus** for:
1. **Wave 0** (scaffold and contracts): mistakes here spread into every package.
2. **H – split/merge camera**: subtle viewport, zoom and HUD layering interactions.
3. **Wave 4 integration and tuning**, plus a review pass after each wave (cheap, and it catches cross-module drift).

Rough split: ~80% of the code written by Sonnet agents, ~20% Opus (foundation, camera, integration and review).

---

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Off-brand USB pads without "standard" mapping | F2 raw-input overlay; mapping table keyed by `gamepad.id`; remap UI in Wave 5. |
| Browser autoplay blocks audio | Unlock audio on the first key or button press on the Title screen. |
| Matter performance with many static bodies | Merge adjacent building rects; only create bodies for chunks near players, or keep the static count low (~600). |
| Split-screen cost (2 cameras × full world) | Tile culling per camera; cap particles; traffic budget. |
| Ambiguous picture/word pairs | Confusables list + a manual review pass of `scenes.json` with the user. |
| Car feel is subjective | All physics constants in `gameConfig.ts`; Wave 4 tuning with the user on real controllers; `?tune` live sliders (dev only). |

## 7. Decisions confirmed by the user (2026-11-19)
- Police **bump** players on contact (minor disruption only); a correct-answer **turbo** gets you away from them.
- Target age about **5–9** is confirmed.
- Each player always gets **their own challenges**, even when the camera is merged.
- Still open (default stands): goal scoring of +3 per arriving car.

## 8. Autonomous run (main Opus session as orchestrator)
The main session runs on Opus and drives all waves without the user stepping in:
1. Do Wave 0 itself and commit it.
2. For each wave, spawn that wave's packages **in parallel** as background `Agent` calls (`model: "sonnet"`, `isolation: "worktree"`; Opus for H). Wait for each one's completion notice.
3. For each finished package: review the diff, run `npm run typecheck && npm test` on the merged result, fix or re-dispatch on failure (max 2 retries, then note it in `docs/STATUS.md` and continue), then **commit to a `dev` branch** (one commit per package).
4. After each wave: Opus review pass + Playwright smoke test; update `docs/STATUS.md` (done / gaps / what to check by hand).
5. Stop after Wave 4's automated part and hand over to the user for real-controller playtesting and tuning. Wave 5 waits for feedback.

**Guardrails:** never push to a remote; never edit outside the repo; only the orchestrator edits contract files; the e2e test must pass before a wave counts as done.
