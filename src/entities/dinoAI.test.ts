import { describe, expect, it } from 'vitest';
import { DINO } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { capsuleHit, chooseWaypoint, dinoCapsule, dist, isDefeated, isTeamHit, patrolPoint, ramDamage, shouldSpawn, steer, wrapAngle, type DinoWalk } from './dinoAI';

const sites = Array.from({ length: 40 }, (_, i) => ({ x: (i % 8) * 600 + 100, y: Math.floor(i / 8) * 600 + 100 }));
const opts = { goalChance: 0.6, goalRadius: 250, minDist: 300 };

describe('chooseWaypoint', () => {
  it('biases toward the goal ~60% and never within minDist', () => {
    const goal = { x: 9000, y: 9000 }; // far from every site
    let near = 0;
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      const rng = new Rng(seed);
      const pos = { x: rng.range(0, 4800), y: rng.range(0, 3000) };
      const w = chooseWaypoint(rng, pos, goal, sites, opts);
      expect(dist(w, pos)).toBeGreaterThanOrEqual(300);
      if (dist(w, goal) <= 250.001) near++;
    }
    expect(near / N).toBeGreaterThan(0.5);
    expect(near / N).toBeLessThan(0.7);
  });
  it('works with no goal and no sites', () => {
    const w = chooseWaypoint(new Rng(1), { x: 0, y: 0 }, null, [], opts);
    expect(dist(w, { x: 0, y: 0 })).toBeGreaterThanOrEqual(300);
    expect(chooseWaypoint(new Rng(2), { x: 0, y: 0 }, null, sites, opts)).toBeTruthy();
  });
});

describe('steer', () => {
  const so = { speed: 330, turnRate: 1.1, arriveRadius: 90, pauseSec: 1 };
  it('limits turn rate', () => {
    const w: DinoWalk = { x: 0, y: 0, angle: 0, pauseLeft: 0 };
    steer(w, { x: -1000, y: 1 }, 0.1, so);
    expect(Math.abs(wrapAngle(w.angle))).toBeLessThanOrEqual(1.1 * 0.1 + 1e-9);
  });
  it('arrives, pauses ~1s, then moves', () => {
    const w: DinoWalk = { x: 0, y: 0, angle: 0, pauseLeft: 0 };
    const t = { x: 1000, y: 0 };
    let res: string = 'walking';
    for (let i = 0; i < 1000 && res !== 'arrived'; i++) res = steer(w, t, 1 / 60, so);
    expect(res).toBe('arrived');
    let paused = 0;
    while (steer(w, t, 1 / 60, so) === 'paused') paused++;
    expect(paused / 60).toBeGreaterThan(0.9);
  });
  it('moves at constant speed when aligned', () => {
    const w: DinoWalk = { x: 0, y: 0, angle: 0, pauseLeft: 0 };
    steer(w, { x: 5000, y: 0 }, 1, so);
    expect(w.x).toBeCloseTo(330);
  });
});

describe('capsule', () => {
  const c = dinoCapsule(100, 100, 0, 100, 50, 60);
  it('hits inside body and head zone', () => {
    expect(capsuleHit(c, 100, 140)).toBe(true);
    expect(capsuleHit(c, 250, 100)).toBe(true);
  });
  it('misses outside and respects target radius', () => {
    expect(capsuleHit(c, 100, 200)).toBe(false);
    expect(capsuleHit(c, 100, 200, 40)).toBe(true);
    expect(capsuleHit(c, -20, 100)).toBe(false);
  });
});

describe('shouldSpawn', () => {
  it('spawns at half time', () => {
    expect(shouldSpawn(149, 300, 0.5)).toBe(false);
    expect(shouldSpawn(150, 300, 0.5)).toBe(true);
  });
});

describe('guard patrol', () => {
  it('stays within the guard radius around the goal', () => {
    const goal = { x: 3000, y: 2000 };
    const guardR = 170 * DINO.guardRadiusMul + DINO.guardRadiusPad;
    const loop = guardR * DINO.patrolLoopFrac;
    let phase = 0.7;
    const w: DinoWalk = { ...patrolPoint(goal, loop, phase), angle: phase + Math.PI / 2, pauseLeft: 0 };
    phase += DINO.patrolStepRad;
    let target = patrolPoint(goal, loop, phase);
    let maxD = 0;
    for (let i = 0; i < 60 * 240; i++) {
      const r = steer(w, target, 1 / 60, { speed: DINO.speed * DINO.guardSpeedFrac, turnRate: DINO.turnRate, arriveRadius: DINO.arriveRadius, pauseSec: DINO.patrolPauseSec });
      if (r === 'arrived') { phase += DINO.patrolStepRad; target = patrolPoint(goal, loop, phase); }
      maxD = Math.max(maxD, dist(w, goal));
    }
    expect(maxD).toBeLessThanOrEqual(guardR);
  });
});

describe('ram damage', () => {
  const c = { minSpeed: 200, speedMax: 700, dmgMin: 12, dmgMax: 30, turboMult: 1.5, teamMult: 2 };
  it('scales with speed and ignores slow bumps', () => {
    expect(ramDamage(199, false, false, c)).toBe(0);
    expect(ramDamage(200, false, false, c)).toBeCloseTo(12);
    expect(ramDamage(700, false, false, c)).toBeCloseTo(30);
    expect(ramDamage(5000, false, false, c)).toBeCloseTo(30);
  });
  it('applies turbo and team multipliers', () => {
    expect(ramDamage(700, true, false, c)).toBeCloseTo(45);
    expect(ramDamage(700, false, true, c)).toBeCloseTo(60);
    expect(ramDamage(700, true, true, c)).toBeCloseTo(90);
  });
  it('team window', () => {
    expect(isTeamHit(10, 11.4, 1.5)).toBe(true);
    expect(isTeamHit(10, 11.6, 1.5)).toBe(false);
  });
  it('defeat threshold and lone-player hit count', () => {
    expect(isDefeated(0)).toBe(true);
    expect(isDefeated(0.1)).toBe(false);
    let hp = DINO.maxHp, n = 0;
    while (!isDefeated(hp)) { hp -= ramDamage(450, false, false, c); n++; }
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
  });
});
