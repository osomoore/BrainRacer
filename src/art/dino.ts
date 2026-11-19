import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { OUTLINE, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, type Ctx } from './draw';

const SKIN_L = '#8ff08a', SKIN_D = '#1fa385', BELLY = '#e6fbb0', SPIKE = '#ff9a1f', SPIKE_L = '#ffd23a';

/** Outline the union of several paths, then fill them (no inner seams). */
function union(ctx: Ctx, paths: ((c: Ctx) => void)[], fill: string | CanvasGradient, lw = 6): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw;
  for (const p of paths) { p(ctx); ctx.stroke(); }
  ctx.fillStyle = fill;
  for (const p of paths) { p(ctx); ctx.fill(); }
}

function dinoPlate(ctx: Ctx, x: number, y: number, s: number, light: boolean): void {
  poly(ctx, [x - s, y, x, y - s * 1.35, x + s, y, x, y + s * 1.35]);
  fillStroke(ctx, light ? SPIKE_L : SPIKE, OUTLINE, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  poly(ctx, [x - s * 0.5, y - s * 0.1, x, y - s * 0.9, x + s * 0.1, y - s * 0.3]); ctx.fill();
}

export function drawDinoBody(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.dinoBody, 300, 140);
  const g = lin(ctx, 40, 10, 200, 130, [[0, SKIN_L], [1, SKIN_D]]);
  // tiny arms (behind the torso)
  for (const s of [-1, 1]) {
    const y = 70 + s * 56;
    ellipse(ctx, 204, y, 14, 8); fillStroke(ctx, SKIN_D, OUTLINE, 3);
    for (const k of [-1, 1]) { ellipse(ctx, 220, y + k * 3.5, 6, 3.2); fillStroke(ctx, '#f5f5e0', OUTLINE, 2); }
  }
  union(ctx, [
    c => ellipse(c, 116, 70, 102, 54),
    c => { c.beginPath(); c.moveTo(185, 40); c.bezierCurveTo(230, 34, 255, 46, 292, 50); c.lineTo(292, 90); c.bezierCurveTo(255, 94, 230, 106, 185, 100); c.closePath(); },
  ], g);
  // belly-colored side patches + spots
  ctx.save();
  ellipse(ctx, 116, 70, 102, 54); ctx.clip();
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(230,251,176,0.55)';
    ellipse(ctx, 120, 70 + s * 54, 90, 20); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = BELLY;
  const spots: [number, number, number][] = [[70, -30, 9], [105, -38, 7], [140, -31, 10], [175, -36, 6], [60, 33, 8], [98, 37, 10], [135, 33, 7], [172, 36, 9], [244, -14, 5], [262, 14, 4]];
  for (const [x, dy, r] of spots) { ellipse(ctx, x, 70 + dy, r, r * 0.8); ctx.fill(); }
  ctx.fillStyle = 'rgba(14,110,90,0.28)';
  for (const [x, dy, r] of [[88, -14, 8], [130, 12, 9], [165, -8, 7], [215, 8, 6]] as [number, number, number][]) { ellipse(ctx, x, 70 + dy, r, r * 0.75); ctx.fill(); }
  // spine plates along the back
  const xs = [30, 55, 82, 110, 138, 166, 194];
  xs.forEach((x, i) => dinoPlate(ctx, x, 70, 9 + Math.sin(i / 6 * Math.PI) * 6, i % 2 === 1));
  glossHighlight(ctx, 90, 28, 52, 7, 0.28);
  done();
}

