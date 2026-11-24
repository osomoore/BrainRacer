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

## Fixes applied (branch pkg/ws-perf)
- **Aborted dino run**: `scenario()` now disposes its `Act` when the stage layer is destroyed (`RunHandle.destroy()` destroys layers), so loops/tweens stop even while the script awaits. Also `SideStage.spray` drops its `update` listener on layer destroy. e2e test aborts 6 dino runs and checks the pane tween count stays flat. Note: on this Phaser build the leak could not be reproduced on the starter/admin dino challenges tried (count flat before and after), so the fix is defensive and the test is a regression guard.
- **No geometry mask** in `run/runner.ts` stage wipe/roll: the pane camera viewport clips (dev scenes set a viewport too). Nothing else changed visually.
- **One render per rig per frame**: `art/rigBase.ts` tween `onUpdate` only marks the rig dirty; it re-poses once at the scene `postupdate`. (race/dino `rig.ts` untouched.)
- **Room**: 2 bubble tweens per tank instead of 4; the walking character only updates position/depth when it moved.
- **Run backgrounds cached**: `bakeTemp(..., cacheKey)` keeps an LRU (6 idle entries, in-use never evicted) keyed by workshop + stage JSON + size + colours + drawing code; used by `SideStage` terrain and `TopStage.bg`. The dino kit already caches its textures by key (no per-run re-bake).

### Measurements (Edge, 1920x1080, CPU throttle 20x, 5 s rAF, desktop; noisy, single run each)
| scene | before avg / 1% low | after avg / 1% low |
|---|---|---|
| 2P dino room | 50.6 / 22.5 | 37.5 / 27.3 (avg noisy; 1% low better) |
| race:parade run | 49.1 / 18.9 | 54.8 / 27.4 |
| dino:canyon split | 56.6 / 53.6 | 56.3 / 38.6 (noise) |
| aborted dino runs, tween count after 6 aborts | 1,1,1,1,1,1 | 1,1,1,1,1,1 |
Desktop numbers are within noise for most rows; the real gains (no stencil mask, fewer tweens/re-poses, no bake stall on the 2nd run) matter on the TV box GPU. Verify there.
