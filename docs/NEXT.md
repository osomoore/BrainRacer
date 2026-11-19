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

## Backlog
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
- Countryside and industrial biomes (generator + art + place words: farm, barn, windmill, water tower, harbor …).
- Optional minimap; button remapping UI for odd USB pads; more challenge types (subtraction, letter-by-letter spelling); high-score table; optional desktop wrapper (Electron/Tauri).
- Decide whether/when to merge `dev` → `main` and push to a remote.

## Small cleanups
- Remove unused config keys `WORLD.bigAirSec`, `GOALS.arrowBandFrac`, `GOALS.arrowBandMaxH`; remove the HudTest "Nice jump!" popup.
- Police bump should use the actual colliding cruiser (add an npc reference to `vehicle:crash`).
- Traffic right-of-way at junctions (optional).
