# Codex jobs — Adventure Workshop

A queue of self-contained jobs for Codex. Pick the **first job marked `OPEN`**, do only that job, hand it back,
and mark it `DONE (<branch>)` in this file on your branch. Each job has a fixed start point, a file scope and a
"done when" list, so it can be done in one sitting.

Read `AGENTS.md`, `CLAUDE.md` (rules 10, 11, 14, 15), `docs/WORKSHOP.md` and `docs/WORKSHOP_ART_PIPELINE.md` first.

## How every job starts and ends

**Start**
```powershell
cd C:\Users\osomo\Projects\BrainRacer
git fetch . feature/workshop:feature/workshop 2>$null   # local branch; nothing to fetch remotely
git worktree add -q ".worktrees\codex-<job>" -b "codex/<job>" feature/workshop
New-Item -ItemType Junction -Path ".worktrees\codex-<job>\node_modules" -Target "$PWD\node_modules"
cd ".worktrees\codex-<job>"; npm run assets
npx vite --port 5198 --strictPort        # restart after every edit: Vite does not hot-reload inside .worktrees
```
- Port 5198 is the shared art viewer port. If it is busy, stop whatever listens on it first
  (`Get-NetTCPConnection -LocalPort 5198 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).
- Always branch from the **current `feature/workshop`** (never `dev`, never another job's branch).
- Work only inside your worktree and only in the job's file scope. Never `git stash`. Never delete the
  `node_modules` junction while the worktree exists.

**End**
1. `npm run typecheck && npm test` pass; `npx playwright test tests/e2e/workshop --workers=1` passes.
2. Screenshots checked in the reviewer (`tools/art-review/`, once job C1 is done) or the dev scenes below.
3. Commit on `codex/<job>` (small commits are fine), set the job to `DONE (codex/<job>)` here, stop.
   Do not merge, do not push. Claude (the orchestrator) reviews and merges into `feature/workshop`.
4. Remove nothing; leave the worktree for review.

**Review URLs** (port 5198): `workshop.html?dev=WorkshopParts&workshop=race&aspect=wheels` (arrows = aspect, 1/2 = workshop,
`&page=random&seed=N`, dino `&page=beaks`), `workshop.html?dev=RigAnims&workshop=dino&model=rex` (V = side/top),
`workshop.html?dev=RunPreview&scenario=mud&facet=mud.grip&level=2&pass=0` (`&split=1` half width).

## Ground rules for every art job

- **Code draws shapes, ComfyUI paints them** (see `docs/WORKSHOP_ART_PIPELINE.md`). Your job is the shape layer:
  silhouettes, which part sits in front of which, proportions, flat base colors, outlines. Do not hand-paint
  textures, mottling, shading gradients or fine detail: the ComfyUI pass adds those. Flat fills + clean outlines.
- Keep the rig API: `buildRig`, anchors (race `wheelFront wheelRear exhaust roof front back`; dino
  `mouth headTop tail feet belly front back`), `focus(aspect)`, size scales, `setModel`, every `RigAnim`.
- Side and top views come from the same look entry and must match.
- Never edit `apps/workshop/core/*`, `logic/**`, `content/**`, `run/types.ts`. No new catalog variants (put ideas
  in `docs/WORKSHOP_FUTURE_VARIANTS.md`).
- Kid-safe, cute, no words drawn in scenes. Bake shapes to textures (rule 15). No `Math.random` in run visuals.

---

## C1 — Rescue and commit the art reviewer · `OPEN`
- **Why:** the grading tool lives in `.worktrees/ws-artpolish/test-results/workshop-review/` (gitignored; Playwright
  wipes `test-results/` on every e2e run). Backup copy: `C:\Users\osomo\AppData\Local\Temp\claude\art-review-backup\`.
- **Scope:** new `tools/art-review/**`, one npm script `"art:review"` in `package.json`.
- **Do:** move `grade.html`, `grade-v2.js`, `grade-catalog-v2.js`, `capture-grading.cjs`, `check-grading.cjs` (and
  anything they need) into `tools/art-review/`, fix paths, write captures to `tools/art-review/shots/` (gitignored),
  keep the export format of `workshop-art-feedback_*.json` exactly (array of `{workshop, aspect, variant, name,
  grade 1-5|null, comment}`). Add a short `tools/art-review/README.md` (capture, open, grade, export).
- **Done when:** `npm run art:review` captures every variant of both workshops (side + top) and opens the grading
  page; grades persist in localStorage; export works; the old test-results copy is no longer needed.

## C2 — Accent colors and base colors · `OPEN`
- **Scope:** `apps/workshop/art/race/looks.ts`, `art/dino/looks.ts`, `art/dino/skin.ts`, `art/race/drawSide.ts`/`drawTop.ts`
  only where accents are drawn.
- **Do:** give every dino color (`color.*`) and every car paint (`paint.*`) its own fixed **accent color** in the look
  table (one accent per skin: a "red with green" look would be a separate future skin, not a second choice). Use the
  accent for dino spots, feathers, frill rims, glow spots, stripes; for cars, for trim and (later) the racing stripe.
  Base colors: dino orange brighter and more tiger-orange; dino green darker, forest green. Rework car Rainbow
  (graded 2/5: make it a clean rainbow band layout that reads at small size).
- **Done when:** each color/paint shows a clear, pleasant accent in both views; review items above addressed.

## C3 — Car part layering · `OPEN`
- **Scope:** `apps/workshop/art/race/**`.
- **Do (from review):**
  - Bumpers drawn **behind** the body in side view so they never cover the lights.
  - Springs drawn **behind** the tires; normally only visible in the gap between tire and body. When the station
    shows springs, the tires fade to ~40% so the spring shows through (add `ModelRig` support only via existing
    `parts[aspect]` alpha, done in `screens/stationScreen.ts` for `aspect === 'springs'`: allowed edit).
  - Bouncy Springs: visible gaps between coils, otherwise like Soft Springs.
  - Engines: tailpipes run into the body and out of sight; engines never overhang the front edge in side view — they
    stick up out of the hood, drawn behind the body outline. Turbo: one vertical pipe in side view (the second is
    hidden behind it). Electric Motor: battery + wires, not a big lightning symbol.
  - Floaties outside the tires (in front of them) in side view.
  - Roof Rack: remove the stray yellow streak in front / off the front bumper.
  - Winch: no overlap with the engine.
  - Mud Tires: knobs all the way round (top edge too), not only the lower half.
  - Snow Tires: larger, with visible chains / grippy studs.
  - Pickup Truck: rear bed edge lower.
- **Done when:** every item above is visibly fixed in `WorkshopParts` side + top; no part covers lights/windows wrongly.

## C4 — Car shapes · `OPEN`
- **Scope:** `apps/workshop/art/race/**`.
- **Do:** Sports Car: brand-new low, long-hood supercar profile (think Porsche / Ferrari silhouettes, cartoon-ified).
  Round and Sleek shapes: the cabin/greenhouse is far too small — make it larger and blend smoothly into the lower
  body. Wedge: keep the idea, tone the wedge angle down. Big Spoiler: tilted forward (leading edge low), sits on the
  rear deck at the body's height, body-colored with accent trim.
- **Done when:** each shape reads instantly at half size, and every body × shape combo still looks right
  (`&page=random`, several seeds).

## C5 — Car sizes · `OPEN`
- **Scope:** `apps/workshop/art/race/**`, `apps/workshop/dev/WorkshopParts.ts`.
- **Do:** size comparison page shows a fixed reference (e.g. a kid figure or a cone) and all sizes at the same scale.
  Per-part scaling so small cars look cute: tires a bit larger relative to the body on Small/Tiny; roof-rack luggage
  relatively larger and only one bag on Small/Tiny. (A "Giant" size is a future variant: not in this job.)
- **Done when:** sizes are clearly different next to the reference; small cars look intentionally chunky.

## C6 — Gears close-up (hood open) · `OPEN`
- **Scope:** `apps/workshop/art/race/**` (new `art/race/detail.ts`), `apps/workshop/art/index.ts` (new export
  `buildDetail(scene, workshop, model, aspect): Phaser.GameObjects.Container | null`), `screens/stationScreen.ts`
  (use `buildDetail` when it returns a container).
- **Do:** gears are never visible in the side view or while driving (remove the side-view gear badge). The Gears
  station instead shows the car from above the hood with the hood open: the engine plus a gear train whose look
  differs per variant (Easy: a few plain gears; Speed: small fast gears; Climbing: big strong gears; 4x4: gears plus
  shafts to all four wheels). The preview swaps as the player scrolls.
- **Done when:** the Gears station shows the open-hood view for all four variants; side view has no gear badge.

## C7 — Dino structure fixes · `OPEN`
- **Scope:** `apps/workshop/art/dino/**`.
- **Do (from review):**
  - **Claws:** redraw every claw variant as seen from the **side** in side view (they currently look top-down).
  - **Teeth:** the upper jaw shows one big tooth-like mass on most variants — fix the upper jaw/lip. Big Teeth: add a
    third tooth. Sharp Teeth: fill the empty stretch with smaller sharp teeth. Mega Teeth: upper and lower teeth
    interlock instead of clashing.
  - **Beak:** keep all 4 approved profiles in `BEAK_LOOKS` (short curved, wide duckbill, long pointed, tall parrot).
    `teeth.beak` uses "short and curved" for now; the others are future variants.
  - **Tails:** Heavy Tail reads as top-down in side view — redraw as a side profile. Spiked Tail: spikes only along the
    top edge, plus a clear feature on the tip. Paddle Tail: new profile and redone fins.
  - **Body:** Armor Plates stop before the neck. Big Belly: the tubby curve lower and with a larger radius.
  - **Legs:** Powerful Legs: front legs less muscular than the back legs.
  - **Crest Head:** smooth the color bands (fewer, softer transitions; ComfyUI adds the final shading).
- **Done when:** every item visibly fixed in side + top; T-Rex combo still reads as a goofy T-Rex.

## C8 — Dino sizes · `OPEN`
- **Scope:** `apps/workshop/art/dino/**`, `apps/workshop/dev/WorkshopParts.ts`.
- **Do:** the size page must show sizes clearly different against a fixed reference (same as C5). Consider per-part
  scaling (e.g. small dinos: bigger head and eyes relative to body; huge: thicker legs).
- **Done when:** Small / Medium / Big / Huge are obviously different side by side.

---

## Done
- (none yet)
