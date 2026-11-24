/** Wording rules in validateCatalog: each mechanical problem from the 2026 text review must fail. */
import { describe, expect, it } from 'vitest';
import type { FacetPhrases, FacetStory, ReadingLevel, WorkshopCatalog } from '../core/types';
import { READING_LEVELS } from '../core/types';
import { CATALOGS } from '../content';
import { lineProblems, namedVariants, validateCatalog } from './validateCatalog';
import { resolveSpec } from './text';

const race = CATALOGS.race;
const dino = CATALOGS.dino;

type Row = readonly [string, string, string];
/** Replace the rows of one facet level (and optionally its titles). */
function patch(cat: WorkshopCatalog, facet: string, level: number, rows: Row[], title?: string[]): WorkshopCatalog {
  const facetPhrases = cat.facetPhrases.map((p): FacetPhrases => p.facet !== facet ? p : {
    ...p,
    title: title ?? p.title,
    requirement: p.requirement.map((row, i) => i !== level ? row : {
      easy: rows.map((r) => r[0]), medium: rows.map((r) => r[1]), hard: rows.map((r) => r[2]),
    } as Record<ReadingLevel, string[]>),
  });
  return { ...cat, facetPhrases };
}
const errors = (cat: WorkshopCatalog): string => validateCatalog(cat).join('\n');
const okRow: Row = ['Get Mud Tires now.', 'Get Mud Tires so you can go.', 'Put on Mud Tires so the car can go through.'];

