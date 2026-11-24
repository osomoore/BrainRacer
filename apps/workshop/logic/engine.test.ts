import { describe, expect, it } from 'vitest';
import { WS_RULES } from '../config';
import type { WorkshopEngine } from '../core/engineApi';
import type { Challenge, Model, WorkshopCatalog, WorkshopId, WorkshopProgress } from '../core/types';
import { createEngine } from './index';
import { solveAffordable } from './affordability';
import { solvable } from './solver';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import { deepFreeze } from './testing/helpers';
import { flatChecks } from './util';
import { challengeKey } from './generator';

const pair = (cat: WorkshopCatalog): Readonly<Record<WorkshopId, WorkshopCatalog>> => ({ race: cat, dino: { ...cat, id: 'dino' } });
const eng: WorkshopEngine = createEngine(pair(C));
const fresh = (): WorkshopProgress => eng.refreshBoard('race', eng.newProgress('race'));
const unfinished = (p: WorkshopProgress): Challenge[] => p.active.filter((id) => !p.completed[id]).map((id) => p.challenges[id]);
const win = (p: WorkshopProgress, id: string, model: Model, now = 1): WorkshopProgress => eng.recordWin('race', p, id, model, now).progress;

function affordableBuild(p: WorkshopProgress, ch: Challenge, cat: WorkshopCatalog = C): Model {
  const solution = solveAffordable(cat, flatChecks(ch), p);
  if (!solution) throw new Error(`unaffordable ${ch.id}`);
  return solution.build;
}

function playStarters(): WorkshopProgress {
  let p = fresh();
  for (let i = 0; i < 5; i++) {
    const ch = unfinished(p)[0];
    if (!ch) break;
    const build = affordableBuild(p, ch);
    for (const [aspect, id] of Object.entries(build)) {
      if (!eng.available('race', p).has(id)) p = eng.purchase('race', p, aspect, id).progress;
    }
    p = win(p, ch.id, build, i + 1);
  }
  return p;
}

function buyBuild(p: WorkshopProgress, model: Model, engine: WorkshopEngine = eng): WorkshopProgress {
  for (const [aspect, id] of Object.entries(model)) {
    if (!engine.available('race', p).has(id)) {
      const outcome = engine.purchase('race', p, aspect, id);
      if (outcome.status !== 'bought') throw new Error(`could not buy ${id}: ${outcome.status}`);
      p = outcome.progress;
    }
  }
  return p;
}

describe('evaluate', () => {
  const mk = (stages: Challenge['stages']): Challenge => ({ id: 'c', workshop: 'race', title: '', intro: { easy: '', medium: '', hard: '' }, stages, tier: 0, source: 'generated', seed: 1, genVersion: 1 });
  const req = (id: string, passes: boolean) => ({
    id, facet: 'f', level: 1, text: { easy: '', medium: '', hard: '' }, hint: { aspect: 'wheels', text: { easy: '', medium: '', hard: '' } },
    checks: [{ kind: 'tag' as const, tag: passes ? 'canCarry' : 'dark' }],
  });
  const st = (...r: ReturnType<typeof req>[]) => ({ scenario: 'mud', view: 'side' as const, params: {}, requirements: r });
  const model = eng.defaultModel('race'); // roofRack gives canCarry, nothing is dark

  it('evaluates later requirements but ends the run at the first failing stage', () => {
    const r = eng.evaluate('race', model, mk([st(req('s0r0', true)), st(req('s1r0', true), req('s1r1', false), req('s1r2', false)), st(req('s2r0', false))]));
    expect(r.passed).toBe(false);
    expect(r.endStage).toBe(1);
    expect(r.stages.map((s) => s.reached)).toEqual([true, true, false]);
    expect(r.stages[1].firstFail).toBe('s1r1');
    expect(r.stages[0].firstFail).toBeUndefined();
    expect(r.requirements.map((x) => [x.id, x.passed, x.reached])).toEqual([
      ['s0r0', true, true], ['s1r0', true, true], ['s1r1', false, true], ['s1r2', false, true], ['s2r0', false, false],
    ]);
  });
  it('passes when everything passes; the last stage is the end stage', () => {
    expect(eng.evaluate('race', model, mk([st(req('a', true)), st(req('b', true))]))).toMatchObject({ passed: true, endStage: 1 });
  });
  it('sums stats, clamps them and unions tags', () => {
    const cm = eng.computeModel('race', { ...model, wheels: 'wheels.racing', engine: 'engine.turbo', extra: 'extra.rocket' });
    expect(cm.stats.speed).toBe(8);
    expect(cm.stats.grip).toBe(0);
    expect(cm.tags.has('canCarry')).toBe(false);
    const big = eng.computeModel('race', { ...model, size: 'size.tiny' });
    expect(big.stats.size).toBe(0);
  });
});

