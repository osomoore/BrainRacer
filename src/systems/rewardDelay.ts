/** Pure timing for post-break rewards (Phaser-free). */
export interface PendingGrant {
  /** Wall-clock second the answer resolved (the HUD panel fade runs on it, also while the world is frozen). */
  resolvedAtSec: number;
  /** Game-time seconds left to wait; null until the world resumed. */
  waitSec: number | null;
}

/**
 * Advance one pending grant by a game frame after the world resumed. First call computes the wait:
 * what is left of the panel's hold+fade (`panelClearSec` since the answer) plus `extraSec`.
 * Returns true when the reward should be granted now.
 */
export function stepPending(g: PendingGrant, nowSec: number, dt: number, panelClearSec: number, extraSec: number): boolean {
  if (g.waitSec === null) {
    const remaining = Math.max(0, Math.min(panelClearSec, panelClearSec - (nowSec - g.resolvedAtSec)));
    g.waitSec = remaining + extraSec;
  }
  g.waitSec -= dt;
  return g.waitSec <= 0;
}
