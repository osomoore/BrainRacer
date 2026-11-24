/** Easy text is for children who are just learning to read: no stat jargon (part names are exempt). */
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './index';
import { WORKSHOP_IDS } from '../core/types';
import type { LeveledPhrases, WorkshopCatalog } from '../core/types';
import { PRACTICE_FAIL } from './stories';

export const BANNED_EASY_WORDS: readonly string[] = [
  'clearance', 'toughness', 'handling', 'traction', 'efficiency', 'stealth', 'range', 'load',
  'durability', 'aerodynamic', 'acceleration', 'camouflage', 'insulation', 'stamina',
];

const easyOf = (p: LeveledPhrases | undefined): readonly string[] => p?.easy ?? [];

/** Every Easy sentence a child can see for a catalog. */
export function easyStrings(cat: WorkshopCatalog): string[] {
  const out: string[] = [];
  for (const fp of cat.facetPhrases) {
    out.push(...(fp.title ?? []), ...fp.hint.easy);
    for (const lv of fp.requirement) out.push(...lv.easy);
  }
  for (const sp of cat.scenarioPhrases) out.push(...sp.title, ...sp.intro.easy);
  for (const s of Object.values(cat.stories ?? {})) {
    for (const row of s.story) out.push(...easyOf(row));
    out.push(...easyOf(s.fail));
  }
  for (const p of Object.values(cat.practiceStories ?? {})) out.push(...easyOf(p));
  out.push(...easyOf(cat.practiceFail), ...easyOf(PRACTICE_FAIL), ...easyOf(cat.cleverWinPhrases));
  for (const sp of Object.values(cat.successPhrases ?? {})) {
    out.push(...easyOf(sp.named), ...easyOf(sp.quality));
    for (const q of Object.values(sp.qualityByLevel ?? {})) out.push(...easyOf(q));
  }
  return out;
}

describe.each(WORKSHOP_IDS)('Easy wording: %s', (id) => {
  const cat = CATALOGS[id];
  it('uses no stat jargon outside part names', () => {
    const partNames = cat.variants.map((v) => v.name).sort((a, b) => b.length - a.length);
    const bad: string[] = [];
    for (const text of easyStrings(cat)) {
      let rest = text.toLowerCase();
      for (const name of partNames) rest = rest.split(name.toLowerCase()).join(' ');
      const words: string[] = rest.match(/[a-z]+/g) ?? [];
      for (const w of BANNED_EASY_WORDS) if (words.includes(w)) bad.push(`${w}: ${text}`);
    }
    expect(bad).toEqual([]);
  });
});
