// BrainRacer: a lane racer where each gate asks a math question.
// Drive through the lane showing the correct answer; wrong answers cost a life.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const LANES = 3, LANE_W = W / LANES;
const CAR = { w: 40, h: 70, y: H - 110 };

let state, keys = {};

function newGame() {
  return { mode: 'title', lane: 1, x: LANE_W * 1.5, lives: 3, score: 0,
           speed: 220, gate: null, roadOffset: 0, flash: 0 };
}

function makeGate(speed) {
  const a = 1 + Math.floor(Math.random() * 12), b = 1 + Math.floor(Math.random() * 12);
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const options = new Set([answer]);
  while (options.size < LANES) options.add(answer + Math.floor(Math.random() * 11) - 5);
  const arr = [...options].sort(() => Math.random() - 0.5);
  return { y: -80, question: `${a} ${op} ${b}`, options: arr, correct: arr.indexOf(answer), resolved: false };
}

addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'Space' && state.mode !== 'play') { state = newGame(); state.mode = 'play'; state.gate = makeGate(0); }
  if (state.mode !== 'play') return;
  if (e.code === 'ArrowLeft') state.lane = Math.max(0, state.lane - 1);
  if (e.code === 'ArrowRight') state.lane = Math.min(LANES - 1, state.lane + 1);
});
addEventListener('keyup', e => keys[e.code] = false);

function update(dt) {
  const s = state;
  if (s.mode !== 'play') return;
  s.x += (LANE_W * (s.lane + 0.5) - s.x) * Math.min(1, dt * 14);
  s.roadOffset = (s.roadOffset + s.speed * dt) % 40;
  s.flash = Math.max(0, s.flash - dt);
  const g = s.gate;
  g.y += s.speed * dt;
  if (!g.resolved && g.y > CAR.y - 20) {
    g.resolved = true;
    if (s.lane === g.correct) { s.score += 10; s.speed += 8; }
    else { s.lives--; s.flash = 0.3; if (s.lives <= 0) s.mode = 'over'; }
  }
  if (g.y > H + 20) s.gate = makeGate(s.speed);
}

function draw() {
  const s = state;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#666'; ctx.setLineDash([20, 20]); ctx.lineDashOffset = -s.roadOffset;
  for (let i = 1; i < LANES; i++) { ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke(); }
  ctx.setLineDash([]);
  if (s.gate) {
    const g = s.gate;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(g.question + ' = ?', W / 2, 40);
    g.options.forEach((o, i) => {
      ctx.fillStyle = '#2a6'; ctx.fillRect(i * LANE_W + 10, g.y, LANE_W - 20, 50);
      ctx.fillStyle = '#fff'; ctx.fillText(o, (i + 0.5) * LANE_W, g.y + 36);
    });
  }
  ctx.fillStyle = s.flash > 0 ? '#e33' : '#4af';
  ctx.fillRect(s.x - CAR.w / 2, CAR.y, CAR.w, CAR.h);
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`Score ${s.score}   Lives ${s.lives}`, 10, H - 10);
  if (s.mode !== 'play') {
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 44px system-ui';
    ctx.fillText(s.mode === 'over' ? 'Game Over' : 'BrainRacer', W / 2, H / 2 - 20);
    ctx.font = '20px system-ui';
    if (s.mode === 'over') ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 15);
    ctx.fillText('Press Space to start', W / 2, H / 2 + 50);
  }
}

state = newGame();
let last = performance.now();
(function loop(t) {
  update(Math.min(0.05, (t - last) / 1000)); last = t;
  draw();
  requestAnimationFrame(loop);
})(last);
