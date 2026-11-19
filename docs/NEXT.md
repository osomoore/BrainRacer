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
  Agent prompt must say: work only inside `.worktrees\X` with absolute paths, a unique dev-server port, one commit on `pkg/X`, never delete the junction.
  **Removal (order matters!):** stop the agent's dev server, `cmd /c rmdir .worktrees\X\node_modules` (deletes the link only), THEN `git worktree remove --force .worktrees\X; git branch -D pkg/X`. Removing a worktree with the junction still present wipes the real `node_modules` (recover with `npm ci`).
- **Merge loop:** `git merge --no-ff pkg/X` → `npx tsc --noEmit` → `npm test` → `npm run e2e` → screenshot check via Playwright on Edge (`chromium.launch({ channel: 'msedge' })`) → update STATUS.
- Vite "Outdated Optimize Dep" after big merges → restart the dev server with `--force`.

## Queued playtest changes

- Remove on-screen destination text. Players follow their guide buddies.
- Investigate the reported 2–3 second delay before the buddy turns toward the next destination after a goal.
- Repeated rams make the player's vehicle smoke, catch fire, and eventually stop working. Double-tapping B within half a second lets the player jump straight into another vehicle of any kind, including police cars and trucks.

## Backlog

### Queued map and gameplay ideas

Begin these follow-ups only when the user kicks them off.

- Add more criss-crossing routes between areas.
- Let players smash moving freight trains apart.
- Give player cars headlights in dark areas. Industrial at Night is the first map with headlights.
- Give the dino laser-eye beams.
- Break up long buildings with usable gaps so that multiple blocks do not form a continuous barrier.
- Restrict controller answer selection to buttons. Moving the controller stick should never select an answer.
- Cap active police pursuit at two cars per player.
- Fix the square masking or transparency artifact around destination rings on Industrial at Night.
- Run trains on a continuous rail circuit so they stay in the world between crossings. Avoid long gates that block access to the crossing.

### Session 2 follow-ups

Session 2 finished items 1–6 (Easy place words, reward delay, held-button arming, break panels vs scoreboard, goal banner → card pulse, guide buddy distance). See STATUS. Open follow-ups from that work:
- Words flagged `simple` but borderline for age 5: church, city, dam (`src/data/wordMeta.json`). User to decide.
- `CHALLENGE.rewardPanelClearSec` (1.05) mirrors HUD `panel.resultHoldSec + fadeSec` by hand; keep them in sync if the HUD fade changes.
- Held pad X/Y/B into a break is covered only by `answerGuardSec` (face buttons arrive as one-frame edges). Holding W/RT also blocks pad A's slot until released (no pad/keyboard distinction).
- Guide buddy: `GUIDE.topInset`/`seamInset` keep it off the split-screen scoreboard. In single player it uses the full view and avoids the top-left scoreboard. Check the hand-off to the goal orbit (hover ~500 px vs `nearGoal` 450).
- Sub-agents writing files from PowerShell can produce Windows-1252 bytes (a "…" broke `vite build` in session 2). Tests and typecheck don't catch it; `npm run e2e` does (it builds).

## Playtest checklist (needs the user, real pads, projector)
- Xbox pads: steering, RT/LT, the diamond answers, held-button behavior (hold A / D-pad / stick into a break and after a wrong answer: nothing should answer), Start = pause, hot-plug, rumble.
- Reward timing: turbo + jump should land ~0.7 s after the question panel fades (car glows in between).
- Destination card pulse on a new goal: noticeable enough? (`HUD.goalPulse` in hudConfig.ts). "Waiting…" pill readable?
- Car feel: pivot turning, wall unstick, turbo and punch-through strength, boost-jump height and distance.
- Camera rotation smoothness (`CAMERA.rotTau`, `maxAngVel`), car screen height (`carScreenY`).
- Question breaks: interval (10 s) feel, wrong-answer retry delay (`CHALLENGE.wrongRetrySec` 0.5 s), dim strength.
- Guide buddies: easy to follow? Too fast or slow? Visible on the projector?
- Dino: guard speed (75 px/s), ram difficulty (hp 100), roar loudness.
- Audio by ear: boost, siren, roar, new music, overall balance.
- Readability of question cards and destination cards from the back of the room.

