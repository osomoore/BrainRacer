# BrainRacer — instructions for Codex (and other non-Claude agents)

Read `CLAUDE.md` first: it holds the project conventions and rules, and they apply to you too. Then `docs/STATUS.md` (current behavior, tunables, how to test) and `docs/NEXT.md` (backlog, follow-ups, playtest checklist). This file only covers what differs when Codex is the driver.

## Codex as the driver (replaces the "orchestrator + sub-agents" split)
- You are the orchestrator for this session, so the "contracts are orchestrator-owned" rule (`src/core/types.ts`, `events.ts`, `race.ts`, `services.ts`, `assetKeys.ts`) now means: you may edit them, but only deliberately and with tests/typecheck passing, since every system depends on them.
- Start every task on a dedicated branch from the agreed base, usually `dev`. Commit and test on that task branch. Get explicit user approval before merging it into another branch. Push only with separate authorization.
- Commit in small steps with clear messages. The user's CLAUDE-side sessions append a `Co-Authored-By` trailer; for Codex commits use your own trailer or none.
- Before every commit: `npm run typecheck && npm test`. Before declaring a feature done: `npm run e2e` (it does a full production build, which also catches file-encoding problems that typecheck and tests miss).
- Files must be UTF-8. On Windows PowerShell, `Set-Content`/`Out-File` can write Windows-1252 and silently break `vite build` (this happened in session 2 with a "…" character). Prefer your editor's file writes, or pass `-Encoding utf8`.

## Environment quick facts
- Windows, Node 24. Use `npm test`, not `npx vitest` (the wrapper fixes a drive-letter-case bug).
- After cloning or after adding scene images: `npm run assets` (regenerates `src/data/scenes.json` and copies PNGs to `public/scenes/`).
- Questions are mandatory unless `VITE_ALLOW_QUESTIONS_OFF=1` (see STATUS.md). `npm run dev` and e2e set it automatically and dev defaults to questions off; for a manual build/preview set it yourself.
- Dev server: `npm run dev` → http://localhost:5173. Skip menus with `/?race=2&seed=3` (also `&round=60&debug=1&dino=now&heat=100&rewards=1`). Dev scenes: `?dev=<FileName>` for `src/scenes/dev/<FileName>.ts`.
- Visual checks: Playwright with Edge (`chromium.launch({ channel: 'msedge' })`) at 1920×1080. The bundled headless shell is software-rendered and very slow.
- Vite "Outdated Optimize Dep" after big changes: restart the dev server with `--force`.

## Parallel checkouts

- Run `git worktree list` and check the current checkout's branch and status before editing. Assign each parallel writer an exclusive checkout and branch, usually `.worktrees/<task>`. Tell agents their absolute checkout paths and owned files.
- Run builds and tests in the assigned checkout. Use a distinct Vite `--port` or `BRAINRACER_E2E_PORT` for each active checkout. Keep generated assets, caches, and test output in the checkout that owns them. Coordinate shared contracts with the driver.
- For worktree setup and cleanup, follow `docs/NEXT.md`. Use an independent `node_modules` installation for dependency or lockfile changes. Unlink any `node_modules` junction before removing its worktree so the target installation is preserved.

## State at handoff (2026-11-19)
- Branch `dev`, clean tree, HEAD at the "STATUS/NEXT: session 2 items done" commit. 272 unit tests + 7 e2e tests pass.
- Backlog items 1–6 from sessions 1–2 are done. What remains: the "Backlog" follow-ups, the playtest checklist (needs the user with real pads and a projector), the roadmap (new biomes, minimap, remapping UI, more question types, high scores, desktop wrapper), and small cleanups, all in `docs/NEXT.md`.
- Open question for the user: whether church/city/dam should stay flagged `simple` (Easy words) in `src/data/wordMeta.json`.
