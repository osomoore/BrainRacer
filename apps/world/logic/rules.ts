import { WORLD_DRIVE, WORLD_SURFACES, WORLD_TERRAIN } from '../config';
import type { Feature, Obstacle, SurfaceKind, SurfaceSample, TraitNeed, Traits } from '../core/types';

export interface SurfaceEffect {
  speedMult: number;
  /** Steering and acceleration control, from 0 to 1. */
  grip: number;
  passable: boolean;
  /** Normal velocity retained in the opposite direction after a blocked entry. */
  bounce?: number;
}

type SurfaceProfile = typeof WORLD_SURFACES[keyof typeof WORLD_SURFACES];
type SurfaceRule = { profile: SurfaceProfile; ability?: (sample: SurfaceSample, traits: Traits) => number };

const compact = (traits: Traits): number => traits.width === 1 ? 3 : 0;
const rules: Record<SurfaceKind, SurfaceRule> = {
  road: { profile: WORLD_SURFACES.open },
  path: { profile: WORLD_SURFACES.open },
  bridge: { profile: WORLD_SURFACES.open },
  grass: { profile: WORLD_SURFACES.grass },
  tallGrass: { profile: WORLD_SURFACES.tallGrass, ability: (_, t) => Math.max(compact(t), t.reach) },
  sand: { profile: WORLD_SURFACES.sand, ability: (_, t) => t.heat },
  snow: { profile: WORLD_SURFACES.snow, ability: (_, t) => Math.max(t.snow, t.cold) },
  ice: { profile: WORLD_SURFACES.ice, ability: (_, t) => t.snow },
  mud: { profile: WORLD_SURFACES.mud, ability: (_, t) => t.mud },
  deepMud: { profile: WORLD_SURFACES.deepMud, ability: (_, t) => t.mud },
  rough: {
    profile: WORLD_SURFACES.rough,
    ability: (sample, t) => {
      if (sample.biome === 'canyon') return Math.max(t.rough, t.jump, compact(t));
      if (sample.biome === 'geyser') return Math.max(t.rough, t.heat);
      return t.rough;
    },
  },
  shallow: { profile: WORLD_SURFACES.shallow, ability: (_, t) => t.water },
  deep: { profile: WORLD_SURFACES.deep, ability: (_, t) => t.water },
  hotSpring: { profile: WORLD_SURFACES.hotSpring, ability: (_, t) => Math.max(t.heat, t.rough) },
  cliff: { profile: WORLD_SURFACES.cliff },
};

const unit = (value: number): number => Math.max(0, Math.min(1, value));

export function surfaceEffect(kind: Traits['kind'], sample: SurfaceSample, traits: Traits): SurfaceEffect {
  const { profile, ability } = rules[sample.kind];
  const level = ability?.(sample, traits) ?? 0;
  const speedMult = profile.speed[level];
  if (speedMult === 0) return { speedMult, grip: 0, passable: false, bounce: WORLD_DRIVE.groundBounce };

  const darkPenalty = profile === WORLD_SURFACES.open ? 0 : unit(sample.dark) * (1 - WORLD_TERRAIN.darkSpeed[traits.light]);
  const grip = Math.min(1, profile.grip[level] + (kind === 'dino' ? WORLD_TERRAIN.dinoGripBonus : 0));
  return { speedMult: speedMult * (1 - darkPenalty), grip, passable: true };
}

export function meets(needs: readonly TraitNeed[] | undefined, traits: Traits): boolean {
  return needs?.every(({ trait, min, max }) => traits[trait] >= (min ?? -Infinity) && traits[trait] <= (max ?? Infinity)) ?? true;
}

export function obstaclePassable(obstacle: Obstacle, traits: Traits): boolean {
  return obstacle.needs !== undefined && meets(obstacle.needs, traits);
}

export function featurePassable(feature: Feature, traits: Traits): boolean {
  return meets(feature.needs, traits);
}

export function visibilityRadius(dark: number, traits: Traits): number {
  const daylight = WORLD_TERRAIN.daylightRadius;
  return daylight + (WORLD_TERRAIN.darkRadius[traits.light] - daylight) * unit(dark);
}
