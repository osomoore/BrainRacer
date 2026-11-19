import { describe, expect, it } from 'vitest';
import aliases from './wordAliases.json';
import { ALL_WORDS, SCENES } from './scenes';
import { WORD_META } from './wordMeta';

describe('word data', () => {
  it('every scene word has metadata and vice versa', () => {
    expect(Object.keys(WORD_META).sort()).toEqual([...ALL_WORDS]);
  });
  it('confusables are symmetric and valid', () => {
    for (const [w, m] of Object.entries(WORD_META)) {
      expect(m.confusableWith).not.toContain(w);
      for (const c of m.confusableWith) expect(WORD_META[c]?.confusableWith, `${w}<->${c}`).toContain(w);
    }
  });
  it('multi-word words are never "simple" (Hard only)', () => {
    for (const [w, m] of Object.entries(WORD_META)) if (w.includes(' ')) expect(m.simple, w).toBe(false);
  });
  it('aliases map labels onto words the game uses, and are applied', () => {
    for (const [label, word] of Object.entries(aliases)) {
      if (label.startsWith('_')) continue;
      expect(ALL_WORDS).toContain(word);
      expect(ALL_WORDS).not.toContain(label);
    }
    expect(SCENES.every((s) => s.label.length > 0)).toBe(true);
  });
});
