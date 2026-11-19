/**
 * ALL gameplay tunables live here. Orchestrator-owned contract: sub-agents may READ any value,
 * and may ADD new keys only inside the section for their own package (mark with the package id),
 * never rename/remove existing keys.
 */
import type { CarKind, ChallengeKind, Difficulty, Settings, VehicleSpec } from '../core/types';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const TILE_SIZE = 128;

export const PLAYER_COLORS = ['#2ecc40', '#ff3b30'] as const;      // P1 green (dino), P2 red (kart)
export const ANSWER_COLORS = ['#1e6fff', '#ffcc00', '#ff3b30', '#2ecc40'] as const; // X blue, Y yellow, B red, A green
export const ANSWER_LABELS = ['X', 'Y', 'B', 'A'] as const;

/** Render depth layers (higher draws on top). */
export const DEPTH = {
  ground: 0,
  decal: 5,         // skid marks, goal ring floor glow
  ramp: 8,
  prop: 10,
  shadow: 12,
  vehicle: 20,
  building: 25,     // roofs (cars can't drive under them)
  sign: 26,
  airborne: 30,
  dino: 40,
  fx: 50,
  worldUi: 60,      // world-space labels, beacon
} as const;

/** Matter collision categories (bit flags). */
export const CAT = {
  static: 0x0001,
  player: 0x0002,
  traffic: 0x0004,
  police: 0x0008,
  prop: 0x0010,
  sensor: 0x0020,
  dino: 0x0040,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  players: [
    { device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal', car: 'dino' },
  ],
  challengeMode: 'words',
  questionStyle: 'pause',
  challengeIntervalSec: 10,
  roundLengthSec: 300,
  goalPointsPerCar: 3,
  seed: 0,
  musicVolume: 0.6,
  sfxVolume: 0.8,
};

// ───────────────────────── challenges (package B) ─────────────────────────
export interface DifficultyProfile {
  periodMultiplier: number;           // period = challengeIntervalSec * this
  typeWeights: Record<ChallengeKind, number>;
  math: { minA: number; maxA: number; minB: number; maxB: number; maxSum: number; requireCarry: boolean };
  words: { simpleOnly: boolean; allowMultiWord: boolean; sameCategoryDistractors: boolean };
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    periodMultiplier: 1.5,
    typeWeights: { picToWord: 30, math: 30, wordToPic: 40 },
    math: { minA: 1, maxA: 9, minB: 1, maxB: 9, maxSum: 10, requireCarry: false },
    words: { simpleOnly: true, allowMultiWord: false, sameCategoryDistractors: false },
  },
  normal: {
    periodMultiplier: 1.0,
    typeWeights: { picToWord: 34, math: 33, wordToPic: 33 },
    math: { minA: 10, maxA: 25, minB: 1, maxB: 9, maxSum: 30, requireCarry: false },
    words: { simpleOnly: false, allowMultiWord: false, sameCategoryDistractors: true },
  },
  hard: {
    periodMultiplier: 0.7,
    typeWeights: { picToWord: 40, math: 35, wordToPic: 25 },
    math: { minA: 12, maxA: 89, minB: 12, maxB: 89, maxSum: 150, requireCarry: true },
    words: { simpleOnly: false, allowMultiWord: true, sameCategoryDistractors: true },
  },
};

export const CHALLENGE = {
  placeTriggerRadius: 260,     // px from building sign
  placeCooldownSec: 60,        // per player per place word
  resultHoldSec: 0.7,          // show correct/wrong state before fading
  popInSec: 0.35,
  slideUpSec: 0.35,
  firstChallengeDelaySec: 3,   // after GO
  // package B additions
  placeWordToPicChance: 0.5,       // place challenge: word->pictures (else picture->words)
  hardForgotCarryChance: 0.7,      // hard math: chance the "forgot to carry" distractor is included
  normalTensDistractorChance: 0.5, // normal math: chance the 2nd distractor is +-10
  similarLengthDelta: 2,           // hard words: "similar length" = within this many letters
  teamPan: 0.5,                    // sfx pan magnitude when 2 players
};

