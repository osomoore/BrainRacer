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
export const WORLD_SAVE = { claimedLimit: 500, defaultReading: 'easy' } as const;

// --- quests (W4) -------------------------------------------------------------------------------
