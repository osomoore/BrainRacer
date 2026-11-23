# Adventure Workshop — art polish handoff (for Codex)

> **Superseded:** new art work is queued in `docs/CODEX_JOBS.md` and follows `docs/WORKSHOP_ART_PIPELINE.md`. This file stays as background (rules, review URLs, rig contract).

Goal: make the Adventure Workshop look great. The game works; the art is a functional first pass made of
procedural Canvas drawings baked to textures. Improve how things LOOK without changing how they BEHAVE.
Read `AGENTS.md`, `CLAUDE.md` (rules 10, 11, 14, 15) and `docs/WORKSHOP.md` ("Decisions", "Art guide") first.

## Branch and checkout

- **Already set up for you:** worktree `.worktrees\ws-artpolish` on branch `art/workshop-polish`, branched from
  `feature/workshop`, with `node_modules` linked and assets generated. Work ONLY there. Do not create another
  worktree (`git worktree add` would fail on the existing branch). Check with `git worktree list`.
- Never remove that worktree with the junction in place (`cmd /c rmdir .worktrees\ws-artpolish\node_modules` first).
- Vite does not hot-reload inside `.worktrees` (`watch.ignored`): restart the dev server after edits.
  The server for this worktree runs on **port 5198** (`npx vite --port 5198 --strictPort`, from `.worktrees\ws-artpolish`).
  Restart it by stopping the process on 5198 and starting it again, then reload the browser.
- Before each commit: `npm run typecheck && npm test`. Before asking to merge: `npx playwright test tests/e2e/workshop --workers=1`.
- **Do not touch `apps/workshop/run/dino/**` or `apps/workshop/dev/DinoStages.ts`**: a paused Claude agent owns them
  (`.worktrees/ws-rundino`). Everything below is fair game.

## What you may change (art only)

| Area | Files | What it draws |
|---|---|---|
| Car parts | `apps/workshop/art/race/looks.ts` (look table per variant), `drawSide.ts`, `drawTop.ts`, `geometry.ts` | Every car variant, side + top view |
| Dino parts | `apps/workshop/art/dino/looks.ts`, `drawSide.ts`, `drawTop.ts`, `skin.ts` (patterns), `skeleton.ts` (pose math) | Every dino variant, side + top view |
| Rig assembly + animation | `art/race/rig.ts`, `art/dino/rig.ts`, `art/rigBase.ts` (tween anims), `art/bake.ts` (texture baking, `Q` = bake resolution 1.5) | How parts stack and move |
| Run scenery (Race Shop + shared) | `apps/workshop/run/common/props.ts` (~80 baked props), `draw.ts` (palette `PAL`, shape helpers), `fx.ts` (particles), `side.ts` / `top.ts` (stage backdrops) | Skies, hills, mud, bridges, ducks, frog, hay… |
| Race Shop scenes | `apps/workshop/run/race/*.ts` | Per-scenario staging (keep timing and pass/fail flow) |
| Workshop room | `apps/workshop/screens/room/backdrop.ts` (garage + lab), `icons.ts` (station icons, kid character), `Character.ts` | The room screen |
| UI look | `apps/workshop/ui/style.ts` (colors, fonts), `ui/icons.ts` (car/dino tiles), `ui/Button.ts` (baked rounded buttons), `ui/screenChrome.ts` (backdrop/header) | Buttons, cards, headers |

## Rules you must keep (behaviour contracts)

1. **Never edit** `apps/workshop/core/*`, `run/types.ts`, `logic/**`, `content/**` (ids, names, stats, text).
2. **Rig API stays the same** (`ModelRig` in `core/runtime.ts`): `buildRig(scene, workshop, model, view)`;
   origin = ground point under the model's middle (side) / centre (top); faces +x; `width`/`height` after size
   scaling; `parts[aspect]`; `setModel()` swaps in place; `play(anim)` for every `RigAnim`.
   - **Anchor names** used by run scenes: race `wheelFront`, `wheelRear`, `exhaust`, `roof`, `front`, `back`;
     dino `mouth`, `headTop`, `tail`, `feet`, `belly`, `front`, `back`. Keep them pointing at the right spot.
   - **`focus(aspect)`** (station zoom point + zoom) must still frame that part.
   - **Size scales**: race tiny 0.6 / small 0.8 / medium 1 / big 1.3; dino small 0.7 / medium 1 / big 1.35 / huge 1.8.
     Run scenes size obstacles around these, so keep overall proportions close.
3. **Both views from one look entry**: a variant must look the same side and top (same colors, pattern, size,
   features). Every variant id keeps a look entry (tested in `art/art.test.ts`).
4. **Variants must stay distinguishable at a glance**, at 300 px tall on a projector and at half size in split screen
   (960×1080 panes). Kids pick parts by looking at them.
5. **Performance (weak Android TV box)**: bake every rounded shape/path to a texture once (CLAUDE.md rule 15);
   no live `Graphics` redraws per frame; keep particle counts modest; texture keys prefixed `ws:`.
6. **Kid-safe** (ages 5–9): cute, cheerful, thick outlines, saturated colors. Dinos are funny, never scary
   (a T-Rex is a goofy cartoon T-Rex). No words drawn in scenes (no "POW!"); icons/sparkles are fine.
7. Deterministic visuals in runs: use the stage's `ctx.rng`, never `Math.random`.

## How to review your work

Dev server, then open (all at 1920×1080; screenshot with Playwright + Edge):
- `workshop.html?dev=WorkshopParts&workshop=race&aspect=wheels` — every variant of an aspect, side above top.
  Arrows change aspect, 1/2 workshop, `&page=random&seed=N` random combos.
- `workshop.html?dev=RigAnims&workshop=dino&model=rex` — every animation on one model (models: default,
  monster pickup, rocket sports, rex, flyer, swimmer, long neck). V toggles side/top.
- `workshop.html?dev=RunPreview&scenario=mud&facet=mud.grip&level=2&pass=0` — any Race Shop scene, pass/fail,
  `&split=1` for the half-width pane, `&view=top`.
- The real game: `workshop.html` (Space joins/confirms, WASD moves, Esc back), or seed via `window.__ws`.

## Known art issues (good first targets)

- Car: the coil springs are drawn over the wheel hubs; monster wheels on a low sports/sleek body hide most of the body.
- Dino: the standing torso reads like sitting with short legs (T-Rex with powerful legs is fine); the torso outline
  arcs over the neck base like a collar; swim pose legs look awkward; the neck frill gradient is garish and large;
  T-Rex feet float slightly above the ground line.
- Top views: car wheels don't visibly spin; dino legs only swing; wings squash for flapping.
- Huge dino (×1.8) may look soft: raise `Q` in `art/bake.ts` if needed (watch GPU memory on the TV box).
- Run scenes: mud/water/snow pools are plain rounded rectangles; parade top view and fog-scene ducks (top view)
  are thin/minimal; `rocks.clearance` failure is subtle.
- Room: functional; could use more charm (lighting, shelves, posters, animated bits).

## Hand back

One or a few commits on your branch with a short summary: what changed, before/after screenshots you checked,
anything you could not keep inside the rules above. The orchestrator (or the user) merges it into `feature/workshop`.
