import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodeQr, qrPixelScale } from './qr';

describe('encodeQr', () => {
  it('matches an OpenCV version 1-M HELLO WORLD byte-mode matrix', () => {
    const qr = encodeQr('HELLO WORLD');
    expect(qr.map(row => row.map(d => d ? '1' : '0').join(''))).toEqual([
      '111111101100101111111', '100000100001001000001', '101110100101001011101',
      '101110101001001011101', '101110101110101011101', '100000101001001000001',
      '111111101010101111111', '000000001001100000000', '100010111111011111001',
      '000100001011100001111', '001111110011011010010', '111110001100010000000',
      '111110101010101100110', '000000001010111101011', '111111101110101011010',
      '100000100101110110011', '101110101101011000110', '101110100100100011011',
      '101110100111000111000', '100000100001010000000', '111111101111111110101',
    ]);
  });

  it.each([
    [']'.repeat(55), '4a3de7022edcb7c3f8451b669a3e161360423c07b41e25db465b68c54560d450'],
    ['['.repeat(100), 'f6adb18f3f61d487cc5324e5c74948af649f639afbd9f5a89cfa447acc33f7ed'],
  ])('matches an OpenCV multi-block ECC M vector', (data, hash) => {
    const bits = encodeQr(data).flat().map(Number).join('');
    expect(createHash('sha256').update(bits).digest('hex')).toBe(hash);
  });

  it('selects larger versions as byte payloads grow and supports UTF-8', () => {
    expect(encodeQr('a'.repeat(15))).toHaveLength(25);
    expect(encodeQr('a'.repeat(100))).toHaveLength(41);
    expect(encodeQr('fam\u00edlia \ud83c\udfc1 x')).toHaveLength(25);
  });

  it('rejects a payload beyond version 6-M capacity', () => {
    expect(() => encodeQr('x'.repeat(107))).toThrow(RangeError);
  });
});

describe('qrPixelScale', () => {
  it('uses an integer module size that renders supported QR versions around 400px', () => {
    for (const moduleCount of [21, 25, 29, 33, 37, 41]) {
      const scale = qrPixelScale(moduleCount);
      const pixels = (moduleCount + 8) * scale;
      expect(Number.isInteger(scale)).toBe(true);
      expect(pixels).toBeGreaterThanOrEqual(360);
      expect(pixels).toBeLessThanOrEqual(420);
    }
  });
});
