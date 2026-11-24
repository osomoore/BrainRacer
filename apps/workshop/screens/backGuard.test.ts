import { describe, expect, it } from 'vitest';
import { guardBackAfterPreview, isBackGuarded } from './backGuard';

describe('preview Back guard', () => {
  it('blocks Back for 500 ms after leaving a preview', () => {
    const pane = {};
    guardBackAfterPreview(pane, 1000);
    expect(isBackGuarded(pane, 1000)).toBe(true);
    expect(isBackGuarded(pane, 1499)).toBe(true);
    expect(isBackGuarded(pane, 1500)).toBe(false);
  });

  it('keeps the later deadline when a preview is left again before expiry', () => {
    const pane = {};
    guardBackAfterPreview(pane, 1000);
    guardBackAfterPreview(pane, 1200);
    expect(isBackGuarded(pane, 1600)).toBe(true);
    expect(isBackGuarded(pane, 1700)).toBe(false);
  });

  it('keeps panes independent', () => {
    const first = {}, second = {};
    guardBackAfterPreview(first, 1000);
    expect(isBackGuarded(second, 1000)).toBe(false);
  });
});