// ───────────────────────── vehicles (package F) ─────────────────────────
export const CAR_SPECS: Record<CarKind, VehicleSpec> = {
  dino: { length: 72, width: 40, mass: 14, maxSpeed: 620, reverseSpeed: 200, accel: 360, brake: 1100, turnRate: 2.6, grip: 0.82, drag: 0.6 },
  kart: { length: 60, width: 36, mass: 9,  maxSpeed: 570, reverseSpeed: 220, accel: 440, brake: 1200, turnRate: 3.3, grip: 0.88, drag: 0.7 },
};
/** Tunables for the top-down tire model and collision feedback (package F). */
export const VEHICLE_MODEL = {
  /** Fraction of grip lost at full speed (gentle drift at high speed). */
  highSpeedGripLoss: 0.45,
  /** Steering authority ramps 0..1 over this fraction of maxSpeed. */
  steerRampFrac: 0.3,
  /** Full authority until this speed fraction, then declines to steerTopFactor at 1.0. */
  steerPlateauEnd: 0.6,
  steerTopFactor: 0.8,
  /** Pivot turning (player cars): rad/s at ~0 speed with full stick; blends into normal steering by steerRampFrac. */
  pivotRate: 2.2,
  /** Wall un-stick: holding throttle, nearly stationary, touching a static body. */
  unstick: {
    minThrottle: 0.3,
    speed: 40,          // px/s below which we count as "no progress"
    sec: 0.5,
    cooldownSec: 0.6,
    pushSpeed: 150,     // px/s gentle push away from the wall
    turnRate: 4,        // rad/s the car is rotated toward the wall tangent
    awayTilt: 0.35,     // rad: aim slightly away from the wall rather than along it
    maxAssistSec: 0.6,
    contactMemSec: 0.15, // static contact counts if seen this recently
  },
  /** Angular velocity response rate toward the steering target (1/s). */
  steerResponse: 12,
  /** Slower response used while collision spin is much larger than turnRate (1/s). */
  spinDecay: 5,
  /** Rate (1/s) at which forward speed above the current cap decays (turbo ending, slow). */
  overspeedDecay: 3,
  /** Reverse acceleration as a fraction of accel. */
  reverseAccelFrac: 0.8,
  /** |forward speed| (px/s) below which the brake starts reversing. */
  reverseThreshold: 25,
  /** Matter engine iterations recommended for ~1000 px/s turbo speeds. */
  positionIterations: 10,
  velocityIterations: 8,
  restitution: 0.3,
  /** After a hard hit (velocity jump above this, px/s) the car recoils: weaker throttle, lower grip. */
  recoilTriggerSpeed: 150,
  recoilSec: 0.35,
  recoilThrottle: 0.5,
  recoilGrip: 0.06,
  friction: 0.02,
  chamfer: 8,
  /** Skid marks. */
  skidLateralSpeed: 150,   // px/s sideways slip to start marking
  skidBrakeSpeed: 260,     // px/s forward speed above which hard braking marks
  skidBrakeAmount: 0.7,
  skidFadeSec: 4,
  skidMax: 400,
  skidSpacing: 12,         // px between marks per wheel
  airborneScale: 1.3,
  ghostAlpha: 0.5,
};

/** Collision feedback (package F). */
export const COLLISION = {
  minImpact: 60,          // px/s along the normal to emit vehicle:crash
  bigImpact: 350,         // px/s: crashBig + camera shake
  pairThrottleMs: 250,
  shakeMin: 0.004,
  shakeMax: 0.014,
  shakeMs: 220,
};

export const TRAFFIC_SPEC: VehicleSpec = { length: 64, width: 36, mass: 5, maxSpeed: 240, reverseSpeed: 100, accel: 260, brake: 700, turnRate: 2.4, grip: 0.95, drag: 0.8 };
export const TRUCK_SPEC: VehicleSpec = { length: 120, width: 48, mass: 12, maxSpeed: 180, reverseSpeed: 80, accel: 140, brake: 500, turnRate: 1.6, grip: 0.97, drag: 0.8 };
export const POLICE_SPEC: VehicleSpec = { length: 66, width: 38, mass: 13, maxSpeed: 680, reverseSpeed: 240, accel: 600, brake: 1100, turnRate: 3.0, grip: 0.9, drag: 0.6 };

