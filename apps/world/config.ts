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
export const GEN = {
  roadWidth: 220,
  pathWidth: 140,
  edgeJitter: 0.19,
  extraLinkChance: 0.26,
  curveSamples: 8,
  planCacheSize: 96,
  biomeScale: 3,
  meadowFieldShare: 0.06,
  campChance: 1 / 12,
  treasureChance: 1 / 25,
  giverChance: 1 / 3,
  activityRadius: 220,
  featureRadius: 660,
  placementClearance: 20,
} as const;

// --- traits + movement (W2) --------------------------------------------------------------------

// --- save + shell (W3) -------------------------------------------------------------------------

// --- quests (W4) -------------------------------------------------------------------------------