## Bigger roadmap (from PLAN.md Wave 5, not started)
- **Industrial at Night is playable in Setup.** The kickoff plan below records its scope. The projector, real-controller, and by-ear checks remain on the playtest checklist. Harbor is deferred until a layout can connect the docks without lots of dead ends.
- Optional minimap; button remapping UI for odd USB pads; more challenge types (subtraction, letter-by-letter spelling); high-score table; optional desktop wrapper (Electron/Tauri).
- Decide whether/when to merge `dev` → `main` and push to a remote.

## Industrial at Night kickoff plan

### First playable map

- Select City or Industrial in Setup. Industrial is a separate seeded map with a freight-yard loop and a factory loop, joined by two lit bridges over a service canal. Main roads rejoin a loop and any short spur ends in a broad turnaround. Bridge decks use ordinary road tiles so traffic and jump landings work on them.
- Drive through open factory bays with an entrance and exit, under gantry cranes, and along loading yards with truck traffic. Use a water tower and bridge approaches as landmarks. Give one yard a straight ramp approach and a clear landing.
- Run a freight train on its own track. Add one clearly marked grade crossing with warning lights before the train arrives, plus a bridge route that stays open. Keep goal rings clear of the tracks and give drivers room to stop or turn around.
- Keep every goal connected to the driving loops. Put goal rings at exits and open approaches where the buddy's direct bearing is easy to follow. Playtest both directions through factory bays and across the canal to catch goals that pull drivers toward walls or water.
- Use deep-blue shadows, cool pavement, and warm factory and crossing lights. Both player cars have soft headlights that rotate with them in world space. Keep bridge rails, the train, guides, and goal rings readable outside the beams. Check both rotating split views with the HUD at full contrast.
- Write an original looping industrial night-drive track with a steady bass line, a bright synth melody, and light metallic percussion. Leave room in the mix for the train warning and engine sounds. The track starts at GO, gives way to the dino cue, and resumes when the dino leaves or is defeated.

### Work packets for kickoff

The coordinator defines map selection, decoration placements, the rail route and crossing data, texture keys, and the music track ID before dispatch. Shared contracts, Setup and RaceScene wiring, and final integration stay with the coordinator. Lower-tier workers return their changed files, checks, and screenshots or audio notes.

| Packet | Owns | Handoff |
|---|---|---|
| Map generation | Industrial generator and tests under `src/world/gen/` | Connected road loops, two bridges, through-bays, turnarounds, reachable goals, and the rail route. Check determinism across seeds and that the road network stays connected while the grade crossing is blocked. |
| Industrial art | Industrial texture generators under `src/art/` | Factory bays, cranes, bridge rails, tracks, crossing lights, and a freight train. Provide a preview at driving zoom. |
| Music | Industrial track JSON, audio registration, and validation under `src/audio/` | A validated loop using the existing volume controls, with a listening note on the loop seam and SFX balance. |
| World rendering | Industrial decoration building under `src/world/` | Place industrial art and rail markings and keep bridge decks and factory bays passable. Clean up on race restart. |
| Freight train | Train and crossing behavior in a dedicated system | Make the warning readable before the train arrives, keep the train on its rail route, and verify that a blocked crossing leaves the bridge route usable. |
| Headlights and night look | Industrial-only lighting system and its beam assets | Use cached beam textures attached to car transforms. Verify the beams track turns and jumps in both camera views. |
| Playtest coverage | Industrial browser scenarios under `tests/e2e/` | Exercise selection, seeded quick launch, factory pass-throughs, the crossing and bridge bypass, split-screen lighting, and restarting into City. Capture solo and split views. |

Start map generation, art, and music in parallel after the contracts are set. Next dispatch world rendering, freight train, and headlights. Then have the coverage worker test the integrated map. The queued destination text, guide timing, and vehicle damage work can be scheduled independently.

### Integration and playtest

- Add a seeded quick launch such as `/?race=2&map=industrial&seed=3&questions=off`. Verify City is still the default for existing settings.
- Run typecheck, unit tests, and the production Edge suite. Drive both bridge routes and factory bays in solo and split screen. Check that the train warning gives enough time to turn or stop, the bypass stays open, and the guide brings players to every type of goal.
- Check nighttime contrast on a projector and listen through one complete music loop, a dino interruption, and the return to Industrial music.

## Small cleanups
- Remove unused config keys `WORLD.bigAirSec`, `GOALS.arrowBandFrac`, `GOALS.arrowBandMaxH`; remove the HudTest "Nice jump!" popup.
- Police bump should use the actual colliding cruiser (add an npc reference to `vehicle:crash`).
- Traffic right-of-way at junctions (optional).