describe('validateCatalog wording', () => {
  it('accepts both shipped catalogs', () => {
    expect(validateCatalog(race)).toEqual([]);
    expect(validateCatalog(dino)).toEqual([]);
  });

  it('enforces word limits and Easy <= Medium <= Hard per row', () => {
    const long = patch(race, 'mud.grip', 0, [okRow, ['Get Mud Tires so you do not slip.', 'Get Mud Tires.', 'Get Mud Tires please.']]);
    const e = errors(long);
    expect(e).toContain('[easy]: guideline exceeds 6 words');
    expect(e).toContain('row 2: words must go Easy <= Medium <= Hard');
  });

  it('needs every line to name a part that helps, for every check and every any-of option', () => {
    expect(errors(patch(race, 'mud.grip', 0, [okRow, ['Get wheels that grip.', 'Get something that grips mud.', 'Get a part that keeps the car from slipping.']])))
      .toContain('names no part for mudGrip >= 3');
    // A part that does not help (Snorkel for mud) does not count.
    expect(lineProblems(race, [{ kind: 'statMin', stat: 'mudGrip', min: 3 }], 'Get a Snorkel.')).toHaveLength(1);
    // Two-part fix: the winch AND power must both be named.
    const pull = race.scenarios.flatMap((s) => s.facets).find((f) => f.id === 'mud.pull')!;
    expect(lineProblems(race, pull.check(2), 'Get a Winch.')).toEqual(['names no part for power >= 6']);
    expect(lineProblems(race, pull.check(2), 'Get a Winch and a Big Engine.')).toEqual([]);
    // Any-of: both the Snorkel and the Floaties.
    const river = race.scenarios.flatMap((s) => s.facets).find((f) => f.id === 'river.cross')!;
    expect(lineProblems(race, river.check(1), 'Use a Snorkel.')).toEqual(['names no part for option 2 (tag canFloat)']);
    expect(lineProblems(race, river.check(1), 'Use Floaties or a Snorkel.')).toEqual([]);
  });

  it('matches names case-insensitively, longest first, plus approved aliases', () => {
    expect([...namedVariants(race, 'Get a big engine.')]).toEqual(['engine.big']);
    expect([...namedVariants(race, 'Put on Rubber Bumper.')]).toEqual(['bumpers.rubber']);
    expect([...namedVariants(dino, 'Use wings: pick Flying.')]).toEqual(['move.fly']);
    // Taking off a part names the wrong thing: the line must name a part to pick.
    const cool = dino.scenarios.flatMap((s) => s.facets).find((f) => f.id === 'desert.cool')!;
    expect(lineProblems(dino, cool.check(1), 'Take off the Feathers.')).toHaveLength(1);
    expect(lineProblems(dino, cool.check(1), 'Swap Feathers for a Neck Frill.')).toEqual([]);
  });

  it('rejects duplicate lines, leftover placeholders and hard words', () => {
    const dupe = patch(race, 'mud.grip', 1, [okRow, ['Get Snow Tires.', 'Get Snow Tires so you do not slide.', 'Put on Snow Tires so the wheels grip the snowy road.']]);
    expect(errors(dupe)).toContain('duplicate line');
    expect(errors(patch(race, 'mud.grip', 0, [okRow, ['Get {part} now.', 'Get Mud Tires for gooey mud.', 'Put on Mud Tires so you get a grip.']])))
      .toMatch(/leftover placeholder[\s\S]*hard word "gooey"[\s\S]*hard word "get a grip"/);
  });

  it('needs one unique title per facet level and one scenario title', () => {
    expect(errors(patch(race, 'mud.grip', 0, [okRow, okRow.map((s) => s.replace('now', 'today')) as unknown as Row], ['Deep Mud'])))
      .toContain('facet mud.grip: needs one title per level (3), has 1');
    expect(errors(patch(race, 'mud.grip', 0, [okRow, okRow.map((s) => s.replace('now', 'today')) as unknown as Row], ['Deep Mud', 'Deep Mud', 'Steep Hill'])))
      .toMatch(/duplicate title "Deep Mud"[\s\S]*duplicate title "Steep Hill"/);
    const twoTitles = { ...race, scenarioPhrases: race.scenarioPhrases.map((p) => p.scenario === 'mud' ? { ...p, title: ['A', 'B'] } : p) };
    expect(errors(twoTitles)).toContain('scenario mud: needs exactly 1 title');
  });

  it('titles fit the level: one requirement uses its level title, two use the scenario title', () => {
    const title = (facets: { facet: string; level: number }[]) =>
      resolveSpec(race, { stages: [{ scenario: 'mud', facets }] }, { id: 't', source: 'generated', tier: 3, seed: 7 }).title;
    expect(title([{ facet: 'mud.grip', level: 1 }])).toBe('Muddy Road');
    expect(title([{ facet: 'mud.grip', level: 3 }])).toBe('Very Deep Mud');
    expect(title([{ facet: 'mud.pull', level: 1 }])).toBe('Stuck Tractor');
    expect(title([{ facet: 'mud.grip', level: 2 }, { facet: 'mud.pull', level: 1 }])).toBe('Muddy Farm Road');
    // Same seed, any title: the title never depends on the rng.
    for (let seed = 1; seed < 30; seed++) {
      expect(resolveSpec(race, { stages: [{ scenario: 'mud', facets: [{ facet: 'mud.grip', level: 2 }] }] },
        { id: 't', source: 'generated', tier: 1, seed }).title).toBe('Deep Mud');
    }
  });

  it('shows the story row for the level at every reading level', () => {
    const row = race.stories!['hill.power'].story[1];
    for (let seed = 1; seed < 40; seed++) {
      const text = resolveSpec(race, { stages: [{ scenario: 'hill', facets: [{ facet: 'hill.power', level: 2 }] }] },
        { id: 't', source: 'generated', tier: 1, seed }).stages[0].requirements[0].text;
      const i = row.easy.indexOf(text.easy);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(text.medium).toBe(row.medium[i]);
      expect(text.hard).toBe(row.hard[i]);
    }
  });

  it('has a story row and failure lines for every facet level in both workshops', () => {
    for (const cat of [race, dino]) for (const sc of cat.scenarios) for (const f of sc.facets) {
      const st = cat.stories?.[f.id];
      expect(st, f.id).toBeDefined();
      expect(st!.story.length, f.id).toBe(f.levels.length);
      for (const r of READING_LEVELS) expect(st!.fail[r].length, f.id).toBeGreaterThan(0);
    }
  });

  it('flags story and failure lines that break the rules', () => {
    const broken = (patch: (stories: Record<string, FacetStory>) => void) => {
      const stories = JSON.parse(JSON.stringify(race.stories)) as Record<string, FacetStory>;
      patch(stories);
      return validateCatalog({ ...race, stories });
    };
    const set = (st: Record<string, FacetStory>, r: 'easy' | 'medium' | 'hard', line: string) => {
      (st['mud.grip'].story[0][r] as string[])[0] = line;
    };
    expect(broken((st) => set(st, 'easy', 'The mud is so very deep and sticky and brown today!')).join('|')).toMatch(/exceeds 10 words/);
    expect(broken((st) => set(st, 'easy', 'the road is mud')).join('|')).toMatch(/complete sentence/);
    expect(broken((st) => set(st, 'easy', 'The slippery road is mud.')).join('|')).toMatch(/hard word "slippery"/);
    expect(broken((st) => set(st, 'hard', 'Mud!')).join('|')).toMatch(/Easy <= Medium <= Hard/);
    expect(broken((st) => set(st, 'easy', st['mud.pull'].story[0].easy[0])).join('|')).toMatch(/duplicate line/);
    expect(broken((st) => { (st['mud.grip'].fail.easy as string[])[0] = 'You needed better parts.'; }).join('|')).toMatch(/exactly one \{parts\}/);
  });
});

describe('both workshops together', () => {
  it('never share a title or a guideline line', () => {
    const titles = (c: WorkshopCatalog) => [...c.scenarioPhrases.flatMap((p) => p.title), ...c.facetPhrases.flatMap((p) => p.title ?? [])];
    const lines = (c: WorkshopCatalog) => c.facetPhrases.flatMap((p) => p.requirement.flatMap((row) => [...row.easy, ...row.medium, ...row.hard]));
    const all = [...titles(race), ...titles(dino)].map((t) => t.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
    const raceLines = new Set(lines(race).map((l) => l.toLowerCase()));
    expect(lines(dino).filter((l) => raceLines.has(l.toLowerCase()))).toEqual([]);
  });
});