describe('availability', () => {
  it('is first starters + bought + open - locked, and an aspect is never empty', () => {
    const p = eng.newProgress('race');
    expect(eng.available('race', p).size).toBe(C.aspects.length);
    const q: WorkshopProgress = { ...p, bought: ['wheels.racing'], overrides: { 'engine.turbo': 'open', 'wheels.road': 'locked' } };
    const a = eng.available('race', q);
    expect(a.has('wheels.racing') && a.has('engine.turbo')).toBe(true);
    expect(a.has('wheels.road')).toBe(false);
    expect(a.has('wheels.mud')).toBe(false);
    const all: WorkshopProgress = { ...p, overrides: { 'size.medium': 'locked', 'size.small': 'locked' } };
    expect(eng.availableFor('race', all, 'size')).toEqual(['size.medium']);
  });
  it('setOverride sanitizes the model and keeps the board solvable', () => {
    let p = fresh();
    p = eng.purchase('race', p, 'wheels', 'wheels.mud').progress;
    p = eng.setPart('race', p, 'wheels', 'wheels.mud');
    p = eng.setOverride('race', p, 'wheels.mud', 'locked');
    expect(p.model.wheels).toBe('wheels.road');
    for (const c of unfinished(p)) expect(solveAffordable(C, flatChecks(c), p)).not.toBeNull();
    p = eng.setOverride('race', p, 'wheels.mud', 'auto');
    expect(p.overrides['wheels.mud']).toBeUndefined();
  });
  it('locking a part rechecks the board against remaining affordable builds', () => {
    let p = fresh();
    const oldActive = [...p.active];
    p = eng.setOverride('race', p, 'wheels.mud', 'locked');
    expect(p.active.length).toBe(3);
    for (const id of p.active) expect(solveAffordable(C, flatChecks(p.challenges[id]), p)?.cost).toBe(2);
    expect(oldActive.length).toBe(3);
  });
  it('setPart ignores unavailable parts', () => {
    const p = fresh();
    expect(eng.setPart('race', p, 'wheels', 'wheels.racing').model.wheels).toBe('wheels.road');
    const bought = eng.purchase('race', p, 'wheels', 'wheels.mud').progress;
    expect(eng.setPart('race', bought, 'wheels', 'wheels.mud').model.wheels).toBe('wheels.mud');
  });
});

