import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { OUTLINE, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, rr, seeded, star } from './draw';

export function drawTree(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tree, 80, 80);
  // soft ground shadow
  ellipse(ctx, 44, 46, 34, 31); ctx.fillStyle = 'rgba(0,30,0,0.28)'; ctx.fill();
  // layered canopy: back lobes dark -> front lobes light
  const lobes: [number, number, number, string, string][] = [
    [40, 40, 34, '#1f8a3a', '#14602a'],
    [26, 30, 19, '#2fa84a', '#1f7e38'], [54, 31, 19, '#2fa84a', '#1f7e38'], [28, 54, 19, '#2fa84a', '#1f7e38'], [54, 54, 18, '#2fa84a', '#1f7e38'],
    [36, 34, 20, '#4cc85c', '#2fa84a'], [48, 44, 17, '#5fd86a', '#33b04d'],
  ];
  for (const [x, y, r, a, b] of lobes) {
    ellipse(ctx, x, y, r, r);
    fillStroke(ctx, lin(ctx, x - r, y - r, x + r, y + r, [[0, a], [1, b]]), x === 40 ? OUTLINE : '#14602a', x === 40 ? 3 : 2);
  }
  glossHighlight(ctx, 30, 26, 11, 6, 0.3);
  const r = seeded(5);
  ctx.fillStyle = 'rgba(190,255,170,0.7)';
  for (let i = 0; i < 9; i++) { ellipse(ctx, 22 + r() * 34, 22 + r() * 34, 1.7, 1.7); ctx.fill(); }
  ctx.fillStyle = '#ff5a4a';
  for (const [x, y] of [[50, 26], [24, 48], [58, 52]]) { ellipse(ctx, x, y, 2.4, 2.4); fillStroke(ctx, '#ff5a4a', '#8a1f18', 1); }
  done();
}

export function drawBush(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.bush, 40, 40);
  const lobes: [number, number, number][] = [[20, 20, 17], [12, 14, 10], [28, 14, 10], [12, 27, 10], [28, 27, 10]];
  for (const [x, y, r] of lobes) { ellipse(ctx, x, y, r, r); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.stroke(); }
  for (const [x, y, r] of lobes) { ellipse(ctx, x, y, r, r); ctx.fillStyle = lin(ctx, x - r, y - r, x + r, y + r, [[0, '#5fd86a'], [1, '#228f3c']]); ctx.fill(); }
  ctx.fillStyle = '#ff6fa8';
  for (const [x, y] of [[14, 15], [26, 22], [19, 28], [24, 11]]) { ellipse(ctx, x, y, 2.2, 2.2); fillStroke(ctx, '#ff6fa8', '#8a2a50', 1); }
  glossHighlight(ctx, 15, 11, 6, 3, 0.4);
  done();
}

export function drawLamp(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.lamp, 20, 20);
  ctx.fillStyle = radial(ctx, 10, 10, 1, 10, [[0, 'rgba(255,245,170,0.95)'], [0.45, 'rgba(255,230,120,0.5)'], [1, 'rgba(255,220,100,0)']]);
  ctx.fillRect(0, 0, 20, 20);
  ellipse(ctx, 10, 10, 4.3, 4.3); fillStroke(ctx, '#3a3f55', OUTLINE, 1.5);
  ellipse(ctx, 10, 10, 2.2, 2.2); ctx.fillStyle = '#fff8c0'; ctx.fill();
  done();
}

export function drawHydrant(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.hydrant, 16, 16);
  rr(ctx, 1.5, 6, 13, 4, 2); fillStroke(ctx, '#d62b22', OUTLINE, 1.5);
  ellipse(ctx, 8, 8, 4.8, 4.8); fillStroke(ctx, lin(ctx, 4, 4, 12, 12, [[0, '#ff6a5c'], [1, '#c4160e']]), OUTLINE, 1.6);
  ellipse(ctx, 8, 8, 2, 2); ctx.fillStyle = '#ffd23a'; ctx.fill();
  done();
}

export function drawBench(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.bench, 48, 20);
  for (const x of [5, 38]) { rr(ctx, x, 1.5, 5, 17, 2); fillStroke(ctx, '#4a4f60', OUTLINE, 1.5); }
  for (let i = 0; i < 4; i++) {
    rr(ctx, 2, 2.5 + i * 4.2, 44, 3.6, 1.5);
    fillStroke(ctx, i % 2 ? '#c98a4a' : '#e0a060', OUTLINE, 1.2);
  }
  done();
}

export function drawCone(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.cone, 18, 18);
  rr(ctx, 1.5, 1.5, 15, 15, 3); fillStroke(ctx, '#ff8a1f', OUTLINE, 1.6);
  ellipse(ctx, 9, 9, 6, 6); fillStroke(ctx, '#ff7a10', OUTLINE, 1.4);
  ellipse(ctx, 9, 9, 3.6, 3.6); fillStroke(ctx, '#ffffff', OUTLINE, 1.2);
  ellipse(ctx, 9, 9, 1.5, 1.5); ctx.fillStyle = '#ff7a10'; ctx.fill();
  done();
}

