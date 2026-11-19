# BrainRacer — Status

Branch: `dev` (local only, not pushed). Quick test: `npm run dev` → `http://localhost:5173/?race=2` (skip menus) or `/` (full menus).

| Wave | Package | State | Notes |
|---|---|---|---|
| 0 | Foundation | ✅ merged | Scaffold, contracts, asset pipeline, e2e harness |
| 1 | A Input | ✅ merged | Gamepads + 2 keyboard layouts; F2 raw-input overlay |
| 1 | B Challenge engine | ✅ merged | 3 kinds × 3 difficulties; one guess; place-triggered challenges |
| 1 | C City generator | ✅ merged | Seeded 48×48 city, places, ramps, lane graph (100% connected) |
| 1 | D Audio | ✅ merged | Tone.js SFX/engine/roar; Codex-composed music; optional `.mid` overrides in `src/audio/music/midi/` |
| 1 | E Procedural art | ✅ merged | All textures drawn in code; `?dev=ArtGallery` |
| 2 | F Vehicle physics | ✅ merged | Top-down tire model, recoil off walls; `?dev=DriveTest` |
| 2 | G World builder | ✅ merged | Tilemap + 3D-ish buildings + place signs; perf fix by orchestrator |
| 2 | H Camera rig | ✅ merged | Single / merged / split with smooth transitions; `?dev=CameraTest` |
| 2 | I HUD | ⏳ running | |
| 2 | P Menus | ✅ merged | Title/join, Setup, Pause overlay; e2e tests |
| 3 | J Traffic | ⏳ running | |
| 3 | K Police | ⏳ running | |
| 3 | L Goals/score/results | ⏳ running | |
| 3 | M Rewards/FX | ⏳ running | |
| 3 | N Jumps | ⏳ running | |
| 3 | O Dinosaur | ⏳ running | |
| 4 | Integration + tuning | — | |

## Decisions / notes
- Phaser 3.90 (not 4) for sub-agent familiarity.
- Words: `manifest.csv` labels map through `src/data/wordAliases.json` to single simple words (e.g. "rain cloud" → "cloud"). Labels without a good single word stay multi-word and only appear on **Hard**. Edit the alias file, then `npm run assets`.
- Performance: avoid rounded rects / paths in live `Graphics` (re-triangulated every frame per camera). Bake to textures.
- Playwright runs on Edge (`channel: 'msedge'`) to use the real GPU.

## To check by hand (playtest)
- Real Xbox pads: steering, triggers, X/Y/B, Start, hot-plug, rumble.
- Sound balance, roar scariness, "wah-wah" tone.
- Car size on screen at merged zoom (may need `CAMERA.baseZoom` > 1 for kids/projector).
- Shapes on Hard (circle/oval/sphere look-alikes).