// ───────────────────────── rewards (package M) ─────────────────────────
export const REWARDS = {
  turboSec: 3,
  turboSpeedMult: 1.6,      // 620*1.6 ≈ 990 > police 680 → turbo escapes police
  turboAccelMult: 2.2,
  flavorSec: 3,
  magnetSec: 5,
  shockwaveRadius: 420,
  shockwaveImpulse: 22,
  // --- package M ---
  turboMaxSec: 8,           // cap when correct answers stack
  flavorWeights: { rainbow: 3, shockwave: 3, ghost: 2, magnet: 2 },
  fxMaxParticles: 520,
  crashSparkMin: 250,
  crashSmokeMin: 500,
  shockwaveSec: 0.4,
  // --- playtest 2: wrong/timeout answers slow the car a little ---
  missSlowMult: 0.7,
  missSlowSec: 1.2,
  timeoutSlowMult: 0.8,
  timeoutSlowSec: 1.0,
  sputterPuffs: 5,
  boostJumpSec: 1.1,
  // --- boost punch-through ---
  turboMassMult: 5,          // player body mass multiplier while turbo is on
  punchImpulse: 0.9,         // px/s thrown at the hit object per px/s of player speed
  punchMax: 900,
  punchSpin: 6,
  punchKeepFrac: 0.9,        // restore the pre-hit speed if it dropped below this fraction
  punchRadius: 150,
  punchCooldownSec: 0.2,
};

// ───────────────────────── world (package C/G) ─────────────────────────
export const WORLD = {
  widthTiles: 48,
  heightTiles: 48,
  waterBorderTiles: 2,
  blockMin: 3,
  blockMax: 6,
  removeRoadChance: 0.12,
  additionalRoadRemovalChance: 0.04,
  mergedFeatureChance: 0.06,
  rampCount: 10,
  rampMinSpeedFrac: 0.4,
  airSecPerSpeed: 1.1 / 620, // airtime = speed * this (≈1.1 s at dino top speed)
  // --- package N (jumps) ---
  airMinSec: 0.5,
  airMaxSec: 1.6,
  rampDirCos: 0.5,           // min |cos(heading - ramp angle)| to launch
  bigAirSec: 1.0,            // airtime above this shows "BIG AIR!"
  spinSpeedFrac: 0.85,       // speed frac above which the car does a 360 spin
  boostLandSearchPx: 700,    // how far ahead a boost jump looks for drivable ground when it lands on a building
  boostJumpMinSpeed: 420,    // boost jumps always launch at least this fast along the heading (frees stuck cars)
  boostJumpPeakScale: 0.55,  // bigger arc for the correct-answer boost jump
  jumpPeakScale: 0.3,        // extra view scale at the peak of the arc
  npcHopScale: 0.12,
  npcHopSec: 0.4,
  // --- package C (generator) ---
  parkChance: 0.15,
  plazaChance: 0.08,
  /** Parks/plazas may never take more than (1 - this) of block interior land. */
  minBuildingFrac: 0.6,
  pondChance: 0.3,
  lotMaxSide: 3,
  alleyChance: 0.35,
  spawnSpacingPx: 100,
  spawnRoadSearchTiles: 4,
  rampSpacingTiles: 6,
  rampW: 128,
  rampH: 96,
  lampEveryTiles: 3,
  hydrantChance: 0.02,
  parkedCarChance: 0.05,
  coneClusters: 6,
};

// ───────────────────────── traffic & police (packages J/K) ─────────────────────────
export const TRAFFIC = {
  maxVehicles: 25,
  truckFraction: 0.2,
  spawnRadiusMin: 1300,
  spawnRadiusMax: 2000,
  despawnRadius: 2600,
  followDistance: 110,
  minGap: 26,                // px bumper-to-bumper at which a follower stops completely
  speedMinFrac: 0.7,         // desired speed range as a fraction of spec.maxSpeed
  speedMaxFrac: 1.0,
  lookAheadMin: 38,          // pure-pursuit look-ahead (px)
  lookAheadMax: 80,
  advanceRadius: 34,         // reaching a node this close advances to the next one
  turnSlowFrac: 0.45,         // speed multiplier on sharpest turns
  knockSpeed: 70,            // px/s velocity jump counted as a significant hit
  knockSec: 1.5,
  knockDamping: 1.6,         // 1/s velocity decay while knocked
  stuckSec: 3,
  stuckMoveDist: 24,
  reverseSec: 0.9,
  spawnMargin: 160,          // px beyond camera view that spawns must stay outside
  spawnGap: 140,             // min distance to other vehicles at spawn
  spawnIntervalSec: 0.12,    // at most one spawn per interval after the initial fill
  initialSpawnMin: 700,      // initial fill may use a smaller ring (still off-screen)
  nodeCell: 256,             // spatial grid cell size for lane-node queries
  // --- playtest 2: traffic is light and gets shoved off the player ---
  shovePerImpact: 0.9,       // extra px/s of push away from the player per px/s of impact
  shoveMax: 700,
  shoveSpin: 4,              // rad/s of spin on a hit
  shoveTruckMult: 0.6,
};

