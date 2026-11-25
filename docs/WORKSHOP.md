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
  requirement, unlocks, hint after 3 fails). Admin: F9 / LT+RT+Start / gear on every device + multiplication gate.
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
- **Reading levels: Starter / Easy / Medium / Hard.** Starter uses short, sound-out-able wording and shares
  Easy's four stations, challenge rules, and economy. Medium and Hard use all ten stations.
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
- **Admin:** LT+RT+Start/Menu on a pad, F9 on a keyboard, click or tap the gear on any device from the join screen or the 1P profile screen, then answer the multiplication question.
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
- **Payout = 1 x the number of requirements** in the challenge (1 req = 1, 2 = 2, 3 = 3 ...). "Harder" means more
  requirements (e.g. big springs AND mud tires; 3-4+ at higher tiers). Numbers are always even and small so young kids
  can add them.
- **No replays.** A won challenge leaves the board for good and is never generated again (dedupe by its resolved
  requirement set). Old successes stay in the save for a future scoreboard/trophy screen (later feature, not built now;
  listed in `WORKSHOP_FUTURE_VARIANTS.md`).
- **Variants are bought at the aspect's station** in the workshop room. Each station always shows the next 2 unowned
  variants of that aspect (from the aspect's unlock order) for sale with a price tag; buying one reveals the next.
  Unaffordable ones are visible but not installable and show "You need more coins" / "You need more Bio Juice"
  (optionally the missing amount as a number).
- Each variant has a fixed price from its place in its aspect's shop order: 2, 3, 6, 9, 12 … (basePrice for the first, then priceStep × index). Prices never change.
- **Fresh start.** Each aspect starts with one owned variant and the wallet starts at 4. Version 2 saves keep their
  existing cards, which are re-categorized on load.
- **Board of three.** The first deal includes one **Ready** card (solvable with owned parts), one **Affordable** card
  (needs purchases within the wallet balance), and one **Future** card (needs purchases beyond the balance). For
  each card, use the cheapest complete build, including the cost of any purchases needed to reveal a later shop offer.
- **Purchasing parts** can change a card's category. The same challenges stay on the board and keep their colors as
  the list reorders Ready, Affordable, Future.
- **Completing a challenge** fills one vacancy. Recalculate the surviving cards with the new balance and look for
  missing categories in Ready, Affordable, Future order. Skip categories with no eligible card, and draw from an
  already represented category if needed to keep three cards. New challenges prefer a different build, and a Ready
  card may accept the current build when no other Ready challenge is available.
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
- **Checks** include `statMin`, `statMax`, `tag`, `noTag`, and `anyOf`. A requirement passes with a complete
  build named in its level's guidelines or when all its original checks pass. An `anyOf` check passes when all
  the checks in at least one option pass.
- **evaluate**: every requirement is evaluated (also those after a failing stage: `reached: false`).
  The run ends at the first stage with a failing requirement; `firstFail` = first failing requirement there.
  Named fixes take precedence when recording the route. A full win with at least one stat-route requirement
  shows a seeded celebration at the player's reading level and earns an extra buddy point.
- **available variants** = owned (first starter per aspect + purchased) ∪ `open` overrides − `locked` overrides; an aspect never ends up empty
  (if every variant of an aspect is locked, its first starter stays available).
- **Generator** (seeded by `genSeq`, which only increases):
  - Tier `t = min(maxTier, floor(firstWins / winsPerTier))`. Tier sets stage count and requirements per stage, e.g.
    t0: 1 stage × 1 req; t1: 1 × 1–2; t2: 1–2 stages; t3: 2 stages × 1–2; t4+: 2–3 stages, more aspects, tradeoffs.
    Exact table is engine-owned (config).
  - Only facets with `minTier <= t` and scenarios with `minTier <= t`.
  - Construction picks scenarios, facets, and levels, then uses the solver to find a build in the requested category.
    It normally requires a change from the current model and `lastWin`, and prefers at least `minChangedAspects` changes.
    Prefer (not require) challenges whose solutions need the newest unlocked variant about 40% of the time; the
    rest should need older parts or combinations.
  - The three active challenges should differ (different scenarios / hint aspects where possible).
  - Text comes from the scenario and facet phrase banks. A stage with one requirement is titled by that facet's
    level title; a stage with two or more uses the scenario's single stage title. Two stages join their titles with
    "&", and three or more start with the first title. Easy through Hard append "Adventure". Each requirement shows one authored row (A or B),
    the same row at every reading level.
  - Saved challenges keep their checks, named builds, and text for all four levels. Older open cards are re-dealt when the challenge rules version changes.
- **Starters** (see Currency and shop): hand-picked ones are offered first only if each needs exactly one 2-cost purchase; they must fail with the default model.
- **Board**: 3 active challenges (mix and affordability rules in Currency and shop). A won challenge is removed for good
  and never regenerated (deduped by resolved requirement set). Its success stays in the save history. Spending
  reorders the current cards. The save retains active cards and caps unfinished history at `maxSavedChallenges`.
- **Win**: pays `1 x requirement count` into the workshop's wallet (coins / Bio Juice), `firstWins++`, the challenge leaves
  the board and is recorded as a success with its winning build; the build is also stored as `lastWin`. A first win earns
  one buddy point, or two on a clever win. Every ten points unlocks a buddy. Surplus points carry toward the next buddy.
  Variants are bought with `purchase` (fixed price from the variant's place in its aspect's shop order).
- **Fail**: `fails[id]++`. The results screen shows up to `failLinesMax` (2) failure lines, one per failed reached
  requirement, each naming a fix from the requirement's named fixes: one the player owns, else one the wallet covers,
  else the cheapest (`logic/failHints.ts`). The chosen parts are saved in `failHints[id]` and shown on the card (a
  yellow "!") and in its detail, at the current reading level, until the challenge is won. The older aspect hint
  (after `hintAfterFails`) only shows when no failure line can be named.
- **Overrides** change availability. A card that loses every possible route is replaced.
- **Version 2 saves** use `workshop.players.v1` for `Record<profileId, PlayerSave>` and `workshop.device.v1` for
  `DeviceSave` in localStorage. Per-workshop data includes the wallet, bought variants, board and success history.
  Model is saved on every part change.

## Content guide (content/race, content/dino)

- **Starter** uses the regular words and small sight-word list in `content/starterWords.ts`. Write concrete
  sentences of 2–5 words in hints and success lines, and 2–6 words in guidelines, stories and rendered
  failure lines. Split a long guideline into short sentences. Copy part names and station labels exactly.
  A long failure fix starts by naming the part that needs to change.

- **Guidelines** give beginning readers one short line per requirement. The title names the problem (one title per
  facet level, plus one stage title per scenario that fits all its facets), and each line names the fix by the part
  names shown at the stations ("Get Mud Tires.", "Pick the Small size."), naming a part for every check of the
  level. When a requirement accepts alternatives, name every option on that line and link them with "or". Use
  everyday words. Use up to **6 words on Easy**, **8 on Medium**, and **12 on Hard**, with Easy <= Medium <= Hard
  in each row. No line may repeat. Short part words other than the variant names must be listed in the catalog's
  `partAliases`. Use “and” for parts that belong together and “or” for alternative builds. All the fix options
  named at a facet level are accepted at that level. `validateCatalog` checks the guideline wording
  and applies the same word limits and hard-word list to clever-win messages.
- **Stories** are what the card shows for each requirement (`content/<ws>/stories.ts`, one row per facet level).
  A story describes the problem so the kind of part that helps is obvious ("Squish! The road is sticky mud. Wheels
  need to grip!"), without being a bare order. It may name a part but does not have to. Up to **10 words on Easy**,
  **12 on Medium**, **14 on Hard** (two short sentences are fine), Easy <= Medium <= Hard, complete sentences, the
  same hard-word list, no repeats. Vary how lines start. The guideline lines above stay in `phrases.ts`: they are
  no longer shown, but they define each level's named fixes.
- **Failure lines** are templates per facet with one `{parts}` ("You needed {parts} to grip the mud."). Parts read
  as `partPhrases` writes them ("a Winch", "the Small size", "Fire Red paint"). `validateCatalog` fills in every
  named fix of every level and checks the result: up to 12 / 14 / 16 words (long fixes end in "and more"), a
  complete sentence that names a part of that fix. Practice cards use a story per station with one `{part}`
  ("Vroom! Fans want to hear a Turbo Engine.") and the shared `PRACTICE_FAIL` lines, checked for every part.
- **Facet levels** map difficulty to thresholds (mud depth 1–3 → mud grip ≥ 2/3/4). Phrases may differ per level
  ("muddy" → "deep, sticky mud").
- **Tradeoffs**: variants change several stats (big engine: power+, weight+). Several builds may solve one requirement.
- **Scenarios**: 12–15 per workshop, each a scene the runs package can animate in side view (top view only where
  needed). Each facet lists its views and its hint aspect.
- **Starters**: Race Shop: Muddy Road (wheels), Jump the Gap (speed: engine, gears or rocket), Sharp Turn (springs; top
  view), Steep Hill (engine power), Foggy Road (paint; ducks wait to cross). Dino Lab:
  Beetle Snack (teeth; gulp a cartoon critter; small teeth: it giggles and wriggles away), Sniffing Dino (skin color; hide in ferns from a big
  sniffing predator), High Rock (legs), Small Hole (size), Tall Grass (peek over the grass to find the nest).

### Alternative fixes (C27)

| Workshop and challenge | Accepted fixes | Easy guideline example |
|---|---|---|
| Dino Lab, Tall Grass (`tallGrass.peek`, level 1) | Standing, Long Neck, or Big or Huge size. | Stand, long neck, or big body. |
| Race Shop, River Crossing (`river.cross`, level 1) | Snorkel to drive through the stream, or Floaties to cross on the surface. | Use floaties or a snorkel. |

Both fixes count as one requirement on their respective cards. A build must satisfy every guideline, and the
win pays one coin or one Bio Juice per requirement. The board compares the total cost of complete builds
and uses the cheapest to determine the category. An owned route makes the card Ready. A practice card can serve
as a Ready card when no authored card is eligible.
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

### Test launch (C52)

The board deals and saves its cards before **Test it!**. The run screen reads the active card and current model
from that save and evaluates the result. Repeated save reads reuse validation for identical storage contents and
return independent copies. Changes from another tab or Family sync are picked up from storage on the next read.

Race Shop and Dino Lab draw baked canvases before handing them to Phaser, so a cold run avoids a full pixel
readback and an upload of the blank canvas. Rigs and scenery still use the game's shared texture cache.
A painted image arriving late can update an existing texture in place. The run builds scenery for each reached
stage when it plays.

C52 measured the first rendered stage frame in Edge at 1920×1080 with one and two players. With 6× CDP CPU
throttling, the median cold launch across Snack, Ferns and Chase dropped from 365 ms to 265 ms. Across Mud and
Turn it dropped from 361 ms to 298 ms. The measurements used a desktop GPU. Check cold starts and retries on the
Android tablet and Mali-G310 TV box.

## Testing

- Unit tests next to pure code (`apps/**/*.test.ts`, run by `npm test`).
- Engine: progression simulation (fresh profile → everything unlocked) with real catalogs; solvability of every offered
  challenge; the last-win rule; determinism; admin sandbox never mutates the real save.
- e2e: `tests/e2e/workshop*.spec.ts`. Hooks: `window.__ws` (pane contexts, engine) for tests.
- Dev-server ports per package: shell 5191, audio 5192 (render 5193), art 5194, screens 5195, runs 5196/5197.

## Starter and Easy use four aspects (WS_EASY_ASPECTS)

On Starter and Easy each workshop shows only the aspects in `WS_EASY_ASPECTS` (`apps/workshop/config.ts`): race = wheels, engine, paint, size; dino = color, teeth, body, size. The other aspects stay pinned to their first starter for judging, rendering and runs; their bought parts stay owned and return on Medium/Hard. `WorkshopProgress.easy` marks a board dealt for Starter or Easy. Switching between the four-station and ten-station levels re-deals the open cards (`progressOf` / `normalizeSave`). Pure helpers live in `logic/aspects.ts`. Facets that cannot be solved inside the four aspects are never dealt on Starter or Easy (the board only offers cards the solver can meet with the shown aspects).
