/** Pure dino pose maths (side view, ground y = 0, faces +x). No Phaser. */
import type { Model } from '../../core/types';
import { type Pt, rotPt } from '../geom';
import { BODY, type BodyLook, HEAD, type HeadLook, LEGS, type LegLook, MOVE_POSE, type Pose, SIZE_SCALE, TAIL, type TailLook } from './looks';

export interface DinoLooks { head: HeadLook; legs: LegLook; pose: Pose; tail: TailLook; body: BodyLook; scale: number }

export function dinoLooks(m: Model): DinoLooks {
  return {
    head: HEAD[m.head] ?? HEAD['head.round'], legs: LEGS[m.legs] ?? LEGS['legs.short'],
    pose: MOVE_POSE[m.move] ?? 'crawl', tail: TAIL[m.tail] ?? TAIL['tail.short'],
    body: BODY[m.body] ?? BODY['body.round'], scale: SIZE_SCALE[m.size] ?? 1,
  };
}

export interface LegSlot { x: number; y: number; len: number; far: boolean; front: boolean; rot: number }
export interface Skeleton {
  pose: Pose;
  torso: { x: number; y: number; rot: number; rx: number; ry: number };
  tailBase: Pt; neckBase: Pt; neckAng: number; headRot: number;
  legs: LegSlot[];
  arms: { x: number; y: number; far: boolean; rot: number }[];
  wing: Pt;
  armLen: number;
}

export function skeleton(l: DinoLooks, armLen: number): Skeleton {
  const { body: b, legs: lg, head: h, pose } = l;
  const rx = b.rx, ry = pose === 'swim' ? b.ry * 0.88 : b.ry;
  let cx = 0, cy = 0, rot = 0;
  const legs: LegSlot[] = [];
  const arms: Skeleton['arms'] = [];
  let neckAng = h.neckAngCrawl, headRot = 0;
  let tailBase: Pt, neckBase: Pt, wing: Pt;
  if (pose === 'stand') {
    rot = -0.52;
    const hip = { x: -6, y: -lg.len };
    const off = rotPt({ x: rx * 0.34, y: -ry * 0.5 }, rot);
    cx = hip.x + off.x; cy = hip.y + off.y;
    legs.push({ x: hip.x, y: hip.y - 4, len: lg.len + 4, far: false, front: false, rot: 0 });
    legs.push({ x: hip.x + 22, y: hip.y - 4, len: lg.len + 4, far: true, front: false, rot: 0 });
    neckAng = h.neckAngStand; headRot = h.neckLen > 120 ? 0.2 : 0.08;
    const ap = rotPt({ x: rx * 0.62, y: ry * 0.5 }, rot);
    arms.push({ x: cx + ap.x, y: cy + ap.y, far: false, rot: -0.3 }, { x: cx + ap.x + 6, y: cy + ap.y - 4, far: true, rot: -0.1 });
  } else if (pose === 'fly') {
    rot = -0.12;
    cx = 0; cy = -(lg.len * 0.5 + ry + 70);
    for (const [x, far] of [[-rx * 0.35, false], [-rx * 0.35 + 22, true]] as const) legs.push({ x, y: cy + ry * 0.45, len: lg.len * 0.6 + 14, far, front: false, rot: 0.5 });
    neckAng = h.neckAngCrawl - 0.1; headRot = 0.1;
    const ap = rotPt({ x: rx * 0.62, y: ry * 0.5 }, rot);
    arms.push({ x: cx + ap.x, y: cy + ap.y, far: false, rot: -0.2 }, { x: cx + ap.x + 6, y: cy + ap.y - 4, far: true, rot: 0 });
  } else if (pose === 'swim') {
    rot = -0.04;
    cx = 0; cy = -(ry + 10);
    for (const [x, far] of [[-rx * 0.45, false], [-rx * 0.45 + 20, true]] as const) legs.push({ x, y: cy + ry * 0.55, len: lg.len * 0.75 + 20, far, front: false, rot: 0.95 });
    neckAng = h.neckAngCrawl * 0.5 - 0.05; headRot = 0.1;
    const ap = rotPt({ x: rx * 0.55, y: ry * 0.55 }, rot);
    arms.push({ x: cx + ap.x, y: cy + ap.y, far: false, rot: 0.6 }, { x: cx + ap.x + 6, y: cy + ap.y - 3, far: true, rot: 0.8 });
  } else {
    rot = -0.03;
    cx = 0; cy = -(lg.len + ry - 6);
    const ay = cy + ry * 0.45, len = -ay;
    for (const [x, front] of [[-rx * 0.52, false], [rx * 0.5, true]] as const) {
      legs.push({ x: x + 20, y: ay, len, far: true, front, rot: 0 });
      legs.push({ x, y: ay, len, far: false, front, rot: 0 });
    }
    headRot = 0.05;
  }
  tailBase = { x: cx + rotPt({ x: -rx * 0.88, y: ry * 0.05 }, rot).x, y: cy + rotPt({ x: -rx * 0.88, y: ry * 0.05 }, rot).y };
  neckBase = { x: cx + rotPt({ x: rx * 0.78, y: -ry * 0.22 }, rot).x, y: cy + rotPt({ x: rx * 0.78, y: -ry * 0.22 }, rot).y };
  wing = { x: cx + rotPt({ x: rx * 0.1, y: -ry * 0.75 }, rot).x, y: cy + rotPt({ x: rx * 0.1, y: -ry * 0.75 }, rot).y };
  return { pose, torso: { x: cx, y: cy, rot, rx, ry }, tailBase, neckBase, neckAng, headRot, legs, arms, wing, armLen };
}

/** World position of the head hinge (back of the mouth) at rest. */
export function hingePos(s: Skeleton, h: HeadLook): Pt {
  return { x: s.neckBase.x + Math.cos(s.neckAng) * h.neckLen, y: s.neckBase.y + Math.sin(s.neckAng) * h.neckLen };
}
