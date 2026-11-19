import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ellipse, fillStroke, hash, lin, makeCanvas, OUTLINE, radial, rr, type Ctx } from './draw';

const K = TEX.farm;
const WOOD = '#a56a36', WOOD_D = '#6f4423', WOOD_L = '#d19a5c';

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string | CanvasGradient): void {
  ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, c: string): void {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.stroke();
}
function disc(ctx: Ctx, x: number, y: number, r: number, c: string | CanvasGradient, stroke: string | null = OUTLINE, lw = 3): void {
  ellipse(ctx, x, y, r, r); fillStroke(ctx, c, stroke, lw);
}

/** Two-slope gable roof seen from above: ridge along x at mid-height, upper slope lit, lower slope shaded. */
function gableRoof(ctx: Ctx, x: number, y: number, w: number, h: number, lit: string, shade: string, ridge: string, tick: string): void {
  rr(ctx, x, y, w, h, 10);
  fillStroke(ctx, shade, OUTLINE, 4);
  ctx.save();
  rr(ctx, x, y, w, h, 10); ctx.clip();
  rect(ctx, x, y, w, h / 2, lit);
  for (let r = 1; r < h / 16; r++) {
    const yy = y + r * 16;
    line(ctx, x, yy, x + w, yy, 1.6, tick);
    for (let xx = x + ((r % 2) * 12); xx < x + w; xx += 24) line(ctx, xx, yy, xx, yy + 16, 1.2, tick);
  }
  ctx.restore();
  rect(ctx, x + 2, y + h / 2 - 4, w - 4, 8, ridge);
  rect(ctx, x + 2, y + h / 2 - 4, w - 4, 2.5, '#ffffff55');
  rr(ctx, x, y, w, h, 10); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
}

function drawBarn(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.barn, 384, 256);
  gableRoof(ctx, 6, 6, 372, 244, '#e8503a', '#b8312a', '#7d201c', '#00000022');
  // white trim frame
  rr(ctx, 14, 14, 356, 228, 8); ctx.lineWidth = 6; ctx.strokeStyle = '#fbf4e6'; ctx.stroke();
  // white X panels on each slope
  for (const py of [36, 150]) {
    rect(ctx, 60, py, 150, 70, '#00000030');
    ctx.strokeStyle = '#fbf4e6'; ctx.lineWidth = 6; ctx.strokeRect(60, py, 150, 70);
    line(ctx, 60, py, 210, py + 70, 6, '#fbf4e6'); line(ctx, 210, py, 60, py + 70, 6, '#fbf4e6');
  }
  // ventilator cupola on the ridge
  rr(ctx, 262, 100, 56, 56, 6); fillStroke(ctx, lin(ctx, 262, 100, 318, 156, [[0, '#f7efe0'], [1, '#c9bfa8']]), OUTLINE, 4);
  ctx.beginPath(); ctx.moveTo(268, 106); ctx.lineTo(312, 106); ctx.lineTo(290, 128); ctx.closePath(); fillStroke(ctx, '#7d201c', null);
  ctx.beginPath(); ctx.moveTo(268, 150); ctx.lineTo(312, 150); ctx.lineTo(290, 128); ctx.closePath(); fillStroke(ctx, '#a82a24', null);
  line(ctx, 268, 106, 312, 150, 2, '#00000040'); line(ctx, 312, 106, 268, 150, 2, '#00000040');
  // hayloft hood at the +x end
  rr(ctx, 340, 92, 40, 72, 6); fillStroke(ctx, '#fbf4e6', OUTLINE, 4);
  rect(ctx, 348, 102, 28, 52, '#3b2418'); rect(ctx, 354, 112, 22, 32, '#e6bf55');
  line(ctx, 358, 118, 374, 118, 2, '#b98c2e'); line(ctx, 358, 128, 374, 128, 2, '#b98c2e'); line(ctx, 358, 138, 374, 138, 2, '#b98c2e');
  done();
}

function drawSilo(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.silo, 128, 128);
  disc(ctx, 64, 64, 58, radial(ctx, 48, 46, 4, 66, [[0, '#f2f5fa'], [0.6, '#b9c4d6'], [1, '#7f8ba3']]), OUTLINE, 4);
  for (let a = 0; a < 12; a++) {
    const t = (a * Math.PI) / 6;
    line(ctx, 64 + Math.cos(t) * 14, 64 + Math.sin(t) * 14, 64 + Math.cos(t) * 55, 64 + Math.sin(t) * 55, 2, '#5d6a8433');
  }
  ctx.lineWidth = 2; ctx.strokeStyle = '#5d6a8444';
  for (const r of [24, 40]) { ellipse(ctx, 64, 64, r, r); ctx.stroke(); }
  disc(ctx, 64, 64, 14, radial(ctx, 60, 60, 1, 14, [[0, '#ee6a55'], [1, '#a82a24']]), OUTLINE, 3);
  disc(ctx, 59, 59, 4, '#ffffff99', null);
  done();
}

