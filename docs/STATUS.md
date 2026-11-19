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

## Playtest round 1 changes (2026-11-19)
- Challenge panel: appears large at the TOP with shake + glow, then docks smaller at the top (no center pop-in). `src/ui/hud/hudConfig.ts` (`dockFrac`, `showSec`, `bigMaxFrac`).
- Camera: facing-up rotating view (car always points up); 2 players always split. `CAMERA.facingUp` (false = old north-up split/merge), `rotTau`, `maxAngVel`, `carScreenY`.
- Driving: pivot-turn when slow/stopped + automatic wall unstick. `VEHICLE_MODEL.pivotRate`, `VEHICLE_MODEL.unstick.*`.
- Challenges default to **Words** (picture->word, word->picture); Setup row "Questions: Words / Math / Mix".
- Menus: A, A, A starts a race (A from any Setup row = start).
- Images: no missing files found in dev/build; added load-error placeholder cards and `predev` now refreshes `public/scenes`.

## Playtest round 2 changes (2026-11-19)
- Challenge panel centered BELOW the car (question on top row, 3 answers on their own row); car at `CAMERA.carScreenY` 0.52. Goal arrow/tag moved to the top band.
- Buildings: baked beveled 3D blocks (read correctly at any rotation); building text labels removed (picture signs kept). Goal name drawn upright in the HUD; goals pop in large and shrink when first on screen.
- Correct answer = turbo + **boost jump** over traffic/buildings (lands on drivable ground) + **punch-through** (traffic/props thrown aside, speed kept).
- Wrong/timeout answer = short slowdown (0.7x / 0.8x) with exhaust sputter.
- Traffic: 25 cars, lighter, easy to shove. Police: gentle siren, despawn after 1.5 s off-screen.
- Dino: appears when one player reaches the goal early, guards it slowly until the teammate arrives; rammable (health bar, turbo x1.5, both-players TEAM HIT x2), "POOF" defeat = +2 per player. 1-player: half-time at the current goal. Louder roar.
- Music: new, more exciting tracks (Codex); music returns to race theme after the dino leaves/is defeated.

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
