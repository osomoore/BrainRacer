import { describe, expect, it } from 'vitest';
import { checkName, titleCaseName } from './profileName';

describe('Workshop profile names', () => {
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
