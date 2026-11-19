import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { OUTLINE, bodyGrad, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, rr, star, type Ctx } from './draw';

function tire(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rr(ctx, x, y, w, h, 2.5);
  fillStroke(ctx, '#454b60', OUTLINE, 2);
  ctx.fillStyle = '#7b83a0';
  ctx.fillRect(x + 3, y + 1.5, w - 6, 1.5);
}

export function drawCarDino(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.carDino, 72, 40);
  const GD = '#1f9a35', GL = '#8cf27a';
  // tires peeking out
  tire(ctx, 12, 0.5, 14, 7); tire(ctx, 12, 32.5, 14, 7);
  tire(ctx, 40, 0.5, 14, 7); tire(ctx, 40, 32.5, 14, 7);
  // tail fin (rear, -x)
  poly(ctx, [9, 12, 0.8, 16.5, 0.8, 23.5, 9, 28]);
  fillStroke(ctx, '#ffb020', OUTLINE, 2.5);
  // body
  rr(ctx, 6, 5, 50, 30, 11);
  fillStroke(ctx, bodyGrad(ctx, 6, 5, 50, 30, GL, GD), OUTLINE, 3);
  ctx.save(); rr(ctx, 6, 5, 50, 30, 11); ctx.clip();
  ctx.fillStyle = 'rgba(15,90,40,0.25)'; ctx.fillRect(6, 29, 50, 8);
  ctx.restore();
  // cockpit
  rr(ctx, 22, 11, 19, 18, 7);
  fillStroke(ctx, lin(ctx, 22, 11, 22, 29, [[0, '#1c5c4a'], [1, '#2f8f6a']]), OUTLINE, 2.5);
  rr(ctx, 32, 14, 6, 12, 3);
  fillStroke(ctx, '#ffe38a', OUTLINE, 1.5);
  // spine plates (diamonds) down the middle
  const plates: [number, number][] = [[11, 3.6], [17, 4.4], [44.5, 3.8]];
  plates.forEach(([x, s], i) => {
    poly(ctx, [x - s, 20, x, 20 - s * 1.5, x + s, 20, x, 20 + s * 1.5]);
    fillStroke(ctx, i % 2 ? '#ffd23a' : '#ff9a1f', OUTLINE, 2);
  });
  // stubby tail fin plate on top
    // dino head = hood/front bumper
  rr(ctx, 48, 8, 23, 24, 10);
  fillStroke(ctx, bodyGrad(ctx, 48, 8, 23, 24, '#b6ff8e', '#3fd451'), OUTLINE, 3);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(60, 20, 8, -0.95, 0.95); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(67.5, 14, 1.8, 2); ctx.fillRect(67.5, 24, 1.8, 2);
  // big eyes
  for (const ey of [11.5, 28.5]) {
    ellipse(ctx, 54, ey, 4.6, 4.6); fillStroke(ctx, '#fff', OUTLINE, 2);
    ellipse(ctx, 55.4, ey, 2.2, 2.4); ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(55.8, ey - 1.6, 1, 1);
  }
  glossHighlight(ctx, 20, 9, 8, 2, 0.45);
  done();
}

export function drawCarKart(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.carKart, 60, 36);
  tire(ctx, 6, 0.5, 15, 8); tire(ctx, 6, 27.5, 15, 8);
  tire(ctx, 38, 0.5, 15, 8); tire(ctx, 38, 27.5, 15, 8);
  // bumpers
  rr(ctx, 54, 8, 5, 20, 2.5); fillStroke(ctx, lin(ctx, 54, 0, 59, 0, [[0, '#f2f2f2'], [1, '#aeb4c0']]), OUTLINE, 2);
  rr(ctx, 1, 9, 5, 18, 2.5); fillStroke(ctx, '#c8ccd6', OUTLINE, 2);
  // body
  rr(ctx, 5, 5, 50, 26, 12);
  fillStroke(ctx, bodyGrad(ctx, 5, 5, 50, 26, '#ff6a5c', '#c4160e'), OUTLINE, 3);
  // white racing stripe
  ctx.save(); rr(ctx, 5, 5, 50, 26, 12); ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(38, 15, 20, 6); ctx.fillRect(2, 15, 14, 6);
  ctx.restore();
  // seat + steering wheel
  rr(ctx, 14, 10, 18, 16, 6); fillStroke(ctx, '#2c3042', OUTLINE, 2);
  ellipse(ctx, 37, 18, 2.6, 6.5); fillStroke(ctx, '#3a3f55', OUTLINE, 2);
  // shoulders + arms
  ellipse(ctx, 22, 18, 5.5, 10); fillStroke(ctx, '#2f6bff', OUTLINE, 2);
  for (const y of [12.5, 23.5]) {
    ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(36, y < 18 ? 14.5 : 21.5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.6; ctx.stroke();
    ctx.strokeStyle = '#2f6bff'; ctx.lineWidth = 2.2; ctx.stroke();
  }
  for (const y of [14.6, 21.4]) { ellipse(ctx, 36.5, y, 1.8, 1.8); fillStroke(ctx, '#ffd0a0', OUTLINE, 1.2); }
  // red cap seen from above, brim toward +x
  poly(ctx, [29, 12, 38.5, 13.2, 38.5, 22.8, 29, 24]);
  fillStroke(ctx, '#a50f09', OUTLINE, 2);
  ellipse(ctx, 27.5, 18, 8.4, 8.4);
  fillStroke(ctx, lin(ctx, 20, 10, 34, 26, [[0, '#ff5546'], [1, '#d01a10']]), OUTLINE, 2.4);
  // white circle with gold star on cap top
  ellipse(ctx, 27, 18, 5, 5); fillStroke(ctx, '#ffffff', '#8a1008', 1.2);
  star(ctx, 27, 18.3, 3.9, 1.6); fillStroke(ctx, '#ffc61a', '#a56a00', 0.9);
  glossHighlight(ctx, 23, 13, 4, 1.5, 0.45);
  done();
}

export function drawCarShadow(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.carShadow, 80, 48);
  ctx.save();
  ctx.translate(40, 24); ctx.scale(1, 0.6);
  ctx.fillStyle = radial(ctx, 0, 0, 4, 38, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(-40, -40, 80, 80);
  ctx.restore();
  done();
}
