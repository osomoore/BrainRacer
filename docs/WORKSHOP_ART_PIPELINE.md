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
| Candidates + voting | `paint.py --candidates`, `tools/art-pick/`, `apps/workshop/art/paint/picks.json` | Several painted candidates per part, a local vote page, votes feed back into the job seed. See below. |
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

## Face-safe painting (parts with eyes / nostrils)
The cute-sticker paint pass likes to invent faces: on a dino head it drew a second mouth on the side of the head and a mouth line
above the real open jaw (the jaw and teeth are separate rig parts, the head has only the eye, nostril and, for the rex, a brow).
Jobs that carry facial features are marked `protect: 'features'` in `jobs.ts` (all dino `head` / `thead` jobs). For them `paint.py`:
1. builds a **feature mask** from the exported shape: every pixel that is outline-navy (#1b1b3a, within 55) or near-white (eye white,
   highlight, pupil ring), then grows it (4 px for the repaint mask);
2. runs **masked img2img** (`SetLatentNoiseMask`): white = repaint (the skin inside the silhouette), black = the shape's own latent
   (eyes, nostrils, outline, everything outside the part), so the model never regenerates a feature;
3. uses a gentler recipe (`PAINT_TUNE.faceDenoise` 0.55, `faceControl` 0.95, `faceSticker` 0.4), a positive "smooth skin, the eye is the
   only facial feature" and `FACE_NEGATIVE` ("mouth, lips, teeth, tongue, smile, extra eyes, face, nose, nostrils, eyebrows, ...");
4. **scrubs invented strokes**: any dark, outline-coloured painted pixel that is not next to a real feature (an extra mouth or crease) is
   replaced by the surrounding skin colour (normalized Gaussian fill);
5. **copies the feature pixels back** from the shape exactly (grown 2 px, soft edge), so eyes/nostrils are identical to the code shape.
`python scripts/art/paint.py --no-protect ...` paints without the mask (to compare). Cheeks (translucent pink) and skin patterns are
deliberately not protected: they are skin. To protect another part, set `protect: 'features'` for it in `shapeJob` (`faceSafe`).

## Candidates and voting
Instead of trusting one seed, paint several and vote. Nothing here touches the game manifest until you apply the votes.
```
npm run art:paint -- --candidates 4 --only "ws:d:head:*:color.orange:*" --part head   # 4 seeds per job -> art-candidates/<file>/<seed>.png
npm run art:pick                                                                       # vote page: http://localhost:5203/ (ART_PICK_PORT to change)
npm run art:paint -- --apply-picks                                                     # install the votes into public/art/workshop + manifest
```
- `--candidates N` accepts the same `--only/--aspect/--part/--limit` filters. It writes `art-candidates/<file>/<seed>.png`, a copy of
  the code shape (`shape.png`) and `art-candidates/index.json` (key, seeds, prompt, shape file, size). `art-candidates/` is gitignored.
  A job that already has N candidates is skipped; with fewer it is topped up. Seeds are derived from the job's default seed
  (`defaultSeed + k * 2654435761`), so they are reproducible and never collide.
- **Vote page** (`tools/art-pick/`, no dependencies, port 5203): the code shape and the N candidates side by side on a checkerboard or the
  game's sky blue (`B`), zoom (`Z` or the selector), filters (workshop / aspect / part / view / voted-or-not), progress counter, comment box.
  Keys: `1`..`9` pick that candidate, `0` keep the code shape (reject all), `M` need more candidates, `U` clear, `Left`/`Right` move, `C` comment.
  Every vote is saved at once to `apps/workshop/art/paint/picks.json` (committed): `key -> { pick: <seed> | "shape" | "more", comment? }`.
- **`--apply-picks`** (no ComfyUI needed; it re-exports the shapes first): numeric pick -> the candidate PNG is copied to
  `public/art/workshop/<file>.png` and the manifest entry is written with that seed; `shape` -> the manifest entry and PNG are removed
  and normal `art:paint` runs skip the job (the game shows the code shape); `more` jobs are listed.
- **How picks feed back**: `jobs.ts` reads `picks.json`, so a picked job's `seed` is the picked seed (it is part of `specHash`). A normal
  `npm run art:paint` therefore reproduces the chosen image, and the staleness test stays green after `--apply-picks`.
- **More candidates**: vote `M`, then run `npm run art:paint -- --candidates 4 --only "<same glob>"`. Jobs voted `more` get 4 fresh seeds
  added to the existing ones (the `more` vote is cleared, a comment is kept); reload the vote page.

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
