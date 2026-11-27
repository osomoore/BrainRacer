/**
 * Adventure World tunables. Each package ADDS keys in its own section only (see docs/WORLD.md package map).
 */

// --- orchestrator ------------------------------------------------------------------------------
export const WORLD = {
  /** Hex circumradius (center to corner), px. About two screen heights. */
  hexSize: 2400,
  /** Logical screen. */
  width: 1920,
  height: 1080,
  /** Hexes generated/kept around each player (rings). */
  keepRings: 2,
} as const;

// --- gen (W1) ----------------------------------------------------------------------------------

// --- traits + movement (W2) --------------------------------------------------------------------

// --- save + shell (W3) -------------------------------------------------------------------------

// --- quests (W4) -------------------------------------------------------------------------------
export const QUESTS = {
  /** How far the caller looks for biomes when building the nearby lookup. */
  nearbyRings: 3,
  fetchChance: 0.5,
  duckChance: 0.5,
  stars: { fetch: 3, deliver: 2 },
  wordLimit: { starter: 5, easy: 8, medium: 12, hard: 16 },
} as const;
