import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import { BIOME_IDS } from '../core/types';
import type { BiomeId, Feature, Model, Obstacle, SurfaceKind, SurfaceSample, WorkshopId } from '../core/types';
import { featurePassable, meets, obstaclePassable, surfaceEffect, visibilityRadius } from './rules';
import { traitsOf } from './traits';

function build(workshop: WorkshopId, parts: Model = {}) {
  return traitsOf({ workshop, model: { ...defaultModel(CATALOGS[workshop]), ...parts } });
}

const defaults = [build('race'), build('dino')];
const specialties: Record<BiomeId, [SurfaceKind, WorkshopId, Model, number?]> = {
  // Grass suits all builds, so meadow's advantage comes from raw speed.
  meadow: ['grass', 'race', { engine: 'engine.turbo', wheels: 'wheels.racing', body: 'body.sports' }],
  mud: ['mud', 'race', { wheels: 'wheels.mud', gears: 'gears.fourByFour' }],
  rocky: ['rough', 'race', { body: 'body.jeep', wheels: 'wheels.monster' }],
  lake: ['shallow', 'dino', { legs: 'legs.flippers', tail: 'tail.paddle' }],
  darkwood: ['grass', 'dino', { extra: 'extra.glow' }, 0.55],
  snow: ['snow', 'race', { wheels: 'wheels.snow' }],
  desert: ['sand', 'dino', { color: 'color.sandy', extra: 'extra.frill' }],
  jungle: ['tallGrass', 'dino', { size: 'size.small' }],
  canyon: ['rough', 'dino', { legs: 'legs.hoppy' }],
  geyser: ['rough', 'race', { engine: 'engine.efficient', shape: 'shape.sleek' }],
};
const extraSurfaces: Partial<Record<BiomeId, SurfaceKind>> = { mud: 'deepMud', snow: 'ice', geyser: 'hotSpring' };

describe('terrain', () => {
  it.each(BIOME_IDS)('%s has a real Workshop build at least 1.6× faster than both defaults', biome => {
    const [kind, workshop, parts, dark = 0] = specialties[biome];
    const sample: SurfaceSample = { kind, biome, dark, covered: false };
    const suited = build(workshop, parts);
    const samples = [sample];
    const extra = extraSurfaces[biome];
    if (extra) samples.push({ ...sample, kind: extra });
    for (const terrain of samples) {
      const speed = suited.speed * surfaceEffect(suited.kind, terrain, suited).speedMult;
      for (const baseline of defaults) {
        const effect = surfaceEffect(baseline.kind, terrain, baseline);
        expect(effect.passable).toBe(true);
        expect(speed).toBeGreaterThanOrEqual(1.6 * baseline.speed * effect.speedMult);
      }
    }
  });

  it.each(['road', 'path', 'bridge'] as const)('keeps %s fast for both defaults and every specialty', kind => {
    const builds = [...defaults, ...Object.values(specialties).map(([, workshop, parts]) => build(workshop, parts))];
    for (const traits of builds) {
      const sample: SurfaceSample = { kind, biome: 'darkwood', dark: 1, covered: true };
      const effect = surfaceEffect(traits.kind, sample, traits);
      expect(effect.passable).toBe(true);
      expect(effect.speedMult).toBeGreaterThanOrEqual(0.85);
      expect(effect.grip).toBe(1);
    }
  });

  it('gates deep water and cliffs, and gives snow tires more ice control', () => {
    const [car, dino] = defaults;
    const deep: SurfaceSample = { kind: 'deep', biome: 'lake', dark: 0, covered: false };
    for (const traits of defaults) {
      expect(surfaceEffect(traits.kind, deep, traits)).toMatchObject({ passable: false, speedMult: 0, grip: 0 });
    }
    const snorkel = build('race', { extra: 'extra.snorkel' });
    const float = build('race', { extra: 'extra.floats' });
    expect(surfaceEffect('car', deep, snorkel).passable).toBe(true);
    expect(surfaceEffect('car', deep, float).speedMult).toBeGreaterThan(surfaceEffect('car', deep, snorkel).speedMult);
    expect(surfaceEffect('dino', { ...deep, kind: 'cliff' }, { ...dino, jump: 3 }).passable).toBe(false);
    const ice: SurfaceSample = { ...deep, kind: 'ice', biome: 'snow' };
    expect(surfaceEffect('car', ice, build('race', { wheels: 'wheels.snow' })).grip)
      .toBeGreaterThan(surfaceEffect('car', ice, car).grip);
  });

  it('increases dark visibility for light builds and gives everyone daylight vision', () => {
    const [, dino] = defaults;
    const glow = build('dino', { extra: 'extra.glow' });
    expect(visibilityRadius(1, glow)).toBeGreaterThan(visibilityRadius(1, dino));
    expect(visibilityRadius(0, glow)).toBe(visibilityRadius(0, dino));
    expect(visibilityRadius(0.5, dino)).toBeGreaterThan(visibilityRadius(1, dino));
    expect(visibilityRadius(0.5, dino)).toBeLessThan(visibilityRadius(0, dino));
  });
});

describe('trait gates', () => {
  const [car] = defaults;
  const at = { x: 0, y: 0 };

  it('combines inclusive minima and maxima and treats missing bounds as unrestricted', () => {
    expect(meets(undefined, car)).toBe(true);
    expect(meets([{ trait: 'width', min: 2, max: 2 }, { trait: 'mud' }], car)).toBe(true);
    expect(meets([{ trait: 'width', min: 2 }, { trait: 'jump', min: 2 }], car)).toBe(false);
  });

  it('checks obstacle abilities and defaults obstacles without needs to solid', () => {
    const log: Obstacle = { id: 'log', kind: 'log', at, radius: 25, effect: 'push' };
    expect(obstaclePassable(log, car)).toBe(false);
    const gated = { ...log, needs: [{ trait: 'push', min: 2 }] } satisfies Obstacle;
    expect(obstaclePassable(gated, car)).toBe(false);
    expect(obstaclePassable(gated, build('race', { bumpers: 'bumpers.pusher' }))).toBe(true);
  });

  it('checks passage size and jump minimum, regardless of whether there is a bypass', () => {
    const tunnel: Feature = { id: 'tunnel', kind: 'tunnel', at, area: [], dir: 0,
      needs: [{ trait: 'width', max: 2 }, { trait: 'height', max: 2 }], bypass: true };
    expect(featurePassable(tunnel, car)).toBe(true);
    expect(featurePassable(tunnel, build('race', { springs: 'springs.lifted' }))).toBe(false);
    const gap: Feature = { ...tunnel, kind: 'jump', needs: [{ trait: 'jump', min: 2 }] };
    expect(featurePassable(gap, car)).toBe(false);
    expect(featurePassable(gap, build('dino', { legs: 'legs.hoppy' }))).toBe(true);
  });
});