function drawFarmhouse(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.farmhouse, 256, 192);
  gableRoof(ctx, 6, 6, 244, 150, '#6c90c8', '#46689f', '#2b4478', '#00000022');
  // porch roof
  rr(ctx, 78, 150, 100, 36, 8); fillStroke(ctx, lin(ctx, 0, 150, 0, 186, [[0, '#d98b4e'], [1, '#a95f31']]), OUTLINE, 4);
  line(ctx, 90, 156, 90, 182, 1.5, '#00000030'); line(ctx, 130, 156, 130, 182, 1.5, '#00000030'); line(ctx, 168, 156, 168, 182, 1.5, '#00000030');
  // dormer
  rr(ctx, 40, 22, 60, 44, 6); fillStroke(ctx, '#fbf4e6', OUTLINE, 4);
  rect(ctx, 48, 30, 44, 28, '#7ec8f0'); line(ctx, 70, 30, 70, 58, 3, '#fbf4e6');
  rect(ctx, 48, 30, 44, 6, '#ffffff66');
  // chimney
  rr(ctx, 170, 40, 34, 34, 3); fillStroke(ctx, '#b4553b', OUTLINE, 4);
  rect(ctx, 176, 46, 22, 22, '#2d2320');
  line(ctx, 172, 52, 202, 52, 1.5, '#ffffff44'); line(ctx, 172, 64, 202, 64, 1.5, '#ffffff44');
  done();
}

function drawShed(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.shed, 128, 128);
  rr(ctx, 6, 6, 116, 116, 8); fillStroke(ctx, lin(ctx, 6, 6, 122, 122, [[0, '#cfd6dd'], [1, '#8f9ba8']]), OUTLINE, 4);
  ctx.save(); rr(ctx, 6, 6, 116, 116, 8); ctx.clip();
  for (let y = 10; y < 122; y += 9) line(ctx, 6, y, 122, y, 2, '#5f6d7c55');
  ctx.restore();
  rect(ctx, 6, 60, 116, 8, '#6d7a89'); rect(ctx, 6, 60, 116, 2.5, '#ffffff66');
  ctx.beginPath(); ctx.ellipse(36, 94, 16, 10, 0.3, 0, Math.PI * 2); ctx.fillStyle = '#b5683f88'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(98, 32, 9, 6, -0.2, 0, Math.PI * 2); ctx.fillStyle = '#b5683f77'; ctx.fill();
  rr(ctx, 6, 6, 116, 116, 8); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  done();
}

function drawWindmill(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.windmill, 128, 128);
  const oct = (r: number): void => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  oct(60); fillStroke(ctx, '#ebdcb8', OUTLINE, 4);
  oct(48); fillStroke(ctx, radial(ctx, 52, 50, 2, 56, [[0, '#d9593f'], [1, '#9c2f27']]), OUTLINE, 3);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    line(ctx, 64, 64, 64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48, 2, '#00000040');
  }
  disc(ctx, 64, 64, 11, '#f5e7c4', OUTLINE, 3);
  disc(ctx, 61, 61, 3.5, '#ffffffaa', null);
  done();
}

function drawWindmillBlade(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.windmillBlade, 256, 256);
  ctx.translate(128, 128);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2 + 0.2);
    rect(ctx, 10, -3, 112, 6, WOOD_D);
    rr(ctx, 30, -2, 90, 36, 3); fillStroke(ctx, '#f6efd9', OUTLINE, 3);
    for (let x = 42; x < 120; x += 16) line(ctx, x, -1, x, 33, 1.5, WOOD);
    for (let y = 10; y < 32; y += 11) line(ctx, 31, y, 119, y, 1.5, WOOD);
    ctx.restore();
  }
  disc(ctx, 0, 0, 15, radial(ctx, -4, -4, 1, 15, [[0, '#f27a62'], [1, '#a82a24']]), OUTLINE, 3);
  disc(ctx, 0, 0, 5, '#fff2c8', null);
  done();
}

