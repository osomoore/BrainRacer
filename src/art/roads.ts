import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { TILE_SIZE } from '../config/gameConfig';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W } from '../core/types';
import { hash, makeCanvas, type Ctx } from './draw';

const S = TILE_SIZE;
const C = S / 2;            // centre line / lane boundary
const CURB = 12;            // curb strip width on unconnected sides
const YELLOW = '#ffcf1f', WHITE = '#f4f4f0';

type Shape = 'none' | 'dead' | 'straight' | 'corner' | 'tee' | 'cross';
interface Plan { shape: Shape; rot: number }

const SIDES = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];

/** Which canonical shape + quarter turns (cw) a mask needs. Canonical: dead=N, straight=N|S, corner=N|E, tee=missing S. */
export function roadPlan(mask: number): Plan {
  const has = SIDES.map(b => (mask & b) !== 0);
  const n = has.filter(Boolean).length;
  if (n === 0) return { shape: 'none', rot: 0 };
  if (n === 4) return { shape: 'cross', rot: 0 };
  if (n === 1) return { shape: 'dead', rot: has.indexOf(true) };
  if (n === 3) return { shape: 'tee', rot: (has.indexOf(false) + 2) % 4 };
  if (has[0] && has[2]) return { shape: 'straight', rot: 0 };
  if (has[1] && has[3]) return { shape: 'straight', rot: 1 };
  // corner: first side i such that i and i+1 are connected
  for (let i = 0; i < 4; i++) if (has[i] && has[(i + 1) % 4]) return { shape: 'corner', rot: i };
  return { shape: 'none', rot: 0 };
}

function asphaltRegion(ctx: Ctx, shape: Shape): void {
  // canonical frame: dead N, straight N|S, corner N|E, tee missing S
  const k = CURB;
  ctx.beginPath();
  const e = 10; // connected sides overshoot the tile so edge strokes never draw seams
  switch (shape) {
    case 'none': ctx.roundRect(k, k, S - 2 * k, S - 2 * k, 22); break;
    case 'dead':
      ctx.moveTo(k, -e); ctx.lineTo(S - k, -e); ctx.lineTo(S - k, C);
      ctx.arc(C, C, C - k, 0, Math.PI); ctx.closePath(); break;
    case 'straight': ctx.rect(k, -e, S - 2 * k, S + 2 * e); break;
    case 'corner': ctx.roundRect(k, -e, S - k + e, S - k + e, [0, 0, 0, 44]); break;
    case 'tee': ctx.rect(-e, -e, S + 2 * e, S - k + e); break;
    case 'cross': ctx.rect(-e, -e, S + 2 * e, S + 2 * e); break;
  }
}

function noise(ctx: Ctx): void {
  // deterministic, periodic speckle
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(hash(i, 1, 7) * S), y = Math.floor(hash(i, 2, 7) * S);
    const t = hash(i, 3, 7);
    ctx.fillStyle = t < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)';
    const w = 1 + Math.floor(hash(i, 4, 7) * 3);
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) ctx.fillRect(x + dx, y + dy, w, w);
  }
}

function dashV(ctx: Ctx, x: number, y0: number, y1: number, color = YELLOW): void {
  // dashes with period 64 aligned to the tile so they tile across tiles: dash [16,48) mod 64
  ctx.fillStyle = color;
  for (let base = 0; base < S; base += 64) {
    const a = Math.max(y0, base + 16), b = Math.min(y1, base + 48);
    if (b > a) ctx.fillRect(x - 2.5, a, 5, b - a);
  }
}

function crosswalk(ctx: Ctx): void {
  // canonical: connected side N (top). Zebra stripes + stop line for the incoming lane.
  ctx.fillStyle = WHITE;
  for (const x of [28, 40, 52, 68, 80, 92]) ctx.fillRect(x, 5, 8, 20);
  ctx.fillRect(30, 31, 30, 5); // stop line (right of centre for traffic heading south)
}

function drawRoad(scene: Phaser.Scene, mask: number): void {
  const { ctx, done } = makeCanvas(scene, `${TEX.roadPrefix}${mask}`, S, S);
  const { shape, rot } = roadPlan(mask);

  // curb / sidewalk background
  ctx.fillStyle = '#c9ccd4'; ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.translate(C, C); ctx.rotate((rot * Math.PI) / 2); ctx.translate(-C, -C);

  // curb outline: draw asphalt region stroked in a lighter edge, then asphalt
  asphaltRegion(ctx, shape);
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = '#7d8294'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
  ctx.save();
  asphaltRegion(ctx, shape);
  ctx.clip();
  ctx.fillStyle = '#404454'; ctx.fillRect(-S, -S, S * 3, S * 3);
  noise(ctx);
  // curb shadow inside the asphalt edge
  ctx.restore();
  // thin bright curb highlight line just outside asphalt edge
  ctx.save();
  asphaltRegion(ctx, shape);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
  ctx.restore();

  // markings
  ctx.lineCap = 'butt';
  switch (shape) {
    case 'straight': dashV(ctx, C, 0, S); break;
    case 'dead':
      dashV(ctx, C, 0, C - 14);
      ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(C, C + 6, 4, 0, 7); ctx.fill();
      break;
    case 'corner': {
      // centre line curves around the inner corner (128,0)
      ctx.strokeStyle = YELLOW; ctx.lineWidth = 5;
      ctx.setLineDash([22, 14]); ctx.lineDashOffset = -3;
      ctx.beginPath(); ctx.arc(S, 0, C, Math.PI / 2, Math.PI, false); ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'tee':
    case 'cross': {
      const sides = shape === 'cross' ? [0, 1, 2, 3] : [0, 1, 3]; // tee canonical connects N,E,W
      for (const s of sides) {
        ctx.save();
        ctx.translate(C, C); ctx.rotate((s * Math.PI) / 2); ctx.translate(-C, -C);
        crosswalk(ctx);
        ctx.restore();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
  done();
}

export function drawRoads(scene: Phaser.Scene): void {
  for (let m = 0; m < 16; m++) drawRoad(scene, m);
}
