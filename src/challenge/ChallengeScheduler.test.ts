import { describe, expect, it } from 'vitest';
import { CHALLENGE, DIFFICULTY } from '../config/gameConfig';
import { Rng } from '../core/rng';
import type { Challenge, Difficulty } from '../core/types';
import { ChallengeGenerator } from './ChallengeGenerator';
import { ChallengeScheduler, type SchedulerEvent } from './ChallengeScheduler';

function make(d: Difficulty = 'normal', opts: { interval?: number; delay?: number; seed?: number } = {}) {
  const rng = new Rng(opts.seed ?? 1);
  return new ChallengeScheduler({
    player: 0,
    difficulty: d,
    intervalSec: opts.interval ?? 5,
    generator: new ChallengeGenerator(rng.fork(1)),
    rng: rng.fork(2),
    startDelaySec: opts.delay ?? 3,
  });
}
const types = (ev: SchedulerEvent[]) => ev.map((e) => (e.type === 'resolved' ? `resolved:${e.result}` : 'shown'));

/** The word a word-type challenge asks about. */
function targetWordOf(c: Challenge): string | null {
  if (c.kind === 'math') return null;
  return c.kind === 'picToWord' ? (c.options[c.correct] as { text: string }).text : (c.prompt as { text: string }).text;
}

describe('ChallengeScheduler timing', () => {
  it('waits for startDelay before the first challenge', () => {
    const s = make();
    expect(s.update(0)).toEqual([]);
    expect(s.update(2.9)).toEqual([]);
    expect(s.state).toBe('idle');
    expect(types(s.update(3))).toEqual(['shown']);
    expect(s.state).toBe('active');
  });

  it.each(['easy', 'normal', 'hard'] as Difficulty[])('%s: duration and period follow the multiplier', (d) => {
    const s = make(d);
    const period = 5 * DIFFICULTY[d].periodMultiplier;
    s.update(3);
    expect(s.current!.durationSec).toBeCloseTo(period);
    expect(s.update(3 + period - 0.01)).toEqual([]);
    expect(types(s.update(3 + period))).toEqual(['resolved:timeout', 'shown']);
  });

  it('a late update still starts the next period at the old boundary', () => {
    const s = make('normal');
    s.update(3);
    const first = s.current!;
    s.update(8.4);
    expect(s.current!.id).not.toBe(first.id);
    expect(s.remainingSec(8.4)).toBeCloseTo(4.6);
  });

  it('answering resolves once; later presses are ignored', () => {
    const s = make();
    s.update(3);
    const c = s.current!;
    const wrong = ((c.correct + 1) % 3) as 0 | 1 | 2;
    expect(s.answer(wrong, 4)).toEqual([{ type: 'resolved', challenge: c, result: 'wrong', chosen: wrong }]);
    expect(s.state).toBe('resolved');
    expect(s.answer(c.correct, 4.5)).toEqual([]);
    expect(s.state).toBe('resolved');
  });

  it('correct answer is reported as correct', () => {
    const s = make();
    s.update(3);
    const c = s.current!;
    expect(s.answer(c.correct, 3.5)[0]).toMatchObject({ type: 'resolved', result: 'correct', chosen: c.correct });
  });

  it('a resolved challenge stays up until the period ends, then the next shows without a timeout', () => {
    const s = make();
    s.update(3);
    s.answer(0, 3.2);
    expect(s.update(7.9)).toEqual([]);
    expect(types(s.update(8))).toEqual(['shown']);
    expect(s.state).toBe('active');
  });

  it('answers before the first challenge are ignored', () => {
    expect(make().answer(1, 1)).toEqual([]);
  });

  it('unanswered challenges time out repeatedly', () => {
    const s = make('normal');
    let all: string[] = [];
    for (let t = 0; t < 19; t += 0.5) all = all.concat(types(s.update(t)));
    expect(all.filter((x) => x === 'resolved:timeout')).toHaveLength(3);
  });

  it('ids are unique and carry the player parity', () => {
    const s = make();
    const ids = new Set<number>();
    for (let t = 3; t < 60; t += 5) {
      s.update(t);
      ids.add(s.current!.id);
    }
    expect(ids.size).toBeGreaterThan(8);
    for (const id of ids) expect(id % 2).toBe(0);
  });
});

