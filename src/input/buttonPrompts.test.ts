import { describe, expect, it } from 'vitest';
import { ANSWER_POSITIONS, faceButton, identifyController, keyboardTransferLabel } from './buttonPrompts';
import { DEBUG_KEYS } from '../config/gameConfig';
import { HANDLED_CODES, KEY_TABLES } from './keyboardMap';

describe('controller prompts', () => {
  it('recognizes Switch Pro and Xbox from Android Gamepad IDs, with a generic fallback', () => {
    expect(identifyController('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('nintendo');
    expect(identifyController('Wireless Controller (STANDARD GAMEPAD Vendor: 057E Product: 2009)')).toBe('nintendo');
    expect(identifyController('Nintendo Switch Pro Controller')).toBe('nintendo');
    expect(identifyController('Xbox Wireless Controller')).toBe('xbox');
    expect(identifyController('Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    // Android WebView: bare InputDevice names, "<manufacturer> <product>".
    expect(identifyController('Nintendo Co., Ltd. Pro Controller')).toBe('nintendo');
    expect(identifyController('Microsoft Controller')).toBe('xbox');
    expect(identifyController('Microsoft X-Box One S pad')).toBe('xbox');
    // Even a truncated name prefix, as seen on the Onn box debug overlay.
    expect(identifyController('Ninten')).toBe('nintendo');
    expect(identifyController('Micros')).toBe('xbox');
    expect(identifyController('Unknown USB Gamepad')).toBe('other');
    expect(identifyController('Onn Remote')).toBe('other');
  });

  it('shows Xbox as colors only (no letters), Switch as letters, while keeping the answer slot positions', () => {
    const xbox = ANSWER_POSITIONS.map((position) => faceButton('xbox', position));
    const nintendo = ANSWER_POSITIONS.map((position) => faceButton('nintendo', position));
    expect(xbox.map(({ label }) => label)).toEqual(['', '', '', '']);
    expect(new Set(xbox.map(({ color }) => color)).size).toBe(4);
    expect(nintendo.map(({ label }) => label)).toEqual(['Y', 'X', 'A', 'B']);
    expect(nintendo[3].color).not.toEqual(xbox[3].color);
    expect(faceButton('other', 'bottom').label).toBe('');
  });

  it('labels the keyboard transfer key for the on-screen key-cap and keeps it clear of other keys', () => {
    expect(keyboardTransferLabel('left')).toBe('B');
    expect(keyboardTransferLabel('right')).toBe('N');
    expect(HANDLED_CODES.has(KEY_TABLES.left.transfer) && HANDLED_CODES.has(KEY_TABLES.right.transfer)).toBe(true);
    for (const layout of ['left', 'right'] as const) {
      const t = KEY_TABLES[layout];
      const others = [t.up, t.down, t.left, t.right, ...t.answers, t.confirm, t.back, t.reset, t.pause, ...Object.values(DEBUG_KEYS)];
      expect(others).not.toContain(t.transfer);
    }
  });
});
