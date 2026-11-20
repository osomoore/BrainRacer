/**
 * Farm renderer extras (package farm-render): looks for signed farm lots that have no FarmDecoration
 * (well, lake boathouse, campsite, cave, forest) plus the filler pieces that make farm buildings fill
 * their square BuildingLots (barn lean-to, farmhouse porch, concrete pad, windmill mound).
 * Top-down, no baked shadows (the renderer casts long directional ones), deterministic.
 */
import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ellipse, fillStroke, hash, lin, makeCanvas, OUTLINE, poly, radial, rr, type Ctx } from './draw';

const K = TEX.farm;
const WOOD = '#a56a36', WOOD_D = '#6f4423', WOOD_L = '#d19a5c';
const STONE = '#b9b4a8', STONE_D = '#8a857b', STONE_L = '#dcd8cc';

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

/** Ring of rounded stones around (cx, cy). */
function stoneRing(ctx: Ctx, cx: number, cy: number, r: number, n: number, size: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = size * (0.85 + hash(i, 1, seed) * 0.3);
    ellipse(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, s * 0.8);
    fillStroke(ctx, i % 3 === 0 ? STONE_L : i % 3 === 1 ? STONE : STONE_D, OUTLINE, 2);
  }
}

/** Two-slope roof seen from above with the ridge along x. */
function gable(ctx: Ctx, x: number, y: number, w: number, h: number, lit: string, shade: string, tick: string): void {
  rr(ctx, x, y, w, h, 6); fillStroke(ctx, shade, OUTLINE, 3.5);
  ctx.save(); rr(ctx, x, y, w, h, 6); ctx.clip();
  rect(ctx, x, y, w, h / 2, lit);
  for (let yy = y + 10; yy < y + h; yy += 10) line(ctx, x, yy, x + w, yy, 1.4, tick);
  ctx.restore();
  rect(ctx, x + 2, y + h / 2 - 3, w - 4, 6, '#00000033');
  rr(ctx, x, y, w, h, 6); ctx.lineWidth = 3.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
}

function drawWell(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.well, 128, 128);
  disc(ctx, 64, 64, 50, '#9ccf5a', null);                       // trampled grass
  disc(ctx, 64, 64, 38, radial(ctx, 64, 64, 4, 34, [[0, '#1b4d78'], [1, '#2f7fb5']]), OUTLINE, 3);
  disc(ctx, 58, 58, 6, '#ffffff55', null);
  stoneRing(ctx, 64, 64, 38, 16, 9, 7);
  // little wooden roof on two posts across the well
  rr(ctx, 30, 52, 68, 24, 4); fillStroke(ctx, lin(ctx, 0, 52, 0, 76, [[0, '#d9593f'], [0.5, '#d9593f'], [0.5, '#a5352b'], [1, '#a5352b']]), OUTLINE, 3);
  line(ctx, 32, 64, 96, 64, 3, '#7d201c');
  for (const x of [26, 102]) { rr(ctx, x - 6, 58, 12, 12, 3); fillStroke(ctx, WOOD_D, OUTLINE, 2); }
  // bucket
  disc(ctx, 64, 92, 8, '#8d97a6', OUTLINE, 2);
  disc(ctx, 64, 92, 4, '#2f7fb5', null);
  done();
}

function tent(ctx: Ctx, cx: number, cy: number, w: number, h: number, rot: number, lit: string, shade: string): void {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  poly(ctx, [-w / 2, -h / 2, w / 2, -h / 2, w / 2 + 6, 0, w / 2, h / 2, -w / 2, h / 2, -w / 2 - 6, 0]);
  fillStroke(ctx, shade, OUTLINE, 3);
  poly(ctx, [-w / 2, -h / 2, w / 2, -h / 2, w / 2 + 6, 0, -w / 2 - 6, 0]);
  fillStroke(ctx, lit, null);
  line(ctx, -w / 2 - 6, 0, w / 2 + 6, 0, 3, OUTLINE);
  // door flap
  poly(ctx, [w / 2 - 2, -10, w / 2 + 6, 0, w / 2 - 2, 10]);
  fillStroke(ctx, '#3b2a2a', null);
  ctx.restore();
}

