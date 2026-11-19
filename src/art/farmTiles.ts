import { hash, wrap, type Ctx } from './draw';
import { roadPlan } from './roads';

/**
 * Farm tileset atlas index mapping (consumed by the farm renderer via `farmTileSource`).
 * Every tile is 128 x 128 logical px (scaled to the `size` passed in) and tiles seamlessly.
 *   0            open water (pond / stream)
 *   1..3         grass variants (golden-hour green)
 *   4            dirt lane (plain, no direction)
 *   5            farmyard gravel / dirt
 *   6, 7, 8      standing corn: 6 rows along x, 7 rows along y, 8 ripe golden rows along x
 *   9            mown path through corn (full speed)
 *   10           flattened corn (opaque tile: stalks lying down on soil)
 *   11           mud
 *   12..27       paved country road, 12 + roadMask (N=1 E=2 S=4 W=8, same masks as city roads)
 *   28..43       water with grassy banks, 28 + landMask (bit set = grass bank on that side; N=1 E=2 S=4 W=8)
 */
export const FARM_TILE = {
  water: 0, grass: 1, grass2: 2, grass3: 3, dirtLane: 4, yard: 5,
  corn: 6, cornVertical: 7, cornRipe: 8, mown: 9, cornFlat: 10, mud: 11,
  roadBase: 12, waterBankBase: 28,
} as const;
export const FARM_TILE_COUNT = 44;

const S = 128;
const GRASS = ['#7dba45', '#85c04a', '#76b241'];

function fill(ctx: Ctx, color: string | CanvasGradient, x = 0, y = 0, w = S, h = S): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function grass(ctx: Ctx, variant: number): void {
  fill(ctx, GRASS[variant % 3]);
  const seed = 40 + variant;
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 1, seed) * S, y = hash(i, 2, seed) * S, r = 16 + hash(i, 3, seed) * 22;
    const c = hash(i, 4, seed) < 0.5 ? '#92c955' : '#6aa63a';
    wrap(S, x, y, r, (px, py) => blob(ctx, px, py, r, r * 0.7, hash(i, 5, seed) * 3, c + '55'));
  }
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 6, seed) * S, y = hash(i, 7, seed) * S;
    const c = hash(i, 8, seed) < 0.5 ? '#b2db6a' : '#5b9a33';
    wrap(S, x, y, 4, (px, py) => { fill(ctx, c, px, py, 1.5, 4); fill(ctx, c, px + 3, py + 1, 1.5, 3); });
  }
  if (variant === 2) {
    for (let i = 0; i < 7; i++) {
      const x = hash(i, 9, seed) * S, y = hash(i, 10, seed) * S;
      wrap(S, x, y, 4, (px, py) => { blob(ctx, px, py, 2.5, 2.5, 0, i % 2 ? '#fff6b0' : '#ffd24a'); });
    }
  }
}

function pebbles(ctx: Ctx, n: number, seed: number, light: string, dark: string, maxR = 3): void {
  for (let i = 0; i < n; i++) {
    const x = hash(i, 1, seed) * S, y = hash(i, 2, seed) * S, r = 1 + hash(i, 3, seed) * maxR;
    const c = hash(i, 4, seed) < 0.5 ? light : dark;
    wrap(S, x, y, r, (px, py) => blob(ctx, px, py, r, r * 0.75, hash(i, 5, seed) * 3, c));
  }
}

function dirt(ctx: Ctx, base: string, light: string, dark: string, seed: number, stones: number): void {
  fill(ctx, base);
  for (let i = 0; i < 12; i++) {
    const x = hash(i, 1, seed) * S, y = hash(i, 2, seed) * S, r = 14 + hash(i, 3, seed) * 20;
    wrap(S, x, y, r, (px, py) => blob(ctx, px, py, r, r * 0.6, hash(i, 4, seed) * 3, (i % 2 ? light : dark) + '44'));
  }
  pebbles(ctx, stones, seed + 9, light, dark);
}

