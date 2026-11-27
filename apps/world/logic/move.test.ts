import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import type { Feature, Obstacle, SurfaceSample } from '../core/types';
import { step } from './move';
import type { MoveInput, MoveState, MoveWorld, NearbySolids } from './move';
import { traitsOf } from './traits';

const car = traitsOf({ workshop: 'race', model: defaultModel(CATALOGS.race) });
const dino = traitsOf({ workshop: 'dino', model: defaultModel(CATALOGS.dino) });
const road: SurfaceSample = { kind: 'road', biome: 'meadow', dark: 0, covered: false };
const start: MoveState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, airborne: 0 };
const forward: MoveInput = { x: 0, y: 0, throttle: 1, brake: 0 };
const neutral: MoveInput = { ...forward, throttle: 0 };
const box = (left: number, right: number) => [
  { x: left, y: -90 }, { x: right, y: -90 }, { x: right, y: 90 }, { x: left, y: 90 },
];

function world(solids: NearbySolids = {}, surfaceAt: MoveWorld['surfaceAt'] = () => road): MoveWorld {
  return { surfaceAt, nearbySolids: () => solids };
}

function simulate(input: MoveInput, build = car, terrain = world(), state = start, frames = 90) {
  let current = state;
  for (let frame = 0; frame < frames; frame++) current = step(current, input, build, terrain, 1 / 60);
  return current;
}

describe('kinematic driving', () => {
  it('is deterministic for fixed dt and does not mutate its inputs', () => {
    const state = Object.freeze({ ...start });
    const input = Object.freeze({ ...forward, x: 0.35 });
    const build = Object.freeze({ ...car });
    const first = simulate(input, build, world(), state);
    expect(first).toEqual(simulate(input, build, world(), state));
    expect(first.x).toBeGreaterThan(0);
    expect(first.y).toBeGreaterThan(0);
    expect(state).toEqual(start);
  });

  it('reverses at a lower speed and brakes a moving car', () => {
    const reverse = simulate({ ...forward, throttle: -1 });
    const ahead = simulate(forward);
    expect(reverse.x).toBeLessThan(0);
    expect(-reverse.vx).toBeLessThan(ahead.vx);
    const braking = simulate({ ...forward, brake: 1 }, car, world(), ahead, 60);
    expect(braking.vx).toBe(0);
    expect(braking.x).toBeGreaterThan(ahead.x);
  });

  it('limits dino turning and normalizes diagonal analog input', () => {
    const down = { ...neutral, y: 1 };
    const first = step(start, down, dino, world(), 1 / 60);
    expect(first.angle).toBeGreaterThan(0);
    expect(first.angle).toBeLessThan(Math.PI / 2);
    const diagonal = simulate({ ...down, x: 1 }, dino);
    expect(diagonal.angle).toBeCloseTo(Math.PI / 4);
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(dino.speed);
    const partial = simulate({ ...neutral, x: 0.5 }, dino);
    expect(partial.vx).toBeCloseTo(dino.speed / 2);
  });

  it.each([['ice', 'snow'], ['mud', 'mud']] as const)('preserves sideways drift on %s until grip catches it', (kind, trait) => {
    const terrain = world({}, () => ({ ...road, kind }));
    for (const build of [car, dino]) {
      const sliding = { ...start, vx: 100, vy: 130 };
      const loose = step(sliding, forward, { ...build, [trait]: 0 }, terrain, 0.15);
      const suited = step(sliding, forward, { ...build, [trait]: 3 }, terrain, 0.15);
      expect(loose.y).toBeGreaterThan(suited.y);
      expect(loose.vy).toBeGreaterThan(60);
      expect(suited.vy).toBeLessThan(20);
    }
  });

  it('bogs an unsuited car in deep mud while leaving enough traction to wiggle out', () => {
    const terrain = world({}, () => ({ ...road, kind: 'deepMud', biome: 'mud' }));
    const build = { ...car, mud: 0 };
    const bogged = simulate(forward, build, terrain);
    expect(bogged.vx).toBeGreaterThan(0);
    expect(bogged.vx).toBeLessThan(build.speed / 4);
    const wiggled = simulate({ ...forward, x: 1 }, build, terrain, bogged);
    expect(wiggled.x).toBeGreaterThan(bogged.x + 20);
    expect(wiggled.y).toBeGreaterThan(bogged.y + 5);
  });
});

