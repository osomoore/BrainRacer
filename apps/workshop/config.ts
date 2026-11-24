/**
 * Adventure Workshop tunables. Packages may ADD keys inside their own section only.
 * No magic numbers in screens/logic: put them here.
 */

export const STAGE = { w: 1920, h: 1080 } as const;

// ---------------------------------------------------------------- engine (apps/workshop/logic)
export const WS_RULES = {
  /** Offered challenges on the board. */
  boardSize: 3,
  startWallet: 4,
  basePrice: 2,
  /** Price of the shop-order index i >= 1 is priceStep x i (index 0 costs basePrice): 2, 3, 6, 9, 12 ... */
  priceStep: 3,
  offersPerAspect: 2,
  payoutPerRequirement: 1,
  adminCurrencyGrant: 10,
  /** Admin Mode sandbox challenge count. */
  adminBoardSize: 10,
  /** Failed attempts on one challenge before its hint shows. */
  hintAfterFails: 3,
  /** New challenges: every solution must differ from the last winning build in at least this many aspects (relaxed to 1 if impossible, never 0). */
  minChangedAspects: 2,
  /** Maximum unfinished challenges retained (active ones never dropped). */
  maxSavedChallenges: 60,
  /** Generator: first-time wins per tier step (tier = min(maxTier, floor(firstWins / winsPerTier))). */
  winsPerTier: 3,
  maxTier: 6,
  /** Random generator attempts before searching fallback candidates. */
  genAttempts: 200,
  genVersion: 2,
  /** Chance that a new challenge is preferred to need the most recently bought variant. */
  newestChance: 0.4,
  /** Generator shape per tier (index = tier, last row repeats): stage count range and requirements-per-stage range. */
  tierTable: [
    { stages: [1, 1], reqs: [1, 1] },
    { stages: [1, 1], reqs: [1, 2] },
    { stages: [1, 2], reqs: [1, 1] },
    { stages: [2, 2], reqs: [1, 2] },
    { stages: [2, 3], reqs: [1, 2] },
  ] as ReadonlyArray<{ stages: readonly [number, number]; reqs: readonly [number, number] }>,
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
  /** Ignore another Back press for this long after leaving a variant or part view (ms). */
  backGuardMs: 500,
  radius: 28,
  maxPlayers: 2,
  titleJoin: { cardW: 760, cardH: 210, cardY: 520, textGap: 8 },
  /** Pane divider width in 2-player mode. */
  dividerW: 12,
  /** Admin status marker in the top-right edge of the stage. */
  adminPill: { inset: 5, h: 40, padX: 16, font: 28 },
  /** Reading-level sample sentences (profile creation / reading screens). */
  readingSamples: {
    easy: 'The red car can go.',
    medium: 'Build a car that can cross the muddy field.',
    hard: 'Equip your vehicle with enough traction to cross slippery ground.',
  },
  /** Public-beta notice on the title screen (grown-ups read it; never shown during runs). */
  beta: {
    line1: 'Under construction — progress may be lost.',
    line2: 'Thanks for testing! Tell us what you think.',
    y: 895, w: 1500, h: 124, fill: 0xfff4c2,
    // The canvas fits a fixed 1920 × 1080 stage even on phones.
    mobile: { y: 906, w: 1700, h: 300, headingY: 866, headingSize: 84, detailY: 1000, detailSize: 76, playY: 615 },
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

/** Wallet badge centre in pane coordinates; the same on every screen that shows it, per layout. */
export const WS_WALLET = { wide: { x: 126, y: 80 }, tall: { x: 480, y: 80 } } as const;

export const WS_BUDDIES = {
  winsPerUnlock: 10,
  celebrationMs: 2200,
  driftMs: 720,
  peekMs: 240,
  hopMs: 175,
  /** Room flight arcs and the final pose when the buddy points at a station. */
  fly: { arc: 0.22, minTurnPx: 50, maxOffsetPx: 130, maxTiltDeg: 55, flipDeadPx: 24 },
  run: {
    size: { wide: 150, tall: 110 },
    leadMs: 1150,
    slowHoldMs: 280,
    movingPxSec: 150,
    slowPxSec: 85,
    followRate: 10,
  },
  room: {
    wide: { signX: 1450, signY: 110, barX: 405, barW: 64, buddyX: 1490, buddySize: 170 },
    tall: { signX: 480, signY: 192, barX: 284, barW: 52, buddyX: 678, buddySize: 112 },
  },
  signW: 230,
  signH: 128,
  barY: 550,
  barH: 516,
} as const;

// ---------------------------------------------------------------- room / station / board (apps/workshop/screens)
export const WS_ROOM = {
  /** Character walk speed, px/s. */
  walkSpeed: 520,
  /** Seconds between footstep sounds while walking, and the walk bob height (px). */
  stepSec: 0.27,
  bobPx: 12,
  /** Character height (px). */
  charH: 150,
  /** Side-view model scale in the room (before fitting into the model area) per layout. */
  modelScale: { wide: 1.5, tall: 0.95 },
  /** Station sign size per layout (px). */
  signSize: { wide: { w: 300, h: 170 }, tall: { w: 230, h: 160 } },
  /** Station screen: camera zoom tween, sparkle burst before returning to the room (ms), max total scale. */
  stationZoomMs: 550,
  stationConfirmMs: 650,
  stationMaxScale: 4.2,
  /** Bumpers station: empty world px kept beyond both bumpers, and the screen-side margin (px), so front AND rear show. */
  stationBumperPadPx: 70,
  stationBumperMarginPx: 90,
  /** Screen-space margin around the suspension preview, including room for idle bob. */
  stationSpringsMarginPx: 24,
  /** Keep the wheels visible while showing the springs behind them. */
  stationSpringsWheelAlpha: 0.4,
  /** Station screen swatches: visible count per layout, swatch size (px). */
  swatchVisible: { wide: 5, tall: 3 },
  swatchSize: { wide: 250, tall: 220 },
  /** Board: side-view model scale (wide / tall), detail font sizes tried from large to small (px). */
  boardModelScale: { wide: 1.05, tall: 0.7 },
  detailFontsWide: [52, 48, 44, 40],
  detailFontsTall: [48, 44, 40],
  detailLineGap: 1.28,
} as const;

/** Board part view: zoom onto the selected part, and the cycle arrows beside it. */
export const WS_PARTVIEW = {
  /** Largest zoom factor, fraction of the view the zoomed part should fill, zoom tween (ms). */
  zoomMax: 3,
  fill: 0.7,
  zoomMs: 420,
  /** Arrow button size (px), pulse scale and duration (ms). */
  arrowSize: 80,
  pulseScale: 1.3,
  pulseMs: 200,
  /** Aspects left out of the part walk (nothing to see on the vehicle). */
  skip: ['gears'],
} as const;

// ---------------------------------------------------------------- results (apps/workshop/screens)
export const WS_RESULTS = {
  /** Neutral colors for unreached checks at full opacity. */
  unreachedText: 0x30394e,
  unreachedBadge: 0xdddddd,
} as const;

// ---------------------------------------------------------------- runs (apps/workshop/run)
export const WS_RUN = {
  /** Target length of one stage animation, seconds (keep runs short so kids retry a lot). */
  stageSec: 7,
  /** Fake camera roll between side and top views, seconds. */
  viewRollSec: 0.7,
  /** Quick wipe between two stages with the same view, seconds. */
  wipeSec: 0.45,
  /** How long a failure gag is held at the end, ms. */
  failHoldMs: 1500,
  /** Pause after a success celebration before the car leaves, ms. */
  winHoldMs: 700,
  /** Fixed physics step (cosmetic physics only; never decides pass/fail). */
  physicsHz: 60,
  /** Success coast: a car still rolling when the cheer starts decelerates smoothly (min speed to bother, max speed, max duration ms). */
  coastMinSpeed: 60,
  coastMaxSpeed: 900,
  coastMaxMs: 1100,
} as const;

// ---------------------------------------------------------------- art (apps/workshop/art)
export const WS_ART = {
  /** Side-view model height in the room at scale 1 (medium size), px. */
  modelSideH: 300,
  /** Art reviewer: body opacity on the springs sheet so the springs show through. */
  reviewSpringsBodyAlpha: 0.35,
  /** Art reviewer: wheel opacity on the springs sheet so springs behind the wheels show. */
  reviewSpringsWheelAlpha: 0.4,
  /** Extra ride height of the race car body over its wheels (side view), px; springs lengthen to match. */
  raceRideRaise: 9,
  /** Smallest visible gap (px) between the tire top and the body's lower edge, so the coil shows (the ride raise grows to fit big tires). */
  raceSpringGapMin: 24,
} as const;

// ---------------------------------------------------------------- audio (apps/workshop/audio)
export const WS_AUDIO = {
  musicVolume: 0.5,
  /** Workshop-room beds by workshop. */
  sceneMusic: { race: 'raceShop', dino: 'dinoLab' },
  /** Challenge-run cues by workshop. */
  runMusic: { race: 'raceRun', dino: 'dinoRun' },
  sfxVolume: 0.8,
  /** Music crossfade between tracks, seconds. */
  musicFadeSec: 0.65,
  /** Music level (fraction) while a sting plays, and the ramps around it. */
  duckLevel: 0.25,
  duckAttackSec: 0.08,
  duckReleaseSec: 0.6,
  /** Polyphony limits for one-shot sfx. */
  maxVoicesPerSfx: 4,
  maxVoicesTotal: 16,
  /** Ignore the same sfx retriggered within this many seconds. */
  minReplayGapSec: 0.03,
} as const;

// ---------------------------------------------------------------- fog look (apps/workshop/run/common/fogFx.ts)
export const WS_FOG = {
  /** Default look without a `&fog=a|b|c|d` dev query: a = drifting bands, b = depth haze, c = patchy clouds, d = mix. */
  defaultLook: 'd',
  /** Strength multiplier when the car is bright (pass) vs dull (fail, the fog swallows it). */
  brightMul: 0.8,
  dullMul: 1.25,
  /** Drifting band layers (far to near): drift speed px/s, alpha, vertical centre as screen fraction. */
  bands: { layers: 3, speed: [10, 20, 34], alpha: [0.2, 0.28, 0.34], yFrac: [0.58, 0.72, 0.86] },
  /** Depth haze: alpha at the top and at the horizon, where the clear zone starts (gradient fraction). */
  haze: { top: 0.55, horizon: 0.72, clearFrom: 0.8, color: '#e6ecf0' },
  /** Patchy clouds: count, alpha, drift speed px/s, scale range. */
  clouds: { count: 6, alpha: 0.5, speed: [24, 48], scale: [1.6, 2.8] },
  /** Dull car alpha in the fog fail (fades but stays findable). */
  dullCarAlpha: 0.42,
} as const;
