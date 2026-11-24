/**
 * Pure terrain profiles for side-view scenes (no Phaser). y is DOWN, so hills are negative.
 *   const f = slopeProfile({ x0: 800, length: 1000, tan: 0.56, ease: 140 });  f(x) -> y
 */
export interface SlopeSpec { x0: number; length: number; tan: number; ease?: number }

/** Flat, then a straight slope (eased at both ends so the car does not kink), then a flat plateau. */
export function slopeProfile(s: SlopeSpec): (x: number) => number {
  const e = Math.min(s.ease ?? 140, s.length / 3);
  const { x0, length: L, tan } = s;
  return (x: number): number => {
    const t = x - x0;
    if (t <= 0) return 0;
    if (t < e) return -(tan * t * t) / (2 * e);
    if (t < L - e) return -(tan * e / 2 + tan * (t - e));
    const y1 = tan * e / 2 + tan * (L - 2 * e);
    const u = Math.min(t - (L - e), e);
    return -(y1 + tan * (u - (u * u) / (2 * e)));
  };
}

/** Total rise of a slope (positive px). */
export function slopeRise(s: SlopeSpec): number {
  const e = Math.min(s.ease ?? 140, s.length / 3);
  return s.tan * (s.length - e);
}

/** Sagging deck for the wobbly bridge: 0 at both ends, `sag` px down in the middle at load = 1 (smooth). */
export function sagProfile(x0: number, x1: number, sag: number): (x: number) => number {
  return (x: number): number => {
    if (x <= x0 || x >= x1) return 0;
    const t = (x - x0) / (x1 - x0);
    return Math.sin(t * Math.PI) * sag;
  };
}
