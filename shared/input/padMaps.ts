/** Data-driven gamepad layouts. Add an entry to FALLBACK_MAPS to remap an odd USB pad. */
export interface PadMap {
  a: number; b: number; x: number; y: number;
  lt: number; rt: number; start: number;
  dUp: number; dDown: number; dLeft: number; dRight: number;
  axisX: number; axisY: number;
}

export const STANDARD_MAP: PadMap = {
  a: 0, b: 1, x: 2, y: 3, lt: 6, rt: 7, start: 9,
  dUp: 12, dDown: 13, dLeft: 14, dRight: 15, axisX: 0, axisY: 1,
};

export interface FallbackEntry {
  /** Case-insensitive substring of `gamepad.id`. */
  match: string;
  map: Partial<PadMap>;
}

/** Checked in order for pads whose `mapping !== 'standard'`; first match wins. */
export const FALLBACK_MAPS: FallbackEntry[] = [
  // Sony pads report face buttons in the standard order (Cross=0, Circle=1, Square=2, Triangle=3).
  { match: '054c', map: {} },
];

/** Generic default for unknown non-standard pads: assume standard indices. */
export const DEFAULT_FALLBACK: PadMap = STANDARD_MAP;

export function resolvePadMap(id: string, mapping: string, table: readonly FallbackEntry[] = FALLBACK_MAPS): PadMap {
  if (mapping === 'standard') return STANDARD_MAP;
  const lower = id.toLowerCase();
  const hit = table.find((e) => lower.includes(e.match.toLowerCase()));
  return hit ? { ...STANDARD_MAP, ...hit.map } : DEFAULT_FALLBACK;
}