function drawTurbine(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.turbine, 64, 64);
  disc(ctx, 32, 32, 20, radial(ctx, 26, 26, 1, 22, [[0, '#ffffff'], [1, '#c3ccd6']]), OUTLINE, 3);
  rr(ctx, 14, 22, 36, 20, 9); fillStroke(ctx, lin(ctx, 14, 22, 14, 42, [[0, '#ffffff'], [1, '#bfc9d4']]), OUTLINE, 3);
  disc(ctx, 50, 32, 6, '#e6503d', OUTLINE, 2.5);
  done();
}

function drawTurbineBlade(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.turbineBlade, 224, 224);
  ctx.translate(112, 112);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 3 - Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(6, -7); ctx.quadraticCurveTo(50, -13, 106, -2); ctx.lineTo(106, 3); ctx.quadraticCurveTo(50, 12, 6, 7); ctx.closePath();
    fillStroke(ctx, lin(ctx, 0, -10, 0, 10, [[0, '#ffffff'], [1, '#d3dbe4']]), OUTLINE, 3);
    rect(ctx, 90, -3, 15, 5, '#e6503d');
    ctx.restore();
  }
  disc(ctx, 0, 0, 11, radial(ctx, -3, -3, 1, 11, [[0, '#ffffff'], [1, '#aab6c3']]), OUTLINE, 3);
  done();
}

function drawHay(scene: Phaser.Scene): void {
  let c = makeCanvas(scene, K.hayRound, 56, 56);
  disc(c.ctx, 28, 28, 25, radial(c.ctx, 22, 22, 2, 28, [[0, '#f3d76d'], [1, '#c8982f']]), OUTLINE, 3);
  c.ctx.lineWidth = 2; c.ctx.strokeStyle = '#9a6d1f88';
  for (const r of [7, 13, 19]) { ellipse(c.ctx, 28, 28, r, r); c.ctx.stroke(); }
  c.ctx.beginPath(); c.ctx.arc(28, 28, 3, 0, 7); c.ctx.fillStyle = '#9a6d1f'; c.ctx.fill();
  c.done();
  c = makeCanvas(scene, K.haySquare, 64, 40);
  rr(c.ctx, 3, 3, 58, 34, 5); fillStroke(c.ctx, lin(c.ctx, 3, 3, 3, 37, [[0, '#f3d76d'], [1, '#cc9c33']]), OUTLINE, 3);
  c.ctx.save(); rr(c.ctx, 3, 3, 58, 34, 5); c.ctx.clip();
  for (let i = 0; i < 18; i++) {
    const x = 6 + hash(i, 1, 5) * 50, y = 6 + hash(i, 2, 5) * 26;
    line(c.ctx, x, y, x + 8, y + (hash(i, 3, 5) - 0.5) * 3, 1.5, i % 2 ? '#b2832a' : '#fbe796');
  }
  c.ctx.restore();
  rect(c.ctx, 18, 3, 4, 34, '#c4512f'); rect(c.ctx, 42, 3, 4, 34, '#c4512f');
  c.done();
}

function drawOrchard(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.orchardTree, 112, 112);
  const blobs: [number, number, number][] = [[56, 56, 42]];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; blobs.push([56 + Math.cos(a) * 28, 56 + Math.sin(a) * 28, 22]); }
  ctx.lineJoin = 'round';
  for (const [x, y, r] of blobs) disc(ctx, x, y, r, '#3e8f2e', OUTLINE, 3);
  for (const [x, y, r] of blobs) disc(ctx, x, y, r - 2, '#4fa535', null);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; disc(ctx, 52 + Math.cos(a) * 26, 50 + Math.sin(a) * 24, 14, '#7cc548', null); }
  disc(ctx, 44, 42, 16, '#92d658', null);
  for (let i = 0; i < 11; i++) {
    const a = hash(i, 1, 21) * 6.283, d = 10 + hash(i, 2, 21) * 32;
    const x = 56 + Math.cos(a) * d, y = 56 + Math.sin(a) * d;
    disc(ctx, x, y, 6, '#e63229', '#8d1a1a', 1.5);
    disc(ctx, x - 1.8, y - 1.8, 1.8, '#ffffffcc', null);
  }
  done();
}

function drawPumpkin(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.pumpkin, 32, 32);
  for (const dx of [-6, 6, -3, 3]) { ellipse(ctx, 16 + dx, 17, 9 - Math.abs(dx) * 0.3, 12); fillStroke(ctx, '#f28a1f', OUTLINE, 2); }
  ellipse(ctx, 16, 17, 6, 11); fillStroke(ctx, '#ffa63a', null);
  rect(ctx, 14, 3, 5, 8, '#3f7f2a');
  disc(ctx, 12, 12, 2.5, '#ffffff77', null);
  done();
}

