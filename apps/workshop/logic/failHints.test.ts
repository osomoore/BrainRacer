import { describe, expect, it } from 'vitest';
import { CHALLENGE_RULES_VERSION, WS_RULES } from '../config';
import type { Challenge, Model, WorkshopProgress } from '../core/types';
import { READING_LEVELS } from '../core/types';
import { CATALOGS } from '../content';
import { buildBlocks } from '../screens/board/cardText';
import { createEngine } from './index';
import { chooseFix, failLines, failNotes, fillParts, practiceStory } from './failHints';
import { namedVariants } from './namedFixes';
import { solve } from './solver';
import { flatChecks } from './util';
import { evaluate } from './evaluate';
import { newProgress } from './board';
import { resolveSpec } from './text';
import { partTag } from './stats';
import { simulate } from './simulate';

const race = CATALOGS.race;
const eng = createEngine(CATALOGS);
const fresh = (): WorkshopProgress => eng.refreshBoard('race', eng.newProgress('race'));
const openAll = (p: WorkshopProgress): WorkshopProgress =>
  ({ ...p, overrides: Object.fromEntries(race.variants.map((v) => [v.id, 'open' as const])) });
const failing = (p: WorkshopProgress): Challenge => p.active.map((id) => p.challenges[id]).find((c) => !evaluate(race, p.model, c).passed)!;
const winning = (p: WorkshopProgress, c: Challenge): Model =>
  solve(race, flatChecks(c), new Set(race.variants.map((v) => v.id)), { ref: p.model })!.build;

describe('failure part choice', () => {
  const owned = ['wheels.road'];
  const cheap = ['wheels.mud'];
  const dear = ['wheels.monster'];
  it('prefers a fix the player owns, then one they can afford, then any', () => {
    const p = { ...fresh(), wallet: 0 };
    expect(chooseFix(race, p, [dear, cheap, owned])).toEqual(owned);
    expect(chooseFix(race, { ...p, wallet: 4 }, [dear, cheap])).toEqual(cheap);
    expect(chooseFix(race, { ...p, bought: ['wheels.monster'] }, [cheap, dear])).toEqual(dear);
    // Nothing owned or affordable: still names a listed fix (the cheapest).
    expect(chooseFix(race, p, [dear, cheap])).toEqual(cheap);
    expect(chooseFix(race, p, [])).toBeNull();
  });
});

