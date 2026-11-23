/** Pure race-car geometry shared by the side and top drawings and the rig (no Phaser). */
import type { Model } from '../../core/types';
import { type Pt, lerp, topAt } from '../geom';
import { BODY, type BodyLook, SHAPE, type ShapeLook, SIZE_SCALE, SPRING, WHEEL, type WheelLook } from './looks';

export interface RaceLooks {
  body: BodyLook; shape: ShapeLook; wheel: WheelLook; lift: number; scale: number;
}

export function raceLooks(model: Model): RaceLooks {
  return {
    body: BODY[model.body] ?? BODY['body.car'],
    shape: SHAPE[model.shape] ?? SHAPE['shape.boxy'],
    wheel: WHEEL[model.wheels] ?? WHEEL['wheels.road'],
    lift: (SPRING[model.springs] ?? SPRING['springs.soft']).lift,
    scale: SIZE_SCALE[model.size] ?? 1,
  };
}

export interface RaceGeom {
  /** y of the underside of the body. */
  bottom: number;
  hubY: number;
  front: number; rear: number;
  frontAxle: number; rearAxle: number;
  chassis: Pt[]; cabin: Pt[]; bed: Pt[] | null;
  /** Topmost y of the silhouette at x. */
  topY(x: number): number;
  /** Top of the chassis line at x (ignores the cabin). */
  chassisTop(x: number): number;
  roofTop: number;
  cabinTopRange: [number, number];
  /** Overall bounds of the body silhouette. */
  height: number;
}

export function raceGeom(l: RaceLooks): RaceGeom {
  const { body: b, shape: s, wheel: w } = l;
  const sports = b.kind === 'sports';
  const tireClearance = sports || s.noseK < 0.85 ? Math.max(0, w.r - 55) * 0.9 : 0;
  const bottom = -(w.r - 4 + l.lift + tireClearance);
  const x0 = -b.len / 2, x1 = b.len / 2;
  const chRear = b.chH * s.tailK, chFront = b.chH * s.noseK;
  const deck = sports
    ? [[0, chRear * 0.70], [0.09, chRear * 0.96], [0.20, chRear], [0.58, chRear], [0.76, chFront * 0.86], [0.92, chFront * 0.66], [1, chFront * 0.52]]
    : [[0, chRear], [1, chFront]];
  const deckPoints = deck.map(([t, h]) => ({ x: x0 + b.len * t, y: bottom - h }));
  const chassisTop = (x: number) => {
    const next = deckPoints.findIndex((point) => x <= point.x);
    if (next === -1) return deckPoints[deckPoints.length - 1].y;
    if (next === 0) return deckPoints[0].y;
    const a = deckPoints[next - 1], b = deckPoints[next];
    return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
  };
  const chassis: Pt[] = [{ x: x0, y: bottom }, ...deckPoints, { x: x1, y: bottom }];
  const cabH = b.cabH * s.cabK;
  const curvedCabin = s.rc >= 20;
  const extension = curvedCabin && !sports ? 12 : 0;
  const c0 = Math.max(x0 + 3, b.cab[0] - extension);
  const c1 = Math.min(x1 - 18, b.cab[1] + extension);
  const span = c1 - c0;
  const frontSlant = Math.max(s.slantF * b.slantF * cabH, sports ? span * 0.25 : 0);
  const rearSlant = Math.max(s.slantR * b.slantR * cabH, sports ? span * 0.19 : 0);
  // Keep a visible roof between the windscreens on short cabins and sloped shapes.
  const slantFit = Math.min(1, span * 0.72 / (frontSlant + rearSlant));
  const sf = frontSlant * slantFit, sr = rearSlant * slantFit;
  const overlap = sports || curvedCabin ? Math.min(17, cabH * 0.33) : 0;
  const cabin: Pt[] = [
    { x: c0, y: chassisTop(c0) + overlap },
    { x: c0 + sr, y: chassisTop(c0 + sr) - cabH },
    { x: c1 - sf, y: chassisTop(c1 - sf) - cabH },
    { x: c1, y: chassisTop(c1) + overlap },
  ];
  let bed: Pt[] | null = null;
  if (b.bedH > 0) {
    const bx = c0 - 3;
    bed = [{ x: x0, y: chassisTop(x0) - b.bedH }, { x: bx, y: chassisTop(bx) - b.bedH }, { x: bx, y: chassisTop(bx) }, { x: x0, y: chassisTop(x0) }];
  }
  const polys = [chassis, cabin, ...(bed ? [bed] : [])];
  const topY = (x: number) => {
    let best = Infinity;
    for (const p of polys) { const y = topAt(p, x); if (y !== null && y < best) best = y; }
    return best === Infinity ? bottom : best;
  };
  let roofTop = Infinity;
  for (const p of cabin) roofTop = Math.min(roofTop, p.y);
  return {
    bottom, hubY: -w.r, front: x1, rear: x0, frontAxle: b.wheelX, rearAxle: -b.wheelX,
    chassis, cabin, bed, topY, chassisTop, roofTop,
    cabinTopRange: [cabin[1].x, cabin[2].x],
    height: Math.max(-roofTop, -topY(x0), w.r * 2),
  };
}

/** Half width of the body seen from above at length fraction t (0 = tail, 1 = nose). */
export function topHalfWidth(hw: number, s: ShapeLook, t: number): number {
  const u = Math.abs(2 * t - 1);
  const se = Math.pow(Math.max(0, 1 - Math.pow(u, s.topN)), 1 / s.topN);
  return hw * se * lerp(s.topTail, s.topNose, t);
}

export function bodyHalfWidth(b: BodyLook, s: ShapeLook, t: number): number {
  const waist = b.kind === 'sports' ? 1 - 0.12 * Math.exp(-((t - 0.50) ** 2) / 0.02) : 1;
  return topHalfWidth(b.hw, s, t) * waist;
}

/** Top-view body outline (closed polygon, centre = origin, nose at +x). */
export function topOutline(b: BodyLook, s: ShapeLook, n = 28): Pt[] {
  const up: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    up.push({ x: -b.len / 2 + b.len * t, y: -bodyHalfWidth(b, s, t) });
  }
  const down = up.map((p) => ({ x: p.x, y: -p.y })).reverse();
  return [...up, ...down];
}
