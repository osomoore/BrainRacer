/** Start positions for 1..4 players. Worlds supply two side-by-side spawns; extra racers line up behind (or, if blocked, ahead of) them. */
export interface Spawn { x: number; y: number; angle: number }

/**
 * @param base   the world's own spawns (>= 1, normally 2)
 * @param n      players to place
 * @param free   true if a car may start at (x, y)
 * @param rowGap distance between rows along the spawn heading (px)
 */
export function spreadSpawns(base: readonly Spawn[], n: number, free: (x: number, y: number) => boolean, rowGap: number): Spawn[] {
  const out: Spawn[] = [];
  for (let i = 0; i < n; i++) {
    if (i < base.length) { out.push(base[i]); continue; }
    const b = base[i % base.length];
    const row = Math.floor(i / base.length);
    const fx = Math.cos(b.angle), fy = Math.sin(b.angle);
    let placed: Spawn | null = null;
    // behind first, then ahead; nearest rows first
    for (const k of [-row, row, -(row + 1), row + 1, -(row + 2), row + 2]) {
      const x = b.x + fx * rowGap * k, y = b.y + fy * rowGap * k;
      if (free(x, y) && !out.some((o) => Math.hypot(o.x - x, o.y - y) < rowGap * 0.5)) { placed = { x, y, angle: b.angle }; break; }
    }
    out.push(placed ?? b);
  }
  return out;
}
