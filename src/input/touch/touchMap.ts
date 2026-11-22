/** Pure (DOM-free) mapping from on-screen button states to PlayerInput. */
import type { AnswerSlot, PlayerInput, TouchLayout } from '../../core/types';
import { emptyInput, navEdge, type RepeatState } from '../mapping';

export const TOUCH_BUTTONS = ['left', 'right', 'brake', 'pause', 'reset', 'up', 'down', 'a', 'b'] as const;
export type TouchButton = typeof TOUCH_BUTTONS[number];
export type TouchState = Record<TouchButton, boolean>;

export const emptyTouchState = (): TouchState =>
  Object.fromEntries(TOUCH_BUTTONS.map((b) => [b, false])) as TouchState;

/** Which buttons exist (and are shown) for a layout. */
export const LAYOUT_BUTTONS: Record<TouchLayout, readonly TouchButton[]> = {
  none: [],
  race: ['left', 'right', 'brake', 'pause', 'reset'],
  menu: ['left', 'right', 'up', 'down', 'a', 'b'],
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
