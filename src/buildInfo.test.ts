import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBuildTime } from './buildInfo';

describe('formatBuildTime', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('formats the timestamp in an injected zone', () => {
    expect(formatBuildTime('2026-11-25T10:12:00.000Z', 'America/Los_Angeles'))
      .toBe('Nov 25, 2:12 AM PST');
  });

  it('falls back from an invalid zone to Chicago', () => {
    expect(formatBuildTime('2026-11-25T10:12:00.000Z', 'not/a-zone'))
      .toBe('Nov 25, 4:12 AM CST');
    expect(formatBuildTime('2026-07-25T10:12:00.000Z', 'not/a-zone'))
      .toBe('Jul 25, 5:12 AM CDT');
  });

  it('returns an empty string for invalid timestamps', () => {
    expect(formatBuildTime('not-a-date', 'UTC')).toBe('');
  });

  it('uses a UTC label when Intl is unavailable', () => {
    vi.stubGlobal('Intl', undefined);
    expect(formatBuildTime('2026-11-25T10:12:00.000Z')).toBe('Nov 25, 10:12 AM UTC');
  });
});