function drawCampsite(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.campsite, 256, 256);
  // dirt clearing
  ellipse(ctx, 128, 128, 116, 112); fillStroke(ctx, '#c7a46c', null);
  for (let i = 0; i < 40; i++) disc(ctx, 20 + hash(i, 1, 31) * 216, 20 + hash(i, 2, 31) * 216, 1.5 + hash(i, 3, 31) * 2.5, i % 2 ? '#a8864f' : '#dcc08a', null);
  tent(ctx, 78, 74, 92, 64, -0.25, '#ff9a3c', '#d9682a');
  tent(ctx, 184, 102, 80, 56, 0.35, '#4fb4e8', '#2f82bf');
  // log benches + campfire
  for (const [x, y, r] of [[104, 186, 0.2], [172, 196, -0.4]] as const) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r);
    rr(ctx, -30, -8, 60, 16, 7); fillStroke(ctx, lin(ctx, 0, -8, 0, 8, [[0, WOOD_L], [1, WOOD]]), OUTLINE, 2.5);
    disc(ctx, 27, 0, 6, '#e8c08a', OUTLINE, 2);
    ctx.restore();
  }
  stoneRing(ctx, 140, 156, 22, 10, 7, 9);
  disc(ctx, 140, 156, 15, '#3a2a22', null);
  for (let i = 0; i < 4; i++) line(ctx, 140 - 12 * Math.cos(i), 156 - 12 * Math.sin(i), 140 + 12 * Math.cos(i), 156 + 12 * Math.sin(i), 4, WOOD_D);
  disc(ctx, 140, 156, 10, radial(ctx, 140, 156, 1, 11, [[0, '#fff3a0'], [0.5, '#ffb43a'], [1, '#ff6a2a']]), null);
  done();
}

function drawCave(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.cave, 256, 256);
  // rocky hill: overlapping boulders, lit from the west (afternoon sun)
  const rocks: [number, number, number][] = [
    [128, 120, 92], [70, 90, 52], [186, 84, 54], [60, 170, 48], [196, 168, 50], [128, 60, 50], [128, 196, 46],
  ];
  for (const [x, y, r] of rocks) disc(ctx, x, y, r, '#7b7468', OUTLINE, 4);
  for (const [x, y, r] of rocks) disc(ctx, x - r * 0.12, y - r * 0.08, r * 0.86, radial(ctx, x - r * 0.4, y - r * 0.3, 2, r, [[0, '#d5cfc2'], [1, '#958e80']]), null);
  for (let i = 0; i < 14; i++) {
    const x = 40 + hash(i, 1, 51) * 176, y = 40 + hash(i, 2, 51) * 176;
    line(ctx, x, y, x + 8 + hash(i, 3, 51) * 10, y + 4, 2, '#00000030');
  }
  // moss patches
  for (let i = 0; i < 7; i++) disc(ctx, 50 + hash(i, 4, 51) * 150, 40 + hash(i, 5, 51) * 160, 8 + hash(i, 6, 51) * 8, '#6aa63a99', null);
  // dark cave mouth opening toward +y (south), with a sandy floor in front
  ellipse(ctx, 128, 214, 46, 24); fillStroke(ctx, '#c7a46c', null);
  ctx.beginPath();
  ctx.moveTo(88, 214); ctx.quadraticCurveTo(90, 150, 128, 146); ctx.quadraticCurveTo(166, 150, 168, 214); ctx.closePath();
  fillStroke(ctx, radial(ctx, 128, 200, 4, 60, [[0, '#05060a'], [1, '#2a2620']]), OUTLINE, 4);
  // a few glowing crystals for fun
  for (const [x, y, c] of [[112, 196, '#7fe0ff'], [146, 190, '#c78bff'], [130, 176, '#7fffb0']] as const) {
    poly(ctx, [x, y - 8, x + 4, y, x, y + 6, x - 4, y]); fillStroke(ctx, c, null);
  }
  done();
}

function pine(ctx: Ctx, x: number, y: number, r: number, seed: number): void {
  const layers = [[1, '#1f5e2c'], [0.74, '#2c7a36'], [0.48, '#3d9443'], [0.24, '#58b050']] as const;
  for (const [k, c] of layers) {
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + hash(seed, 1, 3);
      const rr2 = r * k * (i % 2 ? 0.62 : 1);
      const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    fillStroke(ctx, c, k === 1 ? OUTLINE : null, 3);
  }
  disc(ctx, x, y, 3, '#7a4a22', null);
}

function drawPines(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.pines, 256, 128);
  ellipse(ctx, 128, 64, 124, 60); fillStroke(ctx, '#5f8f3a', null);  // needle carpet
  for (const [x, y, r, s] of [[60, 62, 52, 1], [140, 46, 42, 2], [198, 74, 48, 3], [116, 92, 34, 4]] as const) pine(ctx, x, y, r, s);
  done();
}

