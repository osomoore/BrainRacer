import { describe, expect, it } from 'vitest';
import type { Requirement, Stage, StageResult } from '../../core/types';
import { facetPlays, orderPlays, planRun, playsUntilGag } from './plan';

const req = (id: string, facet: string, level: number): Requirement => ({ id, facet, level, checks: [], text: { easy: '', medium: '', hard: '' }, hint: { aspect: 'x', text: { easy: '', medium: '', hard: '' } } });
const rocks: Stage = { scenario: 'rocks', view: 'side', params: { 'rocks.tough': 2, 'rocks.clearance': 1, 'rocks.log': 1 }, requirements: [req('s0r0', 'rocks.tough', 2), req('s0r1', 'rocks.clearance', 1), req('s0r2', 'rocks.log', 1)] };
const top: Stage = { scenario: 'turn', view: 'top', params: { 'turn.handling': 1 }, requirements: [req('s1r0', 'turn.handling', 1)] };

describe('planRun', () => {
  const ch = { stages: [rocks, { ...rocks }, top, { ...top }] };
  const res = (end: number) => ({ endStage: end, stages: ch.stages.map((_, i): StageResult => ({ index: i, passed: true, reached: i <= end })) });
  it('plays 0..endStage with transitions by view change', () => {
    const steps = planRun(ch, res(3));
    expect(steps.map((s) => s.transition)).toEqual(['none', 'wipe', 'roll', 'wipe']);
  });
  it('stops at endStage', () => { expect(planRun(ch, res(1))).toHaveLength(2); });
});

describe('facetPlays', () => {
  it('passes everything on a passed stage', () => {
    const p = facetPlays(rocks, { index: 0, passed: true, reached: true }, [{ id: 's0r0', passed: true, reached: true }, { id: 's0r1', passed: true, reached: true }, { id: 's0r2', passed: true, reached: true }]);
    expect(p.every((x) => x.pass && !x.gag)).toBe(true);
  });
  it('the firstFail facet is the gag, the others show as passes', () => {
    const reqs = [{ id: 's0r0', passed: false, reached: true }, { id: 's0r1', passed: false, reached: true }, { id: 's0r2', passed: true, reached: true }];
    const p = facetPlays(rocks, { index: 0, passed: false, reached: true, firstFail: 's0r1' }, reqs);
    expect(p.filter((x) => x.gag).map((x) => x.facet)).toEqual(['rocks.clearance']);
    expect(p.find((x) => x.facet === 'rocks.tough')!.pass).toBe(true);
    expect(p.find((x) => x.facet === 'rocks.clearance')!.pass).toBe(false);
    expect(p.find((x) => x.facet === 'rocks.tough')!.level).toBe(2);
  });
  it('falls back to the first failing facet without firstFail', () => {
    const p = facetPlays(top, { index: 1, passed: false, reached: true }, [{ id: 's1r0', passed: false, reached: true }]);
    expect(p[0].gag).toBe(true);
  });
  it('orders spatially and cuts after the gag', () => {
    const reqs = [{ id: 's0r0', passed: true, reached: true }, { id: 's0r1', passed: true, reached: true }, { id: 's0r2', passed: false, reached: true }];
    const p = orderPlays(facetPlays(rocks, { index: 0, passed: false, reached: true, firstFail: 's0r2' }, reqs), ['rocks.log', 'rocks.clearance', 'rocks.tough']);
    expect(p.map((x) => x.facet)).toEqual(['rocks.log', 'rocks.clearance', 'rocks.tough']);
    expect(playsUntilGag(p).map((x) => x.facet)).toEqual(['rocks.log']);
  });
});
