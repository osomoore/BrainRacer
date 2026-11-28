import { WORLD_DRIVE, WORLD_PLAY, WORLD_SURFACES, WORLD_TERRAIN } from '../config';
import type { Feature, Obstacle, RoadSurface, SurfaceKind, SurfaceSample, TraitNeed, Traits } from '../core/types';

/** Retain road/path kinds for callers that only need to know whether the surface is a route. */
export interface RoadSurfaceSample extends SurfaceSample {
  roadSurface?: RoadSurface;
  /** Local bump strength for rocky road, in [0, 1]. */
  roadRoughness?: number;
}

export interface SurfaceEffect {
  speedMult: number;
  /** Steering control, from 0 to 1. */
  grip: number;
  acceleration: number;
  drag: number;
  lateralGrip: number;
  /** A suitable tire or claw immediately grips in its heading on slippery ground. */
  noSlide?: boolean;
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
  grass: { profile: WORLD_SURFACES.grass, ability: (_, t) => t.raised ? 3 : 0 },
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

export function terrainWall(sample: SurfaceSample, traits: Traits): 'dark' | 'heat' | undefined {
  if (traits.light === 0 && sample.dark >= WORLD_TERRAIN.wallThreshold) return 'dark';
  if (traits.heat === 0 && (sample.heat ?? 0) >= WORLD_TERRAIN.wallThreshold) return 'heat';
}

export function surfaceEffect(kind: Traits['kind'], sample: RoadSurfaceSample, traits: Traits): SurfaceEffect {
  const { profile: baseProfile, ability } = rules[sample.kind];
  const route = sample.kind === 'road' || sample.kind === 'path' ? sample.roadSurface : undefined;
  const rocky = route === 'rocky' ? WORLD_SURFACES.rockyRoad : undefined;
  const roadProfile = route === 'dirt' ? WORLD_SURFACES.dirtRoad : rocky;
  const profile = roadProfile ?? baseProfile;
  const level = ability?.(sample, traits) ?? 0;
  const speedMult = profile.speed[level];
  if (terrainWall(sample, traits)) return {
    speedMult: 0, grip: 0, acceleration: 0, drag: 0, lateralGrip: 0, passable: false, bounce: WORLD_TERRAIN.wallBounce,
  };
  if (speedMult === 0) return {
    speedMult, grip: 0, acceleration: 0, drag: 0, lateralGrip: 0, passable: false, bounce: WORLD_DRIVE.groundBounce,
  };

  const darkPenalty = baseProfile === WORLD_SURFACES.open ? 0 : unit(sample.dark) * (1 - WORLD_TERRAIN.darkSpeed[traits.light]);
  const bump = rocky ? unit(sample.roadRoughness ?? 0) : 0;
  const sureFooted = level >= WORLD_TERRAIN.suitedGrip
    && (sample.kind === 'ice' || sample.kind === 'mud' || sample.kind === 'deepMud');
  const grip = sureFooted ? 1 : Math.min(1, profile.grip[level] + (kind === 'dino' ? WORLD_TERRAIN.dinoGripBonus : 0))
    - (rocky?.bumpGripLoss ?? 0) * bump;
  const handling: Partial<Record<SurfaceKind, readonly [number, number, number]>> = WORLD_PLAY.handling;
  const [acceleration, drag, lateralGrip] = roadProfile?.handling ?? handling[sample.kind] ?? [1, 1, 1];
  const suited = sureFooted ? 1 : level / 3;
  return {
    speedMult: speedMult * (1 - darkPenalty),
    grip,
    acceleration: acceleration + (1 - acceleration) * suited,
    drag: drag + (1 - drag) * suited + (rocky?.bumpDrag ?? 0) * bump,
    lateralGrip: lateralGrip + (1 - lateralGrip) * suited,
    noSlide: sureFooted,
    passable: true,
  };
}

export function desertFatigue(current: number, sample: SurfaceSample, traits: Traits, dt: number): number {
  const { buildSeconds, recoverSeconds, shade, heatForImmunity } = WORLD_PLAY.desert;
  const exposed = sample.biome === 'desert' && !sample.covered && sample.dark < shade
    && sample.kind !== 'shallow' && sample.kind !== 'deep' && sample.kind !== 'hotSpring';
  const susceptibility = 1 - unit(traits.heat / heatForImmunity);
  return unit(current + (exposed && susceptibility > 0 ? susceptibility / buildSeconds : -1 / recoverSeconds) * dt);
}

export function meets(needs: readonly TraitNeed[] | undefined, traits: Traits): boolean {
  return needs?.every(({ trait, min = -Infinity, max = Infinity }) => {
    const value = traits[trait] ?? 0;
    return value >= min && value <= max;
  }) ?? true;
}

const breakable = new Set(['iceBlock', 'bush', 'rock', 'fence', 'crate']);

export function obstacleEffect(obstacle: Obstacle): Obstacle['effect'] {
  if (obstacle.kind === 'boulder' || obstacle.kind === 'tree') return;
  if (breakable.has(obstacle.kind)) return 'break';
  if (obstacle.kind === 'log') return 'push';
  return obstacle.effect;
}

export function obstaclePassable(obstacle: Obstacle, traits: Traits): boolean {
  if (obstacle.kind === 'boulder' || obstacle.kind === 'tree') return false;
  if (breakable.has(obstacle.kind)) return !!traits.smash;
  if (obstacle.kind === 'log') return meets(obstacle.needs, traits);
  return obstacle.kind === 'vent' || (obstacle.needs !== undefined && meets(obstacle.needs, traits));
}

export function featurePassable(feature: Feature, traits: Traits): boolean {
  return meets(feature.needs, traits);
}

export function visibilityRadius(dark: number, traits: Traits): number {
  const daylight = WORLD_TERRAIN.daylightRadius;
  return daylight + (WORLD_TERRAIN.darkRadius[traits.light] - daylight) * unit(dark);
}
