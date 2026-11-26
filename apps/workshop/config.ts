/**
 * Adventure Workshop tunables. Packages may ADD keys inside their own section only.
 * No magic numbers in screens/logic: put them here.
 */

export const STAGE = { w: 1920, h: 1080 } as const;

// ---------------------------------------------------------------- engine (apps/workshop/logic)
/** Bump when challenges are built, worded or checked differently; saved open cards are then re-dealt on load. */
export const CHALLENGE_RULES_VERSION = 11;

/**
 * Easy shows only these aspects per workshop (the others stay pinned to their first starter; parts bought there
 * are kept and return on Medium/Hard). Chosen by a coverage search over the real solver: 19 of 22 race facets and
 * 20 of 26 dino facets stay solvable, and the picks include parts kids love to watch change.
 */
export const WS_EASY_ASPECTS: Readonly<Record<string, readonly string[]>> = {
  race: ['wheels', 'engine', 'paint', 'size'],
  dino: ['color', 'teeth', 'body', 'size'],
};

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
  /** Failure lines (each naming a fix) on the results screen and remembered on the card. */
  failLinesMax: 2,
  recentTriesPerPlayer: 300,
  /** New challenges: every solution must differ from the last winning build in at least this many aspects (relaxed to 1 if impossible, never 0). */
  minChangedAspects: 2,
  /** Maximum unfinished challenges retained (active ones never dropped). */
  maxSavedChallenges: 60,
  /** Generator: first-time wins per tier step (tier = min(maxTier, floor(firstWins / winsPerTier))). */
  winsPerTier: 3,
  maxTier: 6,
  /** Random generator attempts before searching fallback candidates. */
  genAttempts: 200,
  genVersion: 3,
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
  /** Room's touch Back button: smaller and tucked into the top-left corner, clear of the part buttons below it. */
  roomBack: { x: 92, y: 50, w: 170, h: 88, fontSize: 40 },
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
    starter: 'Hop in!',
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
  /** Admin gear gate: a x b with both factors in [min, max]. */
  gateMin: 6,
  gateMax: 9,
  gateMaxDigits: 3,
  /** Grown-up screen text size (>= 36 px) and list metrics. */
  font: 40,
  rowH: 84,
  visibleRows: 9,
  /** Admin gear icon: faint visible size and the larger invisible pointer hit area (px). */
  gearSize: 56,
  gearHit: 150,
  gearAlpha: 0.35,
} as const;

/** Wallet badge centres in pane coordinates; touchRoom/touchBoard leave the shared touch Back target clear. */
export const WS_WALLET = {
  wide: { x: 126, y: 80 }, tall: { x: 480, y: 80 },
  /** Touch-only placements leave the shared top-left Back target clear. */
  touchRoom: { x: 385, y: 80 }, touchBoard: { x: 126, y: 185 },
} as const;

export const WS_BUDDIES = {
  winsPerUnlock: 10,
  celebrationMs: 2200,
  driftMs: 720,
  peekMs: 240,
  hopMs: 175,
  /** Room flight arcs and the final pose when the buddy points at a station. */
  fly: { arc: 0.22, minTurnPx: 50, maxOffsetPx: 130, maxTiltDeg: 55, flipDeadPx: 24, perchGapPx: 12 },
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
  /** At most this many stations (Easy) uses the roomier 4-station layout. */
  fewStations: 4,
  /** Character walk speed, px/s. */
  walkSpeed: 520,
  /** Seconds between footstep sounds while walking, and the walk bob height (px). */
  stepSec: 0.27,
  bobPx: 12,
  /** Character height (px). */
  charH: 150,
  /** Side-view model scale in the room (before fitting into the model area) per layout. */
  modelScale: { wide: 1.5, tall: 0.95 },
  /** Largest dino room model may extend this fraction above its nominal height box. */
  dinoTopOverhang: 0.145,
  /** Keep the tallest room silhouette this far below the pane edge and buttons. */
  modelTopClearancePx: 16,
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
  /** Station screen swatches: swatch size (px) and gap between swatches per layout. */
  swatchSize: { wide: 250, tall: 190 },
  swatchGap: { wide: 40, tall: 25 },
  /** Strip: fraction of a neighbouring swatch left peeking beyond the selected one, and the edge-scroll tween (ms). */
  swatchPeek: 0.5,
  swatchScrollMs: 220,
  /** Board: detail font sizes tried from large to small (px). */
  detailFontsWide: [68, 64, 60, 56, 52, 48, 44, 40],
  detailFontsTall: [56, 52, 48, 44, 40],
  detailLineGap: 1.28,
  /** Text color of a remembered failure hint in the challenge detail (dark blue, high contrast on white). */
  hintText: 0x1d4e89,
} as const;