describe('starters and board', () => {
  it('offers the first currency starter and fills the rest of the board', () => {
    const p = fresh();
    expect(p.active).toHaveLength(3);
    expect(p.challenges[p.active[0]]).toMatchObject({ source: 'starter', tier: 0, workshop: 'race' });
    expect(p.nextStarter).toBeGreaterThan(0);
    for (const id of p.active) expect(solveAffordable(C, flatChecks(p.challenges[id]), p)).not.toBeNull();
  });
  it('is idempotent', () => {
    const p = fresh();
    expect(eng.refreshBoard('race', p)).toEqual(p);
    const ch = p.challenges[p.active[0]];
    const model = affordableBuild(p, ch);
    const purchased = buyBuild(p, model);
    const q = eng.refreshBoard('race', win(purchased, ch.id, model));
    expect(eng.refreshBoard('race', q)).toEqual(q);
  });
  it('refills after a valid first win and pays its requirements', () => {
    const p = fresh();
    const ch = p.challenges[p.active[0]];
    const model = affordableBuild(p, ch);
    const out = eng.recordWin('race', buyBuild(p, model), ch.id, model, 10);
    expect(out.firstWin).toBe(true);
    expect(out.progress.active).toHaveLength(3);
    expect(out.payout).toBe(ch.stages.reduce((n, s) => n + s.requirements.length, 0) * 2);
  });
  it('pays for every requirement across stages and dedupes reordered requirements', () => {
    const start = fresh();
    const mud = start.challenges['st-mud'];
    const turn = start.challenges['st-turn'];
    const challenge = { ...mud, id: 'combined', stages: [...mud.stages, ...turn.stages] };
    const reversed = { ...challenge, id: 'reversed', stages: [...challenge.stages].reverse() };
    expect(challengeKey(reversed)).toBe(challengeKey(challenge));
    const withChallenge = { ...start, active: [challenge.id], challenges: { [challenge.id]: challenge } };
    const build = affordableBuild(withChallenge, challenge);
    const prepared = buyBuild(withChallenge, build);
    const out = eng.recordWin('race', prepared, challenge.id, build, 1);
    expect(out.payout).toBe(4);
    const reloaded = eng.refreshBoard('race', {
      ...out.progress, active: [reversed.id, ...out.progress.active],
      challenges: { ...out.progress.challenges, [reversed.id]: reversed },
    });
    expect(reloaded.active).not.toContain(reversed.id);
  });
  it('first win records a payout and replays do not pay twice', () => {
    const start = fresh();
    const m = { ...start.model, wheels: 'wheels.mud' };
    const p = buyBuild(start, m);
    const w1 = eng.recordWin('race', p, 'st-mud', m, 5);
    expect(w1).toMatchObject({ firstWin: true, payout: 2 });
    expect(w1.progress.wallet).toBe(4);
    expect(w1.progress.firstWins).toBe(1);
    expect(w1.progress.bought).toContain('wheels.mud');
    expect(w1.progress.lastWin).toEqual(m);
    expect(w1.progress.completed['st-mud']).toMatchObject({ wonAt: 5, payout: 2, build: m });
    const w2 = eng.recordWin('race', { ...w1.progress, fails: { 'st-mud': 2 } }, 'st-mud', m, 9);
    expect(w2.firstWin).toBe(false);
    expect(w2.payout).toBe(0);
    expect(w2.progress.firstWins).toBe(1);
    expect(w2.progress.completed['st-mud']).toMatchObject({ wonAt: 5, payout: 2 });
    expect(w2.progress.wallet).toBe(w1.progress.wallet);
    expect(w2.progress.fails['st-mud']).toBe(2);
  });
  it('skips unlock-order variants that are already available', () => {
    const p = eng.setOverride('race', fresh(), 'wheels.racing', 'open');
    const m = { ...p.model, wheels: 'wheels.mud' };
    const out = eng.recordWin('race', buyBuild(p, m), 'st-mud', m, 1);
    expect(out.payout).toBe(2);
  });
  it('ignores a win for an unknown challenge', () => {
    const p = fresh();
    expect(eng.recordWin('race', p, 'nope', p.model, 1)).toMatchObject({ firstWin: false, payout: 0, newChallenges: [] });
  });
  it('keeps won requirements off the board even when authored challenges run out', () => {
    const tiny: WorkshopCatalog = { ...C, scenarios: C.scenarios.filter((s) => s.id === 'fog'), starters: [C.starters[4]] };
    const e = createEngine(pair(tiny));
    let p = e.refreshBoard('race', e.newProgress('race'));
    expect(p.active).toContain('st-bright');
    const model = { ...p.model, paint: 'paint.yellow' };
    p = e.recordWin('race', e.purchase('race', p, 'paint', 'paint.yellow').progress, 'st-bright', model, 1).progress;
    expect(p.active).not.toContain('st-bright');
    const wonKey = challengeKey(p.challenges['st-bright']);
    expect(p.active.map((id) => challengeKey(p.challenges[id]))).not.toContain(wonKey);
    expect(e.refreshBoard('race', p)).toEqual(p);
  });
  it('retains completed history beyond the unfinished challenge cap', () => {
    let p = fresh();
    const extra: Record<string, Challenge> = {};
    for (let i = 0; i < 80; i++) {
      extra[`old${i}`] = { ...p.challenges['st-mud'], id: `old${i}`, source: 'generated', stages: [{ ...p.challenges['st-mud'].stages[0], scenario: `s${i}` }] };
    }
    p = {
      ...p, challenges: { ...p.challenges, ...extra },
      completed: Object.fromEntries(Object.keys(extra).map((id, i) => [id, { build: p.model, wonAt: i, payout: 0 }])),
    };
    const q = eng.refreshBoard('race', p);
    expect(Object.keys(q.challenges).length).toBeGreaterThan(WS_RULES.maxSavedChallenges);
    for (const id of q.active) expect(q.challenges[id]).toBeDefined();
    expect(q.challenges.old79).toBeDefined();
    expect(q.challenges.old0).toBeDefined();
    expect(q.challenges['st-mud']).toBeDefined();
  });
  it('caps inactive unfinished challenges while retaining active cards', () => {
    const p = fresh();
    const extra: Record<string, Challenge> = {};
    for (let i = 0; i < 80; i++) {
      extra[`unfinished${i}`] = { ...p.challenges[p.active[0]], id: `unfinished${i}`, source: 'generated' };
    }
    const q = eng.refreshBoard('race', { ...p, challenges: { ...p.challenges, ...extra } });
    for (const id of q.active) expect(q.challenges[id]).toBeDefined();
    expect(Object.keys(q.challenges).filter((id) => !q.completed[id]).length).toBeLessThanOrEqual(WS_RULES.maxSavedChallenges);
    expect(Object.keys(extra).some((id) => q.challenges[id] === undefined)).toBe(true);
  });
});

