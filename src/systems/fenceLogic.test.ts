import { describe, expect, it } from 'vitest';
import { fenceOffscreen, hitsFence } from './fenceLogic';

describe('farm fences', () => {
  it('detects fast crossings and nearby hits without hitting distant sections', () => {
    const a = { x: -100, y: 0 }, b = { x: 100, y: 0 };
    expect(hitsFence(a, b, { x: 0, y: -30 }, { x: 0, y: 30 }, 5)).toBe(true);
    expect(hitsFence(a, b, { x: 110, y: 0 }, { x: 150, y: 0 }, 10)).toBe(true);
    expect(hitsFence(a, b, { x: 0, y: 40 }, { x: 0, y: 80 }, 5)).toBe(false);
  });
  it('restores only when the whole affected area is outside every view', () => {
    const views = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 500, y: 0, w: 100, h: 100 }];
    expect(fenceOffscreen(490, 50, 20, views, 0)).toBe(false);
    expect(fenceOffscreen(300, 50, 20, views, 0)).toBe(true);
  });
});
