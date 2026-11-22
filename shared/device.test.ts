import { describe, expect, it } from 'vitest';
import { decideMobile, parseOverride } from './device';

const base = { override: null, stored: null, coarse: false, noHover: false };

describe('decideMobile', () => {
  it('phone: coarse and no hover', () => expect(decideMobile({ ...base, coarse: true, noHover: true })).toBe(true));
  it('touchscreen laptop: fine primary pointer stays desktop', () => expect(decideMobile({ ...base, coarse: false, noHover: false })).toBe(false));
  it('coarse but hover-capable (stylus tablet) stays desktop', () => expect(decideMobile({ ...base, coarse: true, noHover: false })).toBe(false));
  it('TV box without touchscreen stays desktop', () => expect(decideMobile({ ...base, noHover: true })).toBe(false));
  it('override on this page beats everything', () => {
    expect(decideMobile({ ...base, override: true })).toBe(true);
    expect(decideMobile({ ...base, override: false, stored: true, coarse: true, noHover: true })).toBe(false);
  });
  it('remembered override beats the media query', () => {
    expect(decideMobile({ ...base, stored: true })).toBe(true);
    expect(decideMobile({ ...base, stored: false, coarse: true, noHover: true })).toBe(false);
  });
});

describe('parseOverride', () => {
  it('parses', () => {
    expect(parseOverride('1')).toBe(true);
    expect(parseOverride('0')).toBe(false);
    expect(parseOverride('auto')).toBeNull();
    expect(parseOverride(null)).toBeNull();
  });
});
