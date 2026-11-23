import { ANSWER_COLORS, ANSWER_LABELS } from '../config/gameConfig';
import type { AnswerSlot, ControllerFamily } from '../core/types';
import { KEY_TABLES, type KeyLayout } from './keyboardMap';

export type FacePosition = 'left' | 'top' | 'right' | 'bottom';
export const ANSWER_POSITIONS = ['left', 'top', 'right', 'bottom'] as const satisfies readonly FacePosition[];

const SWITCH_LABELS = ['Y', 'X', 'A', 'B'] as const;
const KEY_SYMBOLS: Readonly<Record<string, string>> = { Comma: ',', Period: '.', Slash: '/' };

/**
 * Gamepad.id generally has a product name and, on desktop Chromium, vendor and product IDs.
 * Android WebView gives only InputDevice.getName(), often "<USB manufacturer> <product>",
 * e.g. "Nintendo Co., Ltd. Pro Controller" or "Microsoft Controller".
 */
export function identifyController(id: string): ControllerFamily {
  if (/\bninten|\bswitch pro\b|^pro controller(?:\s+\(|$)|\bvendor:\s*057e\b|\b057e[:-][\da-f]{4}\b/i.test(id)) return 'nintendo';
  if (/\bx-?box\b|\bmicros|\bvendor:\s*045e\b|\b045e[:-][\da-f]{4}\b/i.test(id)) return 'xbox';
  return 'other';
}

/** Xbox shows colored caps with no letter (label ''). Appearance only. Each position uses the same input mapping across both controller families. */
export function faceButton(family: ControllerFamily, position: FacePosition): { label: string; color: string } {
  const slot = ANSWER_POSITIONS.indexOf(position);
  if (family === 'nintendo') return { label: SWITCH_LABELS[slot], color: '#343846' };
  if (family === 'xbox') return { label: '', color: ANSWER_COLORS[slot] };
  return { label: '', color: '#485c85' };
}

/** Letter on an Xbox face button, for admin/setup text only (kids' answer prompts show colors, never letters). */
export function xboxFaceLetter(position: FacePosition): string {
  return ANSWER_LABELS[ANSWER_POSITIONS.indexOf(position)];
}

export function keyboardAnswerLabel(layout: KeyLayout, slot: AnswerSlot): string {
  const code = KEY_TABLES[layout].answers[slot];
  return KEY_SYMBOLS[code] ?? code.replace(/^(?:Digit|Key)/, '');
}

/** Key-cap label of the vehicle-switch / ride-the-boss key (same action as pad B and the touch action button). */
export function keyboardTransferLabel(layout: KeyLayout): string {
  const code = KEY_TABLES[layout].transfer;
  return KEY_SYMBOLS[code] ?? code.replace(/^(?:Digit|Key)/, '');
}
