/**
 * Adventure World tunables. Each package ADDS keys in its own section only (see docs/WORLD.md package map).
 */

// --- orchestrator ------------------------------------------------------------------------------
export const WORLD = {
  /** Hex circumradius (center to corner), px. About two screen heights. */
  hexSize: 1200,
  /** Logical screen. */
  width: 1920,
  height: 1080,
  /** Hexes generated/kept around each player (rings). */
  keepRings: 2,
} as const;

// --- gen (W1) ----------------------------------------------------------------------------------
export const GEN = {
  roadWidth: 196,
  pathWidth: 112,
  edgeJitter: 0.105,
  roadSamplesPerSide: 10,
  hubOffset: 0.065,
  pathBendRadius: 350,
  maxSiteSpur: 440,
  canyon: { valleyWidth: 540, wallThickness: 245, wallExtent: 890, crosscutHalfWidth: 158 },
  terrainVertices: 32,
  spatialCell: 120,
  coverageStep: 60,
  lakeRadius: [675, 735],
  lakeLobeOffset: 620,
  lakeShore: 85,
  scatterAttempts: 20,
  terrainPatches: {
    meadow: { count: 4, orbit: 670, radius: [125, 192], aspect: [0.6, 1] },
    mud: { count: 3, orbit: 475, radius: [438, 467], aspect: [0.81, 0.91] },
    rocky: { count: 4, orbit: 580, radius: [128, 195], aspect: [0.45, 0.72] },
    darkwood: { count: 5, orbit: 500, radius: [290, 380], aspect: [0.66, 0.96] },
    snow: { count: 3, orbit: 490, radius: [420, 470], aspect: [0.80, 0.94] },
    desert: { count: 5, orbit: 580, radius: [195, 285], aspect: [0.56, 0.75] },
    jungle: { count: 3, orbit: 450, radius: [540, 610], aspect: [0.88, 1] },
    geyser: { count: 10, orbit: 560, radius: [125, 225], aspect: [0.65, 0.96] },
  },
  scatterDensity: {
    meadow: 26, mud: 30, rocky: 36, lake: 24, darkwood: 56,
    snow: 33, desert: 42, jungle: 52, canyon: 28, geyser: 28,
  },
  planCacheSize: 96,
  campChance: 1 / 12,
  treasureChance: 1 / 25,
  giverChance: 1 / 3,
  activityRadius: 110,
  targetDistance: 90,
  featureRadius: 315,
  placementClearance: 20,
} as const;

// --- traits + movement (W2) --------------------------------------------------------------------

export const WORLD_DRIVE = {
  car: { speed: 240, speedPerStat: 36, accel: 290, accelPerStat: 45, turn: 1.9, turnPerStat: 0.27 },
  dino: { speed: 240, speedPerStat: 36, accel: 340, accelPerStat: 35, turn: 2.7, turnPerSize: 0.35 },
  reverseSpeed: 0.42,
  brakeDeceleration: 2.2,
  coastDeceleration: 0.65,
  lateralDeceleration: 2,
  colliderRadius: [18, 24, 32, 42],
  maxStepSeconds: 1 / 60,
  maxStepDistance: 8,
  bounce: 0.28,
  groundBounce: 0.16,
  jumpAlignment: Math.cos(Math.PI / 4),
  jumpSeconds: 0.24,
  jumpSecondsPerLevel: 0.1,
  gapMinSpeed: 0.55,
} as const;

// Indexed by ability level (0..3). Speed is relative to the creation's road speed.
export const WORLD_SURFACES = {
  open: { speed: [1, 1, 1, 1], grip: [1, 1, 1, 1] },
  dirtRoad: { speed: [0.92, 0.92, 0.92, 0.92], grip: [0.86, 0.86, 0.86, 0.86],
    handling: [0.94, 1.05, 0.88] },
  rockyRoad: { speed: [0.79, 0.79, 0.79, 0.79], grip: [0.83, 0.83, 0.83, 0.83],
    handling: [0.86, 1.15, 0.93], bumpGripLoss: 0.13, bumpDrag: 0.32 },
  grass: { speed: [0.9, 0.9, 0.9, 0.9], grip: [0.88, 0.88, 0.88, 0.88] },
  tallGrass: { speed: [0.35, 0.49, 0.72, 0.92], grip: [0.45, 0.65, 0.8, 0.95] },
  sand: { speed: [0.38, 0.52, 0.75, 0.94], grip: [0.45, 0.6, 0.75, 0.9] },
  snow: { speed: [0.29, 0.45, 0.67, 0.9], grip: [0.31, 0.49, 0.7, 0.92] },
  ice: { speed: [0.27, 0.42, 0.64, 0.86], grip: [0.12, 0.24, 0.52, 0.79] },
  mud: { speed: [0.28, 0.46, 0.69, 0.92], grip: [0.28, 0.48, 0.71, 0.93] },
  deepMud: { speed: [0.17, 0.33, 0.58, 0.85], grip: [0.18, 0.35, 0.61, 0.87] },
  rough: { speed: [0.33, 0.49, 0.72, 0.92], grip: [0.38, 0.57, 0.77, 0.92] },
  shallow: { speed: [0.29, 0.43, 0.68, 0.88], grip: [0.32, 0.51, 0.73, 0.9] },
  deep: { speed: [0, 0, 0.55, 0.82], grip: [0, 0, 0.64, 0.84] },
  hotSpring: { speed: [0.25, 0.44, 0.68, 0.9], grip: [0.27, 0.47, 0.71, 0.91] },
  cliff: { speed: [0, 0, 0, 0], grip: [0, 0, 0, 0] },
} as const;

