import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../config/gameConfig';
import { Rng } from '../core/rng';
import {
  allowedRect, dist, fleeDir, flightPose, insideRect, launchDir, launchDistance, newAnimal, startFlee, startFlight,
  startReturn, stepFlight, stepGround, type AnimalAI,
} from './animalAI';

const zone = { x: 1000, y: 1000, w: 500, h: 400 };

function run(a: AnimalAI, rng: Rng, secs: number, dt = 1 / 60): void {
  for (let t = 0; t < secs; t += dt) stepGround(rng, a, dt);
}

describe('wander', () => {
  it('fenced animals never leave their zone', () => {
    for (const kind of ['cow', 'sheep', 'pig', 'horse', 'chicken', 'duck'] as const) {
      const rng = new Rng(7);
      const a = newAnimal(rng, kind, zone, true);
      for (let i = 0; i < 60 * 120; i++) {
        stepGround(rng, a, 1 / 60);
        expect(insideRect(a.x, a.y, zone)).toBe(true);
      }
    }
  });
  it('actually moves and changes modes', () => {
    const rng = new Rng(3);
    const a = newAnimal(rng, 'cow', zone, true);
    const modes = new Set<string>();
    for (let i = 0; i < 60 * 60; i++) { stepGround(rng, a, 1 / 60); modes.add(a.mode); }
    expect(modes.has('walk')).toBe(true);
    expect(modes.has('graze')).toBe(true);
    expect(a.walked).toBeGreaterThan(50);
  });
  it('is deterministic for a seed', () => {
    const go = (seed: number) => { const r = new Rng(seed); const a = newAnimal(r, 'sheep', zone, true); run(a, r, 30); return [a.x, a.y, a.mode]; };
    expect(go(11)).toEqual(go(11));
    expect(go(11)).not.toEqual(go(12));
  });
});

describe('flee', () => {
  it('runs away from the threat and stays in the zone', () => {
    const rng = new Rng(1);
    const a = newAnimal(rng, 'pig', zone, true);
    a.x = 1250; a.y = 1200;
    const d0 = dist(a.x, a.y, 1100, 1200);
    startFlee(rng, a, 1100, 1200, 0.9);
    expect(a.mode).toBe('flee');
    run(a, rng, 0.8);
    expect(dist(a.x, a.y, 1100, 1200)).toBeGreaterThan(d0);
    expect(insideRect(a.x, a.y, zone)).toBe(true);
  });
  it('fleeDir is a unit vector pointing away', () => {
    const d = fleeDir(10, 0, 0, 0);
    expect(d.x).toBeCloseTo(1); expect(d.y).toBeCloseTo(0);
    expect(fleeDir(5, 5, 5, 5)).toEqual({ x: 1, y: 0 });
  });
});

describe('launch', () => {
  it('direction blends heading and away, unit length', () => {
    const d = launchDir(100, 0, 0, 0, 1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(d.x).toBeGreaterThan(0); expect(d.y).toBeGreaterThan(0);
    expect(Math.hypot(launchDir(0, 0, 0, 0, 0, 0).x, 0)).toBeCloseTo(1);
  });
  it('distance scales with speed within bounds', () => {
    expect(launchDistance(10)).toBe(ANIMALS.launch.minDist);
    expect(launchDistance(100000)).toBe(ANIMALS.launch.maxDist);
    expect(launchDistance(400)).toBeGreaterThan(launchDistance(300));
  });
  it('arc: scale peaks mid-flight, returns to 1 on the ground, lands then daze', () => {
    const rng = new Rng(2);
    const a = newAnimal(rng, 'cow', zone, true);
    a.x = 1250; a.y = 1200;
    startFlight(a, 1, 0, 400, () => true);
    expect(a.mode).toBe('fly');
    const mid = flightPose(a, a.fdur / 2);
    expect(mid.scale).toBeCloseTo(ANIMALS.launch.peakScale);
    expect(flightPose(a, 0).scale).toBeCloseTo(1);
    expect(flightPose(a, a.fdur).height).toBeCloseTo(0);
    expect(mid.x).toBeCloseTo((a.fx0 + a.fx1) / 2);
    let n = 0;
    while (a.mode === 'fly' && n++ < 1000) stepFlight(a, 1 / 60);
    expect(a.mode).toBe('daze');
    expect(a.x).toBeCloseTo(a.fx1); expect(a.y).toBeCloseTo(a.fy1);
    expect(dist(a.fx0, a.fy0, a.fx1, a.fy1)).toBeCloseTo(launchDistance(400));
  });
  it('shortens the flight when the landing spot is bad, or stays put if none is', () => {
    const rng = new Rng(2);
    const a = newAnimal(rng, 'cow', zone, true);
    a.x = 0; a.y = 0;
    startFlight(a, 1, 0, 1000, (x) => x < 300);
    expect(a.fx1).toBeLessThan(300);
    startFlight(a, 1, 0, 1000, () => false);
    expect(a.fx1).toBe(0);
  });
});

describe('return to zone', () => {
  it('a fenced animal landing outside trots back in', () => {
    const rng = new Rng(5);
    const a = newAnimal(rng, 'horse', zone, true);
    a.x = 1700; a.y = 1200; a.mode = 'daze'; a.t = 0;
    run(a, rng, ANIMALS.launch.dazeSec + 0.1);
    expect(a.mode).toBe('return');
    run(a, rng, 20);
    expect(insideRect(a.x, a.y, allowedRect(zone, 'horse', true)) || insideRect(a.x, a.y, zone)).toBe(true);
    expect(['graze', 'walk']).toContain(a.mode);
  });
  it('startReturn targets the nearest inside point', () => {
    const rng = new Rng(5);
    const a = newAnimal(rng, 'cow', zone, true);
    a.x = 900; a.y = 1200;
    startReturn(a);
    expect(a.tx).toBeGreaterThan(1000);
    expect(a.ty).toBe(1200);
  });
});

describe('ducks', () => {
  it('followers queue behind the leader', () => {
    const rng = new Rng(9);
    const free = { x: 0, y: 0, w: 800, h: 600 };
    const lead = newAnimal(rng, 'duck', free, false);
    const f = newAnimal(rng, 'duck', free, false);
    f.leader = lead; f.rank = 1;
    lead.x = 400; lead.y = 300; lead.angle = 0;
    f.x = 300; f.y = 300; f.mode = 'walk'; f.timer = 5;
    for (let i = 0; i < 60 * 3; i++) stepGround(rng, f, 1 / 60);
    expect(dist(f.x, f.y, lead.x - ANIMALS.duckSpacing, lead.y)).toBeLessThan(15);
  });
});
