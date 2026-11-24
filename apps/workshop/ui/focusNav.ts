/**
 * Pure spatial focus navigation (no Phaser): given the rectangles (CENTER x, y + size) of the focusable things on
 * screen, which one is next when the player presses a direction. Works for grids, lists, letter keys with different
 * widths and mixed layouts, so every screen uses the same helper instead of hand-written index maths.
 */
export interface FocusRect { x: number; y: number; w: number; h: number; enabled?: boolean }
export type FocusDir = 'left' | 'right' | 'up' | 'down';

const EPS = 1;

/**
 * Index to focus after moving `dir` from `current`, or `current` when nothing lies that way.
 * With `wrap`, moving past the edge jumps to the far side of the same row / column.
 * A negative `current` (nothing focused) returns the first enabled item.
 */
export function moveFocus(items: readonly FocusRect[], current: number, dir: FocusDir, wrap = false): number {
  const ok = (i: number) => items[i] && items[i].enabled !== false;
  if (current < 0 || !items[current]) return items.findIndex((_, i) => ok(i));
  const cur = items[current];
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best = -1;
  let bestScore = Infinity;
  // First choice: things that overlap the current one on the cross axis (same row / column, even when widths
  // differ, e.g. DELETE -> DONE). Among those the nearest wins, ties go to the best aligned.
  items.forEach((it, i) => {
    if (i === current || !ok(i)) return;
    const along = (horizontal ? it.x - cur.x : it.y - cur.y) * sign;
    if (along <= EPS) return;
    const d = Math.abs(horizontal ? it.y - cur.y : it.x - cur.x);
    const overlap = horizontal ? (cur.h + it.h) / 2 : (cur.w + it.w) / 2;
    if (d >= overlap) return;
    const score = along * 1000 + d;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  if (best >= 0) return best;
  // Left / right never leaves a row that has other items (the end of the row is an edge, not a jump to another row).
  const rowMates = horizontal && items.some((it, i) => i !== current && ok(i) && Math.abs(it.y - cur.y) < (cur.h + it.h) / 2);
  if (!rowMates) items.forEach((it, i) => {
    if (i === current || !ok(i)) return;
    const along = (horizontal ? it.x - cur.x : it.y - cur.y) * sign;
    if (along <= EPS) return;
    const across = Math.abs(horizontal ? it.y - cur.y : it.x - cur.x);
    // Cross-axis misalignment counts triple: prefer staying in the same row / column.
    const score = along + across * 3;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  if (best >= 0) return best;
  if (!wrap) return current;
  // Wrap: among items most aligned with the current one, take the farthest on the opposite side.
  let minAcross = Infinity;
  items.forEach((it, i) => {
    if (i === current || !ok(i)) return;
    minAcross = Math.min(minAcross, Math.abs(horizontal ? it.y - cur.y : it.x - cur.x));
  });
  let bestPos = 0;
  items.forEach((it, i) => {
    if (i === current || !ok(i)) return;
    const across = Math.abs(horizontal ? it.y - cur.y : it.x - cur.x);
    if (across > minAcross + 40) return;
    const pos = horizontal ? it.x : it.y;
    if (best < 0 || (sign > 0 ? pos < bestPos : pos > bestPos)) { best = i; bestPos = pos; }
  });
  return best >= 0 ? best : current;
}

/** First enabled index, or -1. */
export function firstEnabled(items: readonly FocusRect[]): number {
  return items.findIndex((it) => it.enabled !== false);
}

/** Axis-aligned hit test for a center-based rect (tap-to-focus helpers, tests). */
export function hitRect(r: FocusRect, px: number, py: number): boolean {
  return Math.abs(px - r.x) <= r.w / 2 && Math.abs(py - r.y) <= r.h / 2;
}