function plant(ctx: Ctx, x: number, y: number, seed: number, ripe: boolean): void {
  const rot = hash(x | 0, y | 0, seed) * 6;
  blob(ctx, x + 2, y + 3, 14, 14, 0, '#1f4a1655');
  const dark = ripe ? '#6f9a2a' : '#2f7a27', mid = ripe ? '#a6c23d' : '#4e9f32', lite = ripe ? '#d7d96a' : '#8bd04a';
  for (let k = 0; k < 7; k++) {
    const a = rot + (k * Math.PI * 2) / 7;
    for (const [len, w, col] of [[15, 4.4, dark], [11, 3.4, mid]] as const) {
      ctx.save();
      ctx.translate(x - 1, y - 1);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(len * 0.55, 0, len * 0.55, w * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  blob(ctx, x - 2, y - 2, 4.5, 4.5, 0, lite);
  blob(ctx, x - 3, y - 3, 2.2, 2.2, 0, ripe ? '#fff0a0' : '#e3f58a');
  // tassel
  blob(ctx, x, y, 2.4, 2.4, 0, '#f0cf4e');
}

function corn(ctx: Ctx, variant: number): void {
  const vertical = variant === 1, ripe = variant === 2;
  fill(ctx, ripe ? '#6e5230' : '#5e3f25');
  ctx.save();
  if (vertical) { ctx.translate(S, 0); ctx.rotate(Math.PI / 2); }
  for (let r = 0; r < 4; r++) {
    const cy = 16 + r * 32;
    fill(ctx, '#46301c', 0, cy - 15, S, 30);
    for (let c = 0; c < 8; c++) {
      const cx = 8 + c * 16 + (r % 2) * 3;
      wrap(S, cx, cy, 16, (px, py) => plant(ctx, px, py, 70 + variant, ripe));
    }
  }
  ctx.restore();
}

function mown(ctx: Ctx): void {
  fill(ctx, '#c9a456');
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 1, 90) * S, y = hash(i, 2, 90) * S;
    const c = i % 3 === 0 ? '#e2c673' : i % 3 === 1 ? '#a98338' : '#d3b160';
    wrap(S, x, y, 10, (px, py) => fill(ctx, c, px, py, 6 + hash(i, 3, 90) * 8, 2));
  }
  pebbles(ctx, 14, 91, '#7f5f2a', '#e9d48a', 1.6);
}

function cornFlat(ctx: Ctx): void {
  fill(ctx, '#5e4228');
  const stalk = (x: number, y: number, a: number, len: number, col: string, lw: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, lw * 0.6, len / 2, 0);
    ctx.stroke();
    ctx.restore();
  };
  for (let i = 0; i < 46; i++) {
    const x = hash(i, 1, 120) * S, y = hash(i, 2, 120) * S;
    const a = (hash(i, 3, 120) - 0.5) * 1.1 + (i % 2 ? 0.2 : -0.2);
    const col = ['#9bbd4a', '#b6cf5c', '#85a83e', '#cfd77a'][i % 4];
    wrap(S, x, y, 24, (px, py) => {
      stalk(px, py, a, 40, col, 6);
      stalk(px, py - 1, a, 30, '#e4ec9a88', 1.6);
      stalk(px + 5, py + 4, a + 0.5, 20, '#6f9334', 3.5);
    });
  }
}

function mud(ctx: Ctx): void {
  fill(ctx, '#80553a');
  for (let i = 0; i < 9; i++) {
    const x = hash(i, 1, 140) * S, y = hash(i, 2, 140) * S, r = 14 + hash(i, 3, 140) * 18;
    wrap(S, x, y, r, (px, py) => {
      blob(ctx, px, py, r, r * 0.7, hash(i, 4, 140) * 3, '#5d3b25');
      blob(ctx, px - 2, py - 3, r * 0.78, r * 0.5, 0, '#6b452c');
      blob(ctx, px - r * 0.3, py - r * 0.3, r * 0.22, r * 0.1, 0.5, '#c79a6fcc');
    });
  }
  pebbles(ctx, 18, 141, '#9b7552', '#4b2f1c', 1.8);
}

function water(ctx: Ctx): void {
  fill(ctx, '#3a9fd6');
  for (let i = 0; i < 10; i++) {
    const x = hash(i, 1, 160) * S, y = hash(i, 2, 160) * S, r = 14 + hash(i, 3, 160) * 20;
    wrap(S, x, y, r, (px, py) => blob(ctx, px, py, r, r * 0.55, 0, (i % 2 ? '#2f8cc4' : '#58b4e2') + '66'));
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = hash(i, 4, 160) * S, y = hash(i, 5, 160) * S, w = 8 + hash(i, 6, 160) * 14;
    wrap(S, x, y, w, (px, py) => {
      ctx.strokeStyle = i % 3 === 0 ? '#ffffffa0' : '#a9e4f5aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - w / 2, py);
      ctx.quadraticCurveTo(px, py - 3, px + w / 2, py);
      ctx.stroke();
    });
  }
}

function waterBank(ctx: Ctx, landMask: number): void {
  water(ctx);
  for (let side = 0; side < 4; side++) {
    if (!(landMask & (1 << side))) continue;
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-S / 2, -S / 2);
    const edge = (x: number): number => 22 + 5 * Math.sin((x / S) * Math.PI * 4) + 3 * Math.sin((x / S) * Math.PI * 6 + 1);
    const path = (): void => {
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      for (let x = -6; x <= S + 6; x += 4) ctx.lineTo(x, edge(x));
      ctx.lineTo(S + 6, -6);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = '#2b7fb3';  // dark rim of water under the bank
    ctx.save(); ctx.translate(0, 5); ctx.fill(); ctx.restore();
    path();
    ctx.fillStyle = '#e3cf8c';  // sandy shore
    ctx.save(); ctx.translate(0, 2); ctx.fill(); ctx.restore();
    path();
    ctx.fillStyle = GRASS[0];
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const x = hash(i, 1, 170 + side) * S, y = hash(i, 2, 170 + side) * 14;
      fill(ctx, i % 2 ? '#a6d45e' : '#5f9d35', x, y, 2, 5);
    }
    ctx.restore();
  }
}

