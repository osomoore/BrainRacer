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
