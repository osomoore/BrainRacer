/**
 * Adventure Workshop tunables. Packages may ADD keys inside their own section only.
 * No magic numbers in screens/logic: put them here.
 */

export const STAGE = { w: 1920, h: 1080 } as const;

// ---------------------------------------------------------------- engine (apps/workshop/logic)
export const WS_RULES = {
  /** Offered challenges on the board. */
  boardSize: 3,
  /** Admin Mode sandbox challenge count. */
  adminBoardSize: 10,
  /** Failed attempts on one challenge before its hint shows. */
  hintAfterFails: 3,
  /** New challenges: every solution must differ from the last winning build in at least this many aspects (relaxed to 1 if impossible, never 0). */
  minChangedAspects: 2,
  /** Completed challenges kept in the save (oldest dropped first, active ones never). */
  maxSavedChallenges: 60,
  /** Generator: first-time wins per tier step (tier = min(maxTier, floor(firstWins / winsPerTier))). */
  winsPerTier: 3,
  maxTier: 6,
  /** Generator attempts before giving up on one board slot (then a completed challenge fills it). */
  genAttempts: 200,
  genVersion: 1,
} as const;

// ---------------------------------------------------------------- shell / UI (apps/workshop/shell, ui)
export const WS_UI = {
  /** Minimum gameplay text size (projector rule). */
  minFont: 40,
  font: '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif',
  colors: {
    ink: 0x1b1b3a,
    paper: 0xffffff,
    yellow: 0xffd23f,
    green: 0x2fb84f,
    red: 0xe8232a,
    blue: 0x2b8cff,
    focus: 0xffd23f,
    p1: 0xff5a5f,
    p2: 0x2bb3ff,
  },
  /** Minimum tap target (px) for any button a kid presses. */
  tapMin: 120,
  radius: 28,
  maxPlayers: 2,
  /** Pane divider width in 2-player mode. */
  dividerW: 12,
  /** Reading-level sample sentences (profile creation / reading screens). */
  readingSamples: {
    easy: 'The red car can go.',
    medium: 'Build a car that can cross the muddy field.',
    hard: 'Equip your vehicle with enough traction to cross slippery ground.',
  },
} as const;

// ---------------------------------------------------------------- admin (apps/workshop/shell/admin)
export const WS_ADMIN = {
  /** Mobile gear gate: a x b with both factors in [min, max]. */
  gateMin: 6,
  gateMax: 9,
  gateMaxDigits: 3,
  /** Grown-up screen text size (>= 36 px) and list metrics. */
  font: 40,
  rowH: 84,
  visibleRows: 9,
  /** Mobile gear icon: faint visible size and the larger invisible tap area (px). */
  gearSize: 56,
  gearHit: 150,
  gearAlpha: 0.35,
} as const;

// ---------------------------------------------------------------- room / station / board (apps/workshop/screens)
export const WS_ROOM = {
  /** Character walk speed, px/s. */
  walkSpeed: 520,
} as const;

// ---------------------------------------------------------------- runs (apps/workshop/run)
export const WS_RUN = {
  /** Target length of one stage animation, seconds (keep runs short so kids retry a lot). */
  stageSec: 7,
  /** Fake camera roll between side and top views, seconds. */
  viewRollSec: 0.7,
  /** Fixed physics step (cosmetic physics only; never decides pass/fail). */
  physicsHz: 60,
} as const;

// ---------------------------------------------------------------- art (apps/workshop/art)
export const WS_ART = {
  /** Side-view model height in the room at scale 1 (medium size), px. */
  modelSideH: 300,
} as const;

// ---------------------------------------------------------------- audio (apps/workshop/audio)
export const WS_AUDIO = {
  musicVolume: 0.5,
  sfxVolume: 0.8,
} as const;
