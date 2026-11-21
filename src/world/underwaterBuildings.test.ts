import { describe, expect, it } from 'vitest';
import { generateUnderwater } from './gen/underwater';
import { underwaterBuildingFootprints, underwaterBuildingKind } from './underwaterBuildings';

describe('underwater building footprints', () => {
  const { buildings } = generateUnderwater(3);

  it('keeps every painted module within its assigned lot', () => {
    for (const lot of buildings) {
      const footprint = underwaterBuildingFootprints(lot);
      expect(footprint.length).toBeGreaterThan(1);
      for (const { x, y, w, h, radius } of footprint) {
        expect(Math.abs(x) + w / 2).toBeLessThan(.5);
        expect(Math.abs(y) + h / 2).toBeLessThan(.5);
        expect(radius).toBeGreaterThan(0);
        expect(radius).toBeLessThan(.5);
      }
    }
  });

  it('leaves an open center aisle between the park gardens', () => {
    const gardens = buildings.filter(lot => underwaterBuildingKind(lot) === 'park');
    expect(gardens).toHaveLength(2);
    for (const lot of gardens) {
      const [left, right] = underwaterBuildingFootprints(lot);
      expect(left.x + left.w / 2).toBeLessThan(-.08);
      expect(right.x - right.w / 2).toBeGreaterThan(.08);
    }
  });
});