function drawBoathouse(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.boathouse, 256, 128);
  // wooden jetty along the bottom
  rr(ctx, 4, 70, 248, 52, 4); fillStroke(ctx, WOOD_D, OUTLINE, 3);
  for (let x = 8; x < 248; x += 14) { rect(ctx, x, 74, 12, 44, x % 28 === 8 ? '#c4915a' : '#b8844d'); rect(ctx, x, 74, 2, 44, '#ffffff33'); }
  // little boathouse with a teal roof
  gable(ctx, 18, 8, 140, 86, '#47b8b0', '#2f8a86', '#00000026');
  // red rowboat moored at the jetty
  ctx.save(); ctx.translate(206, 50); ctx.rotate(-0.15);
  ellipse(ctx, 0, 0, 40, 15); fillStroke(ctx, '#e6503d', OUTLINE, 3);
  ellipse(ctx, 0, 0, 32, 10); fillStroke(ctx, '#f6d29a', null);
  for (const dx of [-12, 12]) rect(ctx, dx - 2, -10, 4, 20, WOOD);
  ctx.restore();
  // life ring
  disc(ctx, 176, 104, 10, '#ffffff', OUTLINE, 2);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(176, 104, 10, i * Math.PI / 2, i * Math.PI / 2 + 0.6); ctx.lineWidth = 5; ctx.strokeStyle = '#e6503d'; ctx.stroke(); }
  disc(ctx, 176, 104, 4, '#2f7fb5', null);
  done();
}

function drawLeanTo(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.leanTo, 384, 128);
  // single-slope tin roof sloping away from the barn (top edge = against the barn wall)
  rr(ctx, 10, 0, 364, 104, 6);
  fillStroke(ctx, lin(ctx, 0, 0, 0, 104, [[0, '#c9d1d9'], [1, '#8b97a3']]), OUTLINE, 4);
  ctx.save(); rr(ctx, 10, 0, 364, 104, 6); ctx.clip();
  for (let x = 18; x < 374; x += 12) { rect(ctx, x, 0, 4, 104, '#ffffff30'); rect(ctx, x + 6, 0, 2, 104, '#00000022'); }
  rect(ctx, 10, 0, 364, 8, '#00000033');
  ctx.restore();
  rr(ctx, 10, 0, 364, 104, 6); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  // a couple of square bales peeking out of the open side
  for (const x of [40, 300]) { rr(ctx, x, 106, 44, 18, 3); fillStroke(ctx, '#e6c25a', OUTLINE, 2); line(ctx, x + 4, 115, x + 40, 115, 1.5, '#b8902f'); }
  done();
}

function drawPorch(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.porch, 256, 64);
  rr(ctx, 12, 0, 232, 52, 4); fillStroke(ctx, WOOD, OUTLINE, 3);
  for (let x = 16; x < 242; x += 12) { rect(ctx, x, 2, 10, 48, x % 24 === 16 ? '#d6a46a' : '#c99558'); rect(ctx, x, 2, 2, 48, '#ffffff33'); }
  // steps
  rr(ctx, 104, 46, 48, 16, 3); fillStroke(ctx, WOOD_L, OUTLINE, 2.5);
  line(ctx, 106, 54, 150, 54, 1.5, WOOD_D);
  // rocking chairs + flower pots
  for (const x of [44, 196]) { rr(ctx, x - 12, 14, 24, 22, 5); fillStroke(ctx, '#ffffff', OUTLINE, 2.5); rect(ctx, x - 8, 18, 16, 6, '#e6503d'); }
  for (const x of [80, 176]) { disc(ctx, x, 26, 8, '#b5562f', OUTLINE, 2); disc(ctx, x, 26, 5, '#e85fa0', null); }
  done();
}

function drawPad(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.pad, 128, 128);
  rr(ctx, 4, 4, 120, 120, 10); fillStroke(ctx, lin(ctx, 4, 4, 124, 124, [[0, '#e3ddd0'], [1, '#bdb6a6']]), OUTLINE, 3);
  line(ctx, 64, 8, 64, 120, 1.5, '#00000022'); line(ctx, 8, 64, 120, 64, 1.5, '#00000022');
  for (let i = 0; i < 30; i++) disc(ctx, 10 + hash(i, 1, 61) * 108, 10 + hash(i, 2, 61) * 108, 1.2, '#00000018', null);
  done();
}

function drawWindmillBase(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, K.windmillBase, 256, 256);
  // grassy knoll with a stone apron ring and a little path
  disc(ctx, 128, 128, 124, radial(ctx, 100, 96, 10, 130, [[0, '#a6d860'], [1, '#6faa3e']]), null);
  for (let i = 0; i < 6; i++) disc(ctx, 50 + hash(i, 1, 71) * 156, 50 + hash(i, 2, 71) * 156, 3, i % 2 ? '#fff6b0' : '#ffd24a', null);
  disc(ctx, 128, 128, 92, '#d9cfb8', OUTLINE, 3);
  stoneRing(ctx, 128, 128, 92, 30, 9, 13);
  rr(ctx, 109, 180, 38, 73, 5); fillStroke(ctx, '#cab28a', '#927453', 2);
  for (let y = 184; y < 250; y += 10) line(ctx, 111, y, 145, y, 1.5, '#a78b64');
  done();
}

export function drawFarmExtras(scene: Phaser.Scene): void {
  drawWell(scene); drawCampsite(scene); drawCave(scene); drawPines(scene); drawBoathouse(scene);
  drawLeanTo(scene); drawPorch(scene); drawPad(scene); drawWindmillBase(scene);
}