function asphaltRegion(ctx: Ctx, shape: string, k: number): void {
  const e = 10, C = S / 2;
  ctx.beginPath();
  switch (shape) {
    case 'none': ctx.roundRect(k, k, S - 2 * k, S - 2 * k, 24); break;
    case 'dead':
      ctx.moveTo(k, -e); ctx.lineTo(S - k, -e); ctx.lineTo(S - k, C);
      ctx.arc(C, C, C - k, 0, Math.PI); ctx.closePath(); break;
    case 'straight': ctx.rect(k, -e, S - 2 * k, S + 2 * e); break;
    case 'corner': ctx.roundRect(k, -e, S - k + e, S - k + e, [0, 0, 0, 44]); break;
    case 'tee': ctx.rect(-e, -e, S + 2 * e, S - k + e); break;
    default: ctx.rect(-e, -e, S + 2 * e, S + 2 * e);
  }
}

function road(ctx: Ctx, mask: number): void {
  grass(ctx, 0);
  const { shape, rot } = roadPlan(mask);
  const C = S / 2;
  ctx.save();
  ctx.translate(C, C); ctx.rotate((rot * Math.PI) / 2); ctx.translate(-C, -C);
  ctx.lineJoin = 'round';
  asphaltRegion(ctx, shape, 14);                       // gravel shoulder
  ctx.fillStyle = '#d6bf8a'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#d6bf8a'; ctx.stroke();
  asphaltRegion(ctx, shape, 20);
  ctx.save();
  ctx.clip();
  fill(ctx, '#6b6a72', -S, -S, S * 3, S * 3);
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(hash(i, 1, 7) * S), y = Math.floor(hash(i, 2, 7) * S);
    ctx.fillStyle = hash(i, 3, 7) < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(30,20,20,0.16)';
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) ctx.fillRect(x + dx, y + dy, 2, 2);
  }
  ctx.restore();
  asphaltRegion(ctx, shape, 20);
  ctx.lineWidth = 2; ctx.strokeStyle = '#f2e6c4'; ctx.stroke();  // pale edge line
  ctx.fillStyle = '#ffd23a';
  const dash = (x: number, y0: number, y1: number): void => {
    for (let b = 0; b < S; b += 64) {
      const a = Math.max(y0, b + 16), z = Math.min(y1, b + 48);
      if (z > a) ctx.fillRect(x - 2.5, a, 5, z - a);
    }
  };
  if (shape === 'straight') dash(C, 0, S);
  else if (shape === 'dead') dash(C, 0, C - 14);
  else if (shape === 'corner') {
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 5; ctx.setLineDash([22, 14]);
    ctx.beginPath(); ctx.arc(S, 0, C, Math.PI / 2, Math.PI, false); ctx.stroke();
    ctx.setLineDash([]);
  } else if (shape === 'tee' || shape === 'cross') {
    const sides = shape === 'cross' ? [0, 1, 2, 3] : [0, 1, 3];
    for (const s of sides) {
      ctx.save();
      ctx.translate(C, C); ctx.rotate((s * Math.PI) / 2); ctx.translate(-C, -C);
      dash(C, 0, C - 26);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawTile(ctx: Ctx, index: number): void {
  const T = FARM_TILE;
  if (index === T.water) water(ctx);
  else if (index <= T.grass3) grass(ctx, index - T.grass);
  else if (index === T.dirtLane) dirt(ctx, '#b88a56', '#d6ad78', '#8f6a3c', 100, 40);
  else if (index === T.yard) dirt(ctx, '#cdb48c', '#e8d7b4', '#a08865', 110, 90);
  else if (index >= T.corn && index <= T.cornRipe) corn(ctx, index - T.corn);
  else if (index === T.mown) mown(ctx);
  else if (index === T.cornFlat) cornFlat(ctx);
  else if (index === T.mud) mud(ctx);
  else if (index < T.waterBankBase) road(ctx, index - T.roadBase);
  else waterBank(ctx, index - T.waterBankBase);
}

/** One detached canvas reused for every atlas cell (same contract as `industrialTileSource`). */
export function farmTileSource(size: number): (index: number) => HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d')!;
  return (index) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.setTransform(size / S, 0, 0, size / S, 0, 0);
    drawTile(ctx, index);
    return tile;
  };
}