// ---------------------------------------------------------------- results (apps/workshop/screens)
export const WS_RESULTS = {
  /** Neutral colors for unreached checks at full opacity. */
  unreachedText: 0x30394e,
  unreachedBadge: 0xdddddd,
} as const;

// ---------------------------------------------------------------- runs (apps/workshop/run)
export const WS_RUN = {
  /** Timing shared by the short, one-part practice scenes. */
  practice: { approachMs: 1350, actionMs: 1650, reactionMs: 450, holdMs: 1250, cutMs: 180 },
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
  hill: {
    slope: [0.32, 0.52, 0.74],
    climbMs: 2900,
    stallProgress: [0.62, 0.54, 0.46],
  },
  snow: {
    length: [500, 690, 880],
    depth: [45, 76, 108],
    sink: [16, 29, 43],
    sprayMs: [90, 68, 50],
  },
  lowBridge: {
    clearance: [45, 31, 18],
    overlap: [19, 30, 42],
    length: [470, 510, 550],
  },
  wobbly: {
    span: [750, 840, 930],
    restSag: [18, 32, 50],
    passSag: [32, 46, 60],
    failSag: [96, 132, 160],
  },
  narrow: {
    clearance: [38, 16],
    overlap: [20, 38],
    length: [94, 130],
  },
  parade: {
    colors: ['#e8434a', '#2fb84f', 'rainbow'],
    approachMs: 1950,
    processionMs: 2250,
    judges: [1, 2, 3],
  },
  river: {
    width: [725, 1130],
    crossingMs: [2600, 3270],
    approachMs: 1850,
    floatDepth: 34,
    bob: [8, 13],
  },
  beach: {
    distance: [3450, 4700, 6200],
    cruiseMs: 3450,
    fuelLeft: [0.28, 0.21, 0.14],
    shortfall: [360, 470, 575],
  },
  night: {
    campsites: [2, 3],
    quietMs: [2500, 3000],
    hideApproachMs: 2320,
    combinedHideApproachMs: 700,
    beamMs: 1780,
    shadowAlpha: 0.62,
  },
  fog: {
    approachMs: 2050,
    stopGap: 155,
    crossingMs: 1550,
    duckIntervalMs: 260,
    dullAlpha: 0.62,
  },
  jump: {
    gap: [520, 760, 1060],
    rampHeight: [130, 185, 240],
    runUpMs: 1950,
    flightMs: [1160, 1310, 1460],
    landingBounce: [27, 42, 56],
  },
  rocks: {
    count: [2, 3, 4],
    rockHeight: [48, 63, 79],
    boulderHeight: [122, 164],
    logLength: [300, 420],
    logHeight: [106, 156],
    actionMs: 4800,
  },
  turn: {
    radius: [150, 135, 112],
    roadWidth: [210, 196, 178],
    slideMs: 1250,
    driveMs: [4400, 4650, 4900],
  },
  mud: {
    width: [500, 690, 900],
    depth: [96, 128, 174],
    gripSink: [12, 21, 31],
    slipSink: [48, 68, 91],
    pullWidth: [530, 680],
    tractorScale: [0.95, 1.22],
    actionMs: 5100,
  },
  delivery: {
    boxes: [4, 6, 8],
    boxScale: 0.74,
    slope: 0.48,
    stallProgress: 0.46,
    actionMs: 5100,
  },
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
  /** Ground contacts follow the walk and run bob cycles in the dino rig. */
  dinoStepMs: { walk: 380, run: 210 },
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
