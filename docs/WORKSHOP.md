# Adventure Workshop — design and build guide

Reading-focused build-and-test game for kids 5–9, a separate app from Brain Racer (`workshop.html`, code in `apps/workshop/`).
The player reads a challenge, builds a car (Race Shop) or a dinosaur (Dino Lab), launches a test run, laughs at the
failure, and tries again. The product spec is the user's "Adventure Workshop — Game Specification"; this file records
the decisions made on top of it and how the code is split.

## Current state (2026-11-22, branch `feature/workshop`, not merged into `dev` yet)

> **New session?** Start with `docs/WORKSHOP_HANDOFF.md` (what is waiting, servers, standing rules). Codex jobs C1–C8 are all merged (2026-11-23).

- **Playable end to end**: title/join (1–2 players, pads or two keyboard layouts; tap on mobile) → profile pick/create
  (letter grid + reading level) → Race Shop / Dino Lab → workshop room (character walks to 10 stations) → station
  (camera zooms to the part, live preview) → board (read-only part labels + 3 challenges at the reading level; 10 in
  Admin Mode) → test run (15 Race Shop and 15 Dino Lab scenes, pass + funny fail per requirement) → results (✓/✗ per
  requirement, unlocks, hint after 3 fails). Admin: F9 / LT+RT+Start / mobile gear + multiplication gate.
- **Art**: code-drawn first pass (Codex polished the dinos once). Final art comes from the ComfyUI pipeline
  (`docs/WORKSHOP_ART_PIPELINE.md`); shape fixes are queued for Codex (`docs/CODEX_JOBS.md`); scenery still to paint is
  in `docs/WORKSHOP_PAINT_BACKLOG.md`; new part ideas in `docs/WORKSHOP_FUTURE_VARIANTS.md`.
- **How to play locally**: from `.worktrees/workshop`, `npx vite --port 5190` → `http://localhost:5190/workshop.html`
  (Space joins/confirms, WASD moves, Esc back, F9 admin). Restart the server after edits (no hot reload in `.worktrees`).
- **Dev scenes**: `?dev=WorkshopParts` (every part, side + top), `?dev=RigAnims`, `?dev=RunPreview` (Race Shop scenes),
  `?dev=DinoStages` (Dino Lab scenes), `?dev=WorkshopSounds` (audio), `?dev=RigPreview`.
- **Not yet checked**: real controllers, phones, the TV box, audio by ear, projector legibility.

## Decisions (agreed with the user, 2026-11-22)

- **Phaser 3.90**, one game at 1920×1080. Arcade physics only for cosmetic motion (bounces, tumbles, debris);
  particles for mud, splashes, dust, sparkles, confetti. **Pass/fail is decided by the pure engine before the
  animation starts**; the animation acts it out. Same model + same challenge = same result, always.
- **Players:** mobile = 1 player (touch). Controllers/keyboard = 1 or 2 players, split screen side by side
  (each pane 960×1080). Each player has their own profile, workshop, model, board and progress.
- **Profiles** are the shared ones (`shared/profiles.ts`). A new profile = name (on-screen letter grid) + reading
  level. An existing profile entering the workshop for the first time picks a reading level once.
- **Reading levels: Easy / Medium / Hard.** They change only the wording; requirements are identical.
- **Two workshops**, 10 aspects each, 2 starter variants per aspect (frozen lists in `content/*/variants.ts`).
- **Challenges are generated** from hand-built scenarios (scene types such as mud field, low bridge, tall tree),
  each with facets (requirement templates with difficulty levels) and phrase banks (several sentences per facet,
  level and reading level). Five hand-picked starters per workshop come first.
- **A new challenge must not be solvable by the build that just won** (nor by the current model). Every solution
  should differ from the last winning build in at least `WS_RULES.minChangedAspects` (2) aspects; relaxed to 1
  if the unlocked set makes 2 impossible, never 0.
- **Views:** side view is primary. A stage uses side view whenever all its requirements can be shown from the side;
  top view only for turns, narrow paths, chases. Between views: a fake 0.7 s camera roll (side layer flattens to
  the horizon, ground rises as the map, model swaps under a dust puff + whoosh); fallback a quick wipe.
  Chained stages: one screen per stage for now (the contract allows sharing a screen later).
