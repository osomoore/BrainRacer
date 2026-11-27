import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../../workshop/content';
import { defaultModel } from '../../../workshop/logic/stats';
import { WORLD_ACTIVITIES } from '../../config';
import { LiveWorld } from '../../host/liveWorld';
import { step } from '../../logic/move';
import { traitsOf } from '../../logic/traits';
import { WorldGen } from '../../gen/world';
import { nearestActivity, placeAtActivity } from '../kit/quickSpawn';
import { startRingJump, stepRingJump } from '../kit/ringJump';
import { ringPositions } from './ringJump';

describe('ring jump progress', () => {
  const targets = [{ x: 100, y: 0 }, { x: 145, y: 0 }, { x: 190, y: 0 }];
  const advance = (progress: ReturnType<typeof startRingJump>, x: number, airborne: number, dt = 0.1) =>
    stepRingJump(progress, { x, y: 0 }, airborne, dt, targets, 40, 1);

  it('collects the next ring in order only while airborne and reaches success', () => {
    let progress = startRingJump();
    let result = advance(progress, 100, 0);
    expect(result.collected).toBeUndefined();
    progress = result.progress;
    result = advance(progress, 100, 0.2);
    expect(result.collected).toBe(0);
    progress = result.progress;
    result = advance(progress, 190, 0.2);
    expect(result.collected).toBeUndefined(); // second ring must come first
    progress = result.progress;
    result = advance(progress, 145, 0.2);
    expect(result.collected).toBe(1);
    progress = result.progress;
    result = advance(progress, 190, 0.2);
    expect(result.collected).toBe(2);
    expect(result.progress.outcome).toBe('success');
  });

  it('fails on timeout and leaves a terminal run unchanged', () => {
    const timedOut = stepRingJump(startRingJump(), { x: 0, y: 0 }, 0, 1, targets, 40, 1);
    expect(timedOut.progress.outcome).toBe('fail');
    expect(stepRingJump(timedOut.progress, { x: 100, y: 0 }, 0.2, 1, targets, 40, 1))
      .toEqual({ progress: timedOut.progress, collected: undefined });
  });

  it('is deterministic for an identical sequence of movement samples', () => {
    const samples = [
      { position: { x: 80, y: 0 }, airborne: 0.3 },
      { position: { x: 102, y: 0 }, airborne: 0.2 },
      { position: { x: 150, y: 0 }, airborne: 0.1 },
    ];
    const run = () => {
      let progress = startRingJump();
      const collected: (number | undefined)[] = [];
      for (const sample of samples) {
        const result = stepRingJump(progress, sample.position, sample.airborne, 1 / 60, targets, 40, 1);
        progress = result.progress;
        collected.push(result.collected);
      }
      return { progress, collected };
    };
    expect(run()).toEqual(run());
  });

  it('carries a seed-29 quick-spawn default car through its ramp ring', () => {
    const world = new LiveWorld(new WorldGen(29));
    const site = nearestActivity(world, { x: 0, y: 0 }, 'ringJump');
    expect(site).toBeDefined();
    const live = world.live(world.hexAt(site!.at.x, site!.at.y));
    const traits = traitsOf({ workshop: 'race', model: defaultModel(CATALOGS.race) });
    const targets = ringPositions(site!, live, WORLD_ACTIVITIES.ringJump.ringCountByJump[traits.jump]);
    const mockPlayer = {
      move: { x: 0, y: 0, angle: 0, vx: 0, vy: 0, airborne: 0 },
      hex: world.hexAt(0, 0),
      surface: world.surfaceAt(0, 0),
    };
    placeAtActivity(world, mockPlayer as never, site!);
    let progress = startRingJump();
    let state = mockPlayer.move;
    for (let frame = 0; frame < 360 && progress.outcome === 'running'; frame++) {
      state = step(state, { x: 0, y: 0, throttle: 1, brake: 0 }, traits, world, 1 / 60);
      progress = stepRingJump(progress, state, state.airborne, 1 / 60, targets,
        WORLD_ACTIVITIES.ringJump.catchRadius, WORLD_ACTIVITIES.ringJump.timeoutSeconds).progress;
    }
    expect(progress.outcome).toBe('success');
  });
});
