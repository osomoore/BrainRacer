import { describe, expect, it } from 'vitest';
import type { Challenge, PlayerId } from '../core/types';
import { BreakScheduler, type BreakEvent } from './BreakScheduler';

let n = 0;
const make = (p: PlayerId, place: string | null): Challenge => ({
  id: n++, player: p, kind: 'math', prompt: { kind: 'text', text: '1 + 1' },
  options: [{ kind: 'text', text: '2' }, { kind: 'text', text: '3' }, { kind: 'text', text: '4' }, { kind: 'text', text: '5' }],
  correct: 0, durationSec: 0, source: place ? 'place' : 'random', ...(place ? { placeWord: place } : {}),
});
const sched = (players = 2) => new BreakScheduler({
  players, firstAtSec: 5, intervalSec: 10, goSec: 0.6, wrongRetrySec: 0.5, wrongRevealSec: 2, placeCooldownSec: 60, make,
});
const types = (ev: BreakEvent[]) => ev.map((e) => e.type);

describe('BreakScheduler', () => {
  it('first break at 5 s, shared by both players', () => {
    const s = sched();
    expect(s.update(4.9, 0.1)).toEqual([]);
    const ev = s.update(5, 0.1);
    expect(types(ev)).toEqual(['breakStart', 'shown', 'shown']);
    expect(s.active).toBe(true);
    expect(s.current(0)).not.toBeNull();
    expect(s.current(1)).not.toBeNull();
  });

  it('wrong answer gives a new question after the retry beat plus the reveal time; no resume', () => {
    const s = sched();
    s.update(5, 0.1);
    const first = s.current(0)!;
    const ev = s.answer(0, 1);
    expect(ev).toMatchObject([{ type: 'resolved', result: 'wrong' }]);
    expect(s.playerState(0)).toBe('retry');
    expect(s.answer(0, 0)).toEqual([]);      // ignored during the beat
    expect(s.update(5, 0.3)).toEqual([]);
    expect(s.update(5, 2.1)).toEqual([]);    // 2.4 s in: still showing the correct answer (0.5 + 2.0 = 2.5 s)
    expect(s.playerState(0)).toBe('retry');
    const next = s.update(5, 0.2);
    expect(types(next)).toEqual(['shown']);
    expect(s.current(0)!.id).not.toBe(first.id);
    expect(s.playerState(0)).toBe('asking');
  });

  it('resumes only when all players are correct, after the GO beat', () => {
    const s = sched();
    s.update(5, 0.1);
    expect(types(s.answer(0, 0))).toEqual(['resolved']);
    expect(s.update(5, 5)).toEqual([]);      // p1 still waiting: stays in break
    expect(s.phase).toBe('asking');
    expect(types(s.answer(1, 0))).toEqual(['resolved', 'resume']);
    expect(s.update(5, 0.3)).toEqual([]);
    expect(types(s.update(5, 0.4))).toEqual(['breakEnd']);
    expect(s.active).toBe(false);
  });

  it('next break comes interval seconds of driving after the end', () => {
    const s = sched(1);
    s.update(5, 0.1);
    s.answer(0, 0);
    s.update(5, 1);
    expect(s.update(14.9, 0.1)).toEqual([]);
    expect(types(s.update(15, 0.1))).toContain('breakStart');
  });

  it('carries the last passed place into the first question', () => {
    const s = sched(2);
    s.notifyPlace(0, 'bakery');
    s.notifyPlace(0, 'school');
    const ev = s.update(5, 0.1);
    const shown = ev.filter((e) => e.type === 'shown') as Extract<BreakEvent, { type: 'shown' }>[];
    expect(shown[0].challenge.placeWord).toBe('school');
    expect(shown[1].challenge.placeWord).toBeUndefined();
  });

  it('place cooldown blocks the same word at the next break', () => {
    const s = sched(1);
    s.notifyPlace(0, 'school');
    s.update(5, 0.1);
    expect(s.current(0)!.placeWord).toBe('school');
    s.answer(0, 0); s.update(5, 1);
    s.notifyPlace(0, 'school');
    s.update(15, 0.1);
    expect(s.current(0)!.placeWord).toBeUndefined();
  });
});

describe('per-kind wrong reveal', () => {
  it('waits the reveal time returned for the wrong question before asking again', () => {
    let n = 0;
    const kinds = ['jbq', 'math'] as const;
    const br = new BreakScheduler({
      players: 1, firstAtSec: 0, intervalSec: 10, goSec: 0.6, wrongRetrySec: 0.5, placeCooldownSec: 60,
      wrongRevealSec: (c) => (c.kind === 'jbq' ? 5 : 2),
      make: (player) => ({ id: n, player, kind: kinds[n++ % 2], prompt: { kind: 'text', text: 'q' }, options: [], correct: 0, durationSec: 0, source: 'random' }),
    });
    br.update(0, 0);
    br.answer(0, 1);                       // wrong on a JBQ question
    expect(br.update(0, 5.4).some((e) => e.type === 'shown')).toBe(false);
    expect(br.update(0, 0.2).some((e) => e.type === 'shown')).toBe(true);   // 5.6 s > 0.5 + 5
  });
});
