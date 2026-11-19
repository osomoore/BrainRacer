/** Pure (DOM-free) input mapping logic. */
import type { AnswerSlot, PlayerInput } from '../core/types';
import { INPUT_CFG } from './config';
import { resolvePadMap, type PadMap } from './padMaps';

export interface PadSnapshot {
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export interface NavRepeat { dir: number; nextAt: number }
export interface RepeatState { x: NavRepeat; y: NavRepeat }

export const newRepeatState = (): RepeatState => ({ x: { dir: 0, nextAt: 0 }, y: { dir: 0, nextAt: 0 } });

export const emptyInput = (): PlayerInput => ({
  steer: 0, throttle: 0, brake: 0, answer: null, confirm: false, back: false, pause: false, navX: 0, navY: 0,
});

/** Radial deadzone with rescale so output ramps smoothly from 0 at the edge of the deadzone. */
export function applyDeadzone(x: number, y: number, dz: number = INPUT_CFG.stickDeadzone): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag <= dz) return [0, 0];
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

/** Menu-navigation edge with auto-repeat. `now` in seconds. Returns -1/0/1. */
export function navEdge(dir: number, st: NavRepeat, now: number): -1 | 0 | 1 {
  const d = Math.sign(dir);
  if (d === 0) { st.dir = 0; return 0; }
  if (d !== st.dir) { st.dir = d; st.nextAt = now + INPUT_CFG.navRepeatDelaySec; return d as -1 | 1; }
  if (now >= st.nextAt) { st.nextAt = now + INPUT_CFG.navRepeatIntervalSec; return d as -1 | 1; }
  return 0;
}

/** First pressed slot wins (X=0 leftmost, then Y=1, then B=2). */
export function pickAnswer(pressed: readonly [boolean, boolean, boolean]): AnswerSlot | null {
  for (let i = 0; i < 3; i++) if (pressed[i]) return i as AnswerSlot;
  return null;
}

const down = (s: PadSnapshot | null, i: number) => !!s?.buttons[i]?.pressed;
const analog = (s: PadSnapshot, i: number) => {
  const b = s.buttons[i];
  return b ? Math.max(0, Math.min(1, b.value || (b.pressed ? 1 : 0))) : 0;
};

export function mapGamepad(
  snap: PadSnapshot, prev: PadSnapshot | null, repeat: RepeatState, now: number, map?: PadMap,
): PlayerInput {
  const m = map ?? resolvePadMap(snap.id, snap.mapping);
  const edge = (i: number) => down(snap, i) && !down(prev, i);

  const rawX = snap.axes[m.axisX] ?? 0;
  const rawY = snap.axes[m.axisY] ?? 0;
  const [sx] = applyDeadzone(rawX, rawY);
  const dpadX = (down(snap, m.dRight) ? 1 : 0) - (down(snap, m.dLeft) ? 1 : 0);
  const dpadY = (down(snap, m.dDown) ? 1 : 0) - (down(snap, m.dUp) ? 1 : 0);

  const th = INPUT_CFG.navThreshold;
  const navDirX = dpadX !== 0 ? dpadX : Math.abs(rawX) >= th ? Math.sign(rawX) : 0;
  const navDirY = dpadY !== 0 ? dpadY : Math.abs(rawY) >= th ? Math.sign(rawY) : 0;

  return {
    steer: dpadX !== 0 ? dpadX : sx,
    throttle: Math.max(analog(snap, m.rt), down(snap, m.a) ? 1 : 0),
    brake: analog(snap, m.lt),
    answer: pickAnswer([edge(m.x), edge(m.y), edge(m.b)]),
    confirm: edge(m.a),
    back: edge(m.b),
    pause: edge(m.start),
    navX: navEdge(navDirX, repeat.x, now),
    navY: navEdge(navDirY, repeat.y, now),
  };
}

/** Merge inputs: max-magnitude steer, max of analog, OR of edges, first non-null answer / non-zero nav. */
export function mergeInputs(list: readonly PlayerInput[]): PlayerInput {
  const out = emptyInput();
  for (const i of list) {
    if (Math.abs(i.steer) > Math.abs(out.steer)) out.steer = i.steer;
    out.throttle = Math.max(out.throttle, i.throttle);
    out.brake = Math.max(out.brake, i.brake);
    if (out.answer === null) out.answer = i.answer;
    out.confirm ||= i.confirm;
    out.back ||= i.back;
    out.pause ||= i.pause;
    if (out.navX === 0) out.navX = i.navX;
    if (out.navY === 0) out.navY = i.navY;
  }
  return out;
}
