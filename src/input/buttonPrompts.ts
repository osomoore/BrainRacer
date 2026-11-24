import type { AnswerSlot, ControllerFamily } from '../core/types';
import { KEY_TABLES, type KeyLayout } from './keyboardMap';
export { ANSWER_POSITIONS, faceButton, xboxFaceLetter, type FacePosition } from '../../shared/ui/menu/promptMapping';
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

export function keyboardAnswerLabel(layout: KeyLayout, slot: AnswerSlot): string {
  const code = KEY_TABLES[layout].answers[slot];
  return KEY_SYMBOLS[code] ?? code.replace(/^(?:Digit|Key)/, '');
}

/** Key-cap label of the vehicle-switch / ride-the-boss key (same action as pad B and the touch action button). */
export function keyboardTransferLabel(layout: KeyLayout): string {
  const code = KEY_TABLES[layout].transfer;
  return KEY_SYMBOLS[code] ?? code.replace(/^(?:Digit|Key)/, '');
}