export const WORLD_TERRAIN = {
  darkSpeed: [0.24, 0.3, 0.7, 1],
  daylightRadius: 1100,
  darkRadius: [140, 210, 340, 520],
  dinoGripBonus: 0.08,
} as const;

// --- terrain renderer (W5b) -------------------------------------------------------------------
export const WORLD_TERRAIN_RENDER = {
  /** World-space edge length; terrain samples are taken at cellSize intervals. */
  chunkSize: 512,
  cellSize: 8,
  cacheChunks: 64,
  bakePerFrame: 2,
  prefetchRings: 2,
  /** Overlay opacity at maximum surface darkness. */
  darknessAlpha: 0.72,
  /** Light pool radius in world pixels, indexed by the creation's light trait. */
  lightRadius: [0, 145, 245, 365],
} as const;

// --- save + shell (W3) -------------------------------------------------------------------------
export const WORLD_SAVE = { claimedLimit: 500, defaultReading: 'easy' } as const;

// --- quests (W4) -------------------------------------------------------------------------------
export const QUESTS = {
  /** How far the caller looks for biomes when building the nearby lookup. */
  nearbyRings: 3,
  fetchChance: 0.5,
  duckChance: 0.5,
  stars: { fetch: 3, deliver: 2 },
  wordLimit: { starter: 5, easy: 8, medium: 12, hard: 16 },
} as const;

// --- scene host (W5a) -------------------------------------------------------------------------
export const WORLD_HOST = {
  camera: { soloZoom: 1.8, splitZoom: 1.6, carScreenY: 0.68, rotTau: 0.16, maxAngVel: 6 },
  maxFrameSeconds: 0.1,
  spawnSpacing: 110,
  saveEverySeconds: 5,
  saveDebounceSeconds: 0.35,
  stickDeadZone: 0.18,
  pushSpeed: 150,
  objectRings: 1,
  roofFadeAlpha: 0.2,
  roofFadeTau: 0.14,
  playerLengths: [96, 120, 146, 176],
  playerColors: [0xffd266, 0x80e5ff],
  quickSeed: 29,
} as const;

// --- play (W6) --------------------------------------------------------------------------------
export const WORLD_PLAY = {
  // Acceleration, coasting drag and sideways grip at ability level zero.
  handling: {
    grass: [0.9, 1.1, 0.95],
    tallGrass: [0.65, 1.5, 1],
    sand: [0.68, 1.45, 0.78],
    snow: [0.62, 1.35, 0.75],
    ice: [0.6, 0.18, 0.06],
    mud: [0.58, 1.25, 0.23],
    deepMud: [0.36, 1.7, 0.20],
    rough: [0.72, 1.25, 0.86],
    shallow: [0.58, 1.85, 0.72],
    deep: [0.5, 2.2, 0.62],
    hotSpring: [0.54, 1.9, 0.7],
  },
  desert: { buildSeconds: 14, recoverSeconds: 5, maxPenalty: 0.22, shade: 0.35, heatForImmunity: 2 },
  ventSeconds: 0.36,
  homeRadius: 105,
  bumpCooldown: 0.65,
  pushSpeed: 150,
} as const;

