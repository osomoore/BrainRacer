import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings } from './settings';

afterEach(() => vi.unstubAllGlobals());

describe('loadSettings', () => {
  it('loads a saved While Driving style as Stop & Answer', () => {
    const store = { getItem: () => JSON.stringify({ questionStyle: 'drive' }), setItem: () => undefined };
    vi.stubGlobal('localStorage', store);
    expect(loadSettings().questionStyle).toBe('pause');
  });
});
