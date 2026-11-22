# Four-player support — plan (2026-11-21)

Integration branch: `feature/four-players`. Packages branch from it and are merged back by the orchestrator.

## Decisions (assumptions; change here if the user disagrees)
- **1 to 4 players** (`MAX_PLAYERS = 4`, `PlayerId = 0 | 1 | 2 | 3`). 1- and 2-player games must look and play exactly as today.
- **Layout:** 3–4 players use a fixed 2×2 quadrant split (`CameraMode 'quad'`): P1 top-left, P2 top-right, P3 bottom-left, P4 bottom-right, each 960×540, each rotated so its car points up (like split mode today). With 3 players the bottom-right quadrant is a **team panel** (big team score, timer, goals x/3, everyone's points), not a fourth camera.
- **Colors:** P1 green `#2ecc40`, P2 red `#ff3b30`, P3 blue `#1e90ff`, P4 amber `#ffb300` (`PLAYER_COLORS`).
- **Input:** P3 and P4 need gamepads. Keyboard stays two layouts (left = P1, right = P2 by default). Any device can join any slot.
- **Co-op rules generalize from "the other player" to "the team":**
  - Goals: completes when every player has arrived, or the teammate-wait timer runs out after the first arrival (same rule as today, N players).
  - Boss: spawns when a player waits at a goal (as now). A TEAM hit = a hit by a *different* player within `DINO.teamWindowSec` of the last hit. Lasers/target logic use nearest player. The crystal stays until every player has boarded or the window ends.
  - Police, pushes, rewards, guide buddies: per player, looping over `ctx.players`.
- **Text size:** gameplay text stays ≥ 40 px even in a quadrant. In quad mode, per-player HUD elements (question panel, ride countdown, waiting pill, buddy) are scaled/laid out to fit 960×540; the shared scoreboard moves to the screen centre (where the four quadrants meet) or the team panel.
- **Menus:** Title → **Join screen** (new): the screen is split into 4 panels; pressing A on any unassigned controller (or the keyboard confirm keys) claims the next free panel. Each player picks racer (unique per player), car and buddy in their own panel; B leaves the panel. Each player must confirm **Ready**; a Ready panel is locked (no changes) until that player un-readies with B. Only **Player 1** can press "Next", and only when every joined player is Ready → **Track select** (second screen: world and race length; Player 1 chooses and starts the race; B goes back). Then the race. 1–2 players use the same two screens.
- **Results:** per-player stats for up to 4 players; awards already handle any team size (`planAwards`).
- **Performance:** extra cost is expected to be small (4 views measured at ~13% on the TV box). No special 4-player degradations yet; we re-measure with the admin perf overlay after integration.

## Profiling (in the base branch)
`src/core/perfProbe.ts` + hooks in `RaceScene`: per-frame FPS / 1% low, and ms per frame for `cars`, `physics`, `render`, and each system (`sys:<name>`). Off unless `DeviceTuning.perfHud` is on (admin menu "Perf overlay"); when off every hook is one boolean check. Package B draws the overlay; package C adds the admin toggle.

## Packages (disjoint files)
- **A — gameplay (Sonnet):** `src/systems/**`, `src/entities/**`, `src/challenge/**`, `src/fx/**`, `src/audio/**`, `src/world/**` (only true player-count logic), `src/scenes/RaceScene.ts` (player spawn for 1–4, dev URL `?race=3`/`?race=4` with keyboard+gamepad or dummy input), `src/scenes/dev/FourViewPerf.ts` (switch it to real 4-player autopilot). Generalize every 2-player assumption (`[0,0]` tuples, `1 - id`, `players.length < 2`, `for p of [0,1]`).
- **B — camera + HUD (Sonnet):** `src/camera/**`, `src/scenes/HudScene.ts`, `src/ui/hud/**`, new `src/ui/hud/PerfOverlay.ts`. Quad layout, per-quadrant HUD, team panel for 3 players, audio pan helper if it lives in camera.
- **C — menus + input + results (Sonnet):** `src/scenes/SetupScene.ts` (→ Join screen), new `src/scenes/TrackSelectScene.ts`, `src/scenes/TitleScene.ts`, `src/scenes/BootScene.ts`, `src/scenes/ConfigScene.ts` (P3/P4 gas rows, "Perf overlay" toggle), `src/scenes/ResultsScene.ts`, `src/ui/results/**`, `src/ui/menu/**`, `src/input/**`, `src/core/racerProfiles.ts`, `src/core/progression.ts` (only if needed), `src/scenes/keys.ts`, `src/main.ts` (scene registration).

Contracts (`src/core/types.ts`, `events.ts`, `race.ts`, `services.ts`, `perfProbe.ts`) are orchestrator-owned: propose diffs in the report.