- **Parts look the same in both views**: each variant has one look description; the side and top drawings are
  both generated from it. Review screen: `workshop.html?dev=WorkshopParts`.
- **Builder:** side view. Visiting a station zooms the camera to that part.
- **Model view (board):** shows the model large with a read-only label per aspect ("Wheels: Mud Tires").
  To change a part the player goes back to the workshop room and walks to the station. No direct jump from the
  board to a station.
- **Kid content rule (workshop exception to CLAUDE.md rule 11):** dinos may cartoon-eat other animals (gulp whole,
  belly bulge, burp, "nom" puff). No blood, no dismemberment, nothing scary. A T-Rex must be buildable late.
- **Admin:** LT+RT+Start/Menu on a pad, F9 on a keyboard, gear icon + multiplication question on mobile.
  - Per player: reading level; each variant Auto / Open / Locked; Regenerate challenges; reset workshop progress.
  - **Admin Mode** (one switch for the whole device): every part open, 10 sandbox challenges across all tiers with a
    **New Challenges** button, the player's model copied into a sandbox. Nothing is saved: no unlocks, wins, fails,
    board or model changes.
- **Audio:** Race Shop music (garage/racing building), Dino Lab music (quirky lab), simple sfx during runs,
  success / fail / unlock stings. Pre-rendered Ogg files like Brain Racer (`public/audio/workshop/`).

### Currency and shop (agreed 2026-11-23)

Supersedes the earlier "a win unlocks the next variant" rule everywhere in this document.

- **Wins pay currency instead of unlocking variants.** Race Shop: coins. Dino Lab: Bio Juice. Separate wallets per
  profile and per workshop.
- **Payout = 2 x the number of requirements** in the challenge (1 req = 2, 2 = 4, 3 = 6 ...). "Harder" means more
  requirements (e.g. big springs AND mud tires; 3-4+ at higher tiers). Numbers are always even and small so young kids
  can add them.
- **No replays.** A won challenge leaves the board for good and is never generated again (dedupe by its resolved
  requirement set). Old successes stay in the save for a future scoreboard/trophy screen (later feature, not built now;
  listed in `WORKSHOP_FUTURE_VARIANTS.md`).
- **Variants are bought at the aspect's station** in the workshop room. Each station always shows the next 2 unowned
  variants of that aspect (from the aspect's unlock order) for sale with a price tag; buying one reveals the next.
  Unaffordable ones are visible but not installable and show "You need more coins" / "You need more Bio Juice"
  (optionally the missing amount as a number).
- Each variant has a fixed price from its place in its aspect's shop order: 2, 4, 6 … (basePrice + priceStep × index). Prices never change.
- **Fresh start:** 1 owned variant per aspect (the first starter), wallet 4 (two 2-cost buys). Save version is bumped;
  old beta saves are reset (no migration).
- **Board = 3 challenges.** Target mix: 1 solvable with owned variants only + 2 that need purchases the player can
  afford right now. Affordable = solvable with owned variants plus purchases whose total cost <= current wallet (each
  challenge judged on its own). When no owned-only challenge can exist (early game: one owned variant per aspect, so
  the only build is the current model), fill with 3 affordable-purchase challenges; the owned-only slot returns once it
  is possible. Never leave the board short; if generation truly fails, fall back to more owned-only challenges.
  Existing rules stay: not solvable by `lastWin` nor by the current model; `minChangedAspects`.
- **After any purchase or spend, re-check the board:** challenges that became unaffordable are replaced with new valid
  ones; challenges that became owned-only solvable stay.
- **Hand-picked starters:** kept only if they fit (each needs exactly one 2-cost purchase); otherwise dropped in favor
  of generated ones (the C22 job decides and reports which).
- **UI:** each player pane always shows its wallet (coin or juice-drop icon + number). Results shows "+N" with the icon
  (fits the numbers-only popup rule). Buying has a short confirm and a sound.
- **Admin:** Admin Mode keeps everything open and saves nothing. Per-player admin adds "Reset this player (fresh
  start)" and "+10 currency" for testing.
- **Two players:** fully separate wallets and boards (as now).

## Code map and ownership

Everything is under `apps/workshop/` unless noted. **The workshop never imports from `src/`** (Brain Racer);
shared code lives in `shared/`.

