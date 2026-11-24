/** Pure race-car geometry shared by the side and top drawings and the rig (no Phaser). */
import type { Model } from '../../core/types';
import { WS_ART } from '../../config';
import { type Pt, lerp, topAt } from '../geom';
import { BODY, BUMPER, type BodyLook, JEEP_SPARE, SHAPE, type ShapeLook, SIZE_SCALE, SPRING, SPRING_BOB_MAX, SPRING_INSET, SPRING_TUCK, WHEEL, type WheelLook, WINCH_SCALE } from './looks';

export interface RaceLooks {
  body: BodyLook; shape: ShapeLook; wheel: WheelLook; lift: number; scale: number; wheelScale: number; rackBags: number;
}

export function raceLooks(model: Model): RaceLooks {
  const compactRack = model.size === 'size.tiny' || model.size === 'size.small';
  return {
    rackBags: compactRack ? 1 : model.size === 'size.big' ? 3 : 2,
    wheelScale: model.size === 'size.tiny' ? 1.20 : model.size === 'size.small' ? 1.12 : 1,
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
  wheelRadius: number;
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
  const wheelRadius = Math.round(w.r * l.wheelScale);
  const sports = b.kind === 'sports';
  const tireClearance = sports || s.noseK < 0.85 ? Math.max(0, wheelRadius - 55) * 0.9 : 0;
  const bottom = -(wheelRadius - 4 + l.lift + tireClearance);
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
    bottom, hubY: -wheelRadius, wheelRadius, front: x1, rear: x0, frontAxle: b.wheelX, rearAxle: -b.wheelX,
    chassis, cabin, bed, topY, chassisTop, roofTop,
    cabinTopRange: [cabin[1].x, cabin[2].x],
    height: Math.max(-roofTop, -topY(x0), wheelRadius * 2),
  };
}

/** Horizontal reach of a rotating tire at a height on the body. */
function tireReachAt(l: RaceLooks, geo: RaceGeom, y: number): number {
  const radius = geo.wheelRadius * (l.wheel.tread === 'monster' ? (l.wheel.r + 14) / l.wheel.r : 1) + 4;
  const dy = geo.hubY - (y - WS_ART.raceRideRaise);
  return Math.sqrt(Math.max(0, radius ** 2 - dy ** 2));
}

/** Keep the spare above the small bumper. Offset its bracket when the rear tire reaches past the tail. */
export function jeepSpareMount(l: RaceLooks, geo: RaceGeom): { x: number; y: number; extension: number } {
  const bottom = geo.bottom - BUMPER['bumpers.small'].h - 5;
  const tireReach = tireReachAt(l, geo, bottom + 3);
  const standardEdge = geo.rear + JEEP_SPARE.offset + JEEP_SPARE.depth / 2;
  const extension = Math.max(0, Math.ceil(standardEdge - (geo.rearAxle - tireReach - 4)));
  return { x: standardEdge - extension - JEEP_SPARE.depth, y: bottom - JEEP_SPARE.diameter, extension };
}

export function winchMount(l: RaceLooks, geo: RaceGeom): Pt & { extension: number } {
  // Recess the base into low noses so the casing still meets the body.
  const y = Math.max(geo.bottom - BUMPER['bumpers.small'].h - 4, geo.chassisTop(geo.front) + 5);
  const standardX = geo.front + 10;
  const housingHalfW = 28 * WINCH_SCALE;
  const extension = Math.max(0, Math.ceil(geo.frontAxle + tireReachAt(l, geo, y + 2) + housingHalfW + 2 - standardX));
  return { x: standardX + extension, y, extension };
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

/** Distances (px, up from the hub) of a coil spring's top and bottom ends when drawn with length H (see springSide). */
export function springExtent(id: string, H: number): { top: number; bottom: number } {
  const sp = SPRING[id] ?? SPRING['springs.soft'];
  const pitch = (H - 6) / sp.turns;
  const coilTop = 4 + (sp.turns - 1) * pitch + pitch * 0.55 + (sp.thick + 6) / 2;
  return { top: Math.max(coilTop, sp.shock ? H : 0), bottom: 4 - (sp.thick + 6) / 2 };
}

/** Radius of the tire including its tread (monster lugs stick out past the rim radius). */
export function tireRadius(l: RaceLooks, geo: RaceGeom): number {
  return geo.wheelRadius * (l.wheel.tread === 'monster' ? (l.wheel.r + 14) / l.wheel.r : 1);
}

/** y (rest pose, body-local, before the ride raise) of the body's lower edge at the axle: the underside or the wheel arch. */
export function bodyLowerEdge(geo: RaceGeom): number {
  return Math.min(geo.bottom, geo.hubY - geo.wheelRadius - 4);
}

/** World y of a spring's top and bottom end at body bob `bob` (matches rig.render: the group rides up by bob, scaled by 1 + bob / H). */
export function springEnds(id: string, H: number, geo: RaceGeom, bob = 0): { top: number; bottom: number } {
  const e = springExtent(id, H), k = 1 + bob / H;
  return { top: geo.hubY - bob - e.top * k, bottom: geo.hubY - bob - e.bottom * k };
}

/**
 * Spring length H: the coil top ends SPRING_TUCK inside the body above its lower edge (so it is hidden there), never
 * lower than the lower edge at full bob, and no higher than SPRING_INSET below the chassis top. The bottom end sits at
 * the hub, behind the tire. The visible middle is whatever gap there is between tire and body.
 */
export function springHeight(id: string, geo: RaceGeom, axle: number): number {
  const edge = bodyLowerEdge(geo) - WS_ART.raceRideRaise;
  const ceil = geo.chassisTop(axle) - WS_ART.raceRideRaise + SPRING_INSET;
  const ok = (H: number, want: number, bob: number) => springEnds(id, H, geo, bob).top <= want;
  const solve = (want: number, bob: number) => { let H = 20; while (H < 400 && !ok(H, want, bob)) H++; return H; };
  // Bobbing lifts the body by bob but the coil top by less, so the rest pose is the tightest case for hiding the top.
  const wanted = solve(edge - SPRING_TUCK, 0);
  const lowest = solve(edge - 2, 0);
  let highest = lowest;
  while (highest < 400 && springEnds(id, highest + 1, geo, SPRING_BOB_MAX).top >= ceil) highest++;
  return Math.max(lowest, Math.min(wanted, highest));
}
