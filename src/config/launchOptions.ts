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

/** Only the params actually present (and valid) in the URL; saved settings keep everything else. */
export function parseLaunchOverrides(search: string): Partial<LaunchOptions> {
  const q = new URLSearchParams(search);
  const out: Partial<LaunchOptions> = {};
  const round = num(q.get('round'));
  if (round !== undefined && round >= LAUNCH_LIMITS.roundMin && round <= LAUNCH_LIMITS.roundMax) out.roundLengthSec = round;
  const every = num(q.get('every'));
  if (every !== undefined && every >= LAUNCH_LIMITS.everyMin && every <= LAUNCH_LIMITS.everyMax) out.challengeIntervalSec = every;
  const music = num(q.get('music'));
  if (music !== undefined) out.musicVolume = Math.min(1, Math.max(0, music));
  const sfx = num(q.get('sfx'));
  if (sfx !== undefined) out.sfxVolume = Math.min(1, Math.max(0, sfx));
  return out;
}

export function parseLaunchOptions(search: string): LaunchOptions {
  const d = DEFAULT_SETTINGS;
  return {
    roundLengthSec: d.roundLengthSec, challengeIntervalSec: d.challengeIntervalSec,
    musicVolume: d.musicVolume, sfxVolume: d.sfxVolume,
    ...parseLaunchOverrides(search),
  };
}

/** Overrides for the current page (empty when there is no `location`, e.g. unit tests). */
export function currentLaunchOverrides(): Partial<LaunchOptions> {
  return parseLaunchOverrides(typeof location === 'undefined' ? '' : location.search);
}

/** Launch options for the current page (defaults when there is no `location`, e.g. unit tests). */
export function currentLaunchOptions(): LaunchOptions {
  return parseLaunchOptions(typeof location === 'undefined' ? '' : location.search);
}