| Path | Owner | What |
|---|---|---|
| `core/types.ts`, `core/runtime.ts`, `core/engineApi.ts`, `core/rng.ts`, `content/index.ts` | orchestrator | **Contracts.** Do not edit; propose diffs in your report. |
| `config.ts` | everyone | Add keys in **your own section only**. |
| `content/race/variants.ts`, `content/dino/variants.ts` | orchestrator (ids/names) + content package (stats/tags/note) | Frozen ids, names, starters. |
| `logic/**` | engine package | Pure rules: stats, evaluate, solver, generator, board, unlocks, hints, saves, admin sandbox. |
| `content/race/**` | Race Shop content | Stats, scenarios, facets, phrases, unlock order, starters. |
| `content/dino/**` | Dino Lab content | Same for Dino Lab. |
| `main.ts`, `shell/**`, `ui/**`, `screens/profile*`, `screens/reading*`, `screens/pickWorkshop*`, `dev/` loader, `workshop.html`, `shared/input/**`, `tests/e2e/workshop*.spec.ts` | shell package | Boot, panes, join, input, saves store, admin, widgets. |
| `audio/**`, `scripts/renderWorkshopAudio.ts`, `public/audio/workshop/**` | audio package | `WorkshopAudio` implementation + rendered files. |
| `art/**`, `dev/WorkshopParts.ts` | art package | `buildRig` for both workshops and both views. |
| `screens/room*`, `screens/station*`, `screens/board*` | screens package | Workshop room, station menu, model view + board. |
| `run/types.ts` | orchestrator | ScenarioPlayer / StageContext contract. |
| `run/runner.ts`, `run/common/**`, `run/race/**`, `dev/RunPreview.ts` | race runs package | Run sequencing, view roll, shared scene kit, Race Shop scenario players. |
| `run/dino/**`, `dev/DinoStages.ts` | dino runs package | Dino Lab scenario players. |
| `screens/run*`, `screens/results*` | screens package | Run screen (uses the runner), results checklist + hints. |

## Engine semantics (logic/)

- **Stats**: `stat = clamp(base + Σ variant.stats[stat], min, max)`. **Tags**: union of the variants' tags.
- **Checks** include `statMin`, `statMax`, `tag`, `noTag`, and `anyOf`. A requirement passes when all its
  checks pass. An `anyOf` check passes when all the checks in at least one option pass.
- **evaluate**: every requirement is evaluated (also those after a failing stage: `reached: false`).
  The run ends at the first stage with a failing requirement; `firstFail` = first failing requirement there.
- **available variants** = owned (first starter per aspect + purchased) ∪ `open` overrides − `locked` overrides; an aspect never ends up empty
  (if every variant of an aspect is locked, its first starter stays available).
- **Generator** (seeded by `genSeq`, which only increases):
  - Tier `t = min(maxTier, floor(firstWins / winsPerTier))`. Tier sets stage count and requirements per stage, e.g.
    t0: 1 stage × 1 req; t1: 1 × 1–2; t2: 1–2 stages; t3: 2 stages × 1–2; t4+: 2–3 stages, more aspects, tradeoffs.
    Exact table is engine-owned (config).
  - Only facets with `minTier <= t` and scenarios with `minTier <= t`.
  - Construction: pick scenario(s) + facets + levels, then **validate with the solver**: solvable with the
    available variants; NOT solved by `lastWin`; NOT solved by the current model; min changed aspects rule.
    Prefer (not require) challenges whose solutions need the newest unlocked variant about 40% of the time; the
    rest should need older parts or combinations.
  - The three active challenges should differ (different scenarios / hint aspects where possible).
  - Text comes from the scenario and facet phrase banks. Two stages join their titles with "&", and three or
    more use the first title plus "Adventure". Each requirement has one guideline sentence per reading level.
  - Saved challenges are fully resolved (checks + text for all three levels). Never regenerate a saved challenge.
- **Starters** (see Currency and shop): hand-picked ones are offered first only if each needs exactly one 2-cost purchase; they must fail with the default model.
- **Board**: 3 active challenges (mix and affordability rules in Currency and shop). A won challenge is removed for good
  and never regenerated (deduped by resolved requirement set); its success stays in the save history. Any purchase or
  spend re-checks the board. Save capped at `maxSavedChallenges` for non-won challenges, active ones never dropped.
