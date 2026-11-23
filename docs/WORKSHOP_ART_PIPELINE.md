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

## Pieces
| Piece | Where | Does |
|---|---|---|
| Art job manifest | `apps/workshop/art/paint/jobs.ts` | Every paintable texture: key, size, source (`shape` = a baked `ws:` texture, `prompt` = none), prompt, seed, strength, mask. Shape jobs are generated from the look tables (one per variant × view × part); prompt jobs are listed by hand. |
| Shape export | `apps/workshop/dev/ArtExport.ts` + `scripts/art/exportShapes.ts` | Headless Edge renders every shape texture to `art-src/<key>.png` (gitignored). |
| Paint | `scripts/art/paint.ts` (`npm run art:paint [-- --only <glob>] [--force]`) | Sends each job to ComfyUI (`http://127.0.0.1:8188`), writes `public/art/workshop/<key>.png` + `manifest.json` (per key: source hash, prompt, seed, model). Skips jobs whose inputs did not change. |
| Runtime | `apps/workshop/art/paint/painted.ts`, hook in `art/bake.ts`, preload in the boot scene | Uses the painted PNG for a key when the manifest has it, else the code shape. |
| Staleness test | `scripts/art/paintManifest.test.ts` | Fails when a shape or prompt changed and its painted PNG was not re-rendered (like the audio guard). |
| Review | `tools/art-review/` (Codex job C1) | Captures, grades 1–5 with comments, exports `workshop-art-feedback_*.json`. Shape problems become Codex jobs; paint problems become prompt/seed/strength edits in `jobs.ts`. |

## ComfyUI setup (this machine)
- Server: `C:\Users\osomo\ComfyUI`, `http://127.0.0.1:8188` (start it before `art:paint`). GPU: RTX 3060 Laptop, 6 GB.
- Checkpoint: `realcartoonXL_v6.safetensors` (cartoon SDXL). LoRAs: `StickersRedmond.safetensors` (sticker style,
  trigger word "Stickers"), `sdxl_lightning_4step_lora.safetensors` / `dmd2_sdxl_4step_lora_fp16.safetensors` (speed).
- ControlNet: `diffusion_pytorch_model_promax.safetensors` (SDXL union; use lineart/canny from the shape image).
  Preprocessors: `comfyui_controlnet_aux` custom nodes.
- House style prompt (start point; tune in `jobs.ts`): "cute cartoon game asset, thick dark outline, bold flat
  colors with soft cel shading, friendly, for kids, clean edges, plain background" + per-job subject. Negative:
  "realistic, photo, scary, blood, text, watermark, blurry, extra limbs".

## Rules
- Code shapes: flat fills + outlines only. No hand-painted gradients/texture (that is the paint pass's job).
- Seeds are fixed per job; re-running gives the same image.
- Painted textures keep the shape's exact size and alpha; anchors never move.
- Keep total painted art reasonable for the TV box (PNG, sized to the baked texture, no 4K backdrops).