// --- activities (W7) ---------------------------------------------------------------------------
export const WORLD_ACTIVITIES = {
  nearbyRings: 1,
  ringJump: {
    catchRadius: 78,
    timeoutSeconds: 24,
    firstRingOffset: 42,
    ringSpacing: 45,
    ringCountByJump: [1, 1, 2, 3],
    ringSize: 54,
  },
  quickSearchRings: 12,
  quickSpawnInset: 0.4,
  duckParade: {
    duckSpacing: 42, followSpeed: 155, maxSpeed: 155, pondRadius: 105, scatterDistance: 300,
    tooFastSeconds: 0.3, scatterSeconds: 0.8, scatterSpeed: 245, timeoutSeconds: 38,
  },
  hideSeek: { hideRadius: 145, dinoPassDistance: 260, requiredSeconds: 3, maxSeconds: 14, caughtDistance: 105, passSeconds: 2.8 },
  boulderPush: { timeoutSeconds: 55, contactRadius: 100, minPush: 2, minSpeed: 12, rollSpeed: 30, rollSpeedPerLevel: 16, maxRollSpeed: 100, spotRadius: 30, rockOffsetX: 82, rockOffsetY: -30, blockedSeconds: 4 },
  fruitShake: { timeoutSeconds: 55, treeBaseRadius: 94, treeRadiusPerReach: 22, fruitContactRadius: 88, rollSpeed: 55, rollSpeedPerReach: 10, basketOffsetX: 150, basketOffsetY: 95, dropOffsetX: 44, dropOffsetY: 28, shakeSpeed: 12, bumpAlignment: -0.05, basketRadius: 30, missedReachSeconds: 8 },
  digSpot: {
    radius: 44, parkSpeed: 22, digSeconds: [0, 2.4, 1.6, 1.05],
    stuckSeconds: 0.85, timeoutSeconds: 42,
  },
  islandSwim: {
    minWater: 2, catchRadius: 52, swimDistance: 36, timeoutSeconds: 32,
    stayNear: 440, splashSeconds: 0.9, buoyStep: 88,
  },
  gateDash: { halfWidth: 47, timeoutSeconds: 16 },
  lanternCave: {
    maxHeight: 2, touchRadiusByLight: [21, 28, 33, 40], glowRadius: 91, timeoutSeconds: 28,
    celebrationSeconds: 0.85,
  },
  herdSheep: {
    penRadius: 59, nudgeRadius: 75, nudgeMinSpeed: 14, nudgeSpeed: 77,
    honkRadius: 110, honkRadiusPerLoud: 19, honkStride: 40, honkStridePerLoud: 25,
    fleeSpeed: 185, playRadius: 355, timeoutSeconds: 55,
  },
} as const;

// --- input (S1) --------------------------------------------------------------------------------
export const TOUCH = {
  /** Stick spawns where a thumb lands in the left share of the screen. */
  stickZone: 0.45,
  stickRadius: 150,
  /** Fraction of the stick radius that is ignored. */
  deadZone: 0.15,
  /** Keep the stick base fully on screen. */
  stickMargin: 40,
  knobRadius: 62,
  /** Diamond of buttons, bottom-right: centre, offset of each button from it, button radius (px logical). */
  buttonCenter: { x: 1650, y: 830 },
  buttonOffset: 115,
  buttonRadius: 70,
  /** Hit area grows a little so kids do not miss. */
  hitScale: 1.15,
  idleAlpha: 0.8,
  activeAlpha: 0.95,
  depth: 1000,
  extraPointers: 3,
} as const;

// --- buttons (S3) ------------------------------------------------------------------------------
export const BUTTONS = {
  /** Pad colors, shared by the legend and the touch buttons. */
  colors: { a: 0x2fbf5a, b: 0xe5484d, x: 0x2f7de1, y: 0xf5b81c },
  /** Touch pause button (top-left corner; the minimap is top-right). */
  pause: { x: 70, y: 70, radius: 48, hitScale: 1.4 },
  /** Always-on legend in the bottom-left of each player view. */
  legend: { margin: 22, glyph: 56, icon: 64, gap: 26, alpha: 0.92 },
  /** Cards (Lab / pause). Tap targets are at least `minTap` px. */
  card: { width: 760, minTap: 120, fontSize: 48, titleSize: 56, dim: 0.5, rowHeight: 130, rowGap: 22, btnWidth: 260, btnHeight: 140 },
  /** Stick must pass this to move the pad selection; it re-arms below `navRelease`. */
  navThreshold: 0.6,
  navRelease: 0.3,
  /** Honk / roar sound rings around the creation. */
  honk: { rings: 3, stagger: 0.12, seconds: 0.7, startScale: 0.4, endScale: 2.2, cooldown: 0.35, size: 256 },
  poof: { seconds: 0.5, scale: 2.2 },
  /** Pulsing A badge above a creation. */
  badge: { lift: 150, size: 96, pulse: 0.12, pulseSeconds: 0.45 },
  depth: 2000,
} as const;

// --- quests runtime + HUD (W8) ---
export const WORLD_QUEST_HUD = {
  talkRadius: 145,
  pickupRadius: 72,
  pickupHintRadius: 155,
  targetRings: 5,
  targetRefreshSeconds: 0.35,
  targetRefreshDistance: 120,
  carryLift: 114,
  carrySize: 55,
  bannerSeconds: 2.4,
  popupSeconds: 1.25,
  popupLift: 112,
  popupRise: 85,
  questCardWidth: 680,
  questCardHeights: [94, 126, 168],
  questCardGap: 12,
  questFont: 40,
  starFont: 48,
} as const;
