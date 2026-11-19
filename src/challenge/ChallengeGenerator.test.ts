import { describe, expect, it } from 'vitest';
import { CHALLENGE, DIFFICULTY } from '../config/gameConfig';
import { Rng } from '../core/rng';
import type { ChallengeKind, ChallengeOption, Difficulty } from '../core/types';
import { challengeScenesFor, CITY_PLACE_WORDS } from '../data/places';
import { ALL_WORDS, sceneById } from '../data/scenes';
import { WORD_META } from '../data/wordMeta';
import { wordsConflict } from './conflicts';
import { ChallengeGenerator, type GeneratedChallenge } from './ChallengeGenerator';

const KINDS: ChallengeKind[] = ['picToWord', 'wordToPic', 'math'];
const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];

const wordOf = (o: ChallengeOption): string =>
  o.kind === 'text' ? o.text : sceneById(o.sceneId)!.word;

function validateMath(c: GeneratedChallenge, d: Difficulty, n = 3): void {
  const m = /^(\d+) \+ (\d+)$/.exec((c.prompt as { text: string }).text);
  expect(m).not.toBeNull();
  const a = Number(m![1]);
  const b = Number(m![2]);
  const p = DIFFICULTY[d].math;
  expect(a).toBeGreaterThanOrEqual(p.minA);
  expect(a).toBeLessThanOrEqual(p.maxA);
  expect(b).toBeGreaterThanOrEqual(p.minB);
  expect(b).toBeLessThanOrEqual(p.maxB);
  expect(a + b).toBeLessThanOrEqual(p.maxSum);
  if (p.requireCarry) expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
  const nums = c.options.map((o) => Number((o as { text: string }).text));
  for (const n of nums) {
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  }
  expect(nums[c.correct]).toBe(a + b);
  expect(nums.filter((n) => n === a + b)).toHaveLength(1);
  expect(new Set(nums).size).toBe(n);
}

function validate(c: GeneratedChallenge, d: Difficulty, placeWord?: string, n = 3): void {
  expect(c.options).toHaveLength(n);
  expect([0, 1, 2, 3].slice(0, n)).toContain(c.correct);
  if (c.kind === 'math') return validateMath(c, d, n);

  const words = c.options.map(wordOf);
  expect(new Set(words).size).toBe(n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(wordsConflict(words[i], words[j])).toBe(false);
  const target = c.targetWord!;
  expect(words[c.correct]).toBe(target);
  expect(words.filter((w) => w === target)).toHaveLength(1);
  if (c.kind === 'picToWord') {
    expect(c.prompt.kind).toBe('image');
    expect(sceneById((c.prompt as { sceneId: string }).sceneId)!.word).toBe(target);
    expect(c.options.every((o) => o.kind === 'text')).toBe(true);
  } else {
    expect(c.prompt).toEqual({ kind: 'text', text: target });
    expect(c.options.every((o) => o.kind === 'image')).toBe(true);
  }
  const profile = DIFFICULTY[d].words;
  if (placeWord) {
    expect(c.placeWord).toBe(placeWord);
    expect(target).toBe(placeWord);
    const shown = c.kind === 'picToWord'
      ? (c.prompt as { sceneId: string }).sceneId
      : (c.options[c.correct] as { sceneId: string }).sceneId;
    expect(challengeScenesFor(placeWord)).toContain(shown);
  } else {
    expect(c.placeWord).toBeUndefined();
    if (profile.simpleOnly) expect(WORD_META[target].simple).toBe(true);
    if (!profile.allowMultiWord) expect(target.includes(' ')).toBe(false);
  }
  if (c.kind === 'picToWord') {
    words.forEach((t, i) => {
      if (i === c.correct) return;
      if (profile.simpleOnly) expect(WORD_META[t].simple).toBe(true);
      if (!profile.allowMultiWord) expect(t.includes(' ')).toBe(false);
    });
  }
}

describe('ChallengeGenerator randomized validation', () => {
  it('10000 challenges over all kinds x difficulties x place/non-place are valid', () => {
    const gen = new ChallengeGenerator(new Rng(12345));
    const pick = new Rng(99);
    for (let i = 0; i < 10000; i++) {
      const kind = KINDS[i % 3];
      const d = LEVELS[Math.floor(i / 3) % 3];
      const placeWord = i % 5 === 0 ? pick.pick(CITY_PLACE_WORDS) : undefined;
      validate(gen.generate(kind, d, placeWord ? { placeWord } : {}), d, placeWord);
    }
  }, 60_000);

  it('10000 four-option challenges are valid (unique, no confusables)', () => {
    const gen = new ChallengeGenerator(new Rng(4242));
    const pick = new Rng(77);
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const kind = KINDS[i % 3];
      const d = LEVELS[Math.floor(i / 3) % 3];
      const placeWord = i % 5 === 0 ? pick.pick(CITY_PLACE_WORDS) : undefined;
      const c = gen.generate(kind, d, { optionCount: 4, ...(placeWord ? { placeWord } : {}) });
      seen.add(c.correct);
      validate(c, d, placeWord, 4);
    }
    expect(seen.size).toBe(4);
  }, 60_000);

  it('every word can be the target at every difficulty', () => {
    const gen = new ChallengeGenerator(new Rng(7));
    for (const d of LEVELS) {
      const pool = gen.targetPool(d);
      for (const w of pool) {
        const recent = new Set(pool.filter((x) => x !== w));
        for (const kind of ['picToWord', 'wordToPic'] as const) {
          const c = gen.generate(kind, d, { recentWords: recent });
          expect(c.targetWord).toBe(w);
          validate(c, d);
        }
      }
    }
  });
});

