import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DINO_SCENARIOS } from '../../../content/dino/scenarios';
import type { Requirement } from '../../../core/types';
import './art';
import { hasDef } from './paint';
import {
  birdCount, byLevel, canyonGap, chaseSpeed, failedFacet, failedFacets, facetLevel, fernDensity, fruitHeight, grassHeight,
  holeFraction, iceWall, ledgeHeight, logSize, nutSize, riverSize, rockWall, snackCritter, snowFlakes, stageFacets,
} from './layout';

const req = (id: string, facet: string, level: number): Requirement => ({
  id, facet, level, checks: [], text: { easy: '', medium: '', hard: '' }, hint: { aspect: 'x', text: { easy: '', medium: '', hard: '' } },
});

describe('stage helpers', () => {
  const stage = { params: { 'ferns.hide': 2, 'ferns.flowers': 1 }, requirements: [req('s0r0', 'ferns.hide', 3), req('s0r1', 'ferns.flowers', 1)] };
  it('lists facets once, requirements first', () => {
    expect(stageFacets(stage)).toEqual(['ferns.hide', 'ferns.flowers']);
    expect(stageFacets({ params: { 'a.b': 1 }, requirements: [] })).toEqual(['a.b']);
  });
  it('requirement level wins over params, default when absent', () => {
    expect(facetLevel(stage, 'ferns.hide')).toBe(3);
    expect(facetLevel({ params: { 'x.y': 2 }, requirements: [] }, 'x.y')).toBe(2);
    expect(facetLevel(stage, 'nope.nope', 7)).toBe(7);
  });
  it('maps the first failing requirement to its facet', () => {
    expect(failedFacet(stage, { passed: false, firstFail: 's0r1' })).toBe('ferns.flowers');
    expect(failedFacet(stage, { passed: true })).toBeUndefined();
    expect(failedFacet(stage, { passed: false, firstFail: 'zzz' })).toBeUndefined();
    expect(failedFacets(stage, [{ id: 's0r0', passed: false }, { id: 's0r1', passed: true }])).toEqual(['ferns.hide']);
  });
});

describe('level sizing', () => {
  const lv = [1, 2, 3];
  it('byLevel clamps to the table', () => {
    expect(byLevel(0, ['a', 'b'])).toBe('a');
    expect(byLevel(9, ['a', 'b'])).toBe('b');
    expect(byLevel(1.6, ['a', 'b', 'c'])).toBe('b');
  });
  it('failing builds always look harder than passing ones at the same level', () => {
    for (const l of lv) {
      expect(ledgeHeight(l, false)).toBeGreaterThan(ledgeHeight(l, true));
      expect(fruitHeight(l, false)).toBeGreaterThan(fruitHeight(l, true));
      expect(grassHeight(l, false)).toBeGreaterThan(grassHeight(l, true));
    }
    for (const l of [1, 2]) expect(holeFraction(l, false)).toBeLessThan(holeFraction(l, true));
  });
  it('higher level means harder', () => {
    const up = (f: (l: number) => number): void => { expect(f(2)).toBeGreaterThanOrEqual(f(1)); expect(f(3)).toBeGreaterThanOrEqual(f(2)); };
    up((l) => ledgeHeight(l, true)); up((l) => ledgeHeight(l, false)); up((l) => fruitHeight(l, true));
    up((l) => grassHeight(l, true)); up(chaseSpeed); up(birdCount); up(nutSize); up((l) => rockWall(l).height);
    up((l) => riverSize(l).width); up((l) => riverSize(l).wave); up((l) => canyonGap(l).gap); up((l) => logSize(l).thick);
    up((l) => fernDensity(l).leaves * -1); up((l) => fernDensity(l).clumps * -1);
    expect(snowFlakes(2)).toBeGreaterThan(snowFlakes(1));
    expect(iceWall(2)).toBeGreaterThan(iceWall(1));
    expect(holeFraction(2, true)).toBeLessThan(holeFraction(1, true));
  });
  it('snack critters grow with level and the big gulp is a bigger beetle', () => {
    expect(snackCritter(1, false).kind).toBe('beetle');
    expect(snackCritter(3, false).kind).toBe('lizard');
    expect(snackCritter(1, true).kind).toBe('beetle');
    expect(snackCritter(1, true).scale).toBeGreaterThan(snackCritter(1, false).scale);
  });
});

describe('scenario players', () => {
  const dir = fileURLToPath(new URL('..', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  it('every Dino Lab scenario has a player file', () => {
    for (const s of DINO_SCENARIOS) expect(files, s.id).toContain(`${s.id}.ts`);
  });
  it('player files only reference baked pictures that exist', () => {
    for (const f of files) {
      const src = readFileSync(`${dir}${f}`, 'utf8');
      for (const m of src.matchAll(/(?:a\.img|image)\(\s*(?:a\.scene,\s*)?'([^']+)'/g)) expect(hasDef(m[1]), `${f}: ${m[1]}`).toBe(true);
    }
  });
});
