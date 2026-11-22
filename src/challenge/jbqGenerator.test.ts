import { describe, expect, it } from 'vitest';
import { CHALLENGE } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { JBQ_QUESTIONS, JbqGenerator, type JbqGenerateOpts } from './jbqGenerator';

const byId = new Map(JBQ_QUESTIONS.map((q) => [q.id, q]));
const base: JbqGenerateOpts = { points: 10, scope: 'week', date: '2026-11-22', correctCount: () => 0 };
const keyOf = (o: { kind: string; text?: string; ref?: string }) => o.kind === 'verse' ? `${o.ref} ${o.text}` : o.text ?? '';

describe('JbqGenerator', () => {
  it('builds 4 options with exactly one correct, from the pool, with jbq info', () => {
    const g = new JbqGenerator(new Rng(1));
    for (let i = 0; i < 200; i++) {
      const c = g.generate(base);
      const q = byId.get(c.jbq.id)!;
      expect(c.jbq.points).toBe(10);
      expect(q.id).toBeGreaterThanOrEqual(145);
      expect(q.id).toBeLessThanOrEqual(168);
      expect(c.prompt).toEqual({ kind: 'text', text: q.q });
      expect(c.options).toHaveLength(CHALLENGE.pauseOptions);
      expect(keyOf(c.options[c.correct])).toBe(q.ref ? `${q.ref} ${q.verse}` : q.a);
      const keys = c.options.map((o) => keyOf(o).trim().toLowerCase());
      expect(new Set(keys).size).toBe(4);
    }
  });

  it('puts the correct answer in every slot over time', () => {
    const g = new JbqGenerator(new Rng(2));
    const slots = new Set(Array.from({ length: 80 }, () => g.generate(base).correct));
    expect(slots).toEqual(new Set([0, 1, 2, 3]));
  });

  it('supports 3 options', () => {
    const g = new JbqGenerator(new Rng(3));
    for (let i = 0; i < 40; i++) expect(g.generate({ ...base, optionCount: 3 }).options).toHaveLength(3);
  });

  it('quote questions give 4 verse options; others give text options', () => {
    const g = new JbqGenerator(new Rng(4));
    let quotes = 0;
    for (let i = 0; i < 300; i++) {
      const c = g.generate({ ...base, points: 20, scope: 'all' });
      const q = byId.get(c.jbq.id)!;
      if (q.type === 'quote') {
        quotes++;
        expect(c.options.every((o) => o.kind === 'verse')).toBe(true);
        expect(c.options[c.correct]).toEqual({ kind: 'verse', ref: q.ref, text: q.verse });
      } else {
        expect(c.options.every((o) => o.kind === 'text')).toBe(true);
      }
    }
    expect(quotes).toBeGreaterThan(0);
  });

  it('wrong answers prefer the same type from the whole level (outside the pool too)', () => {
    const g = new JbqGenerator(new Rng(5));
    let outsidePool = 0;
    for (let i = 0; i < 200; i++) {
      const c = g.generate(base);
      const q = byId.get(c.jbq.id)!;
      const sameType = JBQ_QUESTIONS.filter((x) => x.points === 10 && x.type === q.type).length;
      const wrongs = c.options.filter((_, s) => s !== c.correct).map(keyOf);
      for (const w of wrongs) {
        const srcs = JBQ_QUESTIONS.filter((x) => x.points === 10 && x.a === w);   // the same answer text can belong to several questions
        expect(srcs.length).toBeGreaterThan(0);
        if (sameType >= 4) expect(srcs.some((x) => x.type === q.type)).toBe(true);
        if (srcs.some((x) => x.id < 145 || x.id > 168)) outsidePool++;
      }
    }
    expect(outsidePool).toBeGreaterThan(0);
  });

  it('falls back to other levels for small types (e.g. yn, cmd, num) and never duplicates', () => {
    const g = new JbqGenerator(new Rng(6));
    for (const q of JBQ_QUESTIONS.filter((x) => ['cmd', 'yn', 'num'].includes(x.type))) {
      const c = g.generate({ ...base, points: q.points, scope: 'all' });
      const keys = c.options.map((o) => keyOf(o).trim().toLowerCase());
      expect(new Set(keys).size).toBe(4);
    }
  });

  it('avoids repeating a question in a race until the pool is used up', () => {
    const g = new JbqGenerator(new Rng(7));
    const recent = new Set<number>();
    const ids = Array.from({ length: 24 }, () => g.generate({ ...base, recent }).jbq.id);
    expect(new Set(ids).size).toBe(24);
    const next = g.generate({ ...base, recent });   // pool exhausted: starts over
    expect(next.jbq.id).toBeGreaterThanOrEqual(145);
    expect(recent.size).toBe(1);
  });

  it('prefers questions that are not learned yet', () => {
    const g = new JbqGenerator(new Rng(8));
    const learned = (id: number) => (id <= 160 ? CHALLENGE.jbqMasteredCorrect : 0);   // 145-160 learned, 161-168 not
    let fresh = 0;
    const n = 600;
    for (let i = 0; i < n; i++) if (g.generate({ ...base, correctCount: learned }).jbq.id > 160) fresh++;
    // weights: 8 x 4 vs 16 x 1 -> 2/3 expected
    expect(fresh / n).toBeGreaterThan(0.58);
    expect(fresh / n).toBeLessThan(0.75);
  });

  it('is deterministic for a seed', () => {
    const run = () => { const g = new JbqGenerator(new Rng(9)); return Array.from({ length: 10 }, () => g.generate(base)); };
    expect(run()).toEqual(run());
  });

  it('draws from added-back weeks when the pool is learned', () => {
    const g = new JbqGenerator(new Rng(10));
    const learned = (id: number) => (id >= 145 && id <= 168 ? 2 : 0);
    const ids = new Set(Array.from({ length: 300 }, () => g.generate({ ...base, correctCount: learned }).jbq.id));
    expect([...ids].some((id) => id >= 169 && id <= 192)).toBe(true);
    expect([...ids].every((id) => id >= 145 && id <= 192)).toBe(true);
  });
});