describe('shop and currency', () => {
  const early = ['wheels.mud', 'wheels.racing', 'wheels.snow'];
  const variant = (id: string) => C.variants.find((v) => v.id === id)!;

  it('offers the first three cards at prices 2, 4, and 6 with seeded availability', () => {
    let p = eng.grantCurrency('race', { ...fresh(), wallet: 0 });
    expect(p.wallet).toBe(10);
    for (let i = 0; i < early.length; i++) {
      const offer = eng.shopOffers('race', p, 'wheels').find((o) => o.variant === early[i]);
      expect(offer).toMatchObject({ variant: early[i], price: (i + 1) * 2, affordable: p.wallet >= (i + 1) * 2 });
      if (i < 2) p = eng.purchase('race', p, 'wheels', early[i]).progress;
    }
    expect(p.wallet).toBe(4);
    expect(eng.shopOffers('race', p, 'wheels')).toEqual(eng.shopOffers('race', p, 'wheels'));
  });

  it('updates the shop after purchases at the same station', () => {
    let p = eng.grantCurrency('race', { ...fresh(), wallet: 0 });
    for (const [i, id] of early.slice(0, 2).entries()) {
      const v = variant(id);
      const out = eng.purchase('race', p, v.aspect, id);
      expect(out).toMatchObject({ status: 'bought', price: (i + 1) * 2 });
      p = out.progress;
      expect(p.bought).toContain(id);
      expect(eng.available('race', p).has(id)).toBe(true);
      expect(eng.purchase('race', p, v.aspect, id).status).toBe('unavailable');
    }
    expect(p.wallet).toBe(4);
    expect(eng.shopOffers('race', p, 'wheels').find((o) => o.variant === early[2])).toMatchObject({ price: 6, affordable: false });
    expect(eng.purchase('race', p, 'wheels', early[2]).status).toBe('unaffordable');
  });

  it('keeps newly owned-solvable cards and replaces unaffordable cards after spending', () => {
    const start = fresh();
    const mud = eng.purchase('race', start, 'wheels', 'wheels.mud').progress;
    const spent = eng.purchase('race', mud, 'paint', 'paint.red').progress;
    expect(spent.wallet).toBe(0);
    expect(spent.active).toHaveLength(3);
    expect(spent.active).toContain('st-mud');
    expect(spent.active).not.toContain('st-jump');
    expect(spent.active).not.toContain('st-turn');
    for (const pending of unfinished(spent)) expect(solveAffordable(C, flatChecks(pending), spent)?.cost).toBe(0);
  });

  it('checks current wallet and board state on each purchase and grants currency deterministically', () => {
    const p = fresh();
    const v = variant(early[0]);
    const bad = eng.purchase('race', { ...p, wallet: 0 }, v.aspect, early[0]);
    expect(bad.status).toBe('unaffordable');
    const missing = eng.purchase('race', p, v.aspect, 'unknown.card');
    expect(missing.status).toBe('unavailable');
    const paid = eng.grantCurrency('race', { ...p, wallet: 0 });
    expect(paid.wallet).toBe(10);
    expect(eng.grantCurrency('race', paid)).toEqual({ ...paid, wallet: 20 });
  });

  it('returns the cheapest affordable build and respects a zero wallet', () => {
    const p = fresh();
    const checks = [{ kind: 'tag' as const, tag: 'color:red' }];
    const result = solveAffordable(C, checks, p);
    expect(result).not.toBeNull();
    expect(result!.cost).toBeLessThanOrEqual(p.wallet);
    expect(solveAffordable(C, checks, { ...p, wallet: 0 })).toBeNull();
    const combined = [...checks, ...flatChecks(p.challenges['st-mud'])];
    expect(solveAffordable(C, combined, p)?.cost).toBe(4);
    expect(solveAffordable(C, combined, { ...p, wallet: 2 })).toBeNull();
  });

  it('resets purchased progress and wallet while preserving reading', () => {
    const save = eng.newPlayerSave('hard');
    const p = fresh();
    const v = variant(early[0]);
    const purchase = eng.purchase('race', p, v.aspect, early[0]);
    const populated = { ...save, workshops: { race: purchase.progress } };
    const reset = eng.resetPlayer(populated);
    expect(reset.reading).toBe('hard');
    expect(reset.workshops).toEqual({});
  });
});

