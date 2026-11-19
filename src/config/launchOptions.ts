/**
 * Launch options: URL query params (play.bat turns its flags into these).
 *   ?round=SEC  round length in seconds      (default DEFAULT_SETTINGS.roundLengthSec)
 *   ?every=SEC  seconds of driving between question breaks
 *   ?music=0..1 ?sfx=0..1  volumes
 * Pure and Phaser-free. Invalid / out-of-range round & every fall back to the defaults; volumes clamp to 0..1.
 */
import { DEFAULT_SETTINGS } from './gameConfig';

export const LAUNCH_LIMITS = { roundMin: 10, roundMax: 3600, everyMin: 1, everyMax: 120 } as const;

export interface LaunchOptions {
  roundLengthSec: number;
  challengeIntervalSec: number;
  musicVolume: number;
  sfxVolume: number;
}

function num(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : undefined;
}

function inRange(raw: string | null, min: number, max: number, fallback: number): number {
  const v = num(raw);
  return v !== undefined && v >= min && v <= max ? v : fallback;
}

function volume(raw: string | null, fallback: number): number {
  const v = num(raw);
  return v === undefined ? fallback : Math.min(1, Math.max(0, v));
}

export function parseLaunchOptions(search: string): LaunchOptions {
  const q = new URLSearchParams(search);
  const d = DEFAULT_SETTINGS;
  return {
    roundLengthSec: inRange(q.get('round'), LAUNCH_LIMITS.roundMin, LAUNCH_LIMITS.roundMax, d.roundLengthSec),
    challengeIntervalSec: inRange(q.get('every'), LAUNCH_LIMITS.everyMin, LAUNCH_LIMITS.everyMax, d.challengeIntervalSec),
    musicVolume: volume(q.get('music'), d.musicVolume),
    sfxVolume: volume(q.get('sfx'), d.sfxVolume),
  };
}

/** Launch options for the current page (defaults when there is no `location`, e.g. unit tests). */
export function currentLaunchOptions(): LaunchOptions {
  return parseLaunchOptions(typeof location === 'undefined' ? '' : location.search);
}
