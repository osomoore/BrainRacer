import { ANSWER_COLORS, ANSWER_LABELS } from '../config/gameConfig';
import type { AnswerSlot, ControllerFamily } from '../core/types';
import { KEY_TABLES, type KeyLayout } from './keyboardMap';

export type FacePosition = 'left' | 'top' | 'right' | 'bottom';
export const ANSWER_POSITIONS = ['left', 'top', 'right', 'bottom'] as const satisfies readonly FacePosition[];

const SWITCH_LABELS = ['Y', 'X', 'A', 'B'] as const;
const KEY_SYMBOLS: Readonly<Record<string, string>> = { Comma: ',', Period: '.', Slash: '/' };

/** Gamepad.id generally has a product name and, on Chromium, vendor and product IDs. */
export function identifyController(id: string): ControllerFamily {
  if (/\b(?:switch pro|nintendo (?:switch )?pro)\b|^pro controller(?:\s+\(|$)|\b057e(?:\s+product:\s*|[:-])2009\b/i.test(id)) return 'nintendo';
  if (/\bx-?box\b|\bvendor:\s*045e\b|\b045e[:-][\da-f]{4}\b/i.test(id)) return 'xbox';
  return 'other';
}

/** Appearance only. Each position uses the same input mapping across both controller families. */
export function faceButton(family: ControllerFamily, position: FacePosition): { label: string; color: string } {
  const slot = ANSWER_POSITIONS.indexOf(position);
  if (family === 'nintendo') return { label: SWITCH_LABELS[slot], color: '#343846' };
  if (family === 'xbox') return { label: ANSWER_LABELS[slot], color: ANSWER_COLORS[slot] };
  return { label: '', color: '#485c85' };
}

export function keyboardAnswerLabel(layout: KeyLayout, slot: AnswerSlot): string {
  const code = KEY_TABLES[layout].answers[slot];
  return KEY_SYMBOLS[code] ?? code.replace(/^(?:Digit|Key)/, '');
}
