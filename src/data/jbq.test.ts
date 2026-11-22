import { describe, expect, it } from 'vitest';
import { buildRows, parseCsv, pointsFor, splitRef } from '../../scripts/jbqData';
import rows from './jbq.json';

type Row = { id: number; points: number; type: string; q: string; a: string; ref?: string; verse?: string };
const data = rows as Row[];

describe('jbq.json', () => {
  it('has ids 1..576, unique, in order', () => {
    expect(data.map((r) => r.id)).toEqual(Array.from({ length: 576 }, (_, i) => i + 1));
  });

  it('puts 10s in 1-288, 20s in 289-480, 30s in 481-576', () => {
    for (const r of data) expect(r.points).toBe(r.id <= 288 ? 10 : r.id <= 480 ? 20 : 30);
    expect(data.filter((r) => r.points === 10)).toHaveLength(288);
    expect(data.filter((r) => r.points === 20)).toHaveLength(192);
    expect(data.filter((r) => r.points === 30)).toHaveLength(96);
  });

  it('gives every quote-type question a reference and verse, and nobody else', () => {
    const quotes = data.filter((r) => r.type === 'quote');
    expect(quotes).toHaveLength(95);
    for (const r of quotes) {
      expect(r.ref, `Q${r.id}`).toMatch(/^(?:[1-3] )?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \d+:\d+(?:[-,]\d+)*$/);
      expect(r.verse && r.verse.length > 5, `Q${r.id}`).toBe(true);
    }
    for (const r of data.filter((x) => x.type !== 'quote')) expect(r.ref).toBeUndefined();
  });

  it('has no leftover split-word junk', () => {
    for (const r of data) expect(`${r.q} ${r.a}`, `Q${r.id}`).not.toMatch(/\b(?:A cts|w ould|mo re|F irst|th at|sh ould|w alls)\b/);
    expect(data.find((r) => r.id === 385)?.ref).toBe('Matthew 7:12');
  });
});

describe('jbqData helpers', () => {
  it('splits references', () => {
    expect(splitRef('Acts 2:4 All of them were filled')).toEqual({ ref: 'Acts 2:4', verse: 'All of them were filled' });
    expect(splitRef('1 John 4:8 Whoever does not love')).toEqual({ ref: '1 John 4:8', verse: 'Whoever does not love' });
    expect(splitRef('John 3:16-17 For God so loved')).toEqual({ ref: 'John 3:16-17', verse: 'For God so loved' });
    expect(splitRef('Psalm 117')).toBeNull();
    expect(splitRef('Old Testament and New Testament')).toBeNull();
  });

  it('parses quoted CSV cells', () => {
    expect(parseCsv('﻿a,"b, ""c""",d\r\n1,2,3\r\n')).toEqual([['a', 'b, "c"', 'd'], ['1', '2', '3']]);
    expect(buildRows('h\r\n289,20,what,"Q?, ok",Job 1:2 text,x,y,z,20pt\r\n')[0]).toMatchObject({ id: 289, points: 20, ref: "Job 1:2" });
    expect(pointsFor(288)).toBe(10);
    expect(pointsFor(481)).toBe(30);
  });
});