- **Win**: pays `2 x requirement count` into the workshop's wallet (coins / Bio Juice), `firstWins++`, the challenge leaves
  the board and is recorded as a success with its winning build; the build is also stored as `lastWin`. Nothing unlocks.
  Variants are bought with `purchase` (fixed price from the variant's place in its aspect's shop order).
- **Fail**: `fails[id]++`; after `hintAfterFails` the results screen shows the hint (aspect of the first failed requirement).
- **Overrides** change availability; `refreshBoard` then drops active challenges that became unsolvable and refills.
- **Saves** (version bumped for the currency system): `localStorage` `workshop.players.v1` = `Record<profileId, PlayerSave>`, `workshop.device.v1` = `DeviceSave`. Per workshop: wallet, bought variants, success history.
  Model is saved on every part change.

## Content guide (content/race, content/dino)

- **Guidelines** give beginning readers one short line per requirement. The title names the problem, and each
  line names the fix. When a requirement accepts alternatives, name every option on that line and link them with
  "or". Use everyday words such as big, small, long, and short. Use up to **6 words on Easy**, **8 on Medium**,
  and **12 on Hard**. `validateCatalog` checks every guideline in the phrase banks. Reading level changes the
  wording only. Name the available parts directly when it helps children recognize the alternatives.
- **Facet levels** map difficulty to thresholds (mud depth 1–3 → mud grip ≥ 2/3/4). Phrases may differ per level
  ("muddy" → "deep, sticky mud").
- **Tradeoffs**: variants change several stats (big engine: power+, weight+). Several builds may solve one requirement.
- **Scenarios**: 12–15 per workshop, each a scene the runs package can animate in side view (top view only where
  needed). Each facet lists its views and its hint aspect.
- **Starters**: Race Shop: Deep Mud (wheels), Long Jump (speed: engine, gears or rocket), Sharp Turn (springs; top
  view), Steep Hill (engine power), Foggy Road (paint; ducks wait to cross). Dino Lab:
  Big Teeth (gulp a cartoon critter; small teeth: it giggles and wriggles away), Green Skin (hide in ferns from a big
  sniffing predator), High Jump (legs), Small Hole (size), Tall Grass (peek over the grass to find the nest).

### Alternative fixes (C27)

| Workshop and challenge | Accepted fixes | Easy guideline example |
|---|---|---|
| Dino Lab, Tall Grass (`tallGrass.peek`, level 1) | Standing, Long Neck, or Big or Huge size. | Stand, long neck, or big body. |
| Race Shop, River Crossing (`river.cross`, level 1) | Snorkel to drive through the stream, or Floaties to cross on the surface. | Use floaties or a snorkel. |

Both fixes count as one requirement on their respective cards. A build must satisfy every guideline, and the
win pays two coins or two Bio Juice per requirement. The board compares the total cost of complete builds
and uses the cheapest. A card with an owned route can fill the owned-only slot. The board targets one owned-only
card and two affordable purchase cards as it fills or replaces slots. An owned practice card can fill the
owned slot if the authored pool has no eligible card. Cards that become owned-solvable after a purchase stay active.
Version 2 saves retain their resolved requirements, wording, and IDs. Newly offered cards use the updated catalog.

The review kept these cases on their existing rules.

