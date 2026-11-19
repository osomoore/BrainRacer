/** Pure keyboard mapping (DOM-free). Keys are `KeyboardEvent.code` values. */
import type { PlayerInput } from '../core/types';
import { directionAnswer, emptyInput, navEdge, pickAnswer, type RepeatState } from './mapping';

export type KeyLayout = 'left' | 'right';

export interface KeyTable {
  up: string; down: string; left: string; right: string;
  answers: [string, string, string, string];
  confirm: string; back: string; transfer: string; pause: string;
}

export const KEY_TABLES: Record<KeyLayout, KeyTable> = {
  left: {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    answers: ['Digit1', 'Digit2', 'Digit3', 'Digit4'], confirm: 'Space', back: 'Backspace', transfer: 'KeyB', pause: 'Escape',
  },
  right: {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    answers: ['Comma', 'Period', 'Slash', 'KeyM'], confirm: 'Enter', back: 'Backspace', transfer: 'KeyN', pause: 'Escape',
  },
};

/** Codes that should have preventDefault called (page scroll etc.). */
export const HANDLED_CODES: ReadonlySet<string> = new Set([
  ...Object.values(KEY_TABLES).flatMap((t) => [t.up, t.down, t.left, t.right, ...t.answers, t.confirm, t.back, t.transfer, t.pause]),
  'F2',
]);

/** `held` = keys down now (including taps since last poll); `prev` = keys considered down at last poll. */
export function mapKeyboard(
  layout: KeyLayout, held: ReadonlySet<string>, prev: ReadonlySet<string>, repeat: RepeatState, now: number,
): PlayerInput {
  const t = KEY_TABLES[layout];
  const d = (k: string) => held.has(k);
  const edge = (k: string) => held.has(k) && !prev.has(k);
  const x = (d(t.right) ? 1 : 0) - (d(t.left) ? 1 : 0);
  const y = (d(t.down) ? 1 : 0) - (d(t.up) ? 1 : 0);
  return {
    ...emptyInput(),
    steer: x,
    throttle: d(t.up) ? 1 : 0,
    brake: d(t.down) ? 1 : 0,
    answer: pickAnswer([edge(t.answers[0]), edge(t.answers[1]), edge(t.answers[2]), edge(t.answers[3])]),
    answerDirection: directionAnswer(edge(t.left), edge(t.up), edge(t.right), edge(t.down)),
    confirm: edge(t.confirm),
    back: edge(t.back),
    transfer: edge(t.transfer),
    pause: edge(t.pause),
    navX: navEdge(x, repeat.x, now),
    navY: navEdge(y, repeat.y, now),
  };
}