export function drawSignFrame(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.signFrame, 150, 150);
  // posts peeking out at the bottom corners
  for (const x of [26, 114]) { rr(ctx, x - 6, 124, 12, 24, 3); fillStroke(ctx, lin(ctx, x - 6, 0, x + 6, 0, [[0, '#a8754a'], [1, '#6e4a2a']]), OUTLINE, 3); }
  rr(ctx, 7, 7, 138, 134, 16); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  rr(ctx, 3, 3, 138, 134, 16);
  fillStroke(ctx, '#ffffff', OUTLINE, 3);
  rr(ctx, 8, 8, 128, 124, 11);
  ctx.strokeStyle = '#1e6fff'; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; rr(ctx, 11.5, 11.5, 121, 117, 9); ctx.stroke();
  for (const [x, y] of [[14, 14], [130, 14], [14, 126], [130, 126]]) { ellipse(ctx, x, y, 2.6, 2.6); fillStroke(ctx, '#c9d3e6', '#4a5470', 1.2); }
  done();
}

export function drawRamp(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.ramp, 128, 96);
  rr(ctx, 6, 8, 120, 84, 10); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  rr(ctx, 3, 3, 120, 86, 10);
  ctx.save();
  fillStroke(ctx, '#ffd21f', OUTLINE, 3);
  ctx.clip();
  // chevrons pointing +x
  ctx.fillStyle = '#23283a';
  for (let x = -10; x < 130; x += 32) {
    poly(ctx, [x, 3, x + 14, 3, x + 40, 46, x + 14, 89, x, 89, x + 26, 46]);
    ctx.fill();
  }
  // height gradient: lighter high end at +x, darker low end
  ctx.fillStyle = lin(ctx, 3, 0, 123, 0, [[0, 'rgba(60,40,0,0.4)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(255,255,255,0.5)']]);
  ctx.fillRect(0, 0, 128, 96);
  ctx.restore();
  rr(ctx, 3, 3, 120, 86, 10); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
  // lip at the high end
  rr(ctx, 114, 6, 9, 80, 4); fillStroke(ctx, '#fff6c0', OUTLINE, 2.5);
  // side rails
  for (const y of [3, 83]) { rr(ctx, 6, y, 108, 6, 3); fillStroke(ctx, '#e8ecf4', OUTLINE, 2); }
  done();
}

// ------------------------------------------------------------ goal
export function drawGoal(scene: Phaser.Scene): void {
  {
    const { ctx, done } = makeCanvas(scene, TEX.goalRing, 360, 360);
    const c = 180;
    // outer glow
    ctx.fillStyle = radial(ctx, c, c, 120, 180, [[0, 'rgba(255,210,60,0)'], [0.55, 'rgba(255,210,60,0.35)'], [1, 'rgba(255,210,60,0)']]);
    ctx.fillRect(0, 0, 360, 360);
    // inner faint wash
    ctx.fillStyle = radial(ctx, c, c, 0, 150, [[0, 'rgba(255,240,150,0.18)'], [1, 'rgba(255,230,110,0)']]);
    ctx.fillRect(0, 0, 360, 360);
    // main band
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(160,90,0,0.8)'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(c, c, 138, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = lin(ctx, 40, 40, 320, 320, [[0, '#fff2a0'], [0.5, '#ffc61a'], [1, '#ff9a1f']]); ctx.lineWidth = 20;
    ctx.beginPath(); ctx.arc(c, c, 138, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, 142, Math.PI * 0.95, Math.PI * 1.55); ctx.stroke();
    // dashes around
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      ctx.save(); ctx.translate(c + Math.cos(a) * 160, c + Math.sin(a) * 160); ctx.rotate(a + Math.PI / 2);
      rr(ctx, -4, -9, 8, 18, 3); fillStroke(ctx, i % 2 ? '#fff6b0' : '#ffd23a', 'rgba(150,80,0,0.9)', 2);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.setLineDash([3, 10]);
    ctx.beginPath(); ctx.arc(c, c, 118, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // sparkles
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, rad = i % 2 ? 138 : 160;
      const x = c + Math.cos(a) * rad, y = c + Math.sin(a) * rad, s = i % 2 ? 11 : 14;
      star(ctx, x, y, s, s * 0.22, 4, 0); fillStroke(ctx, '#ffffff', 'rgba(255,190,40,0.9)', 1.5);
    }
    done();
  }
  {
    const { ctx, done } = makeCanvas(scene, TEX.beacon, 64, 64);
    ctx.fillStyle = radial(ctx, 32, 32, 0, 32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,150,0.85)'], [0.6, 'rgba(255,200,50,0.3)'], [1, 'rgba(255,190,40,0)']]);
    ctx.fillRect(0, 0, 64, 64);
    done();
  }
  {
    const { ctx, done } = makeCanvas(scene, TEX.arrow, 64, 64);
    poly(ctx, [5, 22, 34, 22, 34, 6, 60, 32, 34, 58, 34, 42, 5, 42]);
    fillStroke(ctx, lin(ctx, 0, 6, 0, 58, [[0, '#ffffff'], [1, '#d8def0']]), OUTLINE, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(9, 25, 22, 3);
    done();
  }
}
