/** Starter and Easy show only WS_EASY_ASPECTS per workshop: station list, shop, pinned parts, dealt cards, texts and level switches. */
import { describe, expect, it } from 'vitest';
import { WS_EASY_ASPECTS } from '../config';
import { CATALOGS } from '../content';
import type { Challenge, PlayerSave, RunResult, WorkshopId } from '../core/types';
import { WORKSHOP_IDS } from '../core/types';
import { aspectIdsAt, isHiddenAspect, visibleAspectIds } from './aspects';
import { available, availableFor } from './available';
import { affordability } from './affordability';
import { hint, newProgress, refreshBoard } from './board';
import { chooseFix } from './failHints';
import { engine } from './index';
import { shopOffers } from './shop';
import { simulate } from './simulate';
import { solve } from './solver';
import { successReasons } from './successReasons';
import { resolveSpec } from './text';
import { flatChecks } from './util';

const withoutEasy = <T extends { easy?: true }>(p: T): T => { const { easy: _easy, ...rest } = p; return rest as T; };

describe('aspect filtering', () => {
  it.each(WORKSHOP_IDS)('%s: Starter/Easy list exactly six real aspects in catalog order; other levels list all', (id) => {
    const cat = CATALOGS[id];
    const easy = aspectIdsAt(cat, true);
    expect(easy).toHaveLength(6);
    expect(easy).toEqual(cat.aspects.map((a) => a.id).filter((a) => WS_EASY_ASPECTS[id].includes(a)));
    expect(aspectIdsAt(cat, false)).toHaveLength(cat.aspects.length);
    expect(aspectIdsAt(cat, undefined)).toHaveLength(cat.aspects.length);
  });

  it('pins hidden aspects to their first starter, keeps the purchase, and returns it on Medium', () => {
    const cat = CATALOGS.race;
    const p = { ...newProgress(cat, undefined, 'easy'), bought: ['gears.climbing', 'wheels.mud'] };
    expect(availableFor(cat, p, 'gears')).toEqual(['gears.easy']);
    expect(availableFor(cat, p, 'wheels')).toContain('wheels.mud');
    expect(available(cat, { ...p, overrides: { 'gears.climbing': 'open' } }).has('gears.climbing')).toBe(false);
    expect(availableFor(cat, withoutEasy(p), 'gears')).toContain('gears.climbing');
    expect(p.bought).toContain('gears.climbing');
  });

  it('the shop and the Easy station list offer nothing for hidden aspects', () => {
    const cat = CATALOGS.race;
    const p = newProgress(cat, undefined, 'easy');
    expect(shopOffers(cat, p, 'gears')).toEqual([]);
    expect(shopOffers(cat, p, 'wheels').length).toBeGreaterThan(0);
    expect(shopOffers(cat, withoutEasy(p), 'gears').length).toBeGreaterThan(0);
    const routes = affordability(cat, p).routes;
    for (const id of routes.keys()) expect(isHiddenAspect('race', p, cat.variants.find((v) => v.id === id)!.aspect)).toBe(false);
  });
});

describe.each(WORKSHOP_IDS)('Starter/Easy cards use only shown aspects: %s', (id) => {
  it('dealt challenges and facets are solvable inside the six shown aspects, and wins leave hidden aspects on their starters', () => {
    const cat = CATALOGS[id];
    for (const level of ['starter', 'easy'] as const) {
      // Full Easy progression reaches max tier; Starter also checks early generated facets.
      const report = simulate(cat, { level, ...(level === 'starter' ? { maxSteps: 14 } : {}) });
      if (level === 'starter') expect(report.steps).toBe(14);
      const p = report.progress;
      const shown = new Set(visibleAspectIds(cat, p));
      expect(shown).toHaveLength(6);
      const allowed = new Set(cat.variants
        .filter((v) => shown.has(v.aspect) || cat.aspects.some((a) => a.starters[0] === v.id && !shown.has(a.id)))
        .map((v) => v.id));
      expect(Object.keys(p.challenges).length).toBeGreaterThan(level === 'easy' ? 20 : 3);
      for (const challenge of Object.values(p.challenges)) {
        expect(solve(cat, flatChecks(challenge), allowed), `${id} ${level} ${challenge.title}`).not.toBeNull();
        for (const stage of challenge.stages) {
          for (const facet of new Set(stage.requirements.map((req) => req.facet))) {
            const checks = flatChecks({ ...challenge, stages: [{ ...stage, requirements: stage.requirements.filter((req) => req.facet === facet) }] });
            expect(solve(cat, checks, allowed), `${id} ${level} ${challenge.title} (${facet})`).not.toBeNull();
          }
        }
        for (const req of challenge.stages.flatMap((s) => s.requirements)) {
          if (req.facet.startsWith('practice.')) expect(shown.has(req.facet.slice('practice.'.length))).toBe(true);
        }
      }
      for (const info of Object.values(p.completed)) {
        for (const a of cat.aspects) if (!shown.has(a.id)) expect(info.build[a.id]).toBe(a.starters[0]);
      }
      for (const a of cat.aspects) if (!shown.has(a.id)) expect(p.model[a.id]).toBe(a.starters[0]);
    }
  }, 30_000);
});

