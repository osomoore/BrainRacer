/** Pure debug hotkey helpers (DOM-free). Only active when the race was opened with `?debug=1` (see DEBUG_KEYS). */
import { DEBUG_KEYS } from '../config/gameConfig';
import type { CarKind } from '../core/types';

export type DebugAction = 'cycleCar' | 'boss' | 'laser';

export function debugKeysEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

export function debugActionFor(code: string): DebugAction | null {
  if (code === DEBUG_KEYS.cycleCar) return 'cycleCar';
  if (code === DEBUG_KEYS.boss) return 'boss';
  if (code === DEBUG_KEYS.laser) return 'laser';
  return null;
}

/** Next car in `all`, wrapping; an unknown current car starts at the first. */
export function nextCar(current: CarKind, all: readonly CarKind[]): CarKind {
  const i = all.indexOf(current);
  return all[(i + 1) % all.length];
}
