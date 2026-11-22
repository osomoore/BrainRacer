import { GAMES, gameUrl, goToGame, lastGame, type GameId } from '../../shared/hub';
import { ensureProfiles } from '../../shared/profiles';
import { createMenuInput } from '../../shared/input/menuInput';
import { moveSelection, shouldForward } from './logic';

ensureProfiles();

const CAR_ART = `
<svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b8cff"/><stop offset="1" stop-color="#aee3ff"/></linearGradient></defs>
  <rect width="600" height="340" fill="url(#sky)"/>
  <circle cx="500" cy="70" r="40" fill="#ffe45c"/>
  <ellipse cx="150" cy="215" rx="260" ry="70" fill="#4cc36a"/>
  <ellipse cx="480" cy="225" rx="220" ry="60" fill="#38b05a"/>
  <rect y="220" width="600" height="120" fill="#3a3f4b"/>
  <rect y="220" width="600" height="8" fill="#ffd43b"/>
  <g fill="#fff"><rect x="20" y="300" width="80" height="8"/><rect x="180" y="300" width="80" height="8"/><rect x="340" y="300" width="80" height="8"/><rect x="500" y="300" width="80" height="8"/></g>
  <g stroke="#14213d" stroke-width="6" stroke-linejoin="round">
    <path d="M150 270 L150 240 Q150 222 170 218 L230 212 L270 180 Q280 172 295 172 L370 172 Q385 172 395 182 L420 212 L450 218 Q470 222 470 240 L470 270 Z" fill="#ff3b30"/>
    <path d="M250 212 L282 188 L330 188 L330 212 Z M345 188 L372 188 L398 212 L345 212 Z" fill="#cdeeff"/>
    <circle cx="205" cy="272" r="30" fill="#222"/><circle cx="205" cy="272" r="13" fill="#ddd"/>
    <circle cx="415" cy="272" r="30" fill="#222"/><circle cx="415" cy="272" r="13" fill="#ddd"/>
  </g>
  <circle cx="462" cy="240" r="9" fill="#ffd43b"/>
  <g font-family="Arial Black, Arial" font-weight="900" font-size="64" fill="#ffd43b" stroke="#14213d" stroke-width="8" paint-order="stroke"><text x="40" y="95">?</text><text x="100" y="140">+</text></g>
</svg>`;

const WORKSHOP_ART = `
<svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e6bff"/><stop offset="1" stop-color="#ffc7a6"/></linearGradient></defs>
  <rect width="600" height="340" fill="url(#sky2)"/>
  <circle cx="90" cy="70" r="36" fill="#fff3a0"/>
  <ellipse cx="300" cy="330" rx="420" ry="90" fill="#4cc36a"/>
  <g stroke="#14213d" stroke-width="6" stroke-linejoin="round">
    <path d="M330 250 V130 H350 V150 H375 V130 H400 V150 H425 V130 H450 V150 H475 V130 H495 V250 Z" fill="#b8c2d6"/>
    <path d="M395 250 V205 Q395 180 412 180 Q430 180 430 205 V250 Z" fill="#7a4b2a"/>
    <path d="M330 130 L412 70 L495 130 Z" fill="#ff6b6b"/>
    <rect x="130" y="215" width="190" height="95" rx="14" fill="#ff922b"/>
    <rect x="205" y="200" width="40" height="22" rx="8" fill="#ffd43b"/>
    <circle cx="225" cy="262" r="14" fill="#ffd43b"/>
  </g>
  <g transform="rotate(-35 160 160)" stroke="#14213d" stroke-width="6" stroke-linejoin="round">
    <rect x="145" y="95" width="30" height="110" rx="8" fill="#c9a06b"/>
    <path d="M105 95 H215 V70 H105 Z" fill="#9aa5b8"/>
  </g>
  <path d="M470 60 l8 20 20 8 -20 8 -8 20 -8 -20 -20 -8 20 -8z" fill="#fff" stroke="#14213d" stroke-width="4"/>
</svg>`;

const ART: Record<GameId, string> = { racer: CAR_ART, workshop: WORKSHOP_ART };

const CSS = `
*{box-sizing:border-box}
#stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:0 0;overflow:hidden;
  background:radial-gradient(ellipse at 50% 0%,#2a4a94 0%,#14213d 70%);font-family:Arial,"Segoe UI",sans-serif;color:#fff}
h1{margin:0;position:absolute;top:70px;width:100%;text-align:center;font:900 140px "Arial Black",Arial,sans-serif;color:#ffd43b;
  -webkit-text-stroke:14px #14213d;paint-order:stroke fill;text-shadow:0 10px 0 rgba(0,0,0,.45)}
.tile{position:absolute;top:330px;width:700px;height:560px;border-radius:40px;background:#1d2f5a;border:10px solid #5b6fa8;
  overflow:hidden;cursor:pointer;transform:scale(.94);opacity:.82;transition:transform .15s,opacity .15s}
.tile.sel{transform:scale(1.06);opacity:1;border-color:#ffd43b;box-shadow:0 0 0 12px rgba(255,212,59,.45),0 24px 0 rgba(0,0,0,.35)}
.tile svg{display:block;width:100%;height:400px}
.tile .name{position:absolute;bottom:0;left:0;right:0;height:140px;display:flex;align-items:center;justify-content:center;
  font:900 58px "Arial Black",Arial,sans-serif;background:#14213d}
.ribbon{position:absolute;top:24px;left:50%;transform:translateX(-50%);padding:6px 36px;border-radius:40px;white-space:nowrap;background:#ff6b6b;border:5px solid #14213d;font:900 44px "Arial Black",Arial,sans-serif;color:#fff}
.prompt{position:absolute;top:935px;width:700px;text-align:center;font:bold 64px Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:24px}
.badge{display:inline-flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:50%;background:#2ecc40;
  border:5px solid #fff;font:900 56px "Arial Black",Arial,sans-serif;color:#fff}
`;

function start(): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app')!;
  const stage = document.createElement('div');
  stage.id = 'stage';
  stage.innerHTML = '<h1>Pick a game!</h1>';
  app.appendChild(stage);

  let sel = 0;
  const xs = [150, 1070];
  const tiles = GAMES.map((g, i) => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.game = g.id;
    el.style.left = `${xs[i] ?? 150}px`;
    el.innerHTML = `${ART[g.id]}<div class="name">${g.title}</div>${g.ready ? '' : '<div class="ribbon">Coming soon</div>'}`;
    el.addEventListener('click', () => { sel = i; render(); goToGame(g.id); });
    stage.appendChild(el);
    return el;
  });
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = '<span class="badge">A</span><span>Play</span>';
  stage.appendChild(prompt);

  const last = lastGame() ?? 'racer';
  sel = Math.max(0, GAMES.findIndex((g) => g.id === last));
  function render(): void {
    tiles.forEach((t, i) => t.classList.toggle('sel', i === sel));
    prompt.style.left = `${xs[sel] ?? 150}px`;
  }
  render();

  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${-960 * s}px,${-540 * s}px) scale(${s})`;
  };
  fit();
  addEventListener('resize', fit);

  const input = createMenuInput();
  const loop = () => {
    for (const a of input.poll()) {
      if (a === 'confirm') { goToGame(GAMES[sel].id); return; }
      sel = moveSelection(sel, a, GAMES.length);
    }
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Dev/test URLs (?race=1, ?dev=Scene ...) belong to Brain Racer: forward before rendering anything.
if (shouldForward(location.search)) location.replace(gameUrl('racer', location.search));
else start();
