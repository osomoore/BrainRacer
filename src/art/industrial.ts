import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ellipse, fillStroke, hash, lin, makeCanvas, radial, rr, type Ctx } from './draw';

const SHADOW = '#111b31';
const STEEL = '#44637c';
const EDGE = '#91b6c5';
const GOLD = '#efb659';

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string | CanvasGradient): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function beam(ctx: Ctx, x: number, y: number, endX: number, endY: number, width: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function disk(ctx: Ctx, x: number, y: number, r: number, color: string, stroke: string | null = null): void {
  ellipse(ctx, x, y, r, r);
  fillStroke(ctx, color, stroke, 2);
}

function glow(ctx: Ctx, x: number, y: number, radius: number, color: string): void {
  const light = radial(ctx, x, y, 0, radius, [[0, color], [1, 'transparent']]);
  rect(ctx, x - radius, y - radius, radius * 2, radius * 2, light);
}

function hazard(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, GOLD);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let offset = -h; offset < w; offset += 12) {
    beam(ctx, x + offset, y + h, x + offset + h, y, 6, SHADOW);
  }
  ctx.restore();
}

function drawBridge(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.bridge, 384, 128);
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.translate(0, 64);
    ctx.scale(1, sign);
    ctx.translate(0, 27);
    rect(ctx, 0, 29, 384, 17, '#111b31d9');
    rect(ctx, 0, 37, 384, 5, STEEL);
    for (let x = 0; x < 384; x += 32) {
      beam(ctx, x, 39, x + 16, 30, 3, '#673e37');
      beam(ctx, x + 16, 30, x + 32, 39, 3, '#ac6550');
      rect(ctx, x + 14, 26, 4, 18, SHADOW);
    }
    rect(ctx, 0, 26, 384, 5, '#cd8662');
    rect(ctx, 0, 26, 384, 1, '#e6b593');
    for (let x = 16; x < 384; x += 64) {
      glow(ctx, x, 29, 20, '#ffad4c69');
      rect(ctx, x - 6, 26, 12, 6, '#855230');
      rect(ctx, x - 4, 27, 8, 3, '#fff0a4');
    }
    ctx.restore();
  }
  done();
}

function drawFactoryBay(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.factoryBay, 384, 256);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(0, 128);
    ctx.scale(1, side);
    // Wall and roof start 88 px from the center (roughly 143 px at map scale).
    rect(ctx, 0, 88, 384, 40, SHADOW);
    rect(ctx, 2, 94, 380, 32, lin(ctx, 0, 94, 0, 126, [
      [0, '#607c8f'], [0.18, '#314b63'], [0.86, '#23394f'], [1, '#47617b'],
    ]));
    for (let x = 8; x < 382; x += 8) {
      rect(ctx, x, 97, 2, 25, '#7290a64a');
    }
    for (let x = 16; x < 384; x += 64) {
      glow(ctx, x + 16, 91, 24, '#ffb55a76');
      rect(ctx, x, 88, 32, 5, '#5d483e');
      rect(ctx, x + 3, 88, 26, 3, '#ffcd80');
    }
    for (const x of [0, 376]) {
      rect(ctx, x, 88, 8, 39, STEEL);
      hazard(ctx, x, 88, 8, 12);
    }
    for (const x of [72, 184, 296]) {
      rr(ctx, x, 103, 20, 18, 3);
      fillStroke(ctx, '#7995a0', SHADOW, 2);
      for (let slot = 0; slot < 4; slot++) rect(ctx, x + 4, 106 + slot * 3, 12, 1, '#344d63');
    }
    ctx.restore();
  }
  done();
}

function drawGantry(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.gantry, 128, 224);
  for (const y of [22, 202]) {
    rr(ctx, 36, y - 16, 56, 32, 4);
    fillStroke(ctx, '#314658', SHADOW, 4);
    hazard(ctx, 42, y - 11, 44, 22);
    disk(ctx, 48, y, 3, EDGE, SHADOW);
    disk(ctx, 80, y, 3, EDGE, SHADOW);
  }
  // The raised truss spans the drive lane; the footings above are on the shoulders.
  rect(ctx, 53, 23, 34, 180, '#111b316c');
  for (let y = 22; y < 201; y += 20) {
    beam(ctx, 52, y, 76, y + 10, 3, '#eea957');
    beam(ctx, 76, y + 10, 52, y + 20, 3, '#bd7042');
  }
  for (const x of [49, 73]) {
    rect(ctx, x, 20, 6, 184, '#6b4b42');
    rect(ctx, x, 20, 3, 184, '#f4c376');
  }
  rr(ctx, 46, 48, 36, 24, 3);
  fillStroke(ctx, STEEL, SHADOW, 3);
  rect(ctx, 59, 51, 17, 17, '#527f9b');
  glow(ctx, 81, 60, 16, '#ffbb5280');
  disk(ctx, 80, 60, 3, '#fff1ad');
  done();
}

