import { describe, expect, it } from 'vitest';
import { DINO } from '../config/gameConfig';
import { EventBus } from '../core/events';
import type { RaceContext } from '../core/race';
import { ScoreSystem } from './ScoreSystem';
import { applyDino, emptyStats, roundStore } from './roundStats';

describe('dino points', () => {
  it('applyDino adds points', () => {
    const s = emptyStats();
    applyDino(s, 2);
    expect(s.points).toBe(2);
  });
  it('ScoreSystem awards defeatPoints to each player in `by`', () => {
    const bus = new EventBus();
    const ctx = { bus, players: [{}, {}], settings: { goalPointsPerCar: 3 } } as unknown as RaceContext;
    new ScoreSystem().init(ctx);
    bus.emit('dino:defeated', { by: [1], x: 0, y: 0 });
    expect(roundStore.players[0].points).toBe(0);
    expect(roundStore.players[1].points).toBe(DINO.defeatPoints);
    bus.emit('dino:defeated', { by: [0, 1], x: 0, y: 0 });
    expect(roundStore.players[0].points).toBe(DINO.defeatPoints);
  });
});
