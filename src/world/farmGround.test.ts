import { describe, expect, it } from 'vitest';
import { FARM_TILE } from '../art/farmTiles';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile } from '../core/types';
import { FARM_LANE_BASE, FARM_TILESET_COUNT, centerSides, farmTileIndices } from './farmGround';
import { generateFarm } from './gen/farm';

const CORN = new Set<number>([FARM_TILE.corn, FARM_TILE.cornVertical, FARM_TILE.cornRipe]);

describe('farm ground mapping', () => {
  it('puts the shared center line only on the inner edge of a straight 2-tile strip', () => {
    // top tile of a west-east strip: neighbours E, W and the strip's other half to the S
    expect(centerSides(ROAD_E | ROAD_W | ROAD_S)).toEqual([false, false, true, false]);
    expect(centerSides(ROAD_N | ROAD_S | ROAD_E)).toEqual([false, true, false, false]);
    // junction / corner tiles carry no center line
    expect(centerSides(ROAD_N | ROAD_E | ROAD_S | ROAD_W)).toEqual([false, false, false, false]);
    expect(centerSides(ROAD_E | ROAD_S)).toEqual([false, false, false, false]);
  });

  for (const seed of [3, 7, 11]) {
    it(`maps every tile of seed ${seed} to a fitting atlas cell`, () => {
      const world = generateFarm(seed);
      const idx = farmTileIndices(world);
      expect(idx).toHaveLength(world.tiles.length);
      let lanes = 0, banks = 0;
      const cornKinds = new Set<number>();
      for (let i = 0; i < idx.length; i++) {
        const t = world.tiles[i], k = idx[i], mask = world.roadMask[i];
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(FARM_TILESET_COUNT);
        if (t === Tile.Road) expect(k).toBe(FARM_TILE.roadBase + mask);
        if (t === Tile.Dirt) expect(k).toBe(mask ? FARM_LANE_BASE + mask : FARM_TILE.yard);
        if (t === Tile.Dirt && mask) lanes++;
        if (t === Tile.Mud) expect(k).toBe(FARM_TILE.mud);
        if (t === Tile.Corn) { expect(CORN.has(k)).toBe(true); cornKinds.add(k); }
        if (t === Tile.Water) {
          expect(k === FARM_TILE.water || (k > FARM_TILE.waterBankBase && k < FARM_TILE.waterBankBase + 16)).toBe(true);
          if (k !== FARM_TILE.water) banks++;
        }
      }
      expect(lanes).toBeGreaterThan(0);
      expect(banks).toBeGreaterThan(0);
      // the corn maze's walls run both ways
      expect(cornKinds.has(FARM_TILE.corn) || cornKinds.has(FARM_TILE.cornRipe)).toBe(true);
      expect(cornKinds.has(FARM_TILE.cornVertical)).toBe(true);
      // deterministic
      expect(farmTileIndices(generateFarm(seed))).toEqual(idx);
    });
  }
});
