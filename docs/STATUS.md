# BrainRacer — Status

**v1 (city) is feature-complete and ready for a hands-on playtest with real controllers.**
Branch: `dev` (local only, not pushed). 197 unit tests + 5 browser e2e tests pass.

## How to play / test
- Full game: double-click `play.bat`, or `npm run dev` → http://localhost:5173/
- Skip menus: `/?race=1` or `/?race=2` (add `&seed=N`, `&round=60` for a 1-minute round)
- Dev/test hooks (add to a race URL): `&dino=now` (dino in 2 s), `&heat=100` (police chase P1), `&rewards=1` (keys 6/7/8/9 = rainbow/shockwave/ghost/magnet), `&debug=1` (physics outlines)
- Dev scenes: `?dev=ArtGallery`, `DriveTest`, `CameraTest`, `WorldTest`, `HudTest`, `InputTest`, `AudioTest`, `ChallengeTest`, `ResultsTest`
- F2 anywhere: raw controller input overlay

| Wave | Package | State |
|---|---|---|
| 0 | Foundation (scaffold, contracts, pipeline, e2e) | ✅ |
| 1 | A Input · B Challenges · C City gen · D Audio · E Art | ✅ |
| 2 | F Vehicle physics · G World builder · H Camera · I HUD · P Menus | ✅ |
| 3 | J Traffic · K Police · L Goals/score/results · M Rewards/FX · N Jumps · O Dinosaur | ✅ |
| 4 | Integration (RaceScene, system registry, perf, teardown, tuning) | ✅ automated part · ⏳ hands-on tuning with user |
| 5 | Countryside / industrial biomes, minimap, remapping, more challenge types | not started |

## Decisions / notes
- Phaser 3.90 (not 4) for sub-agent familiarity.
- Words: `manifest.csv` labels → `src/data/wordAliases.json` → single simple words. Multi-word labels are Hard-only. Look-alike pairs live in `src/data/wordMeta.json` (`confusableWith`). After editing either: `npm run assets`.
- Performance: never draw rounded rects/paths in a live `Graphics` (re-triangulated each frame per camera). Bake to textures. Currently ~140 fps (headless Edge, RTX 3060) with 35+ NPCs.
- Camera zoom raised 20% for kids/projector (`CAMERA.baseZoom 1.2`, split at 0.84, split views 0.88).
- Playwright uses Edge (`channel: 'msedge'`) for the real GPU.
- Vite "Outdated Optimize Dep" after big merges → restart dev server with `--force`.

## Playtest checklist (needs a human)
- [ ] Xbox pads: steering feel, RT/LT analog, X/Y/B answers, Start=pause, hot-plug, rumble
- [ ] Car feel: dino vs kart difference, wall recoil (`VEHICLE_MODEL.recoil*`), turbo speed
- [ ] Camera: split/merge timing, zoom level on the projector
- [ ] Challenge pace per difficulty; text readability from the back of the room
- [ ] Police: bump strength, can a swarmed player escape
- [ ] Dino: friendly vs scary, roar volume, how often it blocks goals
- [ ] Sound balance (music vs SFX vs engines)
- [ ] Traffic density (35) and truck weight
- [ ] Results star thresholds (`GOALS.starThresholds`)

## Known gaps
- No junction right-of-way for traffic (bumps are absorbed by knock/recover).
- Police bump picks the nearest cruiser to the crash point (crash event has no npc reference).
- Dino still looks a bit crocodile-like from above.
- Big challenge pop-in briefly overlaps a goal banner if both appear together.