function drawLoadingYard(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.loadingYard, 256, 256);
  rr(ctx, 1, 1, 254, 254, 12);
  fillStroke(ctx, '#3b5165', SHADOW, 2);
  for (let i = 0; i < 480; i++) {
    const x = 8 + hash(i, 0, 41) * 240;
    const y = 8 + hash(i, 1, 41) * 240;
    rect(ctx, x, y, 2, 2, '#a6c3d21c');
  }
  for (let x = 14; x < 223; x += 52) {
    rect(ctx, x, 60, 3, 77, '#a6babb');
    rect(ctx, x + 7, 62, 36, 4, '#8eacc0');
    rect(ctx, x + 7, 131, 36, 3, '#8eacc0');
  }
  rect(ctx, 10, 10, 236, 42, '#23384e');
  hazard(ctx, 10, 45, 236, 5);
  const containers = [
    { x: 24, color: '#ad6d53', rib: '#d28e69' },
    { x: 101, color: '#497587', rib: '#74a2ae' },
    { x: 167, color: '#857444', rib: '#b1a164' },
  ];
  for (const { x, color, rib } of containers) {
    rr(ctx, x, 16, 53, 24, 2);
    fillStroke(ctx, color, SHADOW, 3);
    for (let ribX = x + 5; ribX < x + 50; ribX += 5) rect(ctx, ribX, 19, 2, 18, rib);
  }
  for (const x of [15, 240]) {
    glow(ctx, x, 43, 26, '#ffba6572');
    disk(ctx, x, 43, 4, '#ffe4a1', '#785737');
  }
  done();
}

function drawWaterTower(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.waterTower, 192, 192);
  ellipse(ctx, 100, 110, 85, 75);
  fillStroke(ctx, '#111b318e', null);
  for (const x of [42, 150]) for (const y of [42, 150]) {
    beam(ctx, x, y, 96, 96, 10, STEEL);
    disk(ctx, x, y, 9, '#4e647c', SHADOW);
  }
  disk(ctx, 96, 96, 76, '#263951', SHADOW);
  disk(ctx, 96, 96, 69, '#45637a', EDGE);
  ellipse(ctx, 96, 96, 61, 61);
  fillStroke(ctx, radial(ctx, 71, 67, 8, 106, [[0, '#8fb3c0'], [1, '#294557']]), SHADOW, 2);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    beam(ctx, 96, 96, 96 + 59 * Math.cos(angle), 96 + 59 * Math.sin(angle), 1.5, '#29455780');
    disk(ctx, 96 + 66 * Math.cos(angle), 96 + 66 * Math.sin(angle), 2, '#bdd0cc');
  }
  disk(ctx, 96, 96, 19, STEEL, SHADOW);
  disk(ctx, 96, 96, 13, '#759bad', EDGE);
  for (const y of [79, 109]) {
    rect(ctx, 159, y, 16, 5, STEEL);
    glow(ctx, 166, y + 2, 15, '#ffb45280');
    rect(ctx, 162, y + 1, 8, 3, '#ffe6a6');
  }
  done();
}

function drawContainerStack(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.containerStack, 256, 96);
  rr(ctx, 3, 12, 250, 84, 4);
  fillStroke(ctx, '#111b3180', null);
  const colors = [['#b4684a', '#d99069'], ['#3f7d92', '#6fb0bd'], ['#a58a3e', '#d4bd68'], ['#7a5a8c', '#a58bb8']];
  for (let i = 0; i < 4; i++) {
    const x = 4 + (i % 2) * 125, y = 4 + Math.floor(i / 2) * 44;
    const [c, rib] = colors[(i + (i > 1 ? 1 : 0)) % 4];
    rr(ctx, x, y, 122, 40, 3);
    fillStroke(ctx, c, SHADOW, 3);
    for (let r = x + 6; r < x + 116; r += 6) rect(ctx, r, y + 4, 2, 32, rib);
    rect(ctx, x + 3, y + 3, 116, 3, '#ffffff22');
  }
  done();
}

