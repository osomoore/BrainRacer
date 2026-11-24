# Codex jobs — Adventure Workshop

A queue of self-contained jobs for Codex. Pick the **first job marked `OPEN` that has no `codex/<job>` branch yet**
(check `git branch --list "codex/*"`; `<job>` is the lowercase id, e.g. `c1`), do only that job, hand it back,
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
npx vite --port <job port> --strictPort  # the Port line of your job; restart after every edit (no hot reload in .worktrees)
```
- Use only your job's port. If it is busy, pick the next free port above 5220 and say so in the hand-back.
  Never stop a process you did not start (5190/5191/5198/5199/5203 belong to the user).
- **Use lower-tier sub-agents when they suffice** (mechanical edits, test runs, screenshots, searches); keep the
  top model for design calls and review. For art and shape-drawing work, Sol is a good fit.
- Always branch from the **current `feature/workshop`** (never `dev`, never another job's branch).
- Work only inside your worktree and only in the job's file scope. Never `git stash`. Never delete the
  `node_modules` junction while the worktree exists.

**End**
1. `npm run typecheck && npm test` pass; `npx playwright test tests/e2e/workshop --workers=1` passes.
2. Screenshots checked in the reviewer (`tools/art-review/`, once job C1 is done) or the dev scenes below.
3. Commit on `codex/<job>` (small commits are fine), set the job to `DONE (codex/<job>)` here, stop.
   Do not merge, do not push. Claude (the orchestrator) reviews and merges into `feature/workshop`.
4. Remove nothing; leave the worktree for review.

**Review URLs** (your job port): `workshop.html?dev=WorkshopParts&workshop=race&aspect=wheels` (arrows = aspect, 1/2 = workshop,
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

## C1 — Rescue and commit the art reviewer · `DONE (codex/c1)`
- **Why:** the grading tool lives in `.worktrees/ws-artpolish/test-results/workshop-review/` (gitignored; Playwright
  wipes `test-results/` on every e2e run). Backup copy: `C:\Users\osomo\AppData\Local\Temp\claude\art-review-backup\`.
- **Scope:** new `tools/art-review/**`, one npm script `"art:review"` in `package.json`.
- **Do:** move `grade.html`, `grade-v2.js`, `grade-catalog-v2.js`, `capture-grading.cjs`, `check-grading.cjs` (and
  anything they need) into `tools/art-review/`, fix paths, write captures to `tools/art-review/shots/` (gitignored),
  keep the export format of `workshop-art-feedback_*.json` exactly (array of `{workshop, aspect, variant, name,
  grade 1-5|null, comment}`). Add a short `tools/art-review/README.md` (capture, open, grade, export).
- **Done when:** `npm run art:review` captures every variant of both workshops (side + top) and opens the grading
  page; grades persist in localStorage; export works; the old test-results copy is no longer needed.

## C2 — Accent colors and base colors · `DONE (codex/c2)`
- **Scope:** `apps/workshop/art/race/looks.ts`, `art/dino/looks.ts`, `art/dino/skin.ts`, `art/race/drawSide.ts`/`drawTop.ts`
  only where accents are drawn.
- **Do:** give every dino color (`color.*`) and every car paint (`paint.*`) its own fixed **accent color** in the look
  table (one accent per skin: a "red with green" look would be a separate future skin, not a second choice). Use the
  accent for dino spots, feathers, frill rims, glow spots, stripes; for cars, for trim and (later) the racing stripe.
  Base colors: dino orange brighter and more tiger-orange; dino green darker, forest green. Rework car Rainbow
  (graded 2/5: make it a clean rainbow band layout that reads at small size).
- **Done when:** each color/paint shows a clear, pleasant accent in both views; review items above addressed.

## C3 — Car part layering · `DONE (codex/c3-c4)`
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

## C4 — Car shapes · `DONE (codex/c3-c4)`
- **Scope:** `apps/workshop/art/race/**`.
- **Do:** Sports Car: brand-new low, long-hood supercar profile (think Porsche / Ferrari silhouettes, cartoon-ified).
  Round and Sleek shapes: the cabin/greenhouse is far too small — make it larger and blend smoothly into the lower
  body. Wedge: keep the idea, tone the wedge angle down. Big Spoiler: tilted forward (leading edge low), sits on the
  rear deck at the body's height, body-colored with accent trim.
- **Done when:** each shape reads instantly at half size, and every body × shape combo still looks right
  (`&page=random`, several seeds).

## C5 — Car sizes · `DONE (codex/c5-c6)`
- **Scope:** `apps/workshop/art/race/**`, `apps/workshop/dev/WorkshopParts.ts`.
- **Do:** size comparison page shows a fixed reference (e.g. a kid figure or a cone) and all sizes at the same scale.
  Per-part scaling so small cars look cute: tires a bit larger relative to the body on Small/Tiny; roof-rack luggage
  relatively larger and only one bag on Small/Tiny. (A "Giant" size is a future variant: not in this job.)
- **Done when:** sizes are clearly different next to the reference; small cars look intentionally chunky.

## C6 — Gears close-up (hood open) · `DONE (codex/c5-c6)`
- **Scope:** `apps/workshop/art/race/**` (new `art/race/detail.ts`), `apps/workshop/art/index.ts` (new export
  `buildDetail(scene, workshop, model, aspect): Phaser.GameObjects.Container | null`), `screens/stationScreen.ts`
  (use `buildDetail` when it returns a container).
- **Do:** gears are never visible in the side view or while driving (remove the side-view gear badge). The Gears
  station instead shows the car from above the hood with the hood open: the engine plus a gear train whose look
  differs per variant (Easy: a few plain gears; Speed: small fast gears; Climbing: big strong gears; 4x4: gears plus
  shafts to all four wheels). The preview swaps as the player scrolls.
- **Done when:** the Gears station shows the open-hood view for all four variants; side view has no gear badge.

## C7 — Dino structure fixes · `DONE (codex/c7-c8)`
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

## C8 — Dino sizes · `DONE (codex/c7-c8)`
- **Scope:** `apps/workshop/art/dino/**`, `apps/workshop/dev/WorkshopParts.ts`.
- **Do:** the size page must show sizes clearly different against a fixed reference (same as C5). Consider per-part
  scaling (e.g. small dinos: bigger head and eyes relative to body; huge: thicker legs).
- **Done when:** Small / Medium / Big / Huge are obviously different side by side.


## C9 — Dino heads, mouths and teeth · `DONE (codex/c9)`
- **Source:** review 2026-11-23 (`C:\Users\osomo\Projects\BrainRacer\feedback\workshop-art-feedback.json`) and head vote comments in `apps/workshop/art/paint/picks.json`.
- **Scope:** `apps/workshop/art/dino/**`.
- **Do:**
  - **Horn Head:** in top view the horns must grow from the **top** of the head (now they come from below it). Check side view matches.
  - **Rex Head:** in top view, taper smoothly into the neck (now a sharp edge where it merges back).
  - **Beaks (all 4 profiles in `BEAK_LOOKS`):** the jawline between top and bottom jaw stops sooner; it should not run so far back toward the neck. The profiles themselves are approved, including the wide duckbill.
  - **Teeth:** Flat, Big and Sharp: at the back of the mouth the top row runs over the bottom lip; keep it inside. Mega Teeth: start the teeth slightly closer to the front lip.
- **Done when:** each item is visibly fixed in side + top views and the T-Rex combo still reads as a goofy T-Rex.
  List affected painted heads in the hand-back.
- **Hand-back:** The paint manifest stays as is. The installed overhead Orange Rex Head with Feathers still uses
  its voted paint because the runtime matches by texture key and dimensions. Use `&art=shapes` to review the
  new taper. Overhead Horn Head already uses the code shape, and the voted Short and curved beak caps are unchanged.

## C10 — Dino body, claws and tails · `DONE (codex/c10)`
- **Scope:** `apps/workshop/art/dino/**`. Run after C9 is merged (same files).
- **Do:**
  - **Claws (all variants):** in side view, lower them so they touch the ground at the ends of the feet; now they float above it.
  - **Heavy Tail:** remove the blocky corner on the bottom edge where the base joins the extension; one smooth curve.
  - **Spiked Tail (side view only; top view is fine):** the tip swells slightly and ends in a small set of 2–3 spikes that point up, out and over from the end.
  - **Armor Plates:** start the plates further forward on the body (they start too far back, clearest in the crawling body plan).
- **Done when:** every item visibly fixed in the reviewer sheets for claws, tail and body.

## C11 — Dino patterns with seeded placement · `DONE (codex/c11)`
- **Why:** the head vote asked for "more" on camo, glow, stripes and spotted: every painted candidate starts from the same code shape, so the leaves/spots/stripes sit in the same places on all of them.
- **Can run in parallel with C9** (separate pattern code); if both touch the same file, C9 merges first.
- **Scope:** `apps/workshop/art/dino/**`, `apps/workshop/art/paint/jobs.ts`, `scripts/art/**`, `tools/art-pick/**`.
- **Do:**
  - Pattern placement for `extra.camo`, `extra.glow`, `extra.stripes` and `color.spotted` comes from a seeded `Rng` (no `Math.random`); the in-game default keeps one fixed seed per look.
  - `art:paint --candidates N` varies the pattern seed per candidate (not only the paint seed), and the pick/apply flow records and reinstalls the chosen pattern seed, so a picked candidate reproduces.
  - **Glow Spots:** spread them out (now clustered on legs and head) and offer 3–4 distinct glow layouts in the vote.
  - **Leaf Pattern:** more leaves, each aimed within 15° of straight back along the body.
- **Vote batch:** `npm run art:paint -- --candidates 4 --only "ws:d:*:extra.glow*" --part head,torso,tail`.
  Add `--dry-run` to export the alternate pattern PNGs under `art-src/` without ComfyUI.
- **Done when:** `npm run art:shapes` plus a candidate dry run (no ComfyUI) show clearly different placements per candidate; tests cover seed → placement determinism. **Do not run ComfyUI painting**; the user starts it.

## C12 — Car shapes and layering · `DONE (codex/c12)`
- **Scope:** `apps/workshop/art/race/**`. Start only after `pkg/ws-shopview` (ride height, gears view) is merged into `feature/workshop`.
- **Do:**
  - **Windows:** Round and Sleek shapes: the windows follow the car's own outline (now they don't match).
  - **Wedge:** the side stripe breaks where it crosses the empty wheel well.
  - **Jeep:** the spare tire is seen edge-on in both side and top view (only the rubber shows).
  - **Mud Tires:** nubs stick out evenly all the way round (now only on the bottom).
  - **Small Bumpers:** a little longer at both ends.
  - **Rocket Booster:** slightly smaller, and not clipped at top and bottom.
  - **Layering:** in top view all wheels draw under the body; in side view the spoiler draws behind the body.
  - **Roof rack:** side and top views agree: Medium shows 2 bags in both, Big shows 3 in both. Remove the stray yellow piece in front of the front bumper.
- **Done when:** every item visibly fixed in the reviewer sheets (side + top).
- **Hand-back:** The existing painted Jeep body textures still show the old spare. Review the edge-on spare
  with `&art=shapes`. The side and top Jeep body paints need a refresh to pick up the new geometry.
## C13 — Screen polish and the flaky mobile test · `DONE (codex/c13)`
- **Parallel-safe with C14 and C15.** No user review needed: every item has an objective check.
- **Port:** 5221.
- **Scope:** `apps/workshop/screens/results*`, `apps/workshop/screens/station*`, `apps/workshop/shell/**` (Admin pill only),
  `apps/workshop/config.ts` (add keys in the screens/shell sections), `tests/e2e/workshop*.spec.ts`.
- **Do:**
  - **Admin pill:** in wide Admin Mode the ADMIN MODE pill overlaps the results headline. Move/resize it so it never
    overlaps any screen's headline in wide (1920×1080) and tall (960×1080) layouts.
  - **Results contrast:** dimmed rows for stages not reached are too faint. Keep them visibly "not reached" but make the
    text meet WCAG AA contrast (≥ 4.5:1) against its background; text stays ≥ 40 px.
  - **Springs station framing:** with Lift Kit (and big wheels / Big or Huge size) the springs close-up crops the top of
    the car. Frame the springs view so the body edge above the springs and the wheel below are both in frame for every
    springs variant, size and wheel type. Follow the bumpers framing code already in `stationScreen.ts` (fit from a width
    measured at creation, not after `setModel`).
  - **Flaky e2e:** `tests/e2e/workshop.spec.ts` "mobile: tap to play gives one pane; gear opens the grown-up gate" fails
    under load and passes alone. Find the race (likely a fixed timeout or a tap before the scene is ready) and replace
    waits with state-based waits. Do not just raise timeouts.
- **Done when:** screenshots (wide + tall) show no overlap and readable dimmed rows; the springs view is framed for all
  variants (shoot them all); the workshop e2e suite passes 3 times in a row with `--workers=1` and once with default workers.

## C14 — Paint jobs for Dino Lab run scenery (no painting) · `DONE (codex/c14)`
- **Parallel-safe with C13 and C15.** Sets up jobs only. **Do not run ComfyUI** (`--dry-run` only); the user starts painting.
- **Port:** 5222.
- **Scope:** new `apps/workshop/art/paint/jobsDinoRun.ts` (+ test), one import line in `apps/workshop/art/paint/jobs.ts`
  (`allArtJobs()` includes them), `scripts/art/**` only if export needs a hook, `apps/workshop/run/dino/kit/art.ts` only to
  expose the shape drawers for export (no visual change), `docs/WORKSHOP_PAINT_BACKLOG.md`.
- **Do:** turn the Dino Lab list in `docs/WORKSHOP_PAINT_BACKLOG.md` into `shape` paint jobs (code shape in → paint out,
  same as rig parts), keyed by the existing texture keys `ws:dino-run:<name>` so painted PNGs replace the placeholders at
  runtime through the manifest. Skip particles and procedural strips (they stay code). Critters with faces (`frog`,
  `lizard`, `bird`, `bigHead`, `friend`, `beetle`, `fish`) use the face-safe settings (`FACE_NEGATIVE`, face tune) so paint
  doesn't invent mouths. Prompts follow `HOUSE_STYLE`; kid-safe; one accent colour per item.
- **Done when:** `npm run art:shapes` exports a PNG for every new job; `npm run art:paint -- --dry-run --only "ws:dino-run:*"`
  lists them; a test checks every backlog item has a job or is in an explicit skip list; the game looks unchanged
  (no manifest entries until painted). Mark the items "job added" in the backlog doc.

## C15 — Paint jobs for Race Shop run scenery (no painting) · `DONE (codex/c15)`
- **Parallel-safe with C13 and C14.** Same rules as C14: **no ComfyUI**, `--dry-run` only.
- **Port:** 5223.
- **Scope:** new `apps/workshop/art/paint/jobsRaceRun.ts` (+ test), one import line in `apps/workshop/art/paint/jobs.ts`,
  `apps/workshop/run/common/props.ts` and `run/common/top.ts` only to expose shape drawers and stable texture keys
  (no visual change), `scripts/art/**` only if export needs a hook, `docs/WORKSHOP_PAINT_BACKLOG.md`.
- **Do:** first fill in the "Race Shop run scenes" section of the backlog (list the ~80 `P.*` props and `T.*` top-view
  pieces, grouped like the Dino Lab list, with the same skip rules). Then add `shape` jobs for them as in C14 (people and
  animals with faces use the face-safe settings). Keep the props' existing texture key prefix.
- **Done when:** same checks as C14 with `--only` set to the race prop key prefix.


## C16 — Title screen fixes for the live beta · `DONE (codex/c16)`
- **Parallel-safe with C17.** No user review needed. The beta is live on GitHub Pages, so keep it small and safe.
- **Port:** 5221.
- **Scope:** `apps/workshop/shell/TitleScene.ts`, `apps/workshop/config.ts` (shell/UI section, add or change keys only),
  `tests/e2e/workshop*.spec.ts`.
- **Do:**
  - **Player 2 slot:** "(optional)" overlaps the second line of "Player 2: press A, Space or Enter". Lay the slot text out so
    nothing overlaps in wide (1920×1080) and tall/phone layouts, text ≥ 40 px.
  - **Beta notice on phones:** at a phone viewport (390×844 and 844×390) the "Under construction — progress may be lost."
    card is too small to read. Make it readable there (the stage letterboxes; scale the card/text for the tall layout or
    reflow it) without crowding PLAY or "Back to games". Desktop look stays as it is.
  - Add an e2e check that the title screen's text objects don't overlap (bounds intersection) in wide and tall layouts.
- **Done when:** screenshots at 1920×1080, 390×844 and 844×390 show no overlaps and a readable notice; workshop e2e passes.

## C17 — Painted scenery actually shows in runs · `DONE (codex/c17)`
- **Parallel-safe with C16.** No ComfyUI, no user review needed.
- **Port:** 5222.
- **Why:** C14/C15 added paint jobs for run scenery (`ws:dino-run:*` and the Race Shop prop keys), but nothing proves a
  painted PNG in `public/art/workshop/manifest.json` replaces the placeholder at runtime. The run kits register textures
  under their own names (`run/dino/kit/paint.ts` `def`, `run/common/props.ts`, `run/common/top.ts`) while the jobs use
  prefixed keys, and `bake.ts` looks painted images up by key (`art/paint/painted.ts`).
- **Scope:** `apps/workshop/art/paint/painted.ts`, `apps/workshop/art/bake.ts`, `apps/workshop/run/dino/kit/paint.ts`,
  `apps/workshop/run/common/props.ts`, `apps/workshop/run/common/top.ts` (lookup wiring only, no visual change),
  tests next to them, and one e2e spec if needed.
- **Do:** make scenery textures check the painted manifest under the same key their paint job uses (including sprite
  origin/size handling: painted PNGs must keep the placeholder's anchor and display size), and upgrade when the image
  arrives, like rig parts do. `?art=shapes` must still force code shapes.
- **Done when:** a unit test (fake manifest + fake image) proves one dino scenery texture and one race prop are replaced;
  an e2e/dev check with a temporary test manifest entry (a tinted copy of the exported shape PNG, NOT committed) shows the
  painted version in a run with the same position and size; with the real manifest the game looks unchanged; tests pass.


## C18 — Dino shape fixes from review round 2 · `DONE (codex/c18)`
- **Parallel-safe with C16, C17 and C19.** Shape (code) drawing only, no ComfyUI. Source: `feedback/workshop-art-feedback_2.json`.
- **Port:** 5223.
- **Scope:** `apps/workshop/art/dino/**` (shapes, looks, patterns, layering), `apps/workshop/dev/WorkshopParts.ts` and
  `RigAnims.ts` (sheets only), tests next to them. No gameplay or catalog stat changes.
- **Do:**
  - **Beaks (teeth.beak + all 4 beak profiles):** the lower beak's back edge fades out before it meets the jaw. Carry it
    to the head's underside so it merges with the bottom of the head.
  - **Claws (all claw variants):** claws are drawn as one stack on the top layer. Far-side claws go behind (staggered
    with the far foot/arm layer), start nearer the tips of the feet, and look smaller in profile. Near-side ones stay in
    front.
  - **Tiny Arms (`claws.tinyArms`, the T-Rex arms in the claws/arms aspect):** the reviewer showed it as something that
    does not read as arms or claws. Make it read clearly as two short T-Rex arms with small claws, near arm in front,
    far arm behind. In the reviewer only, label the aspect "Arms & Claws".
  - **Tails vs feathers:** feathers clash with `tail.spiked` and `tail.paddle`. Move the feathers to a spot that works on
    those tails (e.g. the base of the tail, before the spikes/paddle), or skip them for those two tails.
  - **Patterns (seeded, C11):**
    - Glow Spots also on the belly, in a faded/different shade.
    - Leaf Pattern leaves thicker, also on the belly, in a different shade.
    - Tiger Stripes spaced more regularly: not perfectly even, but no touching stripes, no doubles, no big gaps.
      Add a unit test for the spacing rule over many seeds.
- **Done when:** reviewer sheets (`?dev=WorkshopParts&art=shapes&freeze=1`) and `RigAnims` screenshots show each fix
  at side and top views for every head/size combo that the change touches; tests pass. List in the hand-back which paint
  keys are now stale (their voted paint hides the new shape).

- **Hand-back:** The installed paint `ws:d:thead:head.round:color.orange:extra.stripes:n` still shows the old stripe
  layout. Any previously generated Leaf Pattern or Tiger Stripes candidates need a fresh shape export before repainting.
  Reviewer sheets accept `head=head.rex` and `size=size.huge` (or any other dino head and size IDs); use
  `aspect=tail&extra=extra.feathers` to review the spiked and paddle tails.

## C19 — Race Shop attachment placement from review round 2 · `DONE (codex/c19)`
- **Parallel-safe with C16, C17 and C18.** Shape (code) only, no ComfyUI.
- **Port:** 5224.
- **Scope:** `apps/workshop/art/race/**`, `apps/workshop/dev/WorkshopParts.ts` (race sheets only), tests next to them.
- **Do:**
  - **Jeep spare tire:** mount it lower on the back, close to rear bumper height.
  - **Winch:** mount it higher on the front, above the small bumper.
  - Check both on every body type, size and wheel type where they appear, side and top views; nothing may float or
    overlap the wheels.
- **Done when:** reviewer screenshots of the jeep and winch sheets (`&art=shapes&freeze=1`) show the new placement on all
  bodies/sizes; tests pass. List stale paint keys in the hand-back.
- **Review:** `workshop.html?dev=WorkshopParts&page=jeep&size=size.tiny&art=shapes&freeze=1` or
  `workshop.html?dev=WorkshopParts&page=winch&body=body.sports&size=size.tiny&art=shapes&freeze=1`. Each sheet shows all wheels.

## C20 — Dino head fixes from head paint votes · `DONE (codex/c20)`
- **Start point:** branch `codex/c20` from `feature/workshop` at `c221dc6`.
- **Parallel-safe with C21.** Shape (code) only, no ComfyUI.
- **Port:** 5225.
- **Scope:** `apps/workshop/art/dino/**` (shapes, looks, patterns), `apps/workshop/dev/WorkshopParts.ts` (dino sheets only),
  tests next to them.
- **Do:**
  - **Top view (thead) Horned head:** the horns start under the eyeballs. Start them further back on the skull and/or angle
    them outward so they never overlap the eyes.
  - **Top view Tiger Stripes (`extra.stripes` on `head.round`, overhead):** stripes must be left/right symmetrical about the
    body's center line. Each stripe either crosses fully or ends at the same distance on both sides; none may start on one
    side and end on the other. Keep C18's regular spacing (no touching, no doubles, no big gaps).
- **Done when:** reviewer sheets (`?dev=WorkshopParts&art=shapes&freeze=1`) show both fixes in side and top views for every
  head/size combo the change touches; a unit test covers the stripe symmetry rule over many seeds; tests pass.
- **Hand-back:** list the paint keys that are now stale. `ws:d:thead:head.horned:color.orange:extra.feathers:n` and
  `ws:d:thead:head.round:color.orange:extra.stripes:n` need fresh candidates (the user voted "more").

## C21 — Art-pick vote page: comment field hidden · `OPEN`
- **Start point:** branch `codex/c21` from `feature/workshop` at `c221dc6`.
- **Parallel-safe with C20.** Tool UI only; no art or shape changes.
- **Port:** 5226.
- **Scope:** `tools/art-pick/**` only, tests next to them.
- **Problem:** on the vote page (`npm run art:pick`, http://localhost:5203/) the comment/response text field is covered by
  the panel showing the prompt, so the user types blind and cannot see leftover text.
- **Do:**
  - Make the comment field always fully visible and readable: text ≥ 18 px, multi-line, grows or scrolls. It must never be
    overlapped by the prompt panel at 1920×1080 and at a laptop size such as 1366×768.
  - When a job loads, show the existing saved comment in the field.
  - Make it obvious how to clear the comment (a visible clear button or label, not a hidden key).
- **Done when:** Playwright screenshots at both sizes (1920×1080 and 1366×768) show the field fully visible with text in it;
  existing tests pass.

---

## Done
- C1 · `DONE (codex/c1)`
