import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { TILE_SIZE } from '../config/gameConfig';
import { OUTLINE, ellipse, fillStroke, lin, makeCanvas, poly, rr, seeded, wrap, type Ctx } from './draw';

const S = TILE_SIZE;

/** Scatter n tiny speckles (wrapped, so tileable). */
function speckle(ctx: Ctx, seed: number, n: number, colors: string[], minR: number, maxR: number): void {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = minR + r() * (maxR - minR);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    wrap(S, x, y, rad, (px, py) => { ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.fill(); });
  }
}

export function drawWater(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tileWater, S, S);
  // vertical-periodic gradient so it tiles: flat base plus soft blobs
  ctx.fillStyle = '#2f93e8'; ctx.fillRect(0, 0, S, S);
  const r = seeded(11);
  for (let i = 0; i < 7; i++) {
    const x = r() * S, y = r() * S, rad = 26 + r() * 26;
    wrap(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 2, px, py, rad);
      g.addColorStop(0, i % 2 ? 'rgba(90,190,255,0.35)' : 'rgba(20,90,200,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  ctx.lineCap = 'round';
  const waves: [number, number, number][] = [[18, 22, 30], [80, 12, 26], [52, 56, 34], [110, 70, 24], [20, 96, 28], [74, 108, 32]];
  for (const [x, y, w] of waves) {
    wrap(S, x, y, w, (px, py) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(px - w / 2, py);
      ctx.bezierCurveTo(px - w / 4, py - 7, px, py + 7, px + w / 2, py - 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(15,70,170,0.28)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px - w / 2 + 3, py + 6);
      ctx.bezierCurveTo(px - w / 4, py - 1, px, py + 13, px + w / 2 - 3, py + 5); ctx.stroke();
    });
  }
  done();
}

function blades(ctx: Ctx, seed: number, n: number, cols: string[], len: number): void {
  const r = seeded(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, l = len * (0.6 + r() * 0.6), lean = (r() - 0.5) * 6;
    ctx.strokeStyle = cols[Math.floor(r() * cols.length)]; ctx.lineWidth = 2;
    wrap(S, x, y, l + 4, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + lean, py - l); ctx.stroke(); });
  }
}