function drawPallets(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.pallets, 104, 104);
  rect(ctx, 6, 10, 94, 94, '#111b3166');
  for (const [x, y] of [[4, 4], [54, 4], [4, 54], [54, 54]]) {
    rr(ctx, x, y, 46, 46, 3);
    fillStroke(ctx, '#b88c58', '#5a3f2a', 2);
    rect(ctx, x + 3, y + 3, 40, 3, '#e0b983');
    beam(ctx, x + 4, y + 4, x + 42, y + 42, 2, '#7a5a3a');
  }
  rect(ctx, 46, 4, 6, 96, '#44637c');
  done();
}

function drawBarrels(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.barrels, 96, 96);
  const drums: [number, number, string][] = [[26, 26, '#c4562f'], [68, 28, '#3d79a0'], [46, 68, '#c9a032']];
  for (const [x, y] of drums) disk(ctx, x + 3, y + 5, 21, '#111b3180');
  for (const [x, y, c] of drums) {
    disk(ctx, x, y, 21, c, SHADOW);
    disk(ctx, x, y, 14, '#00000026', null);
    disk(ctx, x - 4, y - 4, 4, '#ffffff66');
  }
  done();
}

function drawFuelTank(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.fuelTank, 256, 256);
  disk(ctx, 134, 138, 112, '#111b3173');
  disk(ctx, 128, 128, 112, '#56707e', SHADOW);
  disk(ctx, 128, 128, 100, '#8aa3ad', EDGE);
  disk(ctx, 112, 110, 70, '#b5c7cb');
  for (let a = 0; a < 6; a++) beam(ctx, 128, 128, 128 + 98 * Math.cos(a * Math.PI / 3), 128 + 98 * Math.sin(a * Math.PI / 3), 2, '#3b536380');
  disk(ctx, 128, 128, 22, '#3f5565', SHADOW);
  hazard(ctx, 106, 118, 44, 20);
  done();
}

function drawConveyor(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.conveyor, 384, 72);
  rect(ctx, 0, 14, 384, 58, '#111b3166');
  rr(ctx, 2, 6, 380, 52, 5);
  fillStroke(ctx, '#34485c', SHADOW, 3);
  rect(ctx, 8, 14, 368, 36, '#1d2a3a');
  for (let x = 12; x < 372; x += 14) rect(ctx, x, 14, 3, 36, '#5a7387');
  for (const [x, c] of [[40, '#b4784a'], [140, '#6fa0b0'], [250, '#c9a24a']] as const) {
    rr(ctx, x, 20, 40, 24, 3);
    fillStroke(ctx, c, SHADOW, 2);
    rect(ctx, x + 18, 20, 4, 24, '#ffffff33');
  }
  for (const x of [6, 372]) hazard(ctx, x, 6, 6, 52);
  for (const x of [60, 200, 320]) { glow(ctx, x, 8, 22, '#ffbb5270'); disk(ctx, x, 8, 3, '#fff0b0'); }
  done();
}

function drawSmokeStack(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.smokeStack, 160, 160);
  glow(ctx, 80, 80, 78, '#33415a99');
  disk(ctx, 86, 88, 36, '#111b3199');
  disk(ctx, 80, 80, 36, '#7a574b', SHADOW);
  disk(ctx, 80, 80, 28, '#9d7062', '#4a3030');
  disk(ctx, 80, 80, 20, '#1a1822', SHADOW);
  for (let a = 0; a < 8; a++) rect(ctx, 80 + 32 * Math.cos(a * Math.PI / 4) - 2, 80 + 32 * Math.sin(a * Math.PI / 4) - 2, 4, 4, GOLD);
  glow(ctx, 80, 80, 22, '#ff6a2a66');
  done();
}

function drawLampPost(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.lampPost, 64, 64);
  glow(ctx, 32, 32, 30, '#ffb55a90');
  disk(ctx, 34, 36, 8, '#111b3190');
  disk(ctx, 32, 32, 7, '#44637c', SHADOW);
  disk(ctx, 32, 32, 4, '#fff3b0', '#8a6232');
  done();
}

function drawParkedTruck(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.parkedTruck, 192, 72);
  rr(ctx, 6, 12, 184, 60, 6);
  fillStroke(ctx, '#111b3170', null);
  rr(ctx, 4, 6, 120, 58, 4);
  fillStroke(ctx, '#7f93a0', SHADOW, 3);
  rect(ctx, 10, 10, 108, 4, '#c4d2d8');
  for (let x = 16; x < 116; x += 12) rect(ctx, x, 17, 2, 42, '#5f7482');
  rr(ctx, 130, 10, 54, 50, 8);
  fillStroke(ctx, '#c1573d', SHADOW, 3);
  rr(ctx, 156, 16, 22, 38, 3);
  fillStroke(ctx, '#7fb2c8', SHADOW, 2);
  for (const y of [18, 52]) { glow(ctx, 186, y, 12, '#ffb05570'); disk(ctx, 184, y, 3, '#ffe8a0'); }
  done();
}