| Workshop and requirements reviewed | Alternatives considered |
|---|---|
| Race Shop, mud grip and tractor pull | Mud Tires, Monster Wheels, and 4x4 already contribute grip. A stronger engine helps pull the heavy tractor, which still needs a winch to hook on. |
| Race Shop, jump speed and landing, sharp turn, hill power | Engines, gears, rockets, tires, springs, and other relevant parts already contribute through the speed, bounce, handling, and power thresholds. A soft landing still needs enough bounce. |
| Race Shop, fog visibility, parade color, night quiet and hiding | Any bright paint already works in fog. Honking was excluded since the ducks need to see the car. Keep the requested parade color and the separate quiet and dark checks at night. |
| Race Shop, low bridge, narrow path, wobbly bridge | Size, shape, and other relevant parts already affect height, width, or weight. Speed does not make an oversized car fit or reduce its weight on the bridge. |
| Race Shop, delivery load and power, beach range and load | Storage, body, size, and helpful engines already contribute to their relevant thresholds. Room for boxes and power to move them remain separate. |
| Race Shop, snow grip, rock toughness, clearance, and log push | Traction, lift, toughness, and pushing have stat-based solutions across parts. An extra route around the log would require a different course. |
| Race Shop, river level 2 | The wide river calls for floating. The snorkel is for a stream with a road within driving depth. |
| Dino Lab, snack bite and big gulp, chase speed and quiet | Teeth, size, legs, and other contributors already work through the relevant stats. The big gulp needs both a strong bite and room for the snack. |
| Dino Lab, fern and flower camouflage, grass sneak, fish camouflage, desert camouflage | Forest colors and the Leaf Pattern already share the forest camouflage tag. Low movement or small size alone does not provide the scene's leaf, flower, grass, water, or sand pattern. |
| Dino Lab, ledge jump, river swim, canyon flight | Legs and other stat contributors already support jumping and swimming. These scenes have distinct movement goals. Generic wings would bypass the jump and swim, and a leap would skip the canyon's flight and weight checks. |
| Dino Lab, burrow fit, dig, and light | Smaller builds and digging parts already contribute. Digging cannot replace fitting through the hole or seeing inside it. |
| Dino Lab, taller grass, fruit reach and tree shake | The higher grass levels and the fruit already count combined reach. More height is required for the higher grass. Shaking fruit down is a separate strength guideline. |
| Dino Lab, rock climb and toughness, nut crack, log push, snow warmth and slope, bird noise, desert cooling | Existing stat checks count the relevant combinations, such as a beak or a horn for cracking a nut. Different ways to accomplish the same action already use the same threshold. |

## Art guide (art/)

- `buildRig(scene, workshop, model, view)` → `ModelRig` (`core/runtime.ts`). Origin at ground contact (side) / center (top);
  faces +x. Animations are tweens on parts (`RigAnim`).
- **Both views from one description** per variant (colors, pattern, size, features). Top view shows only
  `visibleFromTop` aspects.
- Bake every rounded shape/path to textures (`scene.textures` keys prefixed `ws:`); never redraw rounded Graphics per frame.
- Basic but clear and cheerful shapes: thick outlines, saturated colors, big readable silhouettes. Codex polishes art later,
  so keep one drawing function per aspect variant and keep the look parameters in one table.

## Screens and input

- **Join/title** (shell, full screen): each pad / keyboard layout presses A (Space / Enter) to join; Start or the first
  player's A on "Play" opens the panes. Mobile: tap = one player. B on the title goes back to the launcher.
- Keyboard layouts: KB1 = WASD + Space (confirm) + Q/Escape (back); KB2 = arrows + Enter (confirm) + Backspace (back).
  F9 = admin.
- **Pane flow**: profile → (newProfile | reading) → pickWorkshop → room ⇄ station; room → board → run → results →
  board / room. B goes back one step.
- Pane-local coordinates; layouts `wide` (1920×1080) and `tall` (960×1080). Gameplay text ≥ 40 px, high contrast.
  Every action reachable by touch (tap targets ≥ 120 px) and by pad.
- No comic word popups (CLAUDE.md rule 14): checkmarks, ✗, stars, banners and the results list are fine.
- Dev scenes: `workshop.html?dev=<Name>` loads `apps/workshop/dev/<Name>.ts` (default export = Phaser.Scene class).
- **Screens auto-register**: `apps/workshop/screens/<screenId>Screen.ts` with `export default` a `ScreenFactory`
  (e.g. `roomScreen.ts` → `'room'`). The shell globs `./screens/*Screen.ts`; a missing id shows a placeholder
  screen with a Back button. Helpers private to one screen go in `screens/<screenId>/`.
- **Stubs to replace**: `logic/index.ts` (engine), `art/index.ts` (`buildRig`), `audio/index.ts`
  (`preloadWorkshopAudio`, `createWorkshopAudio`), `content/*/catalog.ts`. Keep the export names.
- **Music arbitration** (shell): when both panes ask for different tracks, play `title`.

## Testing

- Unit tests next to pure code (`apps/**/*.test.ts`, run by `npm test`).
- Engine: progression simulation (fresh profile → everything unlocked) with real catalogs; solvability of every offered
  challenge; the last-win rule; determinism; admin sandbox never mutates the real save.
- e2e: `tests/e2e/workshop*.spec.ts`. Hooks: `window.__ws` (pane contexts, engine) for tests.
- Dev-server ports per package: shell 5191, audio 5192 (render 5193), art 5194, screens 5195, runs 5196/5197.
