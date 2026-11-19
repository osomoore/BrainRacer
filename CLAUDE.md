# BrainRacer — agent conventions

Top-down 2-player co-op racer for kids 5–9 with picture/word/math question breaks.
**Start here:** `docs/STATUS.md` (current behavior, how to test, tunables) → `docs/NEXT.md` (backlog + how the orchestrator/sub-agent/Codex workflow runs). `docs/PLAN.md` is the original design (STATUS supersedes it where they differ).

Codex or another agent driving instead of Claude? Read `AGENTS.md` too (driver-specific differences).

## Stack
TypeScript (strict) · Vite · Phaser 3.90 (Matter physics) · Tone.js · Vitest · Playwright. Node 24, Windows.

## Commands
- `npm run dev` — dev server (http://localhost:5173). Dev scenes: `?dev=<FileName>` for any `src/scenes/dev/<FileName>.ts`.
- `npm run typecheck` · `npm test` (unit) · `npm run e2e` (Playwright, builds first) · `npm run assets` (regenerate `src/data/scenes.json` + copy PNGs to `public/scenes/`; run once after cloning).
- Use `npm test`, not `npx vitest` directly: the wrapper fixes a Windows drive-letter-case bug.
- Quick race without menus: `?race=1` / `?race=2` (+ `&seed=N&round=60&dino=now&heat=100&rewards=1&debug=1`). `window.__race` = RaceContext, `window.__challenge` = challenge hook.
- Playwright: use Edge (`channel: 'msedge'`) for the real GPU; the bundled headless shell is software-rendered and very slow.
- Systems auto-register: any class exported from `src/systems/*System.ts` implementing `GameSystem` (no-arg constructor, optional `static order`).

## Rules
1. **Contracts are orchestrator-owned. Do not edit** `src/core/types.ts`, `src/core/events.ts`, `src/core/race.ts`, `src/core/services.ts`, `src/core/assetKeys.ts`. If you need a change, stop and put the proposed diff in your final report. `src/config/gameConfig.ts`: you may ADD keys in your package's section only.
2. **Only edit the paths your package owns** (listed in your task). New dev/test scenes go in `src/scenes/dev/<YourName>.ts` (default export = Scene class, scene key = file name).
3. **Systems communicate only via `bus`** (`src/core/events.ts`) and the shared `RaceContext` (`src/core/race.ts`). Never import another system's module.
4. **No `Math.random` in gameplay/generation**: use `Rng` from `src/core/rng.ts` (seeded). UI-only cosmetic jitter may use Math.random.
5. **Tunables go in `gameConfig.ts`**, not magic numbers.
6. **Pure logic stays Phaser-free** (`src/challenge/`, `src/world/gen/`, rules in systems) and gets Vitest tests next to the source (`*.test.ts`).
7. Textures come from `TEX` keys (`src/core/assetKeys.ts`). Everything faces +x at angle 0; +y is down.
8. Input only via `services.input`, audio only via `services.audio` (`src/core/services.ts`).
9. Body ownership: every Matter body sets `body.plugin.owner` (`BodyOwner` in `src/core/race.ts`).
10. Screen is 1920×1080 logical, shown on monitors and projectors: UI text ≥ 40 px for gameplay info, high contrast.
11. Audience is kids aged 5–9. No violence or scary gore; crashes bounce, nothing gets destroyed except comic "squash" / "poof".
12. Before finishing: `npm run typecheck && npm test` must pass. If you are in a git worktree, make ONE commit of your work on your worktree branch (`git add -A && git commit`); never commit on `main`/`dev` directly, never push, never switch branches.
13. Image labels come ONLY from `images/scenes/manifest.csv` (via `src/data/scenes.json`, mapped through `src/data/wordAliases.json`). Ignore `images/scenes/*.txt`.
14. No word popups on screen (POW!, BUMP! …): only score numbers ("+1"), the dino ROAR, banners/indicators. HUD filters `ui:popup` to `/^[+-]\d/` or ROAR.
15. Performance: never draw rounded rects/paths in a live `Graphics` (re-triangulated every frame per camera). Bake to textures. World objects render in 2 rotated cameras; per-player-only objects use `ctx.camera.showOnlyTo(obj, player)`.

## Final report format (sub-agents)
Files changed · tests added · how to see it (`?dev=...`) · known gaps · proposed contract changes (if any) · what a human should check by hand.

## Worktree setup (sub-agents)
0. Worktrees are created manually by the orchestrator under `.worktrees/<pkg>` (see `docs/NEXT.md`). Work only inside yours, with absolute paths. **Never delete or replace the `node_modules` junction**: it links to the real one, and removing a worktree with it in place wipes the main `node_modules`.
1. If `node_modules` is missing in your worktree, link the main one (PowerShell): `cmd /c mklink /J node_modules C:\Users\osomo\Projects\BrainRacer\node_modules`. Do not `npm install` new packages without listing it as a proposed change.
2. `npm run assets` (copies scene PNGs to `public/scenes/`).
3. Visual check: start `npm run dev` in the background (or `npx vite --port <free port>`), then
   `npx playwright screenshot --viewport-size=1920,1080 --wait-for-timeout=4000 "http://localhost:5173/?dev=<Scene>" shot.png` and view the PNG. Iterate until it looks good. Don't commit screenshots.
