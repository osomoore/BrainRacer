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
  drawRail(scene);
  drawCrossing(scene, TEX.industrial.crossing[0], false);
  drawCrossing(scene, TEX.industrial.crossing[1], true);
  drawTrain(scene, true);
  drawTrain(scene, false);
}
