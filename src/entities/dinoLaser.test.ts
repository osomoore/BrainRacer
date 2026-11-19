import { describe, expect, it } from 'vitest';
import { DINO_LASER } from '../config/gameConfig';
import {
  beamHitsCircle, beamSideNormal, cancelLaser, chargeFrac, distToSegment, eyePositions, laserReady, newLaser, startLaser, stepLaser, sweepAngle, sweepSpeed,
} from './dinoLaser';

const tm = { chargeSec: 1, fireSec: 2, arc: 1 };

describe('laser state machine', () => {
  it('waits for cooldown then charges, fires, ends', () => {
    const s = newLaser(1);
    expect(laserReady(s, true)).toBe(false);
    stepLaser(s, 1.1, tm);
    expect(laserReady(s, true)).toBe(true);
    expect(laserReady(s, false)).toBe(false);
    startLaser(s, 0, 1);
    expect(stepLaser(s, 0.5, tm)).toBeNull();
    expect(chargeFrac(s, tm)).toBeCloseTo(0.5);
    expect(stepLaser(s, 0.6, tm)).toBe('fire');
    expect(s.phase).toBe('fire');
    expect(stepLaser(s, 1.9, tm)).toBeNull();
    expect(stepLaser(s, 0.2, tm)).toBe('ended');
    expect(s.phase).toBe('idle');
    expect(laserReady(s, true)).toBe(false); // caller must set the next cooldown
    s.cooldown = 3;
    stepLaser(s, 3, tm);
    expect(laserReady(s, true)).toBe(true);
  });
  it('cancel returns to idle', () => {
    const s = newLaser(0);
    startLaser(s, 0, 1);
    cancelLaser(s, 5);
    expect(s.phase).toBe('idle');
    expect(s.cooldown).toBe(5);
  });
});

describe('sweep', () => {
  it('goes from -arc/2 to +arc/2 around base at constant speed, either direction', () => {
    const s = newLaser(0);
    startLaser(s, 2, 1);
    stepLaser(s, 1, tm); // -> fire
    expect(sweepAngle(s, tm)).toBeCloseTo(2 - 0.5);
    stepLaser(s, 1, tm);
    expect(sweepAngle(s, tm)).toBeCloseTo(2);
    const r = newLaser(0);
    startLaser(r, 2, -1);
    stepLaser(r, 1, tm);
    expect(sweepAngle(r, tm)).toBeCloseTo(2 + 0.5);
  });
  it('config sweep is slow enough to dodge at beam length', () => {
    const t = { chargeSec: DINO_LASER.chargeSec, fireSec: DINO_LASER.fireSec, arc: DINO_LASER.arc };
    const tipSpeed = sweepSpeed(t) * DINO_LASER.length;
    expect(tipSpeed).toBeLessThan(700); // below car top speed so players can outrun the tip
    expect(DINO_LASER.chargeSec).toBeGreaterThanOrEqual(0.8);
  });
});

describe('geometry', () => {
  it('eyes sit ahead and either side of the heading', () => {
    const [a, b] = eyePositions(0, 0, 0, 100, 20);
    expect(a.x).toBeCloseTo(100); expect(b.x).toBeCloseTo(100);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(40);
    const [c, d] = eyePositions(0, 0, Math.PI / 2, 100, 20);
    expect(c.y).toBeCloseTo(100); expect(Math.abs(c.x - d.x)).toBeCloseTo(40);
  });
  it('segment distance clamps to endpoints', () => {
    expect(distToSegment(0, 0, 10, 0, 5, 3)).toBeCloseTo(3);
    expect(distToSegment(0, 0, 10, 0, 14, 3)).toBeCloseTo(5);
    expect(distToSegment(0, 0, 0, 0, 3, 4)).toBeCloseTo(5);
  });
  it('beam hit respects length, width and radius', () => {
    const from = { x: 0, y: 0 };
    expect(beamHitsCircle(from, 0, 500, 20, { x: 300, y: 45 }, 30)).toBe(true);
    expect(beamHitsCircle(from, 0, 500, 20, { x: 300, y: 60 }, 30)).toBe(false);
    expect(beamHitsCircle(from, 0, 500, 20, { x: 600, y: 0 }, 30)).toBe(false);
    expect(beamHitsCircle(from, 0, 500, 20, { x: -100, y: 0 }, 30)).toBe(false);
  });
  it('side normal points from beam toward the point', () => {
    const n = beamSideNormal(0, { x: 0, y: 0 }, { x: 100, y: -20 });
    expect(n.y).toBeCloseTo(-1);
  });
});
