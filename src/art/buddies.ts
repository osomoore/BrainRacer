import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { OUTLINE, ellipse, fillStroke, lin, makeCanvas, poly, radial, star, type Ctx } from './draw';

/** Wing spread (px from the body midline to the wingtip) for the 3 flap frames: up, mid, down. */
const SPREAD = [26, 19, 12];

function wing(ctx: Ctx, side: 1 | -1, spread: number): void {
  const cy = 28;
  const y = (d: number) => cy + side * d;
  // shoulder at the front, swept-back tip, scalloped trailing edge
  poly(ctx, [
    34, y(6), 27, y(spread), 21, y(spread * 0.74), 17, y(spread * 0.9), 12, y(spread * 0.58),
    8, y(spread * 0.66), 10, y(7),
  ]);
  fillStroke(ctx, lin(ctx, 8, cy, 30, y(spread), [[0, '#ff7a1a'], [1, '#ffc24d']]), OUTLINE, 2.6);
  // wing bone
  ctx.strokeStyle = '#d6246e';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(32, y(6)); ctx.lineTo(27, y(spread * 0.92)); ctx.moveTo(30, y(6)); ctx.lineTo(17, y(spread * 0.84)); ctx.stroke();
}

function dinoFrame(scene: Phaser.Scene, key: string, frame: number): void {
  const { ctx, done } = makeCanvas(scene, key, 64, 56);
  // tail with a little diamond tip
  poly(ctx, [22, 24, 5, 27.5, 5, 28.5, 22, 32]);
  fillStroke(ctx, '#ff3d9a', OUTLINE, 2.4);
  poly(ctx, [8, 28, 4, 23.5, 1.2, 28, 4, 32.5]);
  fillStroke(ctx, '#ffd23a', OUTLINE, 2);
  // wings behind the body
  wing(ctx, -1, SPREAD[frame]);
  wing(ctx, 1, SPREAD[frame]);
  // head crest (sweeps back over the body)
  poly(ctx, [47, 24, 33, 28, 47, 32]);
  fillStroke(ctx, '#d6246e', OUTLINE, 2.4);
  // body: hot pink with yellow belly stripe
  ellipse(ctx, 29, 28, 17, 9.5);
  fillStroke(ctx, lin(ctx, 0, 18, 0, 38, [[0, '#ff6fb8'], [1, '#e8267f']]), OUTLINE, 3);
  ellipse(ctx, 31, 28, 11, 4.6);
  fillStroke(ctx, '#ffe36a', null);
  // head
  ellipse(ctx, 46, 28, 9.5, 9);
  fillStroke(ctx, lin(ctx, 0, 19, 0, 37, [[0, '#ff7fc0'], [1, '#ee3b8c']]), OUTLINE, 3);
  // beak
  poly(ctx, [52, 23.5, 63, 28, 52, 32.5]);
  fillStroke(ctx, '#ffd23a', OUTLINE, 2.6);
  // big friendly eyes
  for (const s of [-1, 1]) {
    const ey = 28 + s * 5.2;
    ctx.beginPath(); ctx.arc(47.5, ey, 4.6, 0, Math.PI * 2);
    fillStroke(ctx, '#ffffff', OUTLINE, 2);
    ctx.beginPath(); ctx.arc(49, ey + s * 0.2, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.beginPath(); ctx.arc(49.8, ey - 0.9, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  done();
}

export function drawBuddies(scene: Phaser.Scene): void {
  TEX.buddyDino.forEach((k, i) => dinoFrame(scene, k, i));

  // shining star with a face
  {
    const { ctx, done } = makeCanvas(scene, TEX.buddyStar, 56, 56);
    star(ctx, 28, 29, 26, 12.5);
    fillStroke(ctx, radial(ctx, 28, 27, 2, 28, [[0, '#fffbe0'], [0.45, '#ffe14d'], [1, '#ffb000']]), OUTLINE, 3.2);
    // white gleam on the upper-left arm
    ctx.beginPath(); ctx.moveTo(24, 10); ctx.lineTo(28, 3.5); ctx.lineTo(29.5, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(28 + s * 6.2, 28, 2.8, 3.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = OUTLINE; ctx.fill();
      ctx.beginPath(); ctx.arc(28 + s * 6.2 + 0.8, 26.6, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(28, 33, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(18.5, 33.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(37.5, 33.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,110,90,0.55)'; ctx.fill();
    done();
  }

  // soft additive glow (white, tinted by consumers)
  {
    const { ctx, done } = makeCanvas(scene, TEX.buddyGlow, 128, 128);
    ctx.fillStyle = radial(ctx, 64, 64, 0, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 128, 128);
    done();
  }
}
