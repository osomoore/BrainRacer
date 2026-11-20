# BrainRacer — Next Conversation Plan

Start here in a new conversation. Read `CLAUDE.md`, `docs/STATUS.md` (current state) and this file.

## How we work (proven in session 1)
- **Main session = orchestrator (Opus):** owns contracts (`src/core/*`), `RaceScene`, merging, review, small glue fixes, docs.
- **Implementation = Sonnet sub-agents** (Haiku for mechanical chores), run in parallel with **disjoint file ownership**. The user prefers this to save usage.
- **Codex as driver:** if the user hands the wheel to Codex for a while, see `AGENTS.md` at the repo root (it acts as orchestrator and may commit on `dev`).
- **Codex (user runs it in another VS Code panel):** give it self-contained jobs that touch files nobody else is editing (data/JSON content such as music tracks or `wordMeta.json`). Codex must not run git; the orchestrator validates and commits its output.
- **Worktrees (manual, because the Agent tool's built-in `isolation: "worktree"` fails on this machine with a c:/C: drive-letter mismatch):**
  ```powershell
  git worktree add -q ".worktrees\X" -b "pkg/X" dev
  New-Item -ItemType Junction -Path ".worktrees\X\node_modules" -Target "$PWD\node_modules"
  # in the worktree: npm run assets
  ```
  Agent prompt must say: work only inside `.worktrees\X` with absolute paths, a unique dev-server port, one commit on `pkg/X`, never delete the junction, **never `git stash`** (shared across worktrees).
  **Removal (order matters!):** stop the agent's dev server, `cmd /c rmdir .worktrees\X\node_modules` (deletes the link only), THEN `git worktree remove --force .worktrees\X; git branch -D pkg/X`. Removing a worktree with the junction still present wipes the real `node_modules` (recover with `npm ci`).
- **Merge loop:** `git merge --no-ff pkg/X` → `npx tsc --noEmit` → `npm test` → `npm run e2e` → screenshot check via Playwright on Edge (`chromium.launch({ channel: 'msedge' })`) → update STATUS.
- Vite "Outdated Optimize Dep" after big merges → restart the dev server with `--force`.

## Queued playtest changes

The Beach & Harbor scenery and bridge update is complete. See STATUS for the new details and night timing.

- Beach & Harbor lighthouse: the player could not find it during normal play. Check visibility from the driving routes and check the rotating beam at night.
- Dino encounter: the alert appeared, then the dino wandered off without taking hits or firing lasers. Check the transition into the active encounter in solo and co-op.

Session 3 finished the queued playtest list and the map/gameplay ideas (destination text, round clock during breaks, launch options, day/night by map, darker Industrial, Easy+, player siren, freight smash, dino lasers, building gaps). See STATUS "Session 3 changes".

## Backlog

### Low-end device (ONN Android TV box, TV Bro browser)
Done 2026-11-20 (see STATUS "Hidden settings menu"): hidden settings menu (LT+RT+Start / F9) with debug + input readouts; build stamp on title and menu; Files audio (Ogg Opus in `public/audio/`, `npm run audio:render`) + Sample engine, now the defaults (ONN audio clock went from about 0.6x to 0.9-1.1x); Traffic Normal/Reduced/Minimal; per-player gas A/Trigger/Auto; HUD baked to textures (6x-throttled 2P city: about 19 to 48 fps).
Open:
- Test on the ONN: race fps with the baked HUD, whether Trigger gas avoids TV Bro's controller-as-mouse mode on the second pad, and whether Auto gas feels right.
- Baked HUD, never visually checked: wrong-answer X, the 2P "Waiting..." card, the dino / rock monster alert frame, and the "Look!" and place banners. The question-panel glow came out slightly fainter. The panel textures are baked at 2x, up to about 30 MB of GPU memory; bake them at 1x if the box stutters or crashes when a panel first appears.
- Listen: loop seams in the title, race, farm and dino music, and in the siren and engine loops.
- Music: the Underground track is too sparse (too few notes). Give it more drive and action, then re-run `npm run audio:render`.
- Next performance work (from the 6x-throttle profile): enable Matter sleeping plus off-screen NPC update skipping (about +10-15%, needs wake-on-contact checks); a render-resolution option (unmeasured, depends on the box GPU); trim the display list per camera. Matter iteration counts gave no gain.
- Fallback if TV Bro keeps fighting us: a small Android TV WebView app wrapper.

### Session 4 follow-ups
- Farm: tractors sometimes wander onto paved roads.
- Farm: animals ignore fence bodies (zone rect only), so a flung animal walks back through a fence. Animals and farm vehicles cast no long shadow yet (`ensureCastShadow` in `buildingTex.ts`). The ridden dino launches animals by proximity.
- Farm look: lane mud is a square tile with no lane edges, square inner road corners, overlapping shadows stack darker, flower placement repeats, east turbine shadows run off the map. Golden-grade strength is `FARM_LOOK.gradeAlpha`/`gradeColor`.
- Corn slowdown shares `car.slow()` with the police-bump slow (a bump in corn can be cut short); a `surfaceMult` on IPlayerCar would separate them.
- Dino ride: police heat still builds while riding; the freight train passes through the ridden dino. `DINO.maxHp`/`ramDamage*`/`turboMult`/`teamMult` are mostly unused now.
- Guide buddy: one cause fixed (arrived player driving off). Unverified: the orbit target is not clamped to the inset view (could sit under the scoreboard/seam near a view edge), and buddy visibility after vehicle hop / reset / dino events.
- Audio by ear: farm track (new `pluck` instrument), animal sounds, corn rustle, mud splash, louder player siren.
- Merge script lesson: only delete a package branch/worktree after `git merge` succeeded (a conflict leaves the merge in progress).

### Session 3 follow-ups
- Freight smash "+2" is a popup only. Add a `train:smashed { player, cars }` event so ScoreSystem awards real points. A smash also registers as a normal building crash (damage/shake); decide if it should.
- Proposed sounds (`SfxName`): `laser` (dino charge/fire; reuses turbo/shockwave/pop now) and `smash` (reuses crashBig/pop).
- Local texture keys not in `TEX`: `dino_laser_beam`, `dino_laser_glow`, `industrial_cargo_crate`. Promote to `assetKeys.ts` if wanted.
- Goal ring floor sprite sits under the Industrial darkness overlay (the glow/beacon compensate). Consider drawing it above `INDUSTRIAL_LIGHTING.nightDepth`.
- "Waiting…" pill still sits at `HUD.hint.y` 112, which was set below the old destination card; check it on screen. `hudMath.isOnScreen` is now only used by its test. `GUIDE.topInset` comment in GuideSystem still mentions destination cards.
- Easy+ blurb could read "Bigger sums, more words" instead of "A little bigger".
- Industrial and dino browser specs are sensitive to load. Run them with two Playwright workers for full-suite checks.
- **Never use `git stash` in agent worktrees:** the stash is shared by all worktrees, and two session-3 agents swapped each other's work that way (recovered).

### Session 2 follow-ups

Session 2 finished items 1–6 (Easy place words, reward delay, held-button arming, break panels vs scoreboard, goal banner → card pulse, guide buddy distance). See STATUS. Open follow-ups from that work:
- `CHALLENGE.rewardPanelClearSec` (1.05) mirrors HUD `panel.resultHoldSec + fadeSec` by hand; keep them in sync if the HUD fade changes.
- Guide buddy: `GUIDE.topInset`/`seamInset` keep it off the split-screen scoreboard. In single player it uses the full view and avoids the top-left scoreboard. Check the hand-off to the goal orbit (hover ~500 px vs `nearGoal` 450).
- Sub-agents writing files from PowerShell can produce Windows-1252 bytes (a "…" broke `vite build` in session 2). Tests and typecheck don't catch it; `npm run e2e` does (it builds).

## Playtest checklist (needs the user, real pads, projector)
- Xbox pads: steering, RT/LT, diamond answers with face or D-pad buttons, held-button behavior into a break or after a wrong answer, double-tap B to switch vehicles, Start = pause, hot-plug, rumble.
- Reward timing: turbo + jump should land ~0.7 s after the question panel fades (car glows in between).
- "Waiting…" pill readable and well placed now that the destination card is gone?
- Car feel: pivot turning, wall unstick, turbo and punch-through strength, boost-jump height and distance.
- Camera rotation smoothness (`CAMERA.rotTau`, `maxAngVel`), car screen height (`carScreenY`).
- Question breaks: interval (10 s) feel, wrong-answer retry delay (`CHALLENGE.wrongRetrySec` 0.5 s), dim strength.
- Guide buddies: easy to follow? Too fast or slow? Visible on the projector?
- Dino: guard speed (75 px/s), ram difficulty (hp 100), roar loudness.
- Audio by ear: boost, siren, roar, new music, overall balance.
- Readability of question cards from the back of the room.
- Session 4 by eye/ear: Farm golden hour and long shadows on a projector in both split views, corn slowdown/track/spring-back, animal launches (fun, not scary), tractors and combines, dino ride (3 hits, 20 s, speed, stomp shake), Industrial clutter and new bridges, guide buddy in 2P.
- Session 3 by eye/ear: Industrial darkness on a projector (`INDUSTRIAL_LIGHTING.nightAlpha`), player siren loudness (`POLICE.playerSirenVolume`), dino laser fairness for 5-year-olds (`DINO_LASER.chargeSec`/`fireSec`), freight smash threshold and re-form time, whether the building alleys look intentional (`WORLD.maxBuildingRun`), Easy+ feel.
- Latest changes: Beach & Harbor scenery density, ramp approaches, market shortcuts, beachgoer readability, bridge detail, and night visibility. Also check half-speed handling, one-press dino boarding, split-screen fence restoration, and bomb knockback.
- Check Underground neon and lava readability on a projector, the mine carts from both seats, and the new music by ear. Check the bomb stays upright while turning and try bumping a Farm wagon before and after a dino toss.

## Bigger roadmap (from PLAN.md Wave 5, not started)
- Industrial at Night and Beach & Harbor are playable in Setup. The projector, real-controller, and by-ear checks remain on the playtest checklist.
- Optional minimap; button remapping UI for odd USB pads; more challenge types (subtraction, letter-by-letter spelling); high-score table; optional desktop wrapper (Electron/Tauri).

## Map kickoff plans (done)

The Industrial at Night and Farm kickoff plans were carried out (sessions 1–4); see STATUS "Industrial at Night" and "Farm". Use them as the template for a new map: orchestrator sets contracts (RaceMap, tiles, layout types, TEX block, SfxName/MusicTrack), phase 1 = generator (Opus) + art + audio in parallel, phase 2 = renderer (Opus) + gameplay systems + traffic, then wiring, Setup row and e2e.

## Small cleanups
- Police bump should use the actual colliding cruiser (add an npc reference to `vehicle:crash`).
- Traffic right-of-way at junctions (optional).
