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
export const ANSWER_COLORS = ['#1e6fff', '#ffcc00', '#ff3b30'] as const; // X blue, Y yellow, B red
export const ANSWER_LABELS = ['X', 'Y', 'B'] as const;

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
  challengeIntervalSec: 5,
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
};

// ───────────────────────── vehicles (package F) ─────────────────────────
export const CAR_SPECS: Record<CarKind, VehicleSpec> = {
  dino: { length: 72, width: 40, mass: 14, maxSpeed: 620, reverseSpeed: 200, accel: 520, brake: 1100, turnRate: 2.6, grip: 0.82, drag: 0.6 },
  kart: { length: 60, width: 36, mass: 9,  maxSpeed: 570, reverseSpeed: 220, accel: 700, brake: 1200, turnRate: 3.3, grip: 0.88, drag: 0.7 },
};
export const TRAFFIC_SPEC: VehicleSpec = { length: 64, width: 36, mass: 12, maxSpeed: 240, reverseSpeed: 100, accel: 260, brake: 700, turnRate: 2.4, grip: 0.95, drag: 0.8 };
export const TRUCK_SPEC: VehicleSpec = { length: 120, width: 48, mass: 30, maxSpeed: 180, reverseSpeed: 80, accel: 140, brake: 500, turnRate: 1.6, grip: 0.97, drag: 0.8 };
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
};

// ───────────────────────── world (package C/G) ─────────────────────────
export const WORLD = {
  widthTiles: 48,
  heightTiles: 48,
  waterBorderTiles: 2,
  blockMin: 3,
  blockMax: 6,
  removeRoadChance: 0.12,
  rampCount: 10,
  rampMinSpeedFrac: 0.4,
  airSecPerSpeed: 1.1 / 620, // airtime = speed * this (≈1.1 s at dino top speed)
};

// ───────────────────────── traffic & police (packages J/K) ─────────────────────────
export const TRAFFIC = {
  maxVehicles: 35,
  truckFraction: 0.2,
  spawnRadiusMin: 1300,
  spawnRadiusMax: 2000,
  despawnRadius: 2600,
  followDistance: 110,
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
};

// ───────────────────────── goals & round (package L) ─────────────────────────
export const GOALS = {
  radius: 170,
  teammateWaitSec: 20,
  minDistance: 2200,         // px from previous goal
  maxDistance: 4200,
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
};

// ───────────────────────── camera (package H) ─────────────────────────
export const CAMERA = {
  baseZoom: 1.0,
  minMergedZoom: 0.7,       // below this needed zoom → split (H: tuned from 0.62 so split/merged scale match)
  mergePadding: 260,         // px around both cars in merged view
  splitHysteresis: 0.08,     // zoom must recover above minMergedZoom + this to re-merge
  transitionSec: 0.4,
  lookAheadSec: 0.35,        // camera leads in direction of travel
  turboZoomOut: 0.08,
  // H: added keys
  splitZoom: 0.8,            // zoom of each half-view in split mode (between minMergedZoom and the re-merge zoom → no scale jump)
  lookAheadMax: 380,         // px cap on look-ahead offset
  lookSmoothing: 3,          // 1/s exponential smoothing rate of the look-ahead offset
  zoomSmoothing: 2.5,        // 1/s smoothing rate of the speed/turbo zoom-out
  speedZoomOut: 0.06,        // extra zoom-out at speedZoomRef (scaled linearly below it)
  speedZoomRef: 900,         // px/s at which speedZoomOut is fully applied
};
