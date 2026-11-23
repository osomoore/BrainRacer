import { describe, expect, it } from 'vitest';
import { bumpCount, JBQ_PROGRESS_KEY, JbqProgressStore, parseJbqProgress, type StorageLike } from './jbqProgress';

const fake = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('jbqProgress', () => {
  it('parses defensively', () => {
    expect(parseJbqProgress(null)).toEqual({});
    expect(parseJbqProgress({ a: { 1: 2, 2: -1, 3: 'x' }, b: 5 })).toEqual({ a: { 1: 2 } });
  });

  it('bumpCount is pure', () => {
    const c = { 5: 1 };
    expect(bumpCount(c, 5)).toEqual({ 5: 2 });
    expect(bumpCount(c, 6)).toEqual({ 5: 1, 6: 1 });
    expect(c).toEqual({ 5: 1 });
  });

  it('saves counts per profile under the v1 key', () => {
    const st = fake();
    const s = new JbqProgressStore(() => st);
    expect(s.count('abe', 10)).toBe(0);
    s.recordCorrect('abe', 10);
    s.recordCorrect('abe', 10);
    s.recordCorrect('gideon', 10);
    expect(s.count('abe', 10)).toBe(2);
    expect(s.count('gideon', 10)).toBe(1);
    expect(JBQ_PROGRESS_KEY).toBe('brainracer.jbq.v1');
    expect(JSON.parse(st.data[JBQ_PROGRESS_KEY])).toEqual({ abe: { 10: 2 }, gideon: { 10: 1 } });
    expect(new JbqProgressStore(() => st).count('abe', 10)).toBe(2);   // survives a new store (reload)
  });

  it('works with throwing or missing storage', () => {
    const bad: StorageLike = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    const s = new JbqProgressStore(() => bad);
    s.recordCorrect('abe', 1);
    expect(s.count('abe', 1)).toBe(1);
    const none = new JbqProgressStore(() => undefined);
    none.recordCorrect('abe', 1);
    expect(none.count('abe', 1)).toBe(1);
    const corrupt = fake();
    corrupt.setItem(JBQ_PROGRESS_KEY, '{bad');
    expect(new JbqProgressStore(() => corrupt).count('abe', 1)).toBe(0);
  });

  it('keeps racers without a profile in memory only', () => {
    const st = fake();
    const s = new JbqProgressStore(() => st);
    s.recordCorrect(undefined, 7);
    expect(s.count(undefined, 7)).toBe(1);
    expect(st.data[JBQ_PROGRESS_KEY]).toBeUndefined();
    expect(new JbqProgressStore(() => st).count(undefined, 7)).toBe(0);
  });
});
