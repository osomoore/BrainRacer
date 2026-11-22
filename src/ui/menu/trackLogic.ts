/** Phaser-free world-picker stepping for Track select. */
import type { RaceMap } from '../../core/types';

/**
 * Moves the selection through `all` (grid of `cols` columns): dx steps by one, dy by a whole row, wrapping,
 * skipping worlds that are not in `open`. Stays put if nothing else is open.
 */
export function stepMap(all: readonly RaceMap[], open: readonly RaceMap[], cur: RaceMap, dx: number, dy: number, cols: number): RaceMap {
  const n = all.length;
  const start = all.indexOf(cur);
  const delta = dx !== 0 ? Math.sign(dx) : Math.sign(dy) * cols;
  if (start < 0 || delta === 0 || !open.length) return cur;
  let i = start;
  for (let k = 0; k < n; k++) {
    i = (((i + delta) % n) + n) % n;
    if (open.includes(all[i])) return all[i];
  }
  return cur;
}