describe('ChallengeScheduler place challenges', () => {
  it('starts immediately when idle and restarts the period', () => {
    const s = make();
    expect(types(s.notifyPlace('bakery', 1))).toEqual(['shown']);
    expect(s.current!.source).toBe('place');
    expect(s.current!.placeWord).toBe('bakery');
    expect(s.update(5.99)).toEqual([]);
    expect(types(s.update(6))).toEqual(['resolved:timeout', 'shown']);
  });

  it('starts immediately when already resolved, restarting the period', () => {
    const s = make();
    s.update(3);
    s.answer(0, 4);
    expect(types(s.notifyPlace('school', 5))).toEqual(['shown']);
    expect(s.current!.placeWord).toBe('school');
    expect(s.update(9.9)).toEqual([]);
    expect(types(s.update(10))).toEqual(['resolved:timeout', 'shown']);
  });

  it('queues as the next challenge when one is active', () => {
    const s = make();
    s.update(3);
    const active = s.current!;
    expect(s.notifyPlace('library', 4)).toEqual([]);
    expect(s.current).toBe(active);
    expect(types(s.update(8))).toEqual(['resolved:timeout', 'shown']);
    expect(s.current!.placeWord).toBe('library');
    s.update(13);
    expect(s.current!.source).toBe('random');
  });

  it('honors the per-word cooldown', () => {
    const s = make();
    const cd = CHALLENGE.placeCooldownSec;
    s.notifyPlace('zoo', 1);
    const placeShown = (ev: SchedulerEvent[], w: string) =>
      ev.some((e) => e.type === 'shown' && e.challenge.placeWord === w);
    // step the clock, answering so the scheduler is idle-ish; zoo must be ignored until the cooldown ends
    for (let t = 2; t < 1 + cd; t += 1) s.update(t);
    expect(placeShown(s.notifyPlace('zoo', cd), 'zoo')).toBe(false);
    s.update(cd + 0.5);
    expect(placeShown(s.notifyPlace('zoo', 1 + cd), 'zoo') || placeShown(s.update(1 + cd + 20), 'zoo')).toBe(true);
    // a different word is unaffected
    const t0 = 1 + cd + 20.5;
    expect(placeShown(s.notifyPlace('museum', t0), 'museum') || placeShown(s.update(t0 + 20), 'museum')).toBe(true);
  });

  it('queues only one place at a time', () => {
    const s = make();
    s.update(3);
    s.notifyPlace('zoo', 3.5);
    s.notifyPlace('museum', 4);
    s.update(8);
    expect(s.current!.placeWord).toBe('zoo');
  });
});

describe('ChallengeScheduler content', () => {
  it('does not repeat target words until the pool is exhausted', () => {
    const pool = new ChallengeGenerator(new Rng(1)).targetPool('easy');
    const s = make('easy', { seed: 4 });
    const words: string[] = [];
    for (let i = 0; words.length < pool.length; i++) {
      for (const e of s.update(3 + i * 7.5)) {
        if (e.type !== 'shown') continue;
        const w = targetWordOf(e.challenge);
        if (w) words.push(w);
      }
    }
    expect(new Set(words.slice(0, pool.length)).size).toBe(pool.length);
  });

  it('uses all three kinds on normal', () => {
    const s = make('normal', { seed: 5 });
    const kinds = new Set<string>();
    for (let i = 0; i < 100; i++) for (const e of s.update(3 + i * 5)) if (e.type === 'shown') kinds.add(e.challenge.kind);
    expect(kinds).toEqual(new Set(['picToWord', 'math', 'wordToPic']));
  });
});