describe('generator rules', () => {
  it('makes challenges the current model and last win do not solve, with ids from genSeq', () => {
    const p = playStarters();
    const gen = unfinished(p).filter((c) => c.source === 'generated');
    expect(gen.length).toBeGreaterThan(0);
    for (const c of gen) {
      expect(c.id).toMatch(/^race-g\d+$/);
      expect(eng.evaluate('race', p.model, c).passed).toBe(false);
      expect(eng.evaluate('race', p.lastWin!, c).passed).toBe(false);
      expect(solveAffordable(C, flatChecks(c), p)).not.toBeNull();
    }
  });
  it('is deterministic and respects tier shape, facet uniqueness and views', () => {
    const a = playStarters();
    expect(playStarters()).toEqual(a);
    for (const c of Object.values(a.challenges)) {
      const facets = c.stages.flatMap((s) => s.requirements.map((r) => r.facet));
      expect(new Set(facets).size).toBe(facets.length);
      for (const s of c.stages) {
        const sc = C.scenarios.find((x) => x.id === s.scenario)!;
        for (const r of s.requirements) expect(sc.facets.some((f) => f.id === r.facet)).toBe(true);
        const allSide = s.requirements.every((r) => sc.facets.find((f) => f.id === r.facet)!.views.includes('side'));
        expect(s.view).toBe(allSide ? 'side' : 'top');
      }
      if (c.source === 'generated') {
        const row = WS_RULES.tierTable[Math.min(c.tier, WS_RULES.tierTable.length - 1)];
        expect(c.stages.length).toBeGreaterThanOrEqual(row.stages[0]);
        expect(c.stages.length).toBeLessThanOrEqual(row.stages[1]);
      }
    }
  });
  it('mostly asks for at least 2 changed aspects and never solves with the last win', () => {
    let p = playStarters();
    let ge2 = 0;
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const ch = unfinished(p).find((c) => c.source === 'generated');
      if (!ch) break;
      const build = affordableBuild(p, ch);
      p = buyBuild(p, build);
      const out = eng.recordWin('race', p, ch.id, build, 100 + i);
      p = out.progress;
      const aspects = C.aspects.map((a) => a.id);
      for (const c of out.newChallenges.map((id) => p.challenges[id]).filter((x) => x.source === 'generated')) {
        expect(eng.evaluate('race', p.lastWin!, c).passed).toBe(false);
        total++;
        let min = 99;
        const rec = (k: number, m: Model): void => {
          if (k === aspects.length) {
            if (eng.evaluate('race', m, c).passed) min = Math.min(min, aspects.filter((a) => m[a] !== p.lastWin![a]).length);
            return;
          }
          for (const v of eng.availableFor('race', p, aspects[k])) rec(k + 1, { ...m, [aspects[k]]: v });
        };
        rec(0, {});
        expect(min).toBeGreaterThanOrEqual(1);
        if (min >= 2) ge2++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(ge2 / total).toBeGreaterThan(0.4);
  });
  it('refills the board quickly', () => {
    let p = playStarters();
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const ch = unfinished(p)[0];
      const m = affordableBuild(p, ch);
      const t0 = performance.now();
      p = buyBuild(p, m);
      p = win(p, ch.id, m, 500 + i);
      times.push(performance.now() - t0);
    }
    expect(Math.max(...times)).toBeLessThan(100);
  });
});

