import { describe, expect, it } from 'vitest';
import { formatActiveMinutes } from './progressReport';

describe('formatActiveMinutes', () => {
  it('shows measured times under 30 seconds as <1, including zero', () => {
    expect(formatActiveMinutes(0)).toBe('<1');
    expect(formatActiveMinutes(29_999)).toBe('<1');
  });

  it('rounds to the nearest whole minute', () => {
    expect(formatActiveMinutes(30_000)).toBe('1');
    expect(formatActiveMinutes(89_999)).toBe('1');
    expect(formatActiveMinutes(90_000)).toBe('2');
  });

  it('uses an em dash when time is unknown or invalid', () => {
    expect(formatActiveMinutes()).toBe('\u2014');
    expect(formatActiveMinutes(Number.NaN)).toBe('\u2014');
  });
});
