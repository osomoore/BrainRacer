# Adventure Workshop — design and build guide

Reading-focused build-and-test game for kids 5–9, a separate app from Brain Racer (`workshop.html`, code in `apps/workshop/`).
The player reads a challenge, builds a car (Race Shop) or a dinosaur (Dino Lab), launches a test run, laughs at the
failure, and tries again. The product spec is the user's "Adventure Workshop — Game Specification"; this file records
the decisions made on top of it and how the code is split.

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
| `run/**`, `screens/run*`, `screens/results*` | runs package(s) | Scenario scenes, run sequencing, results + hints. |

## Engine semantics (logic/)

- **Stats**: `stat = clamp(base + Σ variant.stats[stat], min, max)`. **Tags**: union of the variants' tags.
- **Checks**: `statMin`, `statMax`, `tag`, `noTag`. A requirement passes when all its checks pass.
- **evaluate**: every requirement is evaluated (also those after a failing stage: `reached: false`).
  The run ends at the first stage with a failing requirement; `firstFail` = first failing requirement there.
- **available variants** = starters ∪ earned ∪ `open` overrides − `locked` overrides; an aspect never ends up empty
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
  - Text: title from the scenario phrase bank (2 stages: "A & B", 3+: first title + " Adventure"); intro + one
    sentence per requirement, picked deterministically from the phrase bank for each reading level.
  - Saved challenges are fully resolved (checks + text for all three levels). Never regenerate a saved challenge.
- **Starters** are offered in order first (3 at a time). They must fail with the default model and each needs one aspect.
- **Board**: 3 active challenges. When one is won it is replaced by a new eligible challenge; if fewer than 3 unfinished
  ones can be made, completed ones fill the rest. Completed challenges stay replayable (save capped at
  `maxSavedChallenges`, active ones never dropped).
- **Win**: first win → next variant in `unlockOrder` that isn't already available (+ `firstWins++`); replays give no
  reward. Every win stores the build as the challenge's winning build and as `lastWin`; fails reset.
- **Fail**: `fails[id]++`; after `hintAfterFails` the results screen shows the hint (aspect of the first failed requirement).
- **Overrides** change availability; `refreshBoard` then drops active challenges that became unsolvable and refills.
- **Saves**: `localStorage` `workshop.players.v1` = `Record<profileId, PlayerSave>`, `workshop.device.v1` = `DeviceSave`.
  Model is saved on every part change.

## Content guide (content/race, content/dino)

- **Reading levels** (same requirement, three wordings):
  - Easy: short (≤ 9 words), everyday words, may name the aspect: "Your car needs wheels that work in mud."
  - Medium: describes the task: "Build a car that can drive across a muddy field."
  - Hard: richer vocabulary, the reader must infer the part: "Equip your vehicle with enough traction to cross slippery, muddy ground."
  - Never name the exact variant ("Mud Tires") at Medium/Hard. Easy may name the aspect ("wheels"), not the variant.
  - Target vocabulary groups: big/small/long/short, fast/slow/heavy/light, narrow/wide/steep/slippery,
    powerful/flexible/durable/efficient, traction/accelerate/navigate/conceal. Tag the words each facet uses (`vocab`).
- **Facet levels** map difficulty to thresholds (mud depth 1–3 → mud grip ≥ 2/3/4). Phrases may differ per level
  ("muddy" → "deep, sticky mud").
- **Tradeoffs**: variants change several stats (big engine: power+, weight+). Several builds may solve one requirement.
- **Scenarios**: 12–15 per workshop, each a scene the runs package can animate in side view (top view only where
  needed). Each facet lists its views and its hint aspect.
- **Starters**: Race Shop: Deep Mud (wheels), Long Jump (speed: engine, gears or rocket), Sharp Turn (springs; top
  view), Steep Hill (engine power), Bright Color (paint; fog, ducks wait to cross: a dull car isn't seen). Dino Lab:
  Big Teeth (gulp a cartoon critter; small teeth: it giggles and wriggles away), Green Skin (hide in ferns from a big
  sniffing predator), High Jump (legs), Small Hole (size), Standing Up (peek over tall grass to find the nest).

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
