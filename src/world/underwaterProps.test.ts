import { describe, expect, it } from 'vitest';
import { Tile } from '../core/types';
import { generateUnderwater } from './gen/underwater';
import { underwaterPropPositions } from './underwaterProps';

describe('underwater loose props', () => {
  it('places seeded, varied objects on plazas away from destinations and spawns', () => {
    const world = generateUnderwater(3);
    const props = underwaterPropPositions(world);
    expect(props).toEqual(underwaterPropPositions(generateUnderwater(3)));
    expect(props.length).toBeGreaterThan(5);
    expect(new Set(props.map(p => p.kind)).size).toBe(3);
    for (const p of props) {
      expect(world.tiles[Math.floor(p.y / world.tileSize) * world.widthTiles + Math.floor(p.x / world.tileSize)]).toBe(Tile.Plaza);
      for (const target of [...world.places.map(place => place.front), ...world.playerSpawns, ...world.ramps]) {
        expect(Math.hypot(p.x - target.x, p.y - target.y)).toBeGreaterThanOrEqual(world.tileSize * 1.5);
      }
    }
  });
});
