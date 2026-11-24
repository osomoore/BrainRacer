import { describe, expect, it } from 'vitest';
import type { Challenge } from '../../core/types';
import { engine } from '../../logic';
import { buildBlocks, planDetail, wrapLines, type Measure, type TextBlock } from './cardText';

/** 0.55 em per character: close enough to a bold sans font. */
const measure: Measure = (t, size) => t.length * size * 0.55;

const challenge = (reqs: string[][]): Challenge => ({
  id: 'c', workshop: 'race', title: 'T', tier: 0, source: 'generated', seed: 1, genVersion: 1,
  intro: { easy: 'Easy intro.', medium: 'Medium intro.', hard: 'Hard intro.' },
  stages: reqs.map((rs, i) => ({
    scenario: 's', view: 'side', params: {},
    requirements: rs.map((t, k) => ({
      id: `s${i}r${k}`, facet: 'f', level: 1, checks: [],
      text: { easy: `E ${t}`, medium: `M ${t}`, hard: `H ${t}` },
      hint: { aspect: 'wheels', text: { easy: '', medium: '', hard: '' } },
    })),
  })),
});

describe('buildBlocks', () => {
  it('intro first, then every requirement of every stage at the reading level', () => {
    const c = challenge([['a', 'b'], ['c']]);
    expect(buildBlocks(c, 'easy').map((b) => [b.kind, b.text, b.stage])).toEqual([['intro', 'Easy intro.', 0], ['req', 'E a', 0], ['req', 'E b', 0], ['req', 'E c', 1]]);
    expect(buildBlocks(c, 'hard')[1].text).toBe('H a');
  });
  it('real generated challenges change text with the reading level', () => {
    const p = engine.progressOf(engine.newPlayerSave('medium'), 'race');
    const c = p.challenges[p.active[0]];
    const e = buildBlocks(c, 'easy').map((b) => b.text).join('|');
    const h = buildBlocks(c, 'hard').map((b) => b.text).join('|');
    expect(e).not.toBe(h);
  });
});

describe('wrapLines', () => {
  it('wraps at the width and keeps every word', () => {
    const lines = wrapLines('one two three four five six', 120, 20, measure);
    expect(lines.join(' ')).toBe('one two three four five six');
    for (const l of lines) expect(measure(l, 20)).toBeLessThanOrEqual(120);
    expect(lines.length).toBeGreaterThan(1);
  });
  it('a too-long word stays alone; empty text gives one empty line', () => {
    expect(wrapLines('supercalifragilistic a', 50, 20, measure)).toEqual(['supercalifragilistic', 'a']);
    expect(wrapLines('', 100, 20, measure)).toEqual(['']);
  });
});

describe('planDetail', () => {
  const blocks = (n: number): TextBlock[] => Array.from({ length: n }, (_, i) => ({ kind: 'req' as const, text: 'Build a car that can cross the muddy field without any trouble at all', stage: i }));
  const base = { maxW: 1000, indent: 80, boxH: 600, sizes: [52, 48, 44, 40], lineGap: 1.3, blockGap: 20, measure };
  it('uses the largest size that fits on one page', () => {
    const p = planDetail(blocks(1), base);
    expect(p.size).toBe(52);
    expect(p.pages).toHaveLength(1);
    expect(p.overflow).toBe(false);
  });
  it('shrinks, then paginates at the smallest size without cutting blocks', () => {
    const p = planDetail(blocks(10), base);
    expect(p.size).toBe(40);
    expect(p.pages.length).toBeGreaterThan(1);
    expect(p.pages.flat()).toHaveLength(10);
    for (const page of p.pages) {
      const last = page[page.length - 1];
      expect(last.y + last.h).toBeLessThanOrEqual(base.boxH);
    }
  });
  it('a six-requirement hard challenge fits a wide panel in one or two pages', () => {
    const c = challenge([
      ['Equip your vehicle with enough traction to cross slippery, muddy ground.', 'Design a machine fast enough to leap across the gap.'],
      ['Prepare a vehicle that can climb a steep hill.', 'Make it bright enough to be seen through the fog.'],
      ['Add some springs to bounce.', 'Be tough enough to bump gently.'],
    ]);
    const p = planDetail(buildBlocks(c, 'hard'), { ...base, maxW: 1170, boxH: 560 });
    expect(p.size).toBeGreaterThanOrEqual(40);
    expect(p.pages.length).toBeLessThanOrEqual(2);
  });
});
