/** Pure launcher logic (no DOM). */
import type { MenuAction } from '../../shared/input/menuInput';

/** Move the highlight on a single row of `count` tiles (clamped, no wrap). */
export function moveSelection(index: number, action: MenuAction, count: number): number {
  if (count <= 0) return 0;
  if (action === 'left') return Math.max(0, index - 1);
  if (action === 'right') return Math.min(count - 1, index + 1);
  return Math.min(Math.max(index, 0), count - 1);
}

/** Any query string means a dev/test URL meant for Brain Racer: forward it there. */
export function shouldForward(search: string): boolean {
  return search.length > 1;
}