function drawForklift(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.forklift, 80, 56);
  rr(ctx, 14, 12, 56, 42, 5);
  fillStroke(ctx, '#111b3170', null);
  rr(ctx, 14, 10, 40, 36, 6);
  fillStroke(ctx, '#e0a43c', SHADOW, 3);
  rr(ctx, 26, 16, 18, 24, 3);
  fillStroke(ctx, '#4d6a80', SHADOW, 2);
  for (const y of [14, 36]) rect(ctx, 54, y, 24, 5, '#9fb2bd');
  glow(ctx, 36, 6, 14, '#ffbb5280');
  disk(ctx, 36, 6, 3, '#fff1ad');
  done();
}

function drawPipes(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.pipes, 384, 56);
  rect(ctx, 0, 14, 384, 42, '#111b3150');
  for (const [y, c, hi] of [[6, '#a9703f', '#e0a56f'], [26, '#587d93', '#8fb7c8']] as const) {
    rect(ctx, 0, y, 384, 18, SHADOW);
    rect(ctx, 0, y + 2, 384, 14, c);
    rect(ctx, 0, y + 3, 384, 3, hi);
    for (let x = 30; x < 384; x += 64) { rect(ctx, x, y - 1, 8, 20, '#34485c'); rect(ctx, x, y - 1, 2, 20, EDGE); }
  }
  for (const x of [96, 288]) { rect(ctx, x, 2, 10, 50, '#34485c'); disk(ctx, x + 5, 27, 7, GOLD, SHADOW); }
  done();
}

function drawFence(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.fence, 384, 40);
  rect(ctx, 0, 14, 384, 22, '#111b3140');
  for (let x = 0; x < 384; x += 8) {
    beam(ctx, x, 6, x + 8, 26, 1, '#9fb7c466');
    beam(ctx, x + 8, 6, x, 26, 1, '#9fb7c466');
  }
  rect(ctx, 0, 5, 384, 3, '#b9ccd4');
  rect(ctx, 0, 24, 384, 3, '#8aa3b0');
  for (let x = 2; x < 384; x += 64) { rect(ctx, x, 2, 6, 28, '#4c6579'); rect(ctx, x, 2, 6, 3, '#d6e2e6'); }
  done();
}

function drawRoofLights(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.roofLights, 128, 128);
  glow(ctx, 64, 64, 64, '#ffb55a26');
  // Two glowing skylights, a vent unit, and a small sign strip.
  for (const [x, y] of [[20, 26], [20, 72]]) {
    rr(ctx, x, y, 44, 30, 3);
    fillStroke(ctx, '#ffd88a', '#6b4a2e', 2);
    for (let r = x + 7; r < x + 42; r += 8) rect(ctx, r, y + 3, 2, 24, '#b97a3a');
    glow(ctx, x + 22, y + 15, 40, '#ffbb5a55');
  }
  rr(ctx, 78, 28, 32, 32, 4);
  fillStroke(ctx, '#7f93a0', SHADOW, 3);
  disk(ctx, 94, 44, 11, '#34485c', SHADOW);
  for (let a = 0; a < 3; a++) beam(ctx, 94, 44, 94 + 10 * Math.cos(a * 2.1), 44 + 10 * Math.sin(a * 2.1), 2, '#9fb2bd');
  rect(ctx, 76, 92, 38, 8, '#ff6a4a');
  glow(ctx, 95, 96, 32, '#ff7a5a77');
  rect(ctx, 80, 94, 30, 3, '#ffd6c8');
  done();
}


function drawRail(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.industrial.rail, 128, 64);
  rect(ctx, 0, 5, 128, 54, '#29374aac');
  for (let i = 0; i < 200; i++) {
    const x = hash(i, 0, 22) * 128;
    const y = 7 + hash(i, 1, 22) * 48;
    rect(ctx, x, y, 2, 2, '#aab4c244');
  }
  for (let x = 4; x < 128; x += 16) {
    rect(ctx, x, 6, 8, 52, SHADOW);
    rect(ctx, x + 1, 8, 5, 48, '#726167');
    rect(ctx, x + 1, 8, 1, 48, '#a89085');
  }
  for (const y of [14, 44]) {
    rect(ctx, 0, y, 128, 6, SHADOW);
    rect(ctx, 0, y + 1, 128, 3, EDGE);
  }
  done();
}