describe('texts never name hidden parts on Easy', () => {
  const cat = CATALOGS.race;
  const easy = newProgress(cat, undefined, 'easy');

  it('named fixes that use a hidden aspect are skipped', () => {
    expect(chooseFix(cat, easy, [['wheels.mud', 'gears.climbing']])).toBeNull();
    expect(chooseFix(cat, easy, [['gears.climbing'], ['wheels.mud']])).toEqual(['wheels.mud']);
    expect(chooseFix(cat, withoutEasy(easy), [['wheels.mud', 'gears.climbing']])).toEqual(['wheels.mud', 'gears.climbing']);
  });

  it('a hint that points at a hidden station is not shown', () => {
    const challenge = resolveSpec(cat, { stages: [{ scenario: 'jump', facets: [{ facet: 'jump.speed', level: 1 }] }] },
      { id: 'hint-test', source: 'generated', tier: 0, seed: 5 });
    const req = challenge.stages[0].requirements[0];
    const failed: RunResult = {
      passed: false, cleverWin: false, endStage: 0, stages: [{ index: 0, passed: false, reached: true, firstFail: req.id }],
      requirements: [{ id: req.id, passed: false, reached: true, route: null }],
    };
    const withHint = (aspect: string): Challenge => ({ ...challenge, stages: [{ ...challenge.stages[0], requirements: [{ ...req, hint: { ...req.hint, aspect } }] }] });
    const failing = { ...easy, fails: { [challenge.id]: 9 } };
    expect(hint(failing, withHint('gears'), failed, 'easy')).toBeNull();
    expect(hint(failing, withHint('wheels'), failed, 'easy')).toBe(req.hint.text.easy);
    expect(hint(withoutEasy(failing), withHint('gears'), failed, 'medium')).toBe(req.hint.text.medium);
  });

  it('a named win that used a hidden part is praised by its quality line, not by part names', () => {
    const challenge = resolveSpec(cat, { stages: [{ scenario: 'mud', facets: [{ facet: 'mud.grip', level: 1 }] }] },
      { id: 'reason-test', source: 'generated', tier: 0, seed: 11 });
    const req = challenge.stages[0].requirements[0];
    const result: RunResult = {
      passed: true, cleverWin: false, endStage: 0, stages: [{ index: 0, passed: true, reached: true }],
      requirements: [{ id: req.id, passed: true, reached: true, route: 'named', parts: ['wheels.mud', 'gears.climbing'] }],
    };
    const shown = new Set(visibleAspectIds(cat, easy));
    const quality = cat.successPhrases!['mud.grip'].quality.easy;
    const lines = successReasons(cat, challenge, result, 'easy', shown);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(quality).toContain(line);
    expect(successReasons(cat, challenge, result, 'easy')[0]).toContain('Climbing Gears');
  });
});

