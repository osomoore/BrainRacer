/** Pure (DOM-free) mapping from on-screen button states to PlayerInput. */
import type { AnswerSlot, PlayerInput, TouchLayout } from '../../core/types';
import { emptyInput, navEdge, type RepeatState } from '../mapping';

export const TOUCH_BUTTONS = ['left', 'right', 'brake', 'pause', 'reset', 'up', 'down', 'a', 'b', 'act'] as const;
export type TouchButton = typeof TOUCH_BUTTONS[number];
export type TouchState = Record<TouchButton, boolean>;

export const emptyTouchState = (): TouchState =>
  Object.fromEntries(TOUCH_BUTTONS.map((b) => [b, false])) as TouchState;

/** Which buttons exist (and are shown) for a layout. */
export const LAYOUT_BUTTONS: Record<TouchLayout, readonly TouchButton[]> = {
  none: [],
  race: ['left', 'right', 'brake', 'act', 'pause', 'reset'],
  menu: ['left', 'right', 'up', 'down', 'a', 'b'],
  actions: ['a', 'b'],
};

/**
 * `cur` = held now or tapped since the last poll; `prev` = held at the previous poll (edges = cur && !prev).
 * `answer` = an answer card tapped since the last poll.
 */
export function mapTouch(
  layout: TouchLayout, cur: TouchState, prev: TouchState, repeat: RepeatState, now: number, answer: AnswerSlot | null,
): PlayerInput {
  const out = emptyInput();
  out.answer = answer;
  if (layout === 'none') {
    out.navX = navEdge(0, repeat.x, now);
    out.navY = navEdge(0, repeat.y, now);
    return out;
  }
  const edge = (b: TouchButton) => cur[b] && !prev[b];
  const dx = (cur.right ? 1 : 0) - (cur.left ? 1 : 0);
  if (layout === 'race') {
    out.steer = dx;
    out.brake = cur.brake ? 1 : 0;
    out.throttle = cur.brake ? 0 : 1; // gas is automatic
    out.pause = edge('pause');
    out.resetCar = edge('reset');
    out.transfer = edge('act'); // same as pad B: switch car / hop on the boss / fire its lasers
    out.navX = navEdge(0, repeat.x, now);
    out.navY = navEdge(0, repeat.y, now);
    return out;
  }
  out.navX = navEdge(dx, repeat.x, now);
  out.navY = navEdge((cur.down ? 1 : 0) - (cur.up ? 1 : 0), repeat.y, now);
  out.confirm = edge('a');
  out.back = edge('b');
  out.transfer = edge('b');
  return out;
}

/** What the race action button does right now (icon + pulse). `switch` is the default (a car may or may not be near). */
export type TouchActionMode = 'switch' | 'ride' | 'laser';
export interface TouchActionView { mode: TouchActionMode; pulse: boolean }

/**
 * Pure: derive the action button look from the shared dino state.
 * `crystalDistance` = distance from the car to the boss crystal edge (Infinity when unknown).
 */
export function touchActionView(
  dino: { active: boolean; tamed?: boolean; riders?: readonly number[]; rider?: number | null },
  player: number, crystalDistance: number, reach: number,
): TouchActionView {
  const riders = dino.riders ?? (dino.rider === null || dino.rider === undefined ? [] : [dino.rider]);
  if (riders.includes(player)) return { mode: 'laser', pulse: false };
  if (dino.active && dino.tamed && crystalDistance <= reach) return { mode: 'ride', pulse: true };
  return { mode: 'switch', pulse: false };
}
