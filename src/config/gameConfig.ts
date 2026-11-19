/**
 * ALL gameplay tunables live here. Orchestrator-owned contract: sub-agents may READ any value,
 * and may ADD new keys only inside the section for their own package (mark with the package id),
 * never rename/remove existing keys.
 */
import type { CarKind, ChallengeKind, Difficulty, Settings, VehicleSpec } from '../core/types';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const TILE_SIZE = 128;

export const INDUSTRIAL = {
  goalRadius: 96,
};

export const VEHICLE_CONDITION = {
  minImpact: 155,
  maxImpact: 700,
  minDamage: 13,
  maxDamage: 39,
  // Cars take 2x the hits to wreck (was 26 / 59 / 100); smoke and fire stages scale with it.
  smokeDamage: 52,
  fireDamage: 118,
  wreckDamage: 200,
  resetDoubleTapSec: 0.6, // press Y twice within this to restore your own car
  damageCooldownSec: 0.23,
  transferTapSec: 0.5,
  transferReach: 135,
  transferHopSec: 0.32,
  transferHopHeight: 34,
  transferFlashHz: 5,
  transferMarkerPadding: 10,
  abandonedLimit: 8,
  recoverySec: 8,
  smokeIntervalSec: 0.12,
  particleLimit: 72,
};

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
  map: 'city',
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
  math: {
    minA: number; maxA: number; minB: number; maxB: number; maxSum: number; requireCarry: boolean;
    /** Optional: chance a question uses a teen sum (>= 11) when both small and teen pairs exist. */
    teenChance?: number;
    /** Optional: when true the 'forgot to add one' (answer - 1) is tried first. */
    offByOneFirst?: boolean;
  };
  words: {
    simpleOnly: boolean; allowMultiWord: boolean; sameCategoryDistractors: boolean;
    /** Optional: when !simpleOnly, chance the target is drawn from the simple words (rest from all single words); text distractors prefer simple words too. */
    simpleTargetChance?: number;
  };
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    periodMultiplier: 1.5,
    typeWeights: { picToWord: 30, math: 30, wordToPic: 40 },
    math: { minA: 1, maxA: 9, minB: 1, maxB: 9, maxSum: 10, requireCarry: false },
    words: { simpleOnly: true, allowMultiWord: false, sameCategoryDistractors: false },
  },
  // Easy+: sums 2..19 (about half are teen sums); mostly simple single words, some harder ones.
  easyPlus: {
    periodMultiplier: 1.25,
    typeWeights: { picToWord: 32, math: 32, wordToPic: 36 },
    math: { minA: 1, maxA: 12, minB: 1, maxB: 9, maxSum: 19, requireCarry: false, teenChance: 0.5, offByOneFirst: true },
    words: { simpleOnly: false, allowMultiWord: false, sameCategoryDistractors: false, simpleTargetChance: 0.65 },
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
  firstChallengeDelaySec: 3,   // after GO (drive style)
  // pause style (question breaks)
  firstBreakSec: 5,            // driving seconds after GO until the first break
  breakGoSec: 0.6,             // GO beat after everyone answered correctly
  wrongRetrySec: 0.5,          // beat to show the wrong-answer shake before the new question
  breakDimAlpha: 0.6,          // world dim during a break (HUD overlay)
  breakMaxScale: 2.0,          // cap on the centered question panel scale
  rewardDelayAfterBreakSec: 0.7, // game-time wait after the question panel has fully faded, before turbo/jump/bonus
  rewardPanelClearSec: 1.05,   // answer -> HUD panel fully gone (hudConfig panel.resultHoldSec 0.7 + fadeSec 0.35); keep in sync
  answerGuardSec: 0.25,        // ignore answers this long after a break question appears
  pauseOptions: 4,             // answers per question in pause style (drive = 3)
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
export const TRUCK_SPEC: VehicleSpec = { length: 120, width: 48, mass: 12, maxSpeed: 255, reverseSpeed: 100, accel: 205, brake: 650, turnRate: 1.6, grip: 0.97, drag: 0.8 };
export const POLICE_SPEC: VehicleSpec = { length: 66, width: 38, mass: 13, maxSpeed: 680, reverseSpeed: 240, accel: 600, brake: 1100, turnRate: 3.0, grip: 0.9, drag: 0.6 };

export const BOARDING_DRIVE = {
  sedan: { mass: 11, maxSpeed: 595, reverseSpeed: 210, accel: 400, brake: 1100, turnRate: 2.9, grip: 0.86, drag: 0.65 },
  police: { maxSpeed: 720 },
  truck: { mass: 40, maxSpeed: 410, reverseSpeed: 140, accel: 310, brake: 900, turnRate: 2.05 },
  freight: { mass: 56, maxSpeed: 375, reverseSpeed: 125, accel: 280, brake: 850, turnRate: 1.85 },
  heavyMass: 40,
  minimumShoveSpeed: 85,
  trafficDamageScale: 0.32,
  trafficShoveBoost: 1.65,
};

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
  bigAirSec: 1.0,           
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
  /** Longest straight run of building tiles (either axis) before an alley is cut through it. */
  maxBuildingRun: 6,
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

export const INDUSTRIAL_TRAFFIC = {
  regularVehicles: 40,
  freightTrucks: 8,
  yardPaddingTiles: 2,
  spawnGap: 170,
  freightSpawnGap: 190,
};

/** Seeded yard clutter on the Industrial map (tile units unless noted). */
export const INDUSTRIAL_PROPS = {
  fillChance: 0.9,           // chance a shuffled free tile starts a prop
  lampSpacing: 4,            // lamp posts every n tiles along road edges
  roofLightChance: 0.55,     // per building tile
  railClearTiles: 2,         // keep-out distance from the rail centerline
  crossingClearTiles: 3.5,
  goalClearTiles: 1.6,       // beyond GOALS.radius of each place front
  rampClearTiles: 4,
  decorationPadTiles: 0.75,
  poolPx: { lampPost: 380, conveyor: 300, smokeStack: 200 } as Record<string, number>,
};

export const FREIGHT_TRUCK_SPEC: VehicleSpec = {
  ...TRUCK_SPEC, length: 160, width: 58, mass: 20, maxSpeed: 225, accel: 175,
};

export const POLICE = {
  patrolCount: 2,
  heatPerCrash: { traffic: 15, police: 25, prop: 5, building: 0, player: 0, dino: 0 },
  heatDecayPerSec: 3,
  heatChaseThreshold: 40,
  maxChasersPerPlayer: 2,
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
  sirenVolume: 0.22,         // AI cruisers chasing you (gentle)
  playerSirenVolume: 1.4,    // your own siren while you drive a police cruiser; >= 1 also switches to the brighter, punchier tone
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
  shakeIntensity: 0.006,
  shakeMs: 350,
  magnetFlareScale: 1.6,
  introScale: 2.5,           // goal visuals start this much bigger when first seen...
  introSec: 0.6,             // ...and shrink to normal in this long (ease-out back)
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
  guardSpeed: 75,            // px/s: slow lumbering stomp (guard, return and leave)
  orbitPad: 120,             // orbit radius = goal radius + this
  orbitBreathe: 40,          // max radius breathing (px)
  orbitBreatheW: 0.35,       // rad/s
  orbitLookahead: 0.4,       // rad ahead on the circle
  orbitReturnTol: 150,       // radial error (px) at which it heads straight back
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
  leaveTimeoutSec: 45,
  maxHp: 100,                // legacy (variable damage); the dino now counts hits
  hitsToDefeat: 3,           // rams that count as a hit (>= ramMinSpeed, off cooldown) to beat the dino
  teamHits: 2,               // a TEAM hit (both players within teamWindowSec) counts as this many hits
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
  flinchStagger: 6,
  dizzySec: 1.6,
  shrinkSec: 0.7,
  poofSec: 1.6,
  defeatPoints: 2,
  barWidth: 300,
  barHeight: 38,
  barOffset: 290,
};

// rideable dino (package dino-ride): beaten dino is tame for a while; a player can board it like a vehicle
export const DINO_RIDE = {
  tameSec: 8,                  // dizzy + boardable window after the last hit; then it poofs if nobody boards
  durationSec: 20,             // ride length (race time; question breaks don't count). URL &dinoride=N overrides
  dismountSec: 1.4,            // happy roar before the poof after the rider hops off
  boardReach: 150,             // px from the dino centre (minus this) that still counts as "nearby" (see VEHICLE_CONDITION.transferReach)
  markerLength: 380,           // boarding highlight box around the dino
  markerWidth: 230,
  returnMaxDist: 1400,         // own car farther than this from the dino -> respawn the starter car on a clear road nearby
  // driving: slow (~60% of a starter car), heavy, turns gently. length/width = invisible body size
  spec: { length: 240, width: 140, mass: 80, maxSpeed: 360, reverseSpeed: 130, accel: 230, brake: 700, turnRate: 1.45, grip: 0.95, drag: 0.75 },
  stepIntervalSec: 0.42,       // stomp (dust + sfx + small shake) cadence while moving
  stepMinSpeed: 40,            // px/s: below this the dino stands still (no stomps)
  stepShake: 0.004,            // rider camera shake per stomp
  playerPush: 380,             // px/s: the other player's car is pushed out of the way (no damage)
  riderScale: 1.7,             // the rider's car drawn on the dino's back, x its normal size
  edgePad: 160,                // keep the ridden dino this far inside the world edge
};

// dino laser eyes (package dino-laser)
export const DINO_LASER = {
  firstDelaySec: 6,            // after landing, before the first shot may start
  cooldownSec: [9, 15] as [number, number],
  devCooldownSec: 3,           // ?laser=now: first shot 1 s after landing, then every 3 s
  rangeMax: 1100,              // only fires when a player is this close
  chargeSec: 1.1,              // telegraph: eyes glow and a faint aim line shows the start of the sweep
  fireSec: 2.2,                // beams sweep this long
  arc: 1.5,                    // rad swept (~86 deg); tip speed = arc/fireSec*length ~ 610 px/s
  length: 900,                 // beam reach from the eyes
  hitHalfWidth: 20,            // beam half width for hits (plus target radius)
  drawWidth: 46,               // drawn beam thickness
  eyeFwd: 226,                 // eye offset ahead of the dino centre in rig px (x dino scale)
  eyeSide: 54,                 // eye offset to each side in rig px
  aimRandom: 0.25,             // rad: random aim error of the sweep centre
  playerSlowMult: 0.45,        // speed cap on a zapped player...
  playerSlowSec: 1.2,          // ...for this long
  playerPush: 360,             // px/s sideways bounce (out of the beam)
  playerSpin: 3,               // rad/s spin-out
  playerCooldownSec: 2.5,      // per player: can't be zapped again right away (no damage is ever dealt)
  turnRate: 1.6,               // rad/s the dino turns to face its target while charging
};

export const DINO_SMASH = {
  playerCooldownSec: 2,
  playerLaunchSpeed: 620,
  playerAirSec: 0.52,
  playerImpact: 480,
  npcLaunchSpeed: 720,
  truckSpeedMult: 0.82,
  npcAirSec: 0.72,
  npcPeakHeight: 105,
  npcPeakScale: 0.35,
  npcSquashSec: 0.24,
  stompAnimationSec: 0.34,
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

// ───────────────────────── guide buddies (package U1) ─────────────────────────
export const GUIDE = {
  holdDist: 170,             // px fallback hover distance when the view rect is unknown; also the minimum
  edgeFrac: 0.8,             // hover at this fraction of the car->view-edge distance (screen space) along the lead direction
  edgeMargin: 80,            // screen px kept free between the buddy and the (inset) view edge
  topInset: 150,             // screen px at the top treated as off-limits (scoreboard)
  seamInset: 200,            // split screen: px at the centre seam treated as off-limits (scoreboard overlap)
  holdMax: 700,              // world px cap on the hover distance
  spring: 42,                // spring stiffness toward the hover spot (1/s^2)
  damping: 11,               // damping on velocity relative to the car (1/s)
  maxSpeed: 1500,            // px/s; above car turbo (~990) so it never falls behind
  bobAmp: 9,                 // px gentle hover bob
  bobHz: 1.4,
  nearGoal: 450,             // px: within this the buddy flies to the goal and circles it
  leaveGoal: 600,            // hysteresis: stays at the goal until the car is this far away again
  orbitRadius: 130,          // px radius of the circle flown over the goal
  orbitLift: 100,            // px the circle is shifted toward screen-up so the challenge panel never hides it
  orbitSpeed: 2.3,           // rad/s
  bodyScale: 1.5,
  shadowScale: 0.55,
  shadowAlpha: 0.28,
  depthTrail: 51, depthGlow: 52, depthBody: 53,
  trailPool: 56,             // pooled trail particles per buddy
  trailEverySec: 0.035,
  trailLife: 0.75,
  dinoFlapFps: 10,
  dinoFlapFpsHappy: 18,
  starBlinkHz: 8,
  starFlashEverySec: 1.1,
  dinoColors: [0xff3d9a, 0xff8a1f, 0xffd23a] as number[],   // ribbon puff tints
  starColors: [0xffe066, 0xffffff, 0xffc233] as number[],
};

export const INDUSTRIAL_LIGHTING = {
  bumperOffset: 0.44, // fraction of the chassis texture width measured from its center
  referenceWidth: 42, // world px, preserves lamp spacing across the two car models
  alpha: 1,
  airborneAlpha: 0.75,
  airborneLengthScale: 1.15,
  beamLength: 460, // baked texture length px (world px at scale 1)
  beamHeight: 260,
  beamStrength: 1.6, // multiplies baked beam gradient alpha
  // Darkness overlay: lower alpha = brighter night. Sits above ground/props/shadows, below vehicles/buildings.
  nightColor: 0x050b24,
  nightAlpha: 0.57,
  nightDepth: 15,
  // Buildings/bridges/factories sit above the overlay, so they get a dark tint instead.
  buildingTint: 0x39485f,
  decorationTint: 0x5b6d8a,
  // Additive halo that keeps the goal readable under the darkness.
  goalGlowScale: 3.2,
  goalGlowAlpha: 0.55,
  goalGlowColor: 0xffe9a0,
  // Warm ground light pools under lit decorations (bridge, bays, gantry, tower).
  poolAlpha: 0.5,
  poolColor: 0xffb45a,
  poolScale: 1.5,
  // Soft ambient halo around each player car so it never disappears into the dark.
  carHaloScale: 4.2,
  carHaloAlpha: 0.32,
  carHaloColor: 0xbcd2ff,
};

export const CITY_NIGHT_LIGHTING = {
  groundTint: '#677cab',
  buildingTint: 0x7188b8,
};

export const FREIGHT = {
  firstWarningSec: 4,
  warningLeadSec: 2.75,
  warningTailSec: 0.55,
  flashStepSec: 0.35,
  speed: 400,
  wagonCount: 4,
  carriageGap: 8,
  signalRoadLength: 128,
  signalShoulder: 32,
  soundRadius: 1250,
  soundVolume: 0.72,
  releaseSpeed: 380,
  // --- smash (turbo or a hard hit breaks the train apart) ---
  smashImpactSpeed: 760,   // px/s along contact normal without turbo (train itself moves at `speed`)
  smashCooldownSec: 0.4,   // per-player, avoids double triggers
  reformSec: 9,            // smashed cars rejoin their slot after this (once no vehicle is in the way)
  debrisSec: 2.4,          // tumbling wagon lifetime before it poofs away
  debrisLaunch: 520,       // px/s base launch speed of a wagon
  debrisSpin: 7,           // rad/s max spin
  debrisPoofs: 6,
  cratesPerCar: 3,
  crateKey: 'industrial_cargo_crate',
  smashScore: 2,           // popup only: "+N" (no score event exists for this yet)
};

// ───────────────────────── farm map generator (package farm-gen) ─────────────────────────
/** Farm renderer look (package farm-render: src/world/farmWorld.ts, FarmLightSystem). */
export const FARM_LOOK = {
  /** Nominal heights (px) that set each caster's shadow length (× FarmLayout.shadowLength). */
  heights: {
    barn: 110, leanTo: 46, farmhouse: 86, porch: 16, silo: 175, shed: 52, pad: 4, windmill: 170, turbine: 230,
    hay: 26, orchardTrunk: 26, orchardTop: 60, treeTrunk: 30, treeTop: 70, bush: 18, fence: 15, bridge: 10,
    pumpkin: 10, mazeSign: 26, well: 34, campsite: 28, cave: 80, pines: 120, boathouse: 48, village: 72, corn: 28,
  },
  shadowAlpha: 0.34,
  shadowBlur: 10,
  shadowColor: '#1a2150',   // cool blue shadows against the warm light
  shadowFade: 0.5,          // tips are this much lighter than the base
  /** Shadow images sit between the golden grade and decals (skids, goal floor, corn trail). */
  shadowDepth: 4,
  bridgeDepth: 4.5,
  /** Orchard canopies hang over cars a little (cars pass under the edges). */
  canopyDepth: 24,
  bladeDepth: 25.5,         // above roofs (25), below rooftop picture signs (26)
  /** Warm tint on sprites standing above the grade layer (roofs, props). */
  decorTint: 0xfff0d8,
  /** Seconds per blade revolution. */
  windmillSecPerTurn: 14,
  turbineSecPerTurn: 6,
  turbineScale: 1.25,       // tower top + blade sprite scale over the art size
  windmillBladeScale: 1.5,  // over the 256-px sail sprite
  windmillBodyPx: 150,
  /** Corn rows go ripe on every Nth plain corn field. */
  ripeEvery: 2,
  pumpkinsPerTile: 3,
  /** Golden-hour grade: one world-sized warm layer over the ground only (cars, HUD, goals stay crisp). */
  gradeColor: 0xffa53a,
  gradeAlpha: 0.17,
  gradeDepth: 3,
};

export const FARM_GEN = {
  /** Shadows fall east and a little south (fixed low western sun). Radians, world space. */
  shadowAngle: 0.35,
  shadowLength: 2.5,
  /** Fields with a long side of at least this many tiles are split in two (1-tile grass gap). */
  splitLongSide: 12,
  /** Width of each open pasture gate (tiles). */
  gateTiles: 2,
  /** Pastures get this many gates (on different road-facing sides when possible). */
  gatesPerPasture: 2,
  hayBalesPerYard: [2, 4] as [number, number],
  hayBaleSize: 0.8,          // tiles
  orchardTreeSize: 0.9,      // tiles
  turbineSize: 0.5,          // tiles (tower base; blades are art)
  turbineEveryTiles: 4,
  mudPuddles: 5,
  hillCrests: 3,
  /** Corn-maze walls knocked out after carving so young drivers find a way through. */
  mazeExtraOpenings: 3,
  treeChance: 0.55,          // per free woods tile
  animals: { cow: 4, sheep: 6, horse: 3, pig: 4, chicken: 6, duck: 5 },
};

// ───────────────────────── farm corn + mud driving (package farm-corn) ─────────────────────────
export const FARM_CORN = {
  /** Top-speed multiplier (applied through car.slow) on each surface. */
  cornSpeedMult: 0.6,
  mudSpeedMult: 0.5,
  /** Extra drag (1/s, exponential) on top of the cap while plowing through corn / mud. */
  cornDrag: 0.6,
  mudDrag: 1.0,
  /** Mud wobble: sideways shove (px/s per s, sine) scaled by speed fraction. */
  mudWobble: 260,
  mudWobbleHz: 2.5,
  /** Min speed (px/s) before a car counts as plowing (stamps, rustle, puffs). */
  minPlowSpeed: 60,
  /** Stamp pool size (oldest recycled first), spacing along the path (px), look. */
  stampPool: 140,
  stampSpacing: 34,
  stampScale: 1.0,
  stampAlpha: 0.95,
  stampJitterPx: 8,
  stampJitterRad: 0.3,
  /** Stamps spring back when this far (px) outside every player view, or after this many seconds. */
  viewMargin: 120,
  stampLifeSec: 30,
  cullEverySec: 0.2,
  /** Leaf/husk puffs per second while plowing, max live puffs, mud splash count on entering. */
  puffsPerSec: 14,
  puffMax: 40,
  splashCount: 10,
  /** Sound rate limit (sec), volume, and pan for the 2-player split. */
  rustleEverySec: 0.35,
  rustleVolume: 0.6,
  pan: 0.5,
  leafTints: [0x7fb83a, 0xc9a93c, 0x5e8f2a] as number[],
  mudTint: 0x6b4423,
};

/** Farm map traffic: pickups on the roads, slow tractors with hay wagons and combines on dirt lanes. */
export const FARM_TRAFFIC = {
  pickups: 25,
  tractors: 4,
  combines: 2,
  /** Chance a pickup spawn is allowed on a dirt lane node (paved roads always allowed). */
  pickupDirtChance: 0.15,
  spawnGap: 170,
  slowSpawnGap: 230,
  /** A combine needs corn within this many tiles of its lane node (falls back to any dirt lane when none). */
  cornNearTiles: 2,
  /** Straight run (px) of drivable ground required behind a tractor/combine spawn for its trailer. */
  trailerRunPx: 150,
  wagonGapPx: 4,
};
/** Slow tractor: desired speed is 70-100% of maxSpeed (about 35-45% of normal traffic speed). */
export const TRACTOR_SPEC: VehicleSpec = { length: 80, width: 56, mass: 28, maxSpeed: 110, reverseSpeed: 60, accel: 120, brake: 500, turnRate: 1.5, grip: 0.97, drag: 0.8 };
export const HAY_WAGON_SPEC: VehicleSpec = { length: 120, width: 50, mass: 14, maxSpeed: 110, reverseSpeed: 60, accel: 120, brake: 500, turnRate: 1.5, grip: 0.97, drag: 0.8 };
export const COMBINE_SPEC: VehicleSpec = { length: 150, width: 84, mass: 40, maxSpeed: 70, reverseSpeed: 40, accel: 80, brake: 450, turnRate: 1.1, grip: 0.97, drag: 0.8 };
export const PICKUP_SPEC: VehicleSpec = { length: 84, width: 44, mass: 7, maxSpeed: 245, reverseSpeed: 100, accel: 250, brake: 700, turnRate: 2.2, grip: 0.95, drag: 0.8 };

/** Farm animals (AnimalSystem). Speeds px/s, times sec, sizes px. They are obstacles that fly cartoon-style; never hurt. */
export const ANIMALS = {
  /** Only animals within this distance of a player are simulated; others stay frozen. */
  activeRadius: 1500,
  /** Cars slower than this (px/s) only nudge/startle an animal; faster launches it. */
  hitMinSpeed: 90,
  /** Vehicle speed and distance at which an approaching car makes an animal scurry aside. */
  scareSpeed: 200,
  scareRadius: 300,
  fleeSec: 0.9,
  /** Dino roar scatters animals within this radius for this long. */
  roarRadius: 1100,
  roarFleeSec: 2.6,
  /** Keep walkers this far inside a fenced zone edge (plus half their sprite). */
  zoneMargin: 14,
  /** Free (unfenced) zones may wander this far outside their rect. */
  looseSlack: 40,
  /** Launch: distance = clamp(carSpeed * distPerSpeed, min, max); airtime and peak scale. */
  launch: { distPerSpeed: 0.7, minDist: 200, maxDist: 560, airSec: 1.05, peakScale: 1.9, spinTurns: 2.5, landBounceSec: 0.3, dazeSec: 0.9 },
  /** Hit direction blend: how much of the car heading (vs. straight away from the car) is used. */
  launchHeadingBlend: 0.7,
  /** Ambient sound every few seconds from a nearby animal. */
  ambientSecMin: 5,
  ambientSecMax: 12,
  ambientRange: 900,
  /** Free-zone ducks sometimes march across up to this far outside the zone, in a line spaced this much. */
  duckCrossChance: 0.18,
  duckCrossReach: 220,
  duckSpacing: 34,
  /** Per-kind sprite size (matches TEX.farm art), body radius and behaviour. */
  kinds: {
    cow:     { w: 88,  h: 52, radius: 24, walk: 34, run: 130, grazeSec: [2.5, 7],  walkSec: [1.5, 4],    stepPx: 22 },
    sheep:   { w: 64,  h: 48, radius: 19, walk: 38, run: 150, grazeSec: [2, 6],    walkSec: [1.2, 3.5],  stepPx: 18 },
    pig:     { w: 64,  h: 42, radius: 18, walk: 42, run: 150, grazeSec: [1.5, 5],  walkSec: [1.2, 3.5],  stepPx: 18 },
    horse:   { w: 104, h: 44, radius: 22, walk: 55, run: 210, grazeSec: [2, 6],    walkSec: [2, 5],      stepPx: 28 },
    chicken: { w: 32,  h: 28, radius: 10, walk: 30, run: 190, grazeSec: [0.5, 1.6], walkSec: [0.25, 0.6], stepPx: 9 },
    duck:    { w: 32,  h: 26, radius: 10, walk: 40, run: 150, grazeSec: [1.5, 4],  walkSec: [1.5, 3.5],  stepPx: 10 },
  },
  sfx: { cow: 'moo', sheep: 'baa', pig: 'oink', horse: 'neigh', chicken: 'cluck', duck: 'quack' },
} as const;