export const POLICE = {
  patrolCount: 2,
  heatPerCrash: { traffic: 15, police: 25, prop: 5, building: 0, player: 0, dino: 0 },
  heatDecayPerSec: 3,
  heatChaseThreshold: 40,
  maxChasersPerPlayer: 3,
  bumpCooldownSec: 1.5,
  bumpImpulse: 9,
  bumpSlowSec: 0.5,
  bumpSlowMult: 0.6,
  loseDistance: 1400,       // px — chasers give up beyond this
  // --- package K additions ---
  heatMax: 100,
  heatImpactRef: 600,         // impact (px/s) at which heat gain is +50%
  loseHoldSec: 1.5,
  turboEscapeDistance: 900,
  repathSec: 0.5,
  lookaheadPx: 110,
  directChaseDist: 450,
  leadSec: 0.4,
  stuckSpeed: 30,
  stuckSec: 0.7,
  reverseSec: 0.6,
  patrolSpeedFrac: 0.55,
  leaveSpeedFrac: 0.5,
  maxTotal: 8,
  spawnMinDist: 900,
  spawnMaxDist: 1600,
  patrolSpawnMinDist: 1200,
  viewMargin: 160,
  spawnIntervalSec: 0.8,
  despawnDist: 2800,
  joinSightDist: 700,
  bumpShovePerUnit: 40,       // px/s of sideways shove per POLICE.bumpImpulse unit
  bumpSpin: 2.5,              // rad/s
  bumpBounce: 260,            // px/s the police car is thrown back
  bumpBackoffSec: 0.9,
  sirenNearDist: 1300,
  lightFlashSec: 0.2,
  // --- playtest 2 ---
  offscreenDespawnSec: 1.5,  // off every player's view this long -> removed
  offscreenMargin: 80,
  chaserRespawnCooldownSec: 4,
  sirenVolume: 0.22,
  spawnGraceSec: 6,          // freshly spawned (off-screen) cars are exempt from the off-screen despawn
};

// ───────────────────────── goals & round (package L) ─────────────────────────
export const GOALS = {
  radius: 170,
  teammateWaitSec: 20,
  minDistance: 2200,         // px from previous goal
  maxDistance: 4200,
  firstMin: 1500,            // first goal: distance from the players' midpoint
  firstMax: 3000,
  recentWords: 4,            // avoid repeating the last N place words
  nextGoalDelaySec: 1.5,
  shakeIntensity: 0.006,
  shakeMs: 350,
  magnetFlareScale: 1.6,
  introScale: 2.5,           // goal visuals start this much bigger when first seen...
  introSec: 0.6,             // ...and shrink to normal in this long (ease-out back)
  labelIntroScale: 2,        // HUD goal label scale-in start
  labelIntroSec: 0.5,
  arrowBandFrac: 0.4,        // HUD off-screen goal arrow/tag stay within the top this-fraction of a view
  arrowBandMaxH: 420,
  starThresholds: [3, 6] as [number, number],   // team points per minute for 2 / 3 stars
};