describe('text', () => {
  it('fills every reading level and is stable', () => {
    const c = fresh().challenges['st-mud'];
    for (const r of ['easy', 'medium', 'hard'] as const) {
      expect(c.intro[r]).toContain(`(${r}`);
      expect(c.stages[0].requirements[0].text[r]).toContain(`(${r}`);
      expect(c.stages[0].requirements[0].hint.text[r]).toContain(`(${r}`);
    }
    expect(c.stages[0].requirements[0].hint.aspect).toBe('wheels');
    expect(fresh().challenges['st-mud']).toEqual(c);
  });
  it('titles 2 stages "A & B" and 3 stages "<first> Adventure"', () => {
    const titles = new Set<string>();
    let p = playStarters();
    for (let i = 0; i < 14; i++) {
      for (const c of Object.values(p.challenges)) titles.add(`${c.stages.length}|${c.title}`);
      const ch = unfinished(p)[0];
      if (!ch) break;
      const build = affordableBuild(p, ch);
      p = buyBuild(p, build);
      p = win(p, ch.id, build, 200 + i);
    }
    const two = [...titles].filter((t) => t.startsWith('2|'));
    const three = [...titles].filter((t) => t.startsWith('3|'));
    expect(two.length).toBeGreaterThan(0);
    for (const t of two) expect(t).toMatch(/^2\|.+ & .+$/);
    for (const t of three) expect(t).toMatch(/Adventure$/);
  });
  it('does not crash on missing phrases and falls back sensibly', () => {
    const bare: WorkshopCatalog = { ...C, facetPhrases: [], scenarioPhrases: [] };
    const e = createEngine(pair(bare));
    const c = e.refreshBoard('race', e.newProgress('race')).challenges['st-mud'];
    expect(c.title).toBe('Mud');
    expect(c.stages[0].requirements[0].text.easy.length).toBeGreaterThan(0);
    expect(c.stages[0].requirements[0].hint.text.easy).toContain('Wheels');
  });
  it('clamps the level index into the phrase array', () => {
    const short: WorkshopCatalog = { ...C, facetPhrases: C.facetPhrases.map((f) => ({ ...f, requirement: f.requirement.slice(0, 1) })) };
    const e = createEngine(pair(short));
    let p = e.refreshBoard('race', e.newProgress('race'));
    for (let i = 0; i < 6; i++) {
      const ch = p.active.map((id) => p.challenges[id]).find((c) => !p.completed[c.id])!;
      const build = affordableBuild(p, ch, short);
      p = buyBuild(p, build, e);
      p = e.recordWin('race', p, ch.id, build, i).progress;
    }
    for (const c of Object.values(p.challenges)) for (const s of c.stages) for (const r of s.requirements) expect(r.text.hard).toContain('level 1');
  });
});