describe('switching the reading level', () => {
  const dealt = (level: 'starter' | 'easy' | 'medium' | 'hard'): PlayerSave => {
    const save = engine.newPlayerSave(level, 7);
    return { ...save, workshops: { race: engine.progressOf(save, 'race') } };
  };

  it('re-deals the open cards when the level changes, keeping wallet, bought parts and wins', () => {
    for (const [from, to] of [['medium', 'starter'], ['starter', 'hard'], ['hard', 'starter'], ['starter', 'medium'], ['easy', 'medium']] as const) {
      const save = dealt(from);
      const race = save.workshops.race!;
      race.bought = ['gears.climbing', 'wheels.mud'];
      race.wallet = 9;
      const before = [...race.active];
      const switched = engine.progressOf({ ...save, reading: to }, 'race');
      expect(!!switched.easy).toBe(to === 'starter');
      expect(switched.active).toHaveLength(3);
      expect(switched.active.some((id) => before.includes(id))).toBe(false);
      expect(switched.bought).toEqual(['gears.climbing', 'wheels.mud']);
      expect(switched.wallet).toBe(9);
      // unchanged level keeps the cards
      expect(engine.progressOf({ ...save, reading: from }, 'race').active).toEqual(before);
    }
  });

  it('Starter and Easy deal the same board and keep it when switching or loading', () => {
    const starter = engine.newPlayerSave('starter', 7);
    const easy = engine.newPlayerSave('easy', 7);
    for (const ws of ['race', 'dino'] as const) {
      const board = engine.progressOf(starter, ws);
      expect(board).toEqual(engine.progressOf(easy, ws));
      const save = { ...starter, workshops: { [ws]: board } };
      const roundTrip = (reading: 'starter' | 'easy') => engine.normalizeSave(JSON.parse(JSON.stringify({ ...save, reading })))!;
      expect(roundTrip('starter').reading).toBe('starter');
      expect(roundTrip('easy').reading).toBe('easy');
      expect(roundTrip('starter').workshops[ws]).toEqual(board);
      expect(roundTrip('easy').workshops[ws]).toEqual(board);
      expect(engine.progressOf({ ...easy, workshops: { [ws]: board } }, ws)).toEqual(board);
    }
  });

  it('easy cards are solvable with the shown aspects and the hidden bought gears are not used', () => {
    const save = dealt('medium');
    save.workshops.race!.bought = ['gears.climbing', 'gears.speedy'];
    const easy = engine.progressOf({ ...save, reading: 'easy' }, 'race');
    const cat = CATALOGS.race;
    expect(easy.model.gears).toBe('gears.easy');
    const visible = new Set(visibleAspectIds(cat, easy));
    const shown = new Set(cat.variants.filter((v) => visible.has(v.aspect)
      || cat.aspects.some((a) => a.starters[0] === v.id && !visible.has(a.id))).map((v) => v.id));
    for (const id of easy.active) expect(solve(cat, flatChecks(easy.challenges[id]), shown)).not.toBeNull();
  });

  it('a save written at another level or rules version is re-dealt on load', () => {
    const save = dealt('easy');
    const race = save.workshops.race!;
    race.wallet = 9;
    race.bought = ['gears.climbing', 'wheels.mud'];
    race.model.wheels = 'wheels.mud';
    const raw = JSON.parse(JSON.stringify(save));
    const same = engine.normalizeSave(raw)!;
    expect(same.workshops.race!.active).toEqual(save.workshops.race!.active);
    const medium = engine.normalizeSave({ ...raw, reading: 'medium' })!;
    expect(medium.workshops.race!.easy).toBeUndefined();
    expect(medium.workshops.race!.active.some((id) => save.workshops.race!.active.includes(id))).toBe(false);
    const old = engine.normalizeSave({ ...raw, workshops: { race: { ...raw.workshops.race, rulesVersion: 2 } } })!;
    expect(old.workshops.race!.active.some((id) => save.workshops.race!.active.includes(id))).toBe(false);
    expect(old.workshops.race!.wallet).toBe(9);
    expect(old.workshops.race!.bought).toEqual(['gears.climbing', 'wheels.mud']);
    expect(old.workshops.race!.model.wheels).toBe('wheels.mud');
    expect(old.workshops.race!.firstWins).toBe(race.firstWins);
  });

  it('a new Easy progress deals three cards in both workshops', () => {
    const w = (id: WorkshopId) => refreshBoard(CATALOGS[id], newProgress(CATALOGS[id], undefined, 'easy'));
    expect(w('race').active).toHaveLength(3);
    expect(w('dino').active).toHaveLength(3);
  });
});

describe.each(WORKSHOP_IDS)('Easy only deals requirements with a nameable fix: %s', (id) => {
  it('every dealt requirement lists no fixes or at least one made only of shown parts (e.g. dino birds.roar is Head-only, so it is not dealt)', () => {
    const cat = CATALOGS[id];
    for (let seed = 0; seed < 30; seed++) {
      let p = refreshBoard(cat, newProgress(cat, seed, 'easy'));
      for (const cid of p.active) for (const stage of p.challenges[cid].stages) for (const req of stage.requirements) {
        if (!req.namedFixes?.length) continue;
        expect(req.namedFixes.some((fix) => fix.every((v) => !isHiddenAspect(id, p, v.split('.')[0]))), `${id} ${req.facet}`).toBe(true);
      }
      p = refreshBoard(cat, p);
    }
  }, 30_000);
});
