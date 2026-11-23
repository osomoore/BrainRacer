# Adventure Workshop — art pipeline (code shapes + ComfyUI paint)

**One system for all workshop art.** Every image the game shows comes from one manifest of art jobs and one
ComfyUI render script, whether it starts from a code-drawn shape (car/dino parts, props) or from a prompt only
(backdrops, skies, textures). Code owns geometry; ComfyUI owns the painting.

## Why this split
- Cars and dinos are assembled at runtime from ~100 parts in two views; anchors, layering, the side/top match and
  `setModel` swaps all depend on code geometry. So code keeps drawing each part as a **shape layer**: silhouette,
  outline, flat base + accent colors, correct proportions.
- ComfyUI **paints over the shape** (ControlNet keeps the outline, img2img keeps the colors), adding cartoon shading,
  mottling, scales, highlights. The result is cut back to the shape's own alpha, so it fits the rig exactly.
- Backdrops, skies, scenery and tileable textures are prompt-only jobs in the same manifest.
- Anything not painted yet shows its code shape: the game always works, painted art is an upgrade.

## Pieces (as built)
| Piece | Where | Does |
|---|---|---|
| Art job manifest | `apps/workshop/art/paint/jobs.ts` (+ `jobs.test.ts`) | `allArtJobs()`: ~400 jobs. Shape jobs call the same `PartSpec` builders the rigs use (variant x view x part, one aspect swapped at a time into the starter model), so key and pixel size cannot drift from the baked textures. Prompt jobs (`PROMPT_JOBS`) are hand-listed. Each job: key, file, subject, prompt, negative, seed (hash of key), size, denoise, control, `specHash` (prompt, seed, strengths, size). Tunables: `PAINT_TUNE`, `HOUSE_STYLE`, `NEGATIVE`. |
| Shape export | `apps/workshop/dev/ArtExport.ts` + `scripts/art/exportShapes.ts` | `npm run art:shapes [-- --only <glob>] [--limit N]`: headless Edge bakes the code shapes (`?dev=ArtExport&art=shapes`) to `art-src/<file>.png` + `art-src/jobs.json` (jobs, pixel hash of each shape, hash of the shape source files). `art-src/` is gitignored. |
| Paint | `scripts/art/paint.ts` (wrapper) + `scripts/art/paint.py` | `npm run art:paint [-- flags]`: exports shapes, then paints with ComfyUI. Writes `public/art/workshop/<file>.png` + `manifest.json` (key -> file, size, specHash, srcHash, shapeHash, model, seed). Skips jobs whose spec, shape pixels and model did not change. |
| Runtime | `art/paint/painted.ts`, hook in `art/bake.ts`, `preloadPaintedArt()` in `shell/BootScene.ts` | Boot fetches the manifest + PNGs (waits at most 4 s). `ensureTexture` uses the painted image when its size matches the texture, else bakes the code shape and upgrades the texture live when the image arrives (so bare `?dev=` scenes work). `?art=shapes` forces code shapes. URLs are relative. `ensurePaintedTexture(scene, key)` serves prompt-only art (backdrops). |
| Staleness test | `scripts/art/paintManifest.test.ts` | Fails when a manifest entry's `specHash`/size no longer matches its job, its job is gone, or its PNG is missing. Passes with an empty or partial manifest. A changed shape source only warns (Codex edits shapes in parallel). |
| Review | `tools/art-review/` (Codex job C1) | Grades parts; paint problems become prompt/seed/strength edits in `jobs.ts`. |

## Commands
```
npm run art:shapes -- --only "ws:d:head:*"           # export shapes (glob on the texture key; comma = alternatives)
npm run art:paint                                     # everything unpainted or changed (hours: ~33 s/image)
npm run art:paint -- --aspect color --part head,torso --limit 5
npm run art:paint -- --only "ws:r:body:*" --force    # repaint even if unchanged
npm run art:paint -- --prune                          # drop manifest entries whose job vanished
npm run art:paint -- --dry-run                        # list what would be painted
python scripts/art/paint.py --help                    # every tuning flag (--steps --cfg --sticker --denoise --control --seed --out <dir> --no-keep-outline)
```
`--out <dir>` writes PNGs to a scratch folder and leaves the manifest alone (use it to tune; keep the path short on Windows).
Compare painted vs code: `workshop.html?dev=WorkshopParts` and `...&art=shapes`.

## Settings that worked (ComfyUI, RTX 3060 Laptop 6 GB, 16 GB RAM)
- Checkpoint `realcartoonXL_v6` ONLY (never load two SDXL checkpoints: the server crashed out of RAM). `paint.py` calls `POST /free` first,
  batch 1, ~1024 px long side, and stops cleanly (exit 2) when the server dies. Run big jobs in `--aspect/--part/--limit` slices.
- LoRAs: `StickersRedmond` 0.6 (shape jobs only), then `sdxl_lightning_4step_lora` 1.0.
- KSampler: euler / sgm_uniform, 8 steps, cfg 1.5, denoise 0.62 (shape jobs; prompt jobs 1.0).
- ControlNet: union promax, type `canny/lineart/anime_lineart/mlsd`, Canny (0.25/0.6) of the shape, strength 0.9, ends at 85 %.
- Shape handling: crop to the alpha bounding box (+8 % pad), upscale to 1024, grey background; the result is scaled back, the shape's exact
  alpha applied, outline pixels (#1b1b3a) copied from the shape so every part has the same crisp outline, soft edges take the shape colour.
- Prompt jobs: txt2img at 1024x576 (textures 768 square) with only the speed LoRA, downscaled; `tileable` textures are cross-faded with
  a half-offset copy so the borders match.
- Speed: about 32 s per image (first model load included).

## Adding a prompt-only job
Add one `promptJob(key, part, subject, prompt, w, h, genW, genH, tileable?)` to `PROMPT_JOBS` in `art/paint/jobs.ts` (key `ws:bg:<name>` or
`ws:tex:<name>`), run `npm run art:paint -- --only "ws:bg:<name>"`, and show it with `ensurePaintedTexture(scene, key)` (returns the key, or
null when it is not painted: keep a code fallback). Changing a job's prompt/seed/size makes the staleness test name it until it is repainted.

## ComfyUI setup (this machine)
- Server: `C:/Users/osomo/ComfyUI`, `http://127.0.0.1:8188` (`$COMFY_URL` overrides). Start it before `art:paint`.
- House style prompt (see `jobs.ts`): "Stickers, cute cartoon game asset, thick dark navy outline, bold saturated flat colors with soft cel
  shading and a glossy highlight, friendly, for kids, clean sharp edges, plain light grey background" + per-job subject.

## Rules
- Code shapes: flat fills + outlines only. No hand-painted gradients/texture (that is the paint pass's job).
- Seeds are fixed per job; re-running gives the same image.
- Painted textures keep the shape's exact size and alpha; anchors never move.
- Keep total painted art reasonable for the TV box (PNG, sized to the baked texture, no 4K backdrops).