function drawFence(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.fence, 128, 24);
  rr(ctx, -4, 8, 136, 8, 3); fillStroke(ctx, lin(ctx, 0, 8, 0, 16, [[0, WOOD_L], [1, WOOD]]), OUTLINE, 2.5);
  line(ctx, 0, 11, 128, 11, 1.5, '#ffffff55');
  for (const x of [0, 64, 128]) {
    rr(ctx, x - 7, 5, 14, 14, 3); fillStroke(ctx, lin(ctx, x - 7, 5, x + 7, 19, [[0, WOOD_L], [1, WOOD_D]]), OUTLINE, 2.5);
    rect(ctx, x - 4, 8, 4, 4, '#ffffff44');
  }
  done();
}

function drawGatePost(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.gatePost, 24, 24);
  rr(ctx, 3, 3, 18, 18, 4); fillStroke(ctx, lin(ctx, 3, 3, 21, 21, [[0, WOOD_L], [1, WOOD_D]]), OUTLINE, 3);
  rr(ctx, 7, 7, 10, 10, 2); fillStroke(ctx, '#e4b273', null);
  rect(ctx, 8, 8, 4, 3, '#ffffff77');
  done();
}

function drawBridge(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.bridge, 192, 128);
  rr(ctx, 2, 2, 188, 124, 4); fillStroke(ctx, WOOD_D, OUTLINE, 3);
  for (let x = 6; x < 186; x += 16) {
    rect(ctx, x, 14, 14, 100, x % 32 === 6 ? '#b8844d' : '#c4915a');
    rect(ctx, x, 14, 3, 100, '#ffffff33'); rect(ctx, x + 11, 14, 3, 100, '#00000026');
    rect(ctx, x + 4, 20 + hash(x, 1, 3) * 70, 3, 3, '#5a3a1f');
  }
  for (const y of [0, 114]) {
    rr(ctx, 0, y, 192, 14, 3); fillStroke(ctx, lin(ctx, 0, y, 0, y + 14, [[0, WOOD_L], [1, WOOD]]), OUTLINE, 3);
    for (let x = 12; x < 192; x += 48) { rr(ctx, x - 6, y - 1, 12, 16, 3); fillStroke(ctx, WOOD_D, OUTLINE, 2.5); }
  }
  done();
}

function drawMazeSign(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.mazeSign, 96, 64);
  rr(ctx, 4, 4, 88, 56, 8); fillStroke(ctx, lin(ctx, 0, 4, 0, 60, [[0, WOOD_L], [1, WOOD]]), OUTLINE, 4);
  rr(ctx, 12, 11, 72, 42, 4); fillStroke(ctx, '#f6e7b8', '#7a4a22', 2);
  ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 5; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(18, 48); ctx.lineTo(18, 17); ctx.lineTo(78, 17); ctx.lineTo(78, 47); ctx.lineTo(30, 47);
  ctx.lineTo(30, 29); ctx.lineTo(66, 29); ctx.lineTo(66, 38); ctx.lineTo(48, 38);
  ctx.stroke();
  disc(ctx, 48, 38, 4, '#e6503d', null);
  for (const x of [10, 86]) disc(ctx, x, 10, 2.5, '#3b2418', null);
  done();
}

function drawCornFlat(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.cornFlat, 96, 96);
  for (let i = 0; i < 34; i++) {
    const a0 = hash(i, 1, 33) * 6.283, d = Math.sqrt(hash(i, 2, 33)) * 36;
    const x = 48 + Math.cos(a0) * d, y = 48 + Math.sin(a0) * d;
    const a = (hash(i, 3, 33) - 0.5) * 1.2 + (i % 2 ? 0.25 : -0.25);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.lineCap = 'round';
    for (const [lw, col] of [[7, '#7d9a34'], [5, ['#a3c24f', '#bdd462', '#cfdf84'][i % 3]]] as const) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(0, 3, 17, 0); ctx.stroke();
    }
    line(ctx, -12, -1, 8, -1, 1.4, '#ecf2b0aa');
    ctx.restore();
  }
  done();
}

export function drawFarmProps(scene: Phaser.Scene): void {
  drawBarn(scene); drawSilo(scene); drawFarmhouse(scene); drawShed(scene);
  drawWindmill(scene); drawWindmillBlade(scene); drawTurbine(scene); drawTurbineBlade(scene);
  drawHay(scene); drawOrchard(scene); drawPumpkin(scene); drawFence(scene); drawGatePost(scene);
  drawBridge(scene); drawMazeSign(scene); drawCornFlat(scene);
}