export function drawGrass(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tileGrass, S, S);
  ctx.fillStyle = '#5cc94a'; ctx.fillRect(0, 0, S, S);
  const r = seeded(21);
  for (let i = 0; i < 9; i++) {
    const x = r() * S, y = r() * S, rad = 22 + r() * 20;
    wrap(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 2, px, py, rad);
      g.addColorStop(0, i % 2 ? 'rgba(130,230,90,0.4)' : 'rgba(40,150,50,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  blades(ctx, 22, 80, ['#3fa83a', '#4fbb40', '#7bdc5a', '#98ea6c'], 9);
  speckle(ctx, 23, 26, ['#a8f07c', '#2f8f33'], 1, 1.8);
  done();
}

export function drawSidewalk(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tileSidewalk, S, S);
  const slab = S / 2;
  for (let gx = 0; gx < 2; gx++) for (let gy = 0; gy < 2; gy++) {
    const shade = 218 + ((gx * 3 + gy * 5) % 3) * 6;
    ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 6})`;
    ctx.fillRect(gx * slab, gy * slab, slab, slab);
  }
  speckle(ctx, 31, 40, ['rgba(130,135,150,0.35)', 'rgba(255,255,255,0.6)'], 0.8, 1.6);
  // grout lines (wrapped on edges)
  ctx.fillStyle = '#9aa0b0';
  for (const p of [0, slab]) {
    ctx.fillRect(p - 2, 0, 4, S); ctx.fillRect(0, p - 2, S, 4);
    ctx.fillRect(p + 2, 0, 1.5, S); ctx.fillRect(0, p + 2, S, 1.5);
  }
  ctx.fillStyle = '#9aa0b0'; ctx.fillRect(S - 2, 0, 2, S); ctx.fillRect(0, S - 2, S, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const p of [0, slab]) { ctx.fillRect(p + 3, 0, 1.5, S); ctx.fillRect(0, p + 3, S, 1.5); }
  done();
}

function flower(ctx: Ctx, x: number, y: number, petal: string, center: string, r: number): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.9, r * 0.9);
    fillStroke(ctx, petal, 'rgba(60,40,60,0.55)', 1);
  }
  ellipse(ctx, x, y, r * 0.7, r * 0.7); fillStroke(ctx, center, 'rgba(90,60,0,0.5)', 1);
}

export function drawPark(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tilePark, S, S);
  ctx.fillStyle = '#3db84a'; ctx.fillRect(0, 0, S, S);
  const r = seeded(41);
  for (let i = 0; i < 12; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 20;
    wrap(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 2, px, py, rad);
      g.addColorStop(0, i % 2 ? 'rgba(120,235,100,0.45)' : 'rgba(10,110,50,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  blades(ctx, 42, 110, ['#238f3a', '#2fa843', '#6ee06a', '#a5f58a'], 10);
  const petals = ['#ff6fa8', '#ffe14d', '#ffffff', '#ff9a3c', '#c58cff'];
  for (let i = 0; i < 12; i++) {
    const x = r() * S, y = r() * S, p = petals[i % petals.length];
    wrap(S, x, y, 6, (px, py) => flower(ctx, px, py, p, i % 5 === 2 ? '#ffd23a' : '#fff3a0', 2.4));
  }
  done();
}

export function drawPlaza(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tilePlaza, S, S);
  ctx.fillStyle = '#b86b45'; ctx.fillRect(0, 0, S, S);
  const rowH = 16, bw = 32;
  const r = seeded(51);
  for (let row = 0; row < S / rowH; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let b = -1; b < S / bw + 1; b++) {
      const x = b * bw + off, y = row * rowH;
      const t = r();
      const col = t < 0.33 ? '#e39a66' : t < 0.66 ? '#d98a58' : '#eaa877';
      // tile pattern needs wrap-around consistency: draw with fixed palette by (row, brick idx mod)
      const bi = ((b % 4) + 4) % 4;
      const c2 = [ '#e39a66', '#d98a58', '#eaa877', '#dd9560'][(bi + row * 3) % 4];
      void col;
      ctx.fillStyle = c2;
      rr(ctx, x + 1.5, y + 1.5, bw - 3, rowH - 3, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,210,0.35)'; ctx.fillRect(x + 3, y + 2.5, bw - 7, 2);
      ctx.fillStyle = 'rgba(110,50,30,0.25)'; ctx.fillRect(x + 3, y + rowH - 4.5, bw - 7, 2);
    }
  }
  done();
}

export function drawDirt(scene: Phaser.Scene): void {
  const { ctx, done } = makeCanvas(scene, TEX.tileDirt, S, S);
  ctx.fillStyle = '#b98a54'; ctx.fillRect(0, 0, S, S);
  const r = seeded(61);
  for (let i = 0; i < 12; i++) {
    const x = r() * S, y = r() * S, rad = 18 + r() * 24;
    wrap(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 2, px, py, rad);
      g.addColorStop(0, i % 2 ? 'rgba(220,180,120,0.5)' : 'rgba(110,70,35,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  speckle(ctx, 62, 50, ['#8a5f34', '#d6aa72', '#6d4a28'], 1, 2.2);
  for (let i = 0; i < 9; i++) {
    const x = r() * S, y = r() * S, rad = 3 + r() * 3;
    wrap(S, x, y, rad + 2, (px, py) => { ellipse(ctx, px, py, rad, rad * 0.75); fillStroke(ctx, i % 2 ? '#a9a39a' : '#c4a67a', 'rgba(70,45,20,0.55)', 1.2); });
  }
  done();
}

// ---------------------------------------------------------------- roofs
function roofBase(ctx: Ctx, a: string, b: string): void {
  ctx.fillStyle = lin(ctx, 0, 0, S, S, [[0, a], [1, b]]);
  ctx.fillRect(0, 0, S, S);
}

function vent(ctx: Ctx, x: number, y: number, r: number): void {
  ellipse(ctx, x + 2, y + 3, r, r); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ellipse(ctx, x, y, r, r); fillStroke(ctx, lin(ctx, x - r, y - r, x + r, y + r, [[0, '#f3f5f8'], [1, '#98a0b0']]), OUTLINE, 2.5);
  ellipse(ctx, x, y, r * 0.55, r * 0.55); fillStroke(ctx, '#5b6275', OUTLINE, 1.5);
}

function acUnit(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rr(ctx, x + 3, y + 4, w, h, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  rr(ctx, x, y, w, h, 4); fillStroke(ctx, lin(ctx, x, y, x + w, y + h, [[0, '#eef1f6'], [1, '#a6aebe']]), OUTLINE, 2.5);
  ellipse(ctx, x + w * 0.3, y + h / 2, h * 0.32, h * 0.32); fillStroke(ctx, '#6a7286', OUTLINE, 1.5);
  ellipse(ctx, x + w * 0.7, y + h / 2, h * 0.32, h * 0.32); fillStroke(ctx, '#6a7286', OUTLINE, 1.5);
}

export function drawRoofs(scene: Phaser.Scene): void {
  // 0: gray gravel with vents
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[0], S, S);
    roofBase(ctx, '#9aa1ad', '#868d9a');
    speckle(ctx, 70, 150, ['#c7ccd4', '#6e7480', '#b3b9c3'], 0.8, 1.8);
    vent(ctx, 36, 40, 13); vent(ctx, 92, 92, 11);
    done();
  }
  // 1: terracotta rows
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[1], S, S);
    ctx.fillStyle = '#c4553b'; ctx.fillRect(0, 0, S, S);
    for (let row = 0; row < 8; row++) {
      const y = row * 16, off = row % 2 ? 8 : 0;
      for (let x = -16; x < S + 16; x += 16) {
        ctx.fillStyle = (row + x / 16) % 3 === 0 ? '#e4694a' : '#d65c40';
        rr(ctx, x + off + 0.5, y + 0.5, 15, 15, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,170,0.4)'; ctx.fillRect(x + off + 3, y + 2, 9, 2);
        ctx.fillStyle = 'rgba(100,20,10,0.35)'; ctx.fillRect(x + off + 2, y + 12, 11, 2.5);
      }
    }
    done();
  }
  // 2: blue metal sheet with AC units
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[2], S, S);
    roofBase(ctx, '#5f86c2', '#4a6fa8');
    for (let x = 0; x < S; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1, 0, 3, S);
      ctx.fillStyle = 'rgba(10,30,80,0.3)'; ctx.fillRect(x + 12, 0, 3, S);
    }
    acUnit(ctx, 14, 16, 46, 32); acUnit(ctx, 66, 76, 46, 32);
    done();
  }
  // 3: green roof with skylights
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[3], S, S);
    roofBase(ctx, '#7bb35a', '#62a04a');
    speckle(ctx, 73, 120, ['#a4d97c', '#4f8a3c', '#8bc864'], 1, 2.4);
    for (const [x, y] of [[18, 18], [76, 70]] as [number, number][]) {
      rr(ctx, x + 3, y + 4, 34, 34, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      rr(ctx, x, y, 34, 34, 4); fillStroke(ctx, lin(ctx, x, y, x + 34, y + 34, [[0, '#d6f2ff'], [1, '#6fb6e6']]), OUTLINE, 2.5);
      ctx.strokeStyle = 'rgba(30,70,110,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 17, y); ctx.lineTo(x + 17, y + 34); ctx.moveTo(x, y + 17); ctx.lineTo(x + 34, y + 17); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; poly(ctx, [x + 4, y + 4, x + 13, y + 4, x + 4, y + 13]); ctx.fill();
    }
    done();
  }
  // 4: sandy with solar panels
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[4], S, S);
    roofBase(ctx, '#e3cd9a', '#d2ba84');
    speckle(ctx, 74, 90, ['#f3e3b8', '#b89f6a'], 0.8, 1.6);
    for (const [x, y] of [[10, 12], [10, 70]] as [number, number][]) {
      rr(ctx, x + 3, y + 4, 108, 44, 3); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      rr(ctx, x, y, 108, 44, 3); fillStroke(ctx, lin(ctx, x, y, x + 108, y + 44, [[0, '#2f5aa8'], [1, '#17306b']]), OUTLINE, 2.5);
      ctx.strokeStyle = 'rgba(160,200,255,0.55)'; ctx.lineWidth = 1.2;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * 18, y + 1); ctx.lineTo(x + i * 18, y + 43); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x + 1, y + 22); ctx.lineTo(x + 107, y + 22); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; poly(ctx, [x + 2, y + 2, x + 40, y + 2, x + 2, y + 20]); ctx.fill();
    }
    done();
  }
  // 5: purple checker with chimney
  {
    const { ctx, done } = makeCanvas(scene, TEX.roof[5], S, S);
    for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 8; gy++) {
      ctx.fillStyle = (gx + gy) % 2 ? '#8c6ad0' : '#a584e6'; ctx.fillRect(gx * 16, gy * 16, 16, 16);
    }
    ctx.strokeStyle = 'rgba(40,10,90,0.18)'; ctx.lineWidth = 1;
    for (let i = 0; i <= S; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
    rr(ctx, 40, 38, 30, 30, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.translate(3, 4); ctx.fill(); ctx.translate(-3, -4);
    rr(ctx, 40, 38, 30, 30, 3); fillStroke(ctx, lin(ctx, 40, 38, 70, 68, [[0, '#d98a6c'], [1, '#a65a42']]), OUTLINE, 2.5);
    rr(ctx, 47, 45, 16, 16, 2); fillStroke(ctx, '#2a2330', OUTLINE, 1.5);
    vent(ctx, 98, 100, 10); vent(ctx, 22, 96, 8);
    done();
  }
}
