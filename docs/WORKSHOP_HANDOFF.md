# Adventure Workshop — handoff for the next session (2026-11-23, updated)

Read this first, then `docs/WORKSHOP.md` (design, decisions, code map, engine rules). This page holds only what a fresh
session needs on top of that: where things are, what is waiting, and the rules the user set.

## Where things are (updated 2026-11-23, second session)
- **Integration branch:** `feature/workshop`, worktree `C:\Users\osomo\Projects\BrainRacer\.worktrees\workshop`.
- **BETA IS LIVE:** `feature/workshop` tip `6b4c815` was pushed to `origin/dev` (GitHub Pages) with user approval: launcher
  tile has a BETA ribbon, workshop title shows "Under construction — progress may be lost." The main checkout's local `dev`
  is behind `origin/dev` until someone runs `git pull --ff-only` there (Codex/user; we never touch the main checkout).
  Further pushes to `dev` still need explicit user approval each time.
- **The app:** `apps/workshop/` (page `workshop.html`). Shared code only via `shared/`; it never imports from `src/`.
- **Green at `6b4c815`:** typecheck clean; 950 unit tests; full `npm run e2e` 137/137.
- **Merged this session:** 18 voted head paints; shop fixes (ride height `WS_ART.raceRideRaise`, bumper framing, gears
  overhead view, no wheel fade); reviewer gears/springs sheets; reviewer "Only changed since I graded" mode (per-variant
  pixel fingerprints, `--no-open`, `--port`, `--shapes`); Codex C9–C12 (dino heads/mouths/teeth, body/claws/tails,
  seeded patterns, car shapes/layering); beta marking.
- **Codex:** C13–C15 merged. In flight: C16 (title screen, port 5221), C17 (painted scenery wiring, 5222), both
  branched at `0c21008`. Ready to start: C18 (dino shapes from review round 2, 5223), C19 (jeep spare/winch, 5224).
  Review and merge each when its branch marks it DONE; then run typecheck, `npm test`, workshop e2e.
- **User preference:** Claude quota is scarce, Codex resets. Write work as Codex jobs first; Claude sub-agents only when
  the user asks or something blocks.

## Servers and tools (start from `.worktrees\workshop`)
| What | Command | URL |
|---|---|---|
| Play | `npx vite --port 5191` (restart after edits: no hot reload inside `.worktrees`) | http://localhost:5191/workshop.html |
| Vote on painted candidates | `npm run art:pick` | http://localhost:5203/ |
| Grade parts (reviewer) | `npm run art:review -- --port 5199 --shapes --no-open` | http://localhost:5199/tools/art-review/grade.html |
| ComfyUI (paint) | `C:\Users\osomo\ComfyUI\.venv\Scripts\python.exe main.py --listen 127.0.0.1 --port 8188` | http://127.0.0.1:8188 |

Always run the reviewer on **5199**: grades live in localStorage per origin, so another port starts empty. The old 5190/5198
servers (from the first session) still run old code; the user owns them, don't kill them. Codex jobs use 5221–5223.

Keys in game: Space joins/confirms, WASD moves, Esc goes back, F9 opens admin. Dev scenes: `?dev=WorkshopParts`
(add `&art=shapes` for code shapes only), `RigAnims`, `RunPreview`, `DinoStages`, `WorkshopSounds`, `RigPreview`.

## Waiting on the user (do not decide these alone)
1. **Review round 2 is done** (`feedback/workshop-art-feedback_2.json`): all issues went into C18/C19. After they
   merge, the user grades again with "Only changed since I graded" on 5199.
2. **Head paint batch (approved 2026-11-23):** 4 candidates each for round/spotted/feathers, round/orange/glow,
   thead rex, thead horned are in `art-candidates/`; the user votes on 5203 (`npm run art:pick`), then
   `npm run art:paint -- --apply-picks` and commit picks + `public/art/workshop/`. Camo and stripes heads (voted "more")
   wait for the C18 pattern fixes before repainting. Jeep paints are stale after C12 and C19.
3. **Paint strength:** review says "bodies need scale/texture, not flat" → raise `PAINT_TUNE` and test on a small batch.
   Never start a full paint or new ComfyUI painting without the user.
4. **Texture resolution** for the TV box (bake `Q`), **painted backdrops** switch-on, **racing-stripe paints** idea (to
   `WORKSHOP_FUTURE_VARIANTS.md`; each stripe = its own skin).
5. **Hand testing:** controllers, phone, audio, TV box, projector — now also of the live beta.

## Known small issues
- Title screen: "(optional)" overlaps the Player 2 join text.
- Beta notice text is small on phones (the stage letterboxes).
- Springs station close-up crops the car on Lift Kit (C13 fixes it). Admin pill overlap and dim results rows: C13.
- The 2P room is the heaviest screen (see `docs/WORKSHOP_PERF.md`).

## Rules from the user (standing)
- Never merge into `dev` without approval. Never push without approval (the beta push on 2026-11-23 was approved once). Never `git stash`. Never work in the main checkout
  (`C:\Users\osomo\Projects\BrainRacer`, where Codex and others work).
- Each task on its own branch and worktree off `feature/workshop` (`.worktrees/ws-<name>`, branch `pkg/ws-<name>`),
  with a `node_modules` junction. To remove one: `cmd /c rmdir <wt>\node_modules` FIRST, then
  `git worktree remove --force <wt>`, then `git branch -D <branch>`.
- Leave Codex worktrees/branches (`codex-*`, `art/workshop-polish` in `ws-artpolish`) alone unless the user says to clean them up.
- The orchestrator (Opus) plans and merges; Sonnet/Haiku sub-agents do the implementation.
- ComfyUI memory: only the `realcartoonXL_v6` checkpoint, `POST /free` before a run, small batches. It once crashed from running out of RAM.
- Art: one pipeline for all art (code shapes + ComfyUI paint, `docs/WORKSHOP_ART_PIPELINE.md`). Each skin/paint has ONE
  accent color (a different accent means a new skin). New part ideas go to `docs/WORKSHOP_FUTURE_VARIANTS.md`.
  Shape-drawing work is a Codex job; use placeholders when you need art yourself.
- Kids 5–9: cartoon dinos may eat other animals, with no blood or dismemberment. A T-Rex must stay buildable.
- Game design decisions (side view primary, the model view is read-only, a new challenge never passes with the last
  winning build, device-wide Admin Mode, ...) are in `docs/WORKSHOP.md` → Decisions.
- At about 95% of the usage window: checkpoint, pause agents, resume after the reset.
