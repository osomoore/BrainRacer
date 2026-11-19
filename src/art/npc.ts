import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { OUTLINE, bodyGrad, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';

function tire(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rr(ctx, x, y, w, h, 2.5); fillStroke(ctx, '#454b60', OUTLINE, 2);
}

function headlights(ctx: Ctx, x: number, y0: number, y1: number): void {
  for (const y of [y0, y1]) { ellipse(ctx, x, y, 2.6, 3.2); fillStroke(ctx, '#fff7b0', OUTLINE, 1.5); }
}
function taillights(ctx: Ctx, x: number, y0: number, y1: number): void {
  for (const y of [y0, y1]) { rr(ctx, x, y - 3, 3, 6, 1); fillStroke(ctx, '#ff3030', OUTLINE, 1.2); }
}

interface Sedan { light: string; dark: string; roof: string }
const SEDANS: Sedan[] = [
  { light: '#5da4ff', dark: '#1d5fd6', roof: '#8cc0ff' },
  { light: '#ffe45c', dark: '#e0a800', roof: '#fff08a' },
  { light: '#c58cff', dark: '#7a35c9', roof: '#dcb4ff' },
  { light: '#ffffff', dark: '#aab2c0', roof: '#f4f6fa' },
];

function sedanBody(ctx: Ctx, w: number, h: number, s: Sedan): void {
  tire(ctx, 9, 0.5, 14, 6); tire(ctx, 9, h - 6.5, 14, 6);
  tire(ctx, 40, 0.5, 14, 6); tire(ctx, 40, h - 6.5, 14, 6);
  rr(ctx, 2, 3.5, w - 4, h - 7, 10);
  fillStroke(ctx, bodyGrad(ctx, 2, 3.5, w - 4, h - 7, s.light, s.dark), OUTLINE, 3);
  poly(ctx, [40, 8, 47, 10.5, 47, h - 10.5, 40, h - 8]);
  fillStroke(ctx, lin(ctx, 40, 0, 47, 0, [[0, '#2b4a78'], [1, '#6fa8e0']]), OUTLINE, 2);
  poly(ctx, [14, 9.5, 18, 8.5, 18, h - 8.5, 14, h - 9.5]);
  fillStroke(ctx, '#2b4a78', OUTLINE, 2);
  rr(ctx, 17, 8, 24, h - 16, 6);
  fillStroke(ctx, bodyGrad(ctx, 17, 8, 24, h - 16, s.roof, s.dark), OUTLINE, 2.5);
  glossHighlight(ctx, 26, 11.5, 7, 1.6, 0.5);
  for (const y of [5, h - 5]) { ellipse(ctx, 42, y, 2, 1.6); fillStroke(ctx, s.dark, OUTLINE, 1.2); }
  headlights(ctx, w - 4, 8, h - 8);
  taillights(ctx, 2.5, 8.5, h - 8.5);
}

export function drawTraffic(scene: Phaser.Scene): void {
  TEX.traffic.forEach((key, i) => {
    const { ctx, done } = makeCanvas(scene, key, 64, 36);
    sedanBody(ctx, 64, 36, SEDANS[i]);
    done();
  });
}

export function drawTruck(scene: Phaser.Scene): void {
  drawTruckBody(scene, TEX.truck, { cargo: '#ffffff', cargoShade: '#b9c2d0', stripe: '#ff8a1f',
    cab: '#ff6a5c', cabShade: '#c4160e', roof: '#e0403a' });
  drawTruckBody(scene, TEX.freightTruck, { cargo: '#92e1da', cargoShade: '#358b91', stripe: '#ffe078',
    cab: '#ffc56b', cabShade: '#c16a15', roof: '#f5a73a' });
}

function drawTruckBody(scene: Phaser.Scene, key: string, colors: {
  cargo: string; cargoShade: string; stripe: string; cab: string; cabShade: string; roof: string;
}): void {
  const { ctx, done } = makeCanvas(scene, key, 120, 48);
  for (const x of [10, 30, 62, 94]) { tire(ctx, x, 0.5, 15, 7); tire(ctx, x, 40.5, 15, 7); }
  rr(ctx, 2, 4, 84, 40, 6);
  fillStroke(ctx, bodyGrad(ctx, 2, 4, 84, 40, colors.cargo, colors.cargoShade), OUTLINE, 3);
  ctx.strokeStyle = 'rgba(80,95,120,0.35)'; ctx.lineWidth = 2;
  for (let x = 14; x < 84; x += 12) { ctx.beginPath(); ctx.moveTo(x, 7); ctx.lineTo(x, 41); ctx.stroke(); }
  ctx.fillStyle = colors.stripe; ctx.fillRect(6, 20, 76, 8);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.strokeRect(6, 20, 76, 8);
  ctx.fillStyle = '#454b60'; ctx.fillRect(85, 19, 6, 10);
  rr(ctx, 90, 6, 28, 36, 9);
  fillStroke(ctx, bodyGrad(ctx, 90, 6, 28, 36, colors.cab, colors.cabShade), OUTLINE, 3);
  poly(ctx, [104, 10, 112, 13, 112, 35, 104, 38]);
  fillStroke(ctx, lin(ctx, 104, 0, 112, 0, [[0, '#2b4a78'], [1, '#7bb4ea']]), OUTLINE, 2);
  rr(ctx, 92, 11, 11, 26, 4); fillStroke(ctx, colors.roof, OUTLINE, 2);
  headlights(ctx, 116, 11, 37);
  taillights(ctx, 2.5, 10, 38);
  glossHighlight(ctx, 100, 9.5, 6, 1.6, 0.5);
  done();
}

export function drawPolice(scene: Phaser.Scene): void {
  TEX.police.forEach((key, i) => {
    const { ctx, done } = makeCanvas(scene, key, 66, 38);
    tire(ctx, 10, 0.5, 14, 6); tire(ctx, 10, 31.5, 14, 6);
    tire(ctx, 42, 0.5, 14, 6); tire(ctx, 42, 31.5, 14, 6);
    rr(ctx, 2, 3.5, 62, 31, 10);
    fillStroke(ctx, bodyGrad(ctx, 2, 3.5, 62, 31, '#ffffff', '#b4bccb'), OUTLINE, 3);
    ctx.fillStyle = '#23283a'; ctx.fillRect(22, 5, 20, 4); ctx.fillRect(22, 29, 20, 4);
    ctx.fillRect(6, 16, 9, 6);
    poly(ctx, [42, 8, 49, 11, 49, 27, 42, 30]);
    fillStroke(ctx, lin(ctx, 42, 0, 49, 0, [[0, '#2b4a78'], [1, '#6fa8e0']]), OUTLINE, 2);
    rr(ctx, 15, 8, 27, 22, 6); fillStroke(ctx, '#2a3046', OUTLINE, 2.5);
    // light bar: top of image = left side
    const colTop = i === 0 ? '#ff3030' : '#2a7bff';
    const colBot = i === 0 ? '#2a7bff' : '#ff3030';
    const bars: [number, string][] = [[9.5, colTop], [19, colBot]];
    for (const [y, c] of bars) {
      ctx.save();
      ctx.fillStyle = radial(ctx, 28.5, y + 4.75, 2, 17, [[0, c], [1, 'rgba(0,0,0,0)']]);
      ctx.globalAlpha = 0.55; ctx.fillRect(10, y - 10, 38, 30); ctx.restore();
    }
    rr(ctx, 25, 9.5, 7, 9.5, 2.5); fillStroke(ctx, colTop, OUTLINE, 2);
    rr(ctx, 25, 19, 7, 9.5, 2.5); fillStroke(ctx, colBot, OUTLINE, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(26.5, 11, 2, 3); ctx.fillRect(26.5, 20.5, 2, 3);
    headlights(ctx, 61, 8.5, 29.5);
    taillights(ctx, 2.5, 9, 29);
    done();
  });
}
