# Adventure Workshop — handoff for the next session (2026-11-23)

Read this first, then `docs/WORKSHOP.md` (design, decisions, code map, engine rules). This page holds only what a fresh
session needs on top of that: where things are, what is waiting, and the rules the user set.

## Where things are
- **Integration branch:** `feature/workshop` (from `dev`), worktree `C:\Users\osomo\Projects\BrainRacer\.worktrees\workshop`.
  Tip `a4c40b9` at handoff. Not merged into `dev` and never pushed.
- **The app:** `apps/workshop/` (its own Phaser app, page `workshop.html`). Shared code only via `shared/`; it never imports from `src/`.
- **Green at handoff:** typecheck clean; 942 unit tests; workshop e2e 23/24. The one failure is the mobile "gear opens the
  grown-up gate" test, a known flake under load that passes when run alone.
- **Everything is merged in:** all `pkg/ws-*` packages, art voting (`pkg/ws-artvote`) and Codex jobs C1–C8
  (`docs/CODEX_JOBS.md`, all DONE).

## Servers and tools (start from `.worktrees\workshop`)
| What | Command | URL |
|---|---|---|
| Play | `npx vite --port 5190` (restart after edits: no hot reload inside `.worktrees`) | http://localhost:5190/workshop.html |
| Vote on painted candidates | `npm run art:pick` | http://localhost:5203/ |
| Grade parts (reviewer) | `npm run art:review` (captures sheets, then serves) | http://localhost:5198/tools/art-review/grade.html |
| ComfyUI (paint) | `C:\Users\osomo\ComfyUI\.venv\Scripts\python.exe main.py --listen 127.0.0.1 --port 8188` | http://127.0.0.1:8188 |

Keys in game: Space joins/confirms, WASD moves, Esc goes back, F9 opens admin. Dev scenes: `?dev=WorkshopParts`
(add `&art=shapes` for code shapes only), `RigAnims`, `RunPreview`, `DinoStages`, `WorkshopSounds`, `RigPreview`.

## Waiting on the user (do not decide these alone)
1. **Head vote.** 100 face-safe dino head candidates (25 jobs × 4) are in `art-candidates/` (gitignored) and wait for the
   vote at http://localhost:5203. Then: `npm run art:paint -- --apply-picks`, `npm run typecheck && npm test`, and commit
   `apps/workshop/art/paint/picks.json` plus `public/art/workshop/`.
2. **Paint pass.** How strong the paint should be (it is subtle now: `PAINT_TUNE` in `art/paint/jobs.ts`), and when to
   run the full `npm run art:paint` (about 1.5–2 h; ~400 jobs). Never start a full paint or new ComfyUI painting without the user.
3. **Texture resolution.** Whether to lower the bake `Q` (1.5 in `art/bake.ts`) for the TV box; see `docs/WORKSHOP_PERF.md`.
4. **Painted backdrops** (garage and lab) in game: the jobs exist, but they are not switched on yet.
5. **New art feedback.** If the user grades again in the reviewer, turn paint problems into `jobs.ts` edits and shape
   problems into new Codex jobs (C9+) in `docs/CODEX_JOBS.md`, with a fixed start and end, branch `codex/<job>` from `feature/workshop`.
6. **Merge `feature/workshop` into `dev`:** only on explicit approval.
7. **Hand testing** nobody has done yet: real controllers, phone, audio by ear, TV box (admin menu APK), projector legibility.

## Known small issues
- In wide Admin Mode the ADMIN MODE pill overlaps the results headline.
- Dimmed rows for stages not reached have low contrast on the results screen.
- The 2P room is the heaviest screen (see `docs/WORKSHOP_PERF.md`).
- Painted dino heads were removed from the manifest (the paint invented mouths); they come back through the vote above.

## Rules from the user (standing)
- Never merge into `dev` without approval. Never push. Never `git stash`. Never work in the main checkout
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