export function drawDinoHead(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.dinoHead, 140, 96);
  const g = lin(ctx, 10, 6, 120, 90, [[0, '#a6ff9a'], [1, '#27b88a']]);
  union(ctx, [
    c => ellipse(c, 52, 48, 40, 38),
    c => { c.beginPath(); c.roundRect(58, 28, 78, 40, 19); },
  ], g);
  // lighter muzzle underside + nostrils
  ctx.fillStyle = 'rgba(240,255,190,0.55)';
  ctx.beginPath(); ctx.roundRect(70, 50, 62, 15, 8); ctx.fill();
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, 90, 33, 2.6, 2); ctx.fill(); ellipse(ctx, 90, 63, 2.6, 2); ctx.fill();
  // happy open mouth at the snout tip with chunky friendly teeth
  ctx.beginPath(); ctx.roundRect(98, 34, 34, 28, 11);
  fillStroke(ctx, '#d6425e', OUTLINE, 3);
  ellipse(ctx, 118, 55, 9, 4.5); ctx.fillStyle = '#ff8fa3'; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  for (const x of [104, 113, 122]) {
    poly(ctx, [x - 4, 35.5, x + 4, 35.5, x, 43.5]); ctx.fill(); ctx.stroke();
  }
  for (const x of [108, 118]) {
    poly(ctx, [x - 3.5, 60.5, x + 3.5, 60.5, x, 54]); ctx.fill(); ctx.stroke();
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,140,0.5)';
  ellipse(ctx, 76, 48, 5, 10); ctx.fill();
  // head crest plates
  for (const x of [20, 33, 46]) { poly(ctx, [x - 5, 48, x, 48 - 6.5, x + 5, 48, x, 48 + 6.5]); fillStroke(ctx, SPIKE, OUTLINE, 2.2); }
  // big friendly eyes bulging out the sides
  for (const ey of [17, 79]) {
    ellipse(ctx, 66, ey, 15, 15); fillStroke(ctx, '#ffffff', OUTLINE, 3.5);
    ellipse(ctx, 71, ey, 8.5, 9); ctx.fillStyle = '#16202e'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ellipse(ctx, 74, ey + (ey < 48 ? 3 : -3), 2.8, 2.8); ctx.fill();
    ellipse(ctx, 68, ey + (ey < 48 ? -3 : 3), 1.6, 1.6); ctx.fill();
  }
  glossHighlight(ctx, 50, 30, 18, 4, 0.35);
  done();
}

export function drawDinoTail(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.dinoTail, 180, 60);
  const g = lin(ctx, 0, 0, 180, 60, [[0, '#27b88a'], [0.5, '#6fe08a'], [1, SKIN_L]]);
  union(ctx, [c => {
    c.beginPath(); c.moveTo(180, 5); c.bezierCurveTo(120, 8, 70, 22, 7, 28);
    c.quadraticCurveTo(2, 30, 7, 32); c.bezierCurveTo(70, 38, 120, 52, 180, 55); c.closePath();
  }], g);
  ctx.fillStyle = BELLY;
  for (const [x, r] of [[150, 6], [112, 5], [78, 3.6]] as [number, number][]) { ellipse(ctx, x, 30 + (x > 100 ? 14 : 8), r, r * 0.75); ctx.fill(); ellipse(ctx, x + 14, 30 - (x > 100 ? 15 : 8), r * 0.8, r * 0.6); ctx.fill(); }
  const plates: [number, number][] = [[165, 8.5], [138, 8], [111, 7], [86, 6], [63, 5], [42, 4], [24, 3]];
  plates.forEach(([x, s], i) => dinoPlate(ctx, x, 30, s, i % 2 === 1));
  done();
}

/** Leg for the bottom (+y) side; the top leg uses flipY. Foot reaches downward. */
export function drawDinoLegs(scene: Phaser.Scene): void {
  const foot = [34, 48, 36, 22];     // foot x per frame (forward = larger)
  const lift = [0, 1, 0, 0];         // frame 1: foot lifted a little
  TEX.dinoLeg.forEach((key, i) => {
    const { ctx, done } = makeCanvas(scene, key, 70, 40);
    const fx = foot[i];
    ellipse(ctx, 30, 11, 25, 11); fillStroke(ctx, lin(ctx, 10, 0, 50, 24, [[0, '#4fcf8a'], [1, '#1c8f78']]), OUTLINE, 3);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 17;
    ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(fx, 25); ctx.stroke();
    ctx.strokeStyle = '#2fb38a'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(fx, 25); ctx.stroke();
    const fy = 27 - lift[i] * 2;
    ellipse(ctx, fx, fy, 12, 9); fillStroke(ctx, '#3cc48a', OUTLINE, 3);
    for (const dy of [-5.5, 0, 5.5]) {
      ellipse(ctx, fx + 12, fy + dy, 6.5, 3.8); fillStroke(ctx, '#58d691', OUTLINE, 2);
      ellipse(ctx, fx + 17.5, fy + dy, 2.6, 2.2); ctx.fillStyle = '#fff'; ctx.fill();
    }
    done();
  });
}

export function drawDinoShadow(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.dinoShadow, 460, 220);
  ctx.save();
  ctx.translate(230, 110); ctx.scale(1, 0.48);
  ctx.fillStyle = radial(ctx, 0, 0, 20, 228, [[0, 'rgba(0,0,0,0.5)'], [0.7, 'rgba(0,0,0,0.32)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(-230, -230, 460, 460);
  ctx.restore();
  done();
}
