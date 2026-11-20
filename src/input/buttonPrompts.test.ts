import { describe, expect, it } from 'vitest';
import { ANSWER_POSITIONS, faceButton, identifyController } from './buttonPrompts';

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

  it('changes the letters and colors while keeping the answer slot positions', () => {
    const xbox = ANSWER_POSITIONS.map((position) => faceButton('xbox', position));
    const nintendo = ANSWER_POSITIONS.map((position) => faceButton('nintendo', position));
    expect(xbox.map(({ label }) => label)).toEqual(['X', 'Y', 'B', 'A']);
    expect(nintendo.map(({ label }) => label)).toEqual(['Y', 'X', 'A', 'B']);
    expect(nintendo[3].color).not.toEqual(xbox[3].color);
    expect(faceButton('other', 'bottom').label).toBe('');
  });
});