// ───────────────────────── dino (package O) ─────────────────────────
export const DINO = {
  spawnAtFraction: 0.5,      // of round length elapsed
  length: 420,
  speed: 330,                // ≈55% of dino-car top speed
  goalWaypointChance: 0.6,
  roarIntervalSec: [8, 15] as [number, number],
  roarProximity: 400,
  hitImpulse: 40,
  hitSpin: 8,                // rad/s
  stepIntervalSec: 0.55,
  shakeRadius: 900,
  // O: added keys
  turnRate: 1.1,             // rad/s heading change limit
  arriveRadius: 90,          // waypoint reached within this
  pauseSec: 1,               // look-around pause at each waypoint
  minWaypointDist: 300,
  goalWaypointRadius: 250,
  capsuleRadius: 62,         // half-width of the stomp/hit capsule
  capsuleFront: 0.32,        // capsule extends this fraction of length ahead of body centre
  capsuleBack: 0.2,          // ... and this far behind
  hitLaunchSpeed: 760,       // px/s launch speed (hitImpulse=40 is too small to read as px/s)
  hitCooldownSec: 1,
  roarCooldownSec: 4,
  spawnMinDist: 1500,        // from both players
  spawnEdgeTiles: 7,         // spawn on a road within this many tiles of the map edge
  stepAudioRange: 1600,
  devSpawnDelaySec: 2,       // ?dino=now
  // S3: goal guard + ramming
  guardSpeedFrac: 0.45,      // of `speed`
  guardRadiusMul: 1.2,       // x goal radius ...
  guardRadiusPad: 150,       // ... + this = max distance from goal centre
  patrolLoopFrac: 0.55,      // patrol loop radius as a fraction of the guard radius
  patrolStepRad: Math.PI / 3,
  patrolPauseSec: 0.15,
  guardRoarSec: [5, 8] as [number, number],
  faceSec: 1.3,              // turns to face the waiting player while roaring
  dropSec: 0.55,             // drop-in animation
  dropScale: 2.2,
  graceSec: 1.2,             // no damage right after landing
  leaveSec: 1.2,             // happy roar before stomping off
  leaveTimeoutSec: 14,
  maxHp: 100,
  ramMinSpeed: 200,          // px/s closing speed to hurt
  ramSpeedMax: 700,
  ramDamageMin: 12,
  ramDamageMax: 30,
  turboMult: 1.5,
  teamMult: 2,
  teamWindowSec: 1.5,
  ramCooldownSec: 0.6,
  ramBounceBase: 80,         // px/s added on top of 1.3x closing speed
  ramBounceMax: 760,
  ramSpin: 2,
  shoveSpeed: 320,           // px/s^2 gentle push of slow cars
  flinchStagger: 14,
  dizzySec: 1.6,
  shrinkSec: 0.7,
  poofSec: 1.6,
  defeatPoints: 2,
  barWidth: 300,
  barHeight: 38,
  barOffset: 290,
};

// ───────────────────────── camera (package H) ─────────────────────────
export const CAMERA = {
  baseZoom: 1.2,             // orchestrator: bigger cars for kids / projector
  minMergedZoom: 0.84,      // below this needed zoom → split (H: tuned from 0.62 so split/merged scale match)
  mergePadding: 260,         // px around both cars in merged view
  splitHysteresis: 0.08,     // zoom must recover above minMergedZoom + this to re-merge
  transitionSec: 0.4,
  lookAheadSec: 0.35,        // camera leads in direction of travel
  turboZoomOut: 0.08,
  // H: added keys
  splitZoom: 0.88,           // zoom of each half-view in split mode (between minMergedZoom and the re-merge zoom → no scale jump)
  lookAheadMax: 380,         // px cap on look-ahead offset
  lookSmoothing: 3,          // 1/s exponential smoothing rate of the look-ahead offset
  zoomSmoothing: 2.5,        // 1/s smoothing rate of the speed/turbo zoom-out
  speedZoomOut: 0.06,        // extra zoom-out at speedZoomRef (scaled linearly below it)
  speedZoomRef: 900,         // px/s at which speedZoomOut is fully applied
  // R1: facing-up (car-relative rotating) view
  facingUp: true,            // false = old north-up split/merge camera
  facingSplitZoom: 1.15,     // zoom of each half-view in facing-up split (about the same as single)
  carScreenY: 0.52,          // car sits this far down the view (room below for the challenge panel)
  rotTau: 0.3,               // s, time constant of the view-angle follow
  maxAngVel: 3,              // rad/s cap on view rotation speed (spins never whip the screen)
  velBlendMinSpeed: 150,     // px/s: above this (moving forward) the view leans toward the velocity direction
  velBlend: 0.5,             // 0..1 share of (velocity dir - heading) the view follows while sliding
};
