# BrainRacer

Top-down co-op racer for 1–2 kids (ages 5–9) with Xbox-style USB controllers or keyboard. Race through a procedurally generated city to shared destinations, follow your guide buddy, and answer picture, word or math questions in quick question breaks. Right answers launch you into a turbo jump. Watch out for police, traffic and a giant dinosaur that guards the goal.

## Play
- Double-click `play.bat` (builds, starts a local server, opens Edge full screen), or
- `npm install && npm run dev` → http://localhost:5173
- Once **Settings → Pages → Source** is set to **GitHub Actions**, pushes to `dev` deploy the game at https://osomoore.github.io/BrainRacer/.
- Press **A** (or Space/Enter) three times to start: join → setup → race.

## Controls
| | Gamepad | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Steer | Left stick / D-pad | A / D | ← / → |
| Go | RT or A | W | ↑ |
| Brake / reverse | LT | S | ↓ |
| Answer (question break diamond) | Y top · X left · B right · A bottom, or D-pad/stick | W/A/D/S or 2/1/3/4 | ↑/←/→/↓ or . , / M |
| Pause | Start | Esc | Esc |

In the optional "While Driving" question style, answers are X / Y / B (keys 1/2/3 and , . /).

## Docs
- `docs/STATUS.md`: current behavior, test URLs, tunables, known gaps
- `docs/NEXT.md`: backlog and dev workflow for the next session
- `docs/PLAN.md`: original design