describe('fails and hints', () => {
  it('shows the hint of the first failed requirement after 3 fails only', () => {
    let p = fresh();
    const ch = p.challenges['st-mud'];
    const res = eng.evaluate('race', p.model, ch);
    expect(eng.hint(p, ch, res, 'easy')).toBeNull();
    p = eng.recordFail('race', p, 'st-mud');
    p = eng.recordFail('race', p, 'st-mud');
    expect(eng.hint(p, ch, res, 'easy')).toBeNull();
    p = eng.recordFail('race', p, 'st-mud');
    expect(p.fails['st-mud']).toBe(3);
    expect(eng.hint(p, ch, res, 'hard')).toBe(ch.stages[0].requirements[0].hint.text.hard);
    expect(eng.hint(p, ch, eng.evaluate('race', { ...p.model, wheels: 'wheels.mud' }, ch), 'easy')).toBeNull();
  });
});

describe('regenerate', () => {
  it('drops unfinished generated challenges and makes new ones', () => {
    const p = playStarters();
    const old = p.active.filter((x) => !p.completed[x]);
    const q = eng.regenerate('race', p);
    expect(q.active.length).toBe(3);
    expect(q.genSeq).toBeGreaterThan(p.genSeq);
    for (const id of old) { expect(q.active).not.toContain(id); expect(q.challenges[id]).toBeDefined(); }
  });
  it('replaces unfinished starters with generated challenges and stays idempotent', () => {
    const q = eng.regenerate('race', fresh());
    expect(q.active.length).toBe(3);
    expect(q.active.every((id) => q.challenges[id].source === 'generated')).toBe(true);
    expect(eng.refreshBoard('race', q)).toEqual(q);
  });
});

describe('admin sandbox', () => {
  it('makes 10 solvable challenges over all tiers without touching the input', () => {
    const p = win(fresh(), 'st-mud', { ...eng.defaultModel('race'), wheels: 'wheels.mud' });
    const json = JSON.stringify(p);
    const s = eng.adminSandbox('race', deepFreeze(JSON.parse(json) as WorkshopProgress), 42, WS_RULES.adminBoardSize);
    const all = new Set(C.variants.map((v) => v.id));
    expect(s.active.length).toBe(10);
    expect(eng.available('race', s).size).toBe(all.size);
    const tiers = s.active.map((id) => s.challenges[id].tier);
    expect(Math.min(...tiers)).toBe(0);
    expect(Math.max(...tiers)).toBe(WS_RULES.maxTier);
    for (const id of s.active) {
      expect(id).toMatch(/^admin-/);
      expect(s.challenges[id].source).toBe('admin');
      expect(solvable(C, flatChecks(s.challenges[id]), all)).toBe(true);
    }
    expect(s.completed).toEqual({});
    expect(JSON.stringify(p)).toBe(json);
    expect(eng.adminSandbox('race', JSON.parse(json) as WorkshopProgress, 42, 10)).toEqual(s);
  });
});

