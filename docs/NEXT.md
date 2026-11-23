# BrainRacer — Next Conversation Plan

Start here in a new conversation. Read `CLAUDE.md`, `docs/STATUS.md` (current state) and this file.

## How we work (proven in session 1)
- **Clean up merged work:** after a task branch is merged into `dev` and checked, remove its worktree and delete the branch right away (see "Clean up after merging" in `CLAUDE.md`; unlink the `node_modules` junction first). Old finished branches and worktrees pile up quickly otherwise.
- **Own branch per task (every agent, Claude or Codex):** do each task on its own branch, created for that task from `dev` (Claude uses a worktree under `.worktrees/<task>`). Never edit, commit in, or switch branches in a checkout another agent is using. When the work is checked (typecheck, unit tests, e2e) and complete, merge it into `dev` and push `dev` (pushing `dev` deploys GitHub Pages, which the TV box loads).
- **Main session = orchestrator (Opus):** owns contracts (`src/core/*`), `RaceScene`, merging, review, small glue fixes, docs.
- **Implementation = Sonnet sub-agents** (Haiku for mechanical chores), run in parallel with **disjoint file ownership**. The user prefers this to save usage.
- **Codex as driver** follows `AGENTS.md`, including the task branch and approval rules.
- Give agents in separate VS Code panels their own worktree paths and self-contained jobs. The driver reviews each task branch before integration.
- **Worktrees (manual, because the Agent tool's built-in `isolation: "worktree"` fails on this machine with a c:/C: drive-letter mismatch):**
  ```powershell
  git worktree add -q ".worktrees\X" -b "pkg/X" dev
  New-Item -ItemType Junction -Path ".worktrees\X\node_modules" -Target "$PWD\node_modules"
  # in the worktree: npm run assets
  ```
  Agent prompt must say: work only inside `.worktrees\X` with absolute paths, a unique dev-server port, one commit on `pkg/X`, never delete the junction, **never `git stash`** (shared across worktrees).
  **Removal (order matters!):** stop the agent's dev server, `cmd /c rmdir .worktrees\X\node_modules` (deletes the link only), THEN `git worktree remove --force .worktrees\X; git branch -D pkg/X`. Removing a worktree with the junction still present wipes the real `node_modules` (recover with `npm ci`).
- Run typecheck, unit tests, e2e, and visual checks on the task branch before requesting merge approval. After approval, the driver integrates the branch in the designated checkout and reruns the checks.
- Vite "Outdated Optimize Dep" after big merges → restart the dev server with `--force`.

Use the numbered IDs when referring to queue items. Keep IDs stable as items move or are completed.

Items #1, #2, #4, #5, #6, #11, #18, and #49 were completed in the map progression and bosses update. See [STATUS.md](STATUS.md) for the changes and test hooks.

## Backlog

### Low-end device (ONN Android TV box, TV Bro browser)
Done 2026-11-20 (see STATUS "Hidden settings menu"): hidden settings menu (LT+RT+Start / F9) with debug + input readouts; build stamp on title and menu; Files audio (Ogg Opus in `public/audio/`, `npm run audio:render`) + Sample engine, now the defaults (ONN audio clock went from about 0.6x to 0.9-1.1x); Traffic Normal/Reduced/Minimal; per-player gas A/Trigger/Auto; HUD baked to textures (6x-throttled 2P city: about 19 to 48 fps).
Open:
- **#7** Test on the ONN: race fps with the baked HUD, and whether Auto gas feels right.
- **#8** TV Bro's controller-as-mouse mode turned out to be a long press of B (Android maps B to Back) on either pad, so Trigger gas doesn't help. Fix: the Android TV WebView wrapper in `android/` (2026-11-20, see `android/README.md`). It loads the GitHub Pages URL, so game updates need no reinstall. Toolchain (JDK 17, SDK 35, Gradle 8.9) and the signing key live in `C:\Users\osomo\AndroidDev`. Verified on the ONN box (installed from a USB stick with a file manager): good performance, B no longer exits the app or gives a cursor. Rebuild with `.\android\build.ps1`; the APK is `android/out/BrainRacerTV.apk`. Back up the keystore and its properties file in `AndroidDev`.
- **#9** Baked HUD, never visually checked: wrong-answer X, the 2P "Waiting..." card, the dino / rock monster alert frame, and the "Look!" and place banners. The question-panel glow came out slightly fainter. The panel textures are baked at 2x, up to about 30 MB of GPU memory; bake them at 1x if the box stutters or crashes when a panel first appears.
- **#10** Listen: loop seams in the title, race, farm and dino music, and in the siren and engine loops.
- **#12** Next performance work (from the 6x-throttle profile): enable Matter sleeping plus off-screen NPC update skipping (about +10-15%, needs wake-on-contact checks); a render-resolution option (unmeasured, depends on the box GPU); trim the display list per camera. Matter iteration counts gave no gain.

### Music (see [MUSIC_TODO.md](MUSIC_TODO.md))
- **#66** Music loudness differs by up to 11 dB between worlds, the eight newest worlds get a muffling low-pass mix (only them), their songs are 12–18 s template loops, and City's song is 2–4× denser than the rest. Measurements and fixes are in `docs/MUSIC_TODO.md`.

### Admin (hidden settings) menu rework (not started)
- **#63** Too many items on screen; columns overwrite each other's screen space. Re-layout or paginate so nothing overlaps.
- **#64** Up/down does not move in visual order, it jumps around. Make focus order follow the on-screen order within a column.
- **#65** Edit mode: press A to start changing a field, A again to finish. Left/right changes the value only while editing, so a stray press can't flip a setting. When not editing, left/right moves between admin columns.

### Session 5 playtest notes (2026-11-21, queued for later)
- **#55** Airport: far too many random props scattered with no arrangement or order. Lay them out in rows/clusters (stands, cones by the runway, bags near terminals) and make many more of them knockable over.
- **#56** Later worlds after the dark forest: add more of each world's own interactable props (flags etc.) and make them knockable over.
- **#57** ~~Text like "<X> Defeated!" is drawn on top of the question/answer screens.~~ Done in dev: banners and popups use depth 5.5, below the question panel (6), in `HudScene`.
- **#58** Giant light beams sometimes show on screen (seen on Castle, a wide yellow-white glow across the road behind the car). Find out what draws them (turbo/boost flavor reward, a light/glow effect, or a bug) and decide whether to keep, shrink or remove.
- **#59** Police cars hit by a monster the player rides fly too far, too suddenly. Tone the knock-away down by one third.
- **#60** Police Station art is missing (the "park" question showed a "? police stati" placeholder tile). Add the image and check `images/scenes/manifest.csv` / `scenes.json`.
- **#61** Underwater world repeats the same art all over the screen at once (the same coral/shell cluster tiled). Spread it out and add more variety.
- **#62** New feature: while a player controls a boss, pressing B fires its laser eyes to blast stuff (comic effect, kid-friendly: things poof or get knocked back, nothing gets destroyed or hurt).

### Session 4 follow-ups
- **#13** Farm: tractors sometimes wander onto paved roads.
- **#14** Farm: animals ignore fence bodies (zone rect only), so a flung animal walks back through a fence. Animals and farm vehicles cast no long shadow yet (`ensureCastShadow` in `buildingTex.ts`). The ridden dino launches animals by proximity.
- **#15** Farm look: lane mud is a square tile with no lane edges, square inner road corners, overlapping shadows stack darker, flower placement repeats, east turbine shadows run off the map. Golden-grade strength is `FARM_LOOK.gradeAlpha`/`gradeColor`.
- **#16** Corn slowdown shares `car.slow()` with the police-bump slow (a bump in corn can be cut short); a `surfaceMult` on IPlayerCar would separate them.
- **#17** Dino ride: police heat still builds while riding; the freight train passes through the ridden dino. `DINO.maxHp`/`ramDamage*`/`turboMult`/`teamMult` are mostly unused now.
- **#19** Guide buddy: one cause fixed (arrived player driving off). Unverified: the orbit target is not clamped to the inset view (could sit under the scoreboard/seam near a view edge), and buddy visibility after vehicle hop / reset / dino events.
- **#20** Audio by ear: farm track (new `pluck` instrument), animal sounds, corn rustle, mud splash, louder player siren.
- Merge script lesson: only delete a package branch/worktree after `git merge` succeeded (a conflict leaves the merge in progress).

### Session 3 follow-ups
- **#21** Freight smash "+2" is a popup only. Add a `train:smashed { player, cars }` event so ScoreSystem awards real points. A smash also registers as a normal building crash (damage/shake); decide if it should.
- **#22** Proposed sounds (`SfxName`): `laser` (dino charge/fire; reuses turbo/shockwave/pop now) and `smash` (reuses crashBig/pop).
- **#23** Local texture keys not in `TEX`: `dino_laser_beam`, `dino_laser_glow`, `industrial_cargo_crate`. Promote to `assetKeys.ts` if wanted.
- **#24** Goal ring floor sprite sits under the Industrial darkness overlay (the glow/beacon compensate). Consider drawing it above `INDUSTRIAL_LIGHTING.nightDepth`.
- **#25** "Waiting…" pill still sits at `HUD.hint.y` 112, which was set below the old destination card; check it on screen. `hudMath.isOnScreen` is now only used by its test. `GUIDE.topInset` comment in GuideSystem still mentions destination cards.
- **#26** Easy+ blurb could read "Bigger sums, more words" instead of "A little bigger".
- **#27** Industrial and dino browser specs are sensitive to load. Run them with two Playwright workers for full-suite checks.
- **Never use `git stash` in agent worktrees:** the stash is shared by all worktrees, and two session-3 agents swapped each other's work that way (recovered).

### Session 2 follow-ups

Session 2 finished items 1–6 (Easy place words, reward delay, held-button arming, break panels vs scoreboard, goal banner → card pulse, guide buddy distance). See STATUS. Open follow-ups from that work:
- **#28** `CHALLENGE.rewardPanelClearSec` (1.05) mirrors HUD `panel.resultHoldSec + fadeSec` by hand; keep them in sync if the HUD fade changes.
- **#29** Guide buddy: `GUIDE.topInset`/`seamInset` keep it off the split-screen scoreboard. In single player it uses the full view and avoids the top-left scoreboard. Check the hand-off to the goal orbit (hover ~500 px vs `nearGoal` 450).
- Sub-agents writing files from PowerShell can produce Windows-1252 bytes (a "…" broke `vite build` in session 2). Tests and typecheck don't catch it; `npm run e2e` does (it builds).

## Playtest checklist (needs the user, real pads, projector)
- **#30** Xbox pads: steering, RT/LT, diamond answers with face or D-pad buttons, held-button behavior into a break or after a wrong answer, double-tap B to switch vehicles, Start = pause, hot-plug, rumble.
- **#31** Reward timing: turbo + jump should land ~0.7 s after the question panel fades (car glows in between).
- **#32** "Waiting…" pill readable and well placed now that the destination card is gone?
- **#33** Car feel: pivot turning, wall unstick, turbo and punch-through strength, boost-jump height and distance.
- **#34** Camera rotation smoothness (`CAMERA.rotTau`, `maxAngVel`), car screen height (`carScreenY`).
- **#35** Question breaks: interval (10 s) feel, wrong-answer retry delay (`CHALLENGE.wrongRetrySec` 0.5 s), dim strength.
- **#36** Guide buddies: easy to follow? Too fast or slow? Visible on the projector?
- **#37** Dino: guard speed (75 px/s), ram difficulty (hp 100), roar loudness.
- **#38** Audio by ear: boost, siren, roar, new music, overall balance.
- **#39** Readability of question cards from the back of the room.
- **#40** Session 4 by eye/ear: Farm golden hour and long shadows on a projector in both split views, corn slowdown/track/spring-back, animal launches (fun, not scary), tractors and combines, dino ride (3 hits, 20 s, speed, stomp shake), Industrial clutter and new bridges, guide buddy in 2P.
- **#41** Session 3 by eye/ear: Industrial darkness on a projector (`INDUSTRIAL_LIGHTING.nightAlpha`), player siren loudness (`POLICE.playerSirenVolume`), dino laser fairness for 5-year-olds (`DINO_LASER.chargeSec`/`fireSec`), freight smash threshold and re-form time, whether the building alleys look intentional (`WORLD.maxBuildingRun`), Easy+ feel.
- **#42** Latest changes: Beach & Harbor scenery density, ramp approaches, market shortcuts, beachgoer readability, bridge detail, and night visibility. Also check half-speed handling, one-press dino boarding, split-screen fence restoration, and bomb knockback.
- **#43** Check Underground neon and lava readability on a projector, the mine carts from both seats, and the new music by ear. Check the bomb stays upright while turning and try bumping a Farm wagon before and after a dino toss.

## Bigger roadmap (from PLAN.md Wave 5, not started)
- Industrial at Night and Beach & Harbor are playable in Setup. The projector, real-controller, and by-ear checks remain on the playtest checklist.
- **#44** Optional minimap.
- **#45** Button remapping UI for odd USB pads.
- **#46** More challenge types (subtraction and letter-by-letter spelling).
- **#47** High-score table.
- **#48** Optional desktop wrapper (Electron/Tauri).

## Future worlds (ideas, not started)
Each would follow the map kickoff template below (contracts → generator/art/audio → renderer/systems → wiring). Every world gets a boss; keep bosses kid-friendly (bounce, squash, poof; no gore).
- **#52 Spooky Ghost / Graveyard World** would have haunted graveyard lanes, drifting lanterns, and secret doors that open and close. A giant sheet ghost could guard the course. Aim for spooky atmosphere and playful scares for ages 5–9.
- **#53 Día de los Muertos World**
- **#54 Foam World**

Brickworks, Mushroom Island, Frozen Tundra, Volcano, Candyland, Castle, Airport, and In My House are playable. See [STATUS.md](STATUS.md#new-worlds) for their race features and preview URLs.

## Map kickoff plans (done)

The Industrial at Night and Farm kickoff plans were carried out (sessions 1–4); see STATUS "Industrial at Night" and "Farm". Use them as the template for a new map: orchestrator sets contracts (RaceMap, tiles, layout types, TEX block, SfxName/MusicTrack), phase 1 = generator (Opus) + art + audio in parallel, phase 2 = renderer (Opus) + gameplay systems + traffic, then wiring, Setup row and e2e.

## Small cleanups
- **#50** Police bump should use the actual colliding cruiser (add an npc reference to `vehicle:crash`).
- **#51** Traffic right-of-way at junctions (optional).
