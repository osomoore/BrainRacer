import { describe, expect, it } from 'vitest';
import { appendName, buildLetterKeys, checkName, deleteName, titleCaseName } from './letterGrid';

describe('buildLetterKeys', () => {
  it('lays out A-Z in rows then Space / Delete / Done', () => {
    const keys = buildLetterKeys(7);
    expect(keys.filter((k) => k.kind === 'letter')).toHaveLength(26);
    expect(keys[0]).toMatchObject({ label: 'A', row: 0, col: 0 });
    expect(keys.find((k) => k.label === 'Z')).toMatchObject({ row: 3, col: 4 });
    const bottom = keys.filter((k) => k.row === 4);
    expect(bottom.map((k) => k.kind)).toEqual(['space', 'delete', 'done']);
    expect(bottom.reduce((n, k) => n + k.span, 0)).toBe(7);
  });
  it('works with 13 columns (wide pane)', () => {
    const keys = buildLetterKeys(13);
    expect(keys.filter((k) => k.kind === 'letter' && k.row === 1)).toHaveLength(13);
    expect(keys.filter((k) => k.row === 2).reduce((n, k) => n + k.span, 0)).toBe(13);
  });
});

describe('name editing', () => {
  it('caps at 10, refuses leading / double spaces and non letters', () => {
    expect(appendName('', ' ')).toBe('');
    expect(appendName('Al', ' ')).toBe('Al ');
    expect(appendName('Al ', ' ')).toBe('Al ');
    expect(appendName('Al', '3')).toBe('Al');
    expect(appendName('ABCDEFGHIJ', 'K')).toBe('ABCDEFGHIJ');
    expect(deleteName('Zoe')).toBe('Zo');
  });
  it('title-cases', () => {
    expect(titleCaseName('ZOE')).toBe('Zoe');
    expect(titleCaseName('mary ann')).toBe('Mary Ann');
  });
  it('refuses empty and duplicate names (case-insensitive)', () => {
    expect(checkName('  ', [])).toEqual({ ok: false, reason: 'empty' });
    expect(checkName('ZOE', ['Robin'])).toEqual({ ok: true, name: 'Zoe' });
    expect(checkName('robin', ['Robin'])).toEqual({ ok: false, reason: 'taken' });
  });
});
