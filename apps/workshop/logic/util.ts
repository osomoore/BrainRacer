import type { Challenge, Check } from '../core/types';

/** FNV-1a string hash -> non-zero uint32 seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) || 1;
}

/** Combine the challenge's checks while preserving each any-of group's alternatives. */
export function flatChecks(c: Pick<Challenge, 'stages'>): Check[] {
  return c.stages.flatMap((s) => s.requirements.flatMap((r) => r.checks));
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
