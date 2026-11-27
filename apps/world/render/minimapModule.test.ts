import { describe, expect, it } from 'vitest';
import { fixedScreenPoint, minimapPosition, revealHexes } from './minimapModule';

describe('minimap reveal and layout', () => {
  it('reveals the visited hex and its six neighbors, retaining earlier discoveries', () => {
    const previous = new Set(['8,-2']);
    const result = revealHexes(previous, { q: 0, r: 0 });
    expect(result).toEqual(new Set(['8,-2', '0,0', '1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1']));
    expect(previous).toEqual(new Set(['8,-2']));
    expect(revealHexes(result, { q: 1, r: 0 })).toContain('2,0');
    expect(revealHexes(result, { q: 1, r: 0 })).toContain('8,-2');
  });

  it('lays axial hexes out north-up, centered, with equal neighbor spacing', () => {
    const center = { q: 4, r: -3 };
    expect(minimapPosition(center, center)).toEqual({ x: 0, y: 0 });
    const east = minimapPosition({ q: 5, r: -3 }, center, 10);
    const southeast = minimapPosition({ q: 4, r: -2 }, center, 10);
    expect(east.x).toBeCloseTo(Math.sqrt(3) * 10);
    expect(east.y).toBe(0);
    expect(southeast.x).toBeCloseTo(Math.sqrt(3) * 5);
    expect(southeast.y).toBe(15);
    expect(Math.hypot(east.x, east.y)).toBeCloseTo(Math.sqrt(3) * 10);
    expect(Math.hypot(southeast.x, southeast.y)).toBeCloseTo(Math.sqrt(3) * 10);
  });

  it('keeps a screen point fixed through camera rotation and zoom', () => {
    const viewport = { x: 960, y: 0, width: 960, height: 1080 };
    const point = { x: 910, y: 110 };
    for (const [zoom, rotation] of [[0.7, 0.8], [1.4, -1.2]] as const) {
      const world = fixedScreenPoint(point, viewport, zoom, rotation);
      const dx = (world.x - 480) * zoom, dy = (world.y - 540) * zoom;
      const screen = { x: 960 + 480 + dx * Math.cos(rotation) - dy * Math.sin(rotation),
        y: 540 + dx * Math.sin(rotation) + dy * Math.cos(rotation) };
      expect(screen.x).toBeCloseTo(960 + point.x);
      expect(screen.y).toBeCloseTo(point.y);
    }
  });
});
