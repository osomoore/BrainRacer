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
  const bottom = -(w.r - 4 + l.lift);
  const x0 = -b.len / 2, x1 = b.len / 2;
  const chRear = b.chH * s.tailK, chFront = b.chH * s.noseK;
  const chassisTop = (x: number) => bottom - lerp(chRear, chFront, (x - x0) / b.len);
  const chassis: Pt[] = [{ x: x0, y: bottom }, { x: x0, y: chassisTop(x0) }, { x: x1, y: chassisTop(x1) }, { x: x1, y: bottom }];
  const cabH = b.cabH * s.cabK;
  const [c0, c1] = b.cab;
  const sf = s.slantF * b.slantF * cabH, sr = s.slantR * b.slantR * cabH;
  const cabin: Pt[] = [
    { x: c0, y: chassisTop(c0) },
    { x: c0 + sr, y: chassisTop(c0 + sr) - cabH },
    { x: c1 - sf, y: chassisTop(c1 - sf) - cabH },
    { x: c1, y: chassisTop(c1) },
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

/** Top-view body outline (closed polygon, centre = origin, nose at +x). */
export function topOutline(b: BodyLook, s: ShapeLook, n = 28): Pt[] {
  const up: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    up.push({ x: -b.len / 2 + b.len * t, y: -topHalfWidth(b.hw, s, t) });
  }
  const down = up.map((p) => ({ x: p.x, y: -p.y })).reverse();
  return [...up, ...down];
}
