/** Sight gags and safe paths for the race runs. All progress is cosmetic. */
const clamp = (t: number): number => Math.max(0, Math.min(1, t));

/** The gauge starts full and eases towards its final reading, even when the car sputters. */
export function fuelReading(progress: number, remaining: number): number {
  return 1 - (1 - remaining) * clamp(progress) ** 0.85;
}

/** Fade into the water after entry, and out again as the wheels climb the far bank. */
export function waterEnvelope(progress: number): number {
  const edge = clamp(Math.min(progress, 1 - progress) * 6);
  return edge * edge * (3 - 2 * edge);
}

/** Stop the nose upstream of the entire marked crossing, including the duck family's margin. */
export function crossingStop(crossingLeft: number, noseOffset: number, gap: number): number {
  return crossingLeft - noseOffset - gap;
}

/** Height of a hop, with its peak between the takeoff and contact poses. */
export function hopLift(progress: number, height: number): number {
  const t = clamp(progress);
  return 4 * height * t * (1 - t);
}

/** Give the deciding beat more time when several obstacles share one stage. */
export function facetTime(total: number, count: number, deciding: boolean): number {
  if (count <= 1) return total;
  return total * (deciding ? 2 : 1) / (count + 1);
}
