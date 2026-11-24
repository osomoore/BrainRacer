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
    expect(fillParts(race, 'You needed {parts} to grip the mud.', ['wheels.mud'], 'easy')).toBe('You needed Mud Tires to grip the mud.');
    expect(fillParts(race, '{parts} would grip the mud.', ['wheels.mud', 'body.jeep'], 'medium')).toBe('Mud Tires and a Jeep would grip the mud.');
    expect(fillParts(race, 'You needed {parts}.', ['size.small'], 'easy')).toBe('You needed the Small size.');
    expect(fillParts(race, 'You needed {parts}.', ['engine.electric'], 'easy')).toBe('You needed an Electric Motor.');
  });

  it('name the first parts and "more" when the whole list is too long', () => {
    const line = fillParts(race, 'You needed {parts} today.',
      ['engine.efficient', 'size.tiny', 'paint.rainbow', 'body.sports'], 'easy');
    expect(line).toBe('You needed an Efficient Engine, the Tiny size, and more today.');
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it('practice cards tell a story that names the part', () => {
    for (const r of READING_LEVELS) {
      const line = practiceStory(race, 'extra.winch', r);
      expect(line).toContain('a Winch');
      expect(line).not.toMatch(/^Use /);
    }
  });
});

describe('hint memory', () => {
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
    const saved = eng.normalizeSave(JSON.parse(JSON.stringify({ ...eng.newPlayerSave('easy'), workshops: { race: p } })))!;
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