describe('failure lines', () => {
  it('fill in part names the way a sentence reads them', () => {
    expect(fillParts(race, 'Get {parts} to pass.', ['size.small', 'engine.electric'], 'starter')).toBe('Get the Small car size and an Electric Motor to pass.');
    expect(fillParts(race, 'You needed {parts} to grip the mud.', ['wheels.mud'], 'easy')).toBe('You needed Mud Tires to grip the mud.');
    expect(fillParts(race, '{parts} would grip the mud.', ['wheels.mud', 'body.jeep'], 'medium')).toBe('Mud Tires and a Jeep would grip the mud.');
    expect(fillParts(race, 'You needed {parts}.', ['size.small'], 'easy')).toBe('You needed the Small car size.');
    expect(fillParts(race, 'You needed {parts}.', ['engine.electric'], 'easy')).toBe('You needed an Electric Motor.');
  });

  it('name the first parts and "more" when the whole list is too long', () => {
    const line = fillParts(race, 'You needed {parts} today.',
      ['engine.efficient', 'size.tiny', 'paint.rainbow', 'body.sports'], 'easy');
    expect(line).toBe('You needed an Efficient Engine, the Tiny car size, and more today.');
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it.each(['flat', 'big', 'sharp', 'mega'])('omits the article for %s teeth', (kind) => {
    const dino = CATALOGS.dino;
    const part = dino.variants.find((v) => v.id === 'teeth.' + kind)!;
    expect(fillParts(dino, 'You needed {parts}.', [part.id], 'easy')).toBe('You needed ' + part.name + '.');
  });

  it('practice cards show a direct Starter instruction and a situation at later levels', () => {
    expect(practiceStory(race, 'extra.winch', 'starter')).toBe('Try a Winch on it.');
    for (const r of READING_LEVELS) {
      if (r !== 'starter') expect(practiceStory(race, 'extra.winch', r)).toBe('A friend is stuck in the mud. They need help.');
    }
  });
});

describe('hint memory', () => {
  it('Foggy Road names only parts that fit a complete passing build after a miss', () => {
    const challenge = resolveSpec(race, { stages: [
      { scenario: 'fog', facets: [{ facet: 'fog.bright', level: 1 }] },
      { scenario: 'mud', facets: [{ facet: 'mud.grip', level: 3 }, { facet: 'mud.pull', level: 2 }] },
      { scenario: 'turn', facets: [{ facet: 'turn.handling', level: 3 }] },
    ] }, { id: 'foggy-road-regression', source: 'generated', tier: 3, seed: 7919 });
    const p0 = newProgress(race);
    const model = { ...p0.model, wheels: 'wheels.mud', engine: 'engine.big', gears: 'gears.fourByFour', extra: 'extra.winch', paint: 'paint.yellow' };
    const p = { ...p0, model, wallet: 999, overrides: Object.fromEntries(race.variants.map((v) => [v.id, 'open' as const])) };
    const result = evaluate(race, model, challenge);
    expect(result.passed).toBe(false);
    expect(result.stages.slice(0, 2).every((stage) => stage.passed)).toBe(true);
    expect(result.stages[2]).toMatchObject({ reached: true, passed: false });
    const notes = failNotes(race, p, challenge, result);
    const parts = [...new Set(notes.flatMap((note) => note.parts))];
    expect(parts).not.toContain('wheels.racing');
    expect(parts.length).toBeGreaterThan(0);
    const pinned = [...flatChecks(challenge), ...parts.map((id) => ({ kind: 'tag' as const, tag: partTag(id) }))];
    const solution = solve(race, pinned, new Set(race.variants.map((v) => v.id)));
    expect(solution).not.toBeNull();
    expect(evaluate(race, solution!.build, challenge).passed).toBe(true);
    expect(failLines(race, challenge, notes, 'easy').join(' ')).not.toContain('Racing Tires');
    for (const id of parts) expect(Object.values(solution!.build)).toContain(id);
  });

  it('generated failure hints always fit inside some complete passing build across seeds', () => {
    for (const cat of [race, CATALOGS.dino]) {
      const all = new Set(cat.variants.map((v) => v.id));
      let checked = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const progress = simulate(cat, { seed, maxSteps: 12 }).progress;
        for (const challenge of Object.values(progress.challenges).filter((c) => c.source === 'generated')) {
          const failedRun = evaluate(cat, progress.model, challenge);
          if (failedRun.passed) continue;
          const notes = failNotes(cat, progress, challenge, failedRun);
          if (!notes.length) continue;
          const parts = [...new Set(notes.flatMap((note) => note.parts))];
          const pinned = [...flatChecks(challenge), ...parts.map((id) => ({ kind: 'tag' as const, tag: partTag(id) }))];
          const solution = solve(cat, pinned, all);
          expect(solution, `${cat.id}:${challenge.id} (seed ${seed})`).not.toBeNull();
          expect(evaluate(cat, solution!.build, challenge).passed, `${cat.id}:${challenge.id} (seed ${seed})`).toBe(true);
          checked++;
        }
      }
      expect(checked, `${cat.id} should exercise generated hints`).toBeGreaterThan(0);
    }
  }, 30_000);

  it('a failed run remembers a line naming a part until the challenge is won', () => {
    let p = openAll(fresh());
    const c = failing(p);
    const id = c.id;
    p = eng.recordFail('race', p, id);
    const notes = p.failHints?.[id] ?? [];
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.length).toBeLessThanOrEqual(WS_RULES.failLinesMax);
    for (const r of READING_LEVELS) {
      const lines = failLines(race, c, notes, r);
      expect(lines.length).toBe(notes.length);
      lines.forEach((line, k) => expect([...namedVariants(race, line)].some((v) => notes[k].parts.includes(v))).toBe(true));
      const blocks = buildBlocks(c, r, lines);
      expect(blocks.filter((b) => b.kind === 'hint').map((b) => b.text)).toEqual(lines);
    }
    // The same notes come back from the save.
    const saved = eng.normalizeSave(JSON.parse(JSON.stringify({ ...eng.newPlayerSave('medium'), workshops: { race: p } })))!;
    expect(saved.workshops.race!.failHints?.[id]).toEqual(notes);
    // A win clears them.
    const won = eng.recordWin('race', p, id, winning(p, c), 1).progress;
    expect(won.completed[id]).toBeDefined();
    expect(won.failHints?.[id]).toBeUndefined();
  });

  it('the notes match what the results screen shows', () => {
    const p = openAll(fresh());
    const c = failing(p);
    const result = evaluate(race, p.model, c);
    expect(eng.recordFail('race', p, c.id).failHints?.[c.id]).toEqual(failNotes(race, p, c, result));
  });

  it('a rules version change re-deals the board and drops remembered hints', () => {
    let p = openAll(fresh());
    const id = failing(p).id;
    p = eng.recordFail('race', p, id);
    expect(p.failHints?.[id]?.length).toBeGreaterThan(0);
    const old = { ...p, rulesVersion: CHALLENGE_RULES_VERSION - 1 };
    const save = eng.normalizeSave(JSON.parse(JSON.stringify({ ...eng.newPlayerSave('easy'), workshops: { race: old } })))!;
    const q = save.workshops.race!;
    expect(q.rulesVersion).toBe(CHALLENGE_RULES_VERSION);
    expect(q.failHints ?? {}).toEqual({});
    expect(q.fails).toEqual({});
  });
});