describe('purity', () => {
  it('never mutates deep-frozen inputs across the API', () => {
    let p = deepFreeze(fresh());
    const m = { ...p.model, wheels: 'wheels.mud' };
    p = deepFreeze(eng.setPart('race', p, 'wheels', 'wheels.mud'));
    p = deepFreeze(eng.recordFail('race', p, 'st-mud'));
    p = deepFreeze(eng.recordWin('race', p, 'st-mud', m, 1).progress);
    expect(() => eng.setOverride('race', p, 'engine.big', 'locked')).not.toThrow();
    expect(() => eng.regenerate('race', p)).not.toThrow();
    expect(() => eng.refreshBoard('race', p)).not.toThrow();
    expect(() => eng.adminSandbox('race', p, 1, 5)).not.toThrow();
    expect(() => eng.sanitizeModel('race', p, p.model)).not.toThrow();
    const save = deepFreeze(eng.newPlayerSave('easy'));
    expect(() => eng.progressOf(save, 'race')).not.toThrow();
    expect(() => eng.normalizeSave(deepFreeze(JSON.parse(JSON.stringify(save))))).not.toThrow();
  });
});

describe('saves', () => {
  it('creates a progress with a full board when missing and leaves the save untouched', () => {
    const save = deepFreeze(eng.newPlayerSave('medium'));
    expect(eng.progressOf(save, 'race').active.length).toBe(3);
    expect(save.workshops.race).toBeUndefined();
  });
  it('rejects non-saves and repairs broken ones', () => {
    expect(eng.normalizeSave(null)).toBeNull();
    expect(eng.normalizeSave({ version: 1 })).toBeNull();
    expect(eng.normalizeSave('x')).toBeNull();
    const p = fresh();
    const raw = JSON.parse(JSON.stringify({
      version: 2, reading: 'bogus', lastWorkshop: 'nope',
      workshops: {
        race: {
          ...p,
          model: { ...p.model, wheels: 'wheels.ghost', engine: 'paint.red' },
          bought: ['wheels.racing', 'wheels.racing', 'ghost.part', 'wheels.road', 5], wallet: 3,
          overrides: { 'wheels.mud': 'open', 'ghost.x': 'open', 'engine.big': 'maybe' },
          active: ['st-mud', 'missing', 'st-mud'],
          fails: { 'st-mud': 2, missing: 4 },
          nextStarter: 99, firstWins: -3, genSeq: 'x',
          lastWin: { wheels: 'nope' },
          challenges: { ...p.challenges, junk: { id: 'junk' }, 'race-g7': { ...p.challenges['st-jump'], id: 'race-g7' } },
        },
        dino: 'garbage',
      },
    }));
    const s = eng.normalizeSave(raw)!;
    expect(s.reading).toBe('easy');
    expect(s.lastWorkshop).toBeUndefined();
    expect(s.workshops.dino).toBeUndefined();
    const r = s.workshops.race!;
    expect(r.model.wheels).toBe('wheels.road');
    expect(r.model.engine).toBe('engine.small');
    expect(r.bought).toEqual(['wheels.racing']);
    expect(r.wallet).toBe(3);
    expect(r.overrides).toEqual({ 'wheels.mud': 'open' });
    expect(r.active).toContain('st-mud');
    expect(r.fails).toEqual({ 'st-mud': 2 });
    expect(r.nextStarter).toBe(C.starters.length);
    expect(r.firstWins).toBe(0);
    expect(r.genSeq).toBe(8);
    expect(r.lastWin?.wheels).toBe('wheels.road');
    expect(r.challenges.junk).toBeUndefined();
  });
  it('round-trips a normal save unchanged', () => {
    const start = fresh();
    const model = { ...eng.defaultModel('race'), wheels: 'wheels.mud' };
    const p = win(buyBuild(start, model), 'st-mud', model, 3);
    const save = { ...eng.newPlayerSave('hard'), workshops: { race: p }, lastWorkshop: 'race' as const };
    expect(eng.normalizeSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });
});