describe('collisions', () => {
  const rock: Obstacle = { id: 'rock', kind: 'boulder', at: { x: 50, y: 0 }, radius: 12 };

  it('bounces from a circle without tunneling on a long frame', () => {
    const hit = step({ ...start, vx: 300 }, neutral, car, world({ obstacles: [rock] }), 0.12);
    expect(hit.x).toBeLessThanOrEqual(50 - 24 - rock.radius);
    expect(hit.vx).toBeLessThan(0);
  });

  it('slides along a polygon gate and lets a small build through', () => {
    const tunnel: Feature = { id: 'tunnel', kind: 'tunnel', at: { x: 60, y: 0 }, area: box(60, 120), dir: 0,
      needs: [{ trait: 'height', max: 2 }] };
    const terrain = world({ features: [tunnel] });
    const angle = Math.PI / 4;
    const approach = { ...start, x: 30, angle, vx: 200, vy: 200 };
    const wide = step(approach, neutral, { ...car, height: 3 }, terrain, 0.08);
    expect(wide.x).toBeLessThanOrEqual(36);
    expect(wide.y).toBeGreaterThan(10);
    expect(step(approach, forward, car, terrain, 0.25).x).toBeGreaterThan(60);
  });

  it('reports a satisfied obstacle effect once per step', () => {
    const log: Obstacle = Object.freeze({ ...rock, kind: 'log', effect: 'push', needs: [{ trait: 'push', min: 2 }] } satisfies Obstacle);
    const terrain = world({ obstacles: [log] });
    expect(step({ ...start, vx: 250 }, forward, car, terrain, 0.3).obstacleEffects).toEqual([]);
    const strong = step({ ...start, vx: 250 }, forward, { ...car, push: 3 }, terrain, 0.3);
    expect(strong.obstacleEffects).toHaveLength(1);
    expect(strong.obstacleEffects[0]).toMatchObject({ obstacle: log, effect: 'push' });
    expect(strong.obstacleEffects[0].at!.x).toBeGreaterThan(log.at.x);
    expect(strong.x).toBeLessThan(strong.obstacleEffects[0].at!.x);
  });

  it('slides a pushed obstacle up to a solid without passing through it', () => {
    const log: Obstacle = { ...rock, id: 'log', kind: 'log', needs: [], effect: 'push' };
    const wall: Obstacle = { ...rock, at: { x: 130, y: 0 }, radius: 20 };
    const terrain = world({ obstacles: [log, wall] });
    let player = start;
    for (let frame = 0; frame < 180; frame++) {
      const result = step(player, forward, car, terrain, 1 / 60);
      const destination = result.obstacleEffects[0]?.at;
      if (destination) log.at = destination;
      player = result;
    }
    const contact = wall.at.x - wall.radius - log.radius;
    expect(log.at.x).toBeGreaterThan(contact - 5);
    expect(log.at.x).toBeLessThanOrEqual(contact);
    expect(player.x).toBeLessThan(log.at.x - log.radius);
  });

  it('blocks the bank on foot and lets a swimming build into deep water', () => {
    const lake = world({}, x => x >= 40 ? { ...road, kind: 'deep', biome: 'lake' } : road);
    expect(simulate(forward, car, lake).x).toBeLessThan(40);
    expect(simulate(forward, { ...car, water: 3 }, lake).x).toBeGreaterThan(80);
  });
});

describe('jumping', () => {
  const ramp: Feature = { id: 'ramp', kind: 'jump', at: { x: 60, y: 0 }, area: box(60, 100), dir: 0 };
  const gap: Feature = { ...ramp, id: 'gap', area: box(60, 260), needs: [{ trait: 'jump', min: 2 }] };
  const rolling = { ...start, vx: 270 };

  it('coasts over blocked surfaces and obstacles while airborne', () => {
    const stone: Obstacle = { id: 'stone', kind: 'boulder', at: { x: 98, y: 0 }, radius: 10 };
    const terrain = world({ features: [ramp], obstacles: [stone] },
      x => x >= 60 && x <= 85 ? { ...road, kind: 'cliff' } : road);
    const air = step(rolling, forward, car, terrain, 0.15);
    expect(air.airborne).toBeGreaterThan(0);
    const across = step(air, { ...forward, brake: 1, x: 1 }, car, terrain, air.airborne - 0.01);
    expect(across.x).toBeGreaterThan(122);
    expect(across.airborne).toBeGreaterThan(0);
    expect(across.angle).toBeCloseTo(0);
    const landed = step(across, neutral, car, terrain, across.airborne + 0.001);
    expect(landed.airborne).toBe(0);
    expect(landed.x).toBeGreaterThan(across.x);
  });

  it('bounces an underqualified build at the gap lip and carries a qualified one over it', () => {
    const terrain = world({ features: [gap] },
      x => x >= 70 && x <= 250 ? { ...road, kind: 'cliff', biome: 'canyon' } : road);
    const rejected = step(rolling, neutral, car, terrain, 0.19);
    expect(rejected.x).toBeLessThanOrEqual(36);
    expect(rejected.vx).toBeLessThan(0);
    expect(rejected.airborne).toBe(0);
    const cleared = simulate(forward, { ...car, jump: 2 }, terrain, start, 120);
    expect(cleared.x).toBeGreaterThan(284);
    expect(cleared.airborne).toBe(0);
  });

  it('returns to the lip when a jump would land in blocked ground', () => {
    const terrain = world({ features: [ramp] }, x => x > 58 ? { ...road, kind: 'cliff' } : road);
    const result = step(rolling, forward, car, terrain, 0.5);
    expect(result.x).toBeLessThan(58);
    expect(result.vx).toBeLessThan(0);
    expect(result.airborne).toBe(0);
  });

  it('pops a passing build over a vent and avoids relaunching a stationary build on the same vent', () => {
    const vent: Obstacle = { id: 'vent', kind: 'vent', at: { x: 54, y: 0 }, radius: 18 };
    const terrain = world({ obstacles: [vent] });
    const passing = step(rolling, forward, car, terrain, 0.1);
    expect(passing.airborne).toBeGreaterThan(0);
    expect(passing.jump?.id).toBe(vent.id);
    const onVent = { ...start, x: vent.at.x };
    expect(step(onVent, neutral, car, terrain, 0.01).airborne).toBeGreaterThan(0);
    expect(simulate(neutral, car, terrain, onVent).airborne).toBe(0);
  });
});
