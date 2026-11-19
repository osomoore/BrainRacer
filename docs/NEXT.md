# BrainRacer — Next Conversation Plan

Start here in a new conversation. Read `CLAUDE.md`, `docs/STATUS.md` (current state) and this file.

## How we work (proven in session 1)
- **Main session = orchestrator (Opus):** owns contracts (`src/core/*`), `RaceScene`, merging, review, small glue fixes, docs.
- **Implementation = Sonnet sub-agents** (Haiku for mechanical chores), run in parallel with **disjoint file ownership**. The user prefers this to save usage.
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

## Backlog: user requests queued at the end of session 1 (not started)
1. **Easy mode words too hard (e.g. "hospital", "stadium").** Cause: place-triggered challenges deliberately ignore the difficulty word filter for the target word (`ChallengeGenerator` place path), so place words appear on Easy. Fix ideas: on Easy, skip place triggers or only use place words flagged `simple`; review `simple` flags for place words in `src/data/wordMeta.json`.
2. **Delay the post-answer reward after a question break.** Turbo + boost jump currently start before the question UI has fully cleared. After the break ends, wait ~0.5–1.0 s (after the panel fade-out completes) before granting turbo/jump so players can see it take effect. Where: `RewardSystem` (queued rewards granted on resume) + `CHALLENGE` config (e.g. `rewardDelayAfterBreakSec: 0.7`); maybe a short "ready…" glow on the car before launch.
3. **Holding a button into a question break must not count as an answer.** Any answer input (face buttons, D-pad/stick, keys) already held when a question appears must be released and pressed again. Only held directions are handled today; A (also the gas pedal, so usually held) can slip through. Implement a per-player "armed" state in `ChallengeSystem`: at break start and on each new question after a wrong answer, mark every currently-down answer input as "must release". Add unit + e2e coverage (hold A/W through break start).
4. **(Orchestrator-observed) Split-screen break panels overlap the bottom of the center scoreboard/timer.** Shrink or shift the break panel, or hide the timer during breaks.

## Playtest checklist (needs the user, real pads, projector)
- Xbox pads: steering, RT/LT, the diamond answers, held-button behavior, Start = pause, hot-plug, rumble.
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