function drawCrossing(scene: Phaser.Scene, key: string, lit: boolean): void {
  const { ctx, done } = makeCanvas(scene, key, 128, 168);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(64, 84);
    ctx.rotate(side === 1 ? 0 : Math.PI);
    rect(ctx, 47, -49, 5, 44, '#f3d8ae');
    for (let x = 37; x < 49; x += 8) rect(ctx, x, -47, 4, 40, '#e5ac6370');
    rr(ctx, 37, -74, 27, 19, 4);
    fillStroke(ctx, STEEL, SHADOW, 2);
    disk(ctx, 53, -65, 7, '#26394f');
    // Crossbuck and two prominent lenses.
    beam(ctx, 41, -73, 60, -57, 4, '#d4dfe1');
    beam(ctx, 60, -73, 41, -57, 4, '#d4dfe1');
    for (const x of [41, 57]) {
      if (lit) glow(ctx, x, -65, 25, '#ff552fbe');
      disk(ctx, x, -65, 6, lit ? '#ff7048' : '#8b4b46', SHADOW);
      disk(ctx, x - 1, -66, 2, lit ? '#fff1aa' : '#bd7770');
    }
    ctx.restore();
  }
  done();
}

function drawTrain(scene: Phaser.Scene, engine: boolean): void {
  const width = engine ? 144 : 124;
  const key = engine ? TEX.industrial.engine : TEX.industrial.freightCar;
  const { ctx, done } = makeCanvas(scene, key, width, 64);
  rect(ctx, 0, 28, width, 8, SHADOW);
  for (const x of [14, width - 40]) for (const y of [5, 50]) {
    rr(ctx, x, y, 26, 9, 2);
    fillStroke(ctx, '#435268', SHADOW, 2);
    rect(ctx, x + 4, y + 2, 6, 5, '#7693a6');
    rect(ctx, x + 16, y + 2, 6, 5, '#7693a6');
  }
  rr(ctx, 5, 10, width - 10, 44, 5);
  fillStroke(ctx, engine ? '#805343' : '#526276', SHADOW, 3);
  rect(ctx, 8, 13, width - 16, 3, GOLD);
  rect(ctx, 8, 49, width - 16, 3, GOLD);
  if (engine) {
    rr(ctx, 12, 18, 104, 28, 5);
    fillStroke(ctx, lin(ctx, 0, 18, 0, 46, [[0, '#c47655'], [1, '#834938']]), SHADOW, 2);
    for (const x of [29, 51]) {
      disk(ctx, x, 32, 9, '#2b4053', SHADOW);
      for (let row = 0; row < 3; row++) rect(ctx, x - 5, 28 + 3 * row, 10, 1.5, '#7c99a9');
    }
    rr(ctx, 73, 16, 31, 32, 3);
    fillStroke(ctx, '#e1a46e', SHADOW, 2);
    rect(ctx, 96, 19, 6, 26, '#53758d');
    rect(ctx, 100, 19, 2, 26, EDGE);
    hazard(ctx, 125, 18, 10, 28);
    for (const y of [21, 43]) {
      glow(ctx, 135, y, 11, '#ffb055ad');
      disk(ctx, 135, y, 3.5, '#fff1b0', '#774e35');
    }
  } else {
    rr(ctx, 11, 14, 102, 36, 4);
    fillStroke(ctx, '#577889', SHADOW, 2);
    rect(ctx, 14, 16, 96, 3, EDGE);
    for (let x = 16; x < 110; x += 8) {
      rect(ctx, x, 19, 2, 27, '#3c596d');
      rect(ctx, x + 2, 19, 1, 27, '#7b9ba6');
    }
    rect(ctx, 19, 29, 86, 6, '#b58e60');
    for (const x of [14, 107]) disk(ctx, x, 32, 3, GOLD, SHADOW);
  }
  done();
}

export function drawIndustrial(scene: Phaser.Scene): void {
  drawBridge(scene);
  drawFactoryBay(scene);
  drawGantry(scene);
  drawLoadingYard(scene);
  drawWaterTower(scene);
  drawContainerStack(scene); drawPallets(scene); drawBarrels(scene); drawFuelTank(scene);
  drawConveyor(scene); drawSmokeStack(scene); drawLampPost(scene); drawParkedTruck(scene);
  drawForklift(scene); drawPipes(scene); drawFence(scene); drawRoofLights(scene);
  drawRail(scene);
  drawCrossing(scene, TEX.industrial.crossing[0], false);
  drawCrossing(scene, TEX.industrial.crossing[1], true);
  drawTrain(scene, true);
  drawTrain(scene, false);
}
