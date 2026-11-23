# Adventure Workshop — performance audit (2026-11-22, desktop Edge, CDP CPU throttle)

Desktop throttling slows JS only; the TV box (Mali-G310) limits are GPU cost (masks, overdraw, blends) and memory,
which this audit cannot measure. Raw data/scripts: `%TEMP%\claude\ws-perf\`.

## Results
- 6x CPU (≈ TV box CPU): every screen and run scene ≥ ~53 FPS avg (vsync-capped ~57). 20x used to rank relative cost.
- Heaviest at 20x: **2P room** (14.6/8.7 FPS vs 31.4/14.4 in 1P; dino room has 17–18 live tweens), dino board 2P 1% low 3.2,
  runs race:parade (45/19), race:river, race:beach, dino:canyon (split), dino:desert (single ~35 ms hitches).
- Textures plateau (≈ 110–206 depending on mode); heap plateaus ~100 MB. ~20 Mpx of textures ≈ 80 MB GPU if resident.

## Hotspots (file refs as of commit c8f5f21)
1. 2P room: looping bubble tweens per tank (`screens/roomScreen.ts:49-54`), per-frame character depth (`screens/room/Character.ts:44-70`).
2. Rig tween storm: each rig tween calls a full `render()` (`art/rigBase.ts:97`, `110-130`) → 2–3 re-poses per frame per rig.
3. Texture memory: everything baked at Q=1.5 (`art/bake.ts:9`); `ws:rr` rounded-rect cache 4.8 Mpx; swatches keyed per model.
4. First-use bake stalls: per-run `bakeTemp` backgrounds (`run/common/draw.ts:68-90`), `ws:dino-run:*`, swatches.
5. Geometry mask on every stage wipe/roll (`run/runner.ts:74-80`): stencil + broken batching, likely costly on Mali.

## Bug
- **Orphaned tweens after an aborted Dino run** (B-skip / leaving mid-run): +5 tweens per aborted run, forever.
  `run/dino/kit/world.ts:100-107` only disposes in `finally` after the awaited script, which never resolves on abort;
  `RunHandle.destroy()` (`run/runner.ts:216-232`) does not reach the `Act`.

## Fix plan (ranked)
1. Replace the runner's geometry mask (pane camera viewport already clips). 2. Make runner destroy dispose the dino `Act`.
3. Pre-bake/caches for run backgrounds and swatches. 4. Lower bake `Q` (art-quality decision: user). 5. Cheaper 2P room
(fewer bubbles, one render per rig per frame). 6. Evict `ws:sw:*`/`ws:d:*` on leaving a workshop.

## To verify on the real TV box
2P dino room, any stage wipe, the first run after boot. If < 30 FPS: fixes 1 and 5 first.
