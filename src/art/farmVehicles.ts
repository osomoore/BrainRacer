import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { fillStroke, hash, lin, makeCanvas, OUTLINE, rr, type Ctx } from './draw';

const K = TEX.farm;

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, c: string | CanvasGradient, lw = 3): void {
  rr(ctx, x, y, w, h, r); fillStroke(ctx, c, OUTLINE, lw);
}
function wheel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  box(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.3, '#2a2a31', 2.5);
  ctx.fillStyle = '#4a4a55';
  for (let t = x - w / 2 + 3; t < x + w / 2 - 2; t += 5) ctx.fillRect(t, y - h / 2 + 1.5, 2, h - 3);
}
function shine(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = '#ffffff55'; ctx.fill();
}

function drawPickup(scene: Phaser.Scene, key: string, light: string, dark: string): void {
  const { ctx, done } = makeCanvas(scene, key, 84, 44);
  for (const x of [20, 62]) for (const y of [4, 40]) wheel(ctx, x, y, 16, 7);
  box(ctx, 2, 5, 80, 34, 8, lin(ctx, 0, 5, 0, 39, [[0, light], [1, dark]]), 3.5);
  // bed
  box(ctx, 5, 9, 32, 26, 3, '#4a3b34', 2.5);
  for (let x = 10; x < 36; x += 6) { ctx.fillStyle = '#6a584d'; ctx.fillRect(x, 11, 2.5, 22); }
  // cab + windows
  box(ctx, 38, 8, 22, 28, 6, lin(ctx, 0, 8, 0, 36, [[0, light], [1, dark]]), 2.5);
  rr(ctx, 49, 11, 9, 22, 3); fillStroke(ctx, '#8fd3f2', OUTLINE, 2);
  rr(ctx, 40, 12, 6, 20, 2); fillStroke(ctx, '#6fb8dd', OUTLINE, 1.8);
  // hood
  shine(ctx, 62, 10, 14, 4); shine(ctx, 62, 30, 14, 4);
  for (const y of [9, 35]) { ctx.fillStyle = '#fff3a0'; ctx.fillRect(79, y - 2, 4, 5); }
  done();
}

function drawTractor(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.tractor, 80, 56);
  for (const y of [8, 48]) wheel(ctx, 22, y, 32, 14);
  for (const y of [11, 45]) wheel(ctx, 64, y, 16, 8);
  box(ctx, 34, 17, 44, 22, 7, lin(ctx, 0, 17, 0, 39, [[0, '#52b848'], [1, '#2f8a33']]), 3);
  ctx.fillStyle = '#ffffff44'; ctx.fillRect(48, 20, 24, 3);
  box(ctx, 70, 21, 7, 14, 3, '#e9edf0', 2);
  box(ctx, 2, 15, 22, 26, 4, '#3a3a42', 2.5);     // rear axle housing
  box(ctx, 10, 12, 32, 32, 8, lin(ctx, 0, 12, 0, 44, [[0, '#62c755'], [1, '#2f8a33']]), 3.5);
  box(ctx, 14, 16, 24, 24, 5, '#f4efdc', 2.5);   // cab roof
  ctx.fillStyle = '#d9d2b8'; ctx.fillRect(16, 27, 20, 2);
  shine(ctx, 17, 18, 14, 4);
  ctx.beginPath(); ctx.arc(52, 28, 2.5, 0, 7); ctx.fillStyle = '#2a2a31'; ctx.fill();   // exhaust
  done();
}

function drawWagon(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.hayWagon, 120, 50);
  box(ctx, 108, 22, 12, 6, 2, '#5b5560', 2);      // drawbar
  for (const x of [26, 80]) for (const y of [5, 45]) wheel(ctx, x, y, 18, 8);
  box(ctx, 4, 7, 106, 36, 5, '#a56a36', 3.5);
  rr(ctx, 9, 11, 96, 28, 8); fillStroke(ctx, lin(ctx, 0, 11, 0, 39, [[0, '#f5da70'], [1, '#d0a037']]), OUTLINE, 2.5);
  ctx.save(); rr(ctx, 9, 11, 96, 28, 8); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const x = 12 + hash(i, 1, 8) * 90, y = 13 + hash(i, 2, 8) * 24;
    ctx.fillStyle = i % 2 ? '#bd8a28' : '#fff0a0'; ctx.fillRect(x, y, 9, 1.6);
  }
  ctx.restore();
  done();
}

function drawCombine(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.combine, 150, 84);
  for (const y of [11, 73]) wheel(ctx, 96, y, 28, 12);
  for (const y of [14, 70]) wheel(ctx, 30, y, 16, 9);
  // body
  box(ctx, 14, 16, 100, 52, 10, lin(ctx, 0, 16, 0, 68, [[0, '#5bc04c'], [1, '#2d8a35']]), 3.5);
  box(ctx, 18, 22, 52, 40, 7, '#e5d9a0', 2.5);                 // grain tank lid
  ctx.fillStyle = '#c8b974'; for (let x = 24; x < 66; x += 9) ctx.fillRect(x, 24, 2, 36);
  // unloading auger
  box(ctx, 6, 38, 60, 8, 4, '#3b3b44', 2.5);
  // cab
  box(ctx, 78, 24, 32, 36, 9, '#4aa8d8', 3);
  rr(ctx, 98, 28, 9, 28, 3); fillStroke(ctx, '#bfe9fb', OUTLINE, 2);
  shine(ctx, 82, 28, 12, 4);
  // header with reel
  box(ctx, 118, 2, 30, 80, 5, lin(ctx, 0, 0, 0, 84, [[0, '#f6cb3a'], [1, '#d99a1a']]), 3.5);
  for (let y = 6; y < 80; y += 10) { box(ctx, 124, y, 20, 6, 3, y % 20 === 6 ? '#e6503d' : '#fbe9a0', 1.8); }
  ctx.fillStyle = '#fff6c8'; for (let y = 5; y < 82; y += 6) ctx.fillRect(146, y, 3, 3);
  done();
}

export function drawFarmVehicles(scene: Phaser.Scene): void {
  drawPickup(scene, K.pickup[0], '#f0503d', '#b82f27');
  drawPickup(scene, K.pickup[1], '#4d93ea', '#2556b0');
  drawTractor(scene); drawWagon(scene); drawCombine(scene);
}