describe('ChallengeGenerator rules', () => {
  it('correct slot is roughly uniform', () => {
    const gen = new ChallengeGenerator(new Rng(5));
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[gen.generate(KINDS[i % 3], 'normal').correct]++;
    for (const n of counts) expect(n).toBeGreaterThan(850);
  });

  it('is deterministic for a seed', () => {
    const a = new ChallengeGenerator(new Rng(42)).generate('picToWord', 'hard');
    const b = new ChallengeGenerator(new Rng(42)).generate('picToWord', 'hard');
    expect(a).toEqual(b);
  });

  it('easy targets are all simple single words', () => {
    const pool = new ChallengeGenerator(new Rng(1)).targetPool('easy');
    expect(pool.length).toBeGreaterThan(30);
    for (const w of pool) {
      expect(WORD_META[w].simple).toBe(true);
      expect(w).not.toContain(' ');
    }
  });

  it('hard uses multi-word targets; easy wordToPic may show multi-word images', () => {
    const gen = new ChallengeGenerator(new Rng(8));
    let multiTarget = false;
    let multiImage = false;
    for (let i = 0; i < 600; i++) {
      if (gen.generate('picToWord', 'hard').targetWord!.includes(' ')) multiTarget = true;
      if (gen.generate('wordToPic', 'easy').options.some((o) => wordOf(o).includes(' '))) multiImage = true;
    }
    expect(multiTarget).toBe(true);
    expect(multiImage).toBe(true);
  });

  it('normal and hard prefer same-category distractors', () => {
    const gen = new ChallengeGenerator(new Rng(3));
    for (const d of ['normal', 'hard'] as const) {
      let same = 0;
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const c = gen.generate('picToWord', d);
        const cat = WORD_META[c.targetWord!].category;
        for (const o of c.options) {
          total++;
          if (WORD_META[wordOf(o)].category === cat) same++;
        }
      }
      expect(same / total).toBeGreaterThan(0.7);
    }
  });

  it('easy prefers different-category distractors', () => {
    const gen = new ChallengeGenerator(new Rng(3));
    let same = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const c = gen.generate('picToWord', 'easy');
      const cat = WORD_META[c.targetWord!].category;
      c.options.forEach((o, idx) => {
        if (idx === c.correct) return;
        total++;
        if (WORD_META[wordOf(o)].category === cat) same++;
      });
    }
    expect(same / total).toBeLessThan(0.15);
  });

  it('hard prefers similar length or first letter', () => {
    const gen = new ChallengeGenerator(new Rng(4));
    let similar = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const c = gen.generate('picToWord', 'hard');
      const t = c.targetWord!;
      c.options.forEach((o, idx) => {
        if (idx === c.correct) return;
        const w = wordOf(o);
        total++;
        if (Math.abs(w.length - t.length) <= CHALLENGE.similarLengthDelta || w[0] === t[0]) similar++;
      });
    }
    expect(similar / total).toBeGreaterThan(0.6);
  });

  it('recentWords are avoided as target', () => {
    const gen = new ChallengeGenerator(new Rng(6));
    const recent = new Set(ALL_WORDS.filter((w) => w !== 'apple'));
    for (let i = 0; i < 20; i++) {
      expect(gen.generate('picToWord', 'easy', { recentWords: recent }).targetWord).toBe('apple');
    }
  });

  it('a place word with kind math still makes a place challenge', () => {
    const c = new ChallengeGenerator(new Rng(2)).generate('math', 'easy', { placeWord: 'bakery' });
    expect(c.kind).not.toBe('math');
    expect(c.placeWord).toBe('bakery');
  });

  it('place challenges ignore simpleOnly/multi-word for the target', () => {
    const c = new ChallengeGenerator(new Rng(2)).generate('picToWord', 'easy', { placeWord: 'fire station' });
    expect(c.targetWord).toBe('fire station');
  });

  it('conflict rules', () => {
    expect(wordsConflict('circle', 'sphere')).toBe(true);
    expect(wordsConflict('house', 'city')).toBe(true);
    expect(wordsConflict('fire station', 'station')).toBe(true); // whole-word containment
    expect(wordsConflict('cat', 'dog')).toBe(false);
  });
});
