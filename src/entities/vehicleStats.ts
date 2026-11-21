/**
 * Pure (Phaser-free) mapping from five hidden 1-5 ratings to a VehicleSpec.
 * Ratings: speed (top speed), zoom (acceleration), turning, weight (momentum/mass), grip (low = drifty).
 * Ranges live in VEHICLE_STATS (gameConfig). Players never see these numbers; they only feel them.
 */
import { STARTER_CAR_RATINGS, VEHICLE_MODEL, VEHICLE_STATS } from '../config/gameConfig';
import type { StarterCar, VehicleSpec } from '../core/types';

export interface VehicleRatings { speed: number; zoom: number; turning: number; weight: number; grip: number }
export const RATING_KEYS = ['speed', 'zoom', 'turning', 'weight', 'grip'] as const;

type Range = { lo: number; hi: number };
/** Rating 1..5 -> 0..1. */
const unit = (rating: number) => (rating - VEHICLE_STATS.minRating) / (VEHICLE_STATS.maxRating - VEHICLE_STATS.minRating);
const lerp = (r: Range, rating: number) => r.lo + (r.hi - r.lo) * unit(rating);

export const ratingsSum = (r: VehicleRatings) => RATING_KEYS.reduce((a, k) => a + r[k], 0);

export function specFromRatings(r: VehicleRatings, length: number, width: number): VehicleSpec {
  const V = VEHICLE_STATS;
  return {
    length, width,
    mass: lerp(V.mass, r.weight),
    maxSpeed: lerp(V.maxSpeed, r.speed),
    reverseSpeed: lerp(V.reverseSpeed, r.zoom),
    accel: lerp(V.accel, r.zoom),
    brake: V.brake,
    turnRate: lerp(V.turnRate, r.turning),
    grip: lerp(V.grip, r.grip),
    drag: lerp(V.drag, r.weight),
    steerResponse: lerp(V.steerResponse, r.weight),
    driftLoss: lerp(V.driftLoss, r.grip),
    pivotRate: lerp(V.pivotRate, r.turning),
    recoilMult: lerp(V.recoilMult, r.weight),
  };
}

/** Starter cars expressed through ratings. */
export const CAR_SPECS: Record<StarterCar, VehicleSpec> = {
  dino: specFromRatings(STARTER_CAR_RATINGS.dino.ratings, STARTER_CAR_RATINGS.dino.length, STARTER_CAR_RATINGS.dino.width),
  kart: specFromRatings(STARTER_CAR_RATINGS.kart.ratings, STARTER_CAR_RATINGS.kart.length, STARTER_CAR_RATINGS.kart.width),
};

/** Effective values (spec override or the global default), for tests/tools. */
export const effectiveSteerResponse = (s: VehicleSpec) => s.steerResponse ?? VEHICLE_MODEL.steerResponse;
