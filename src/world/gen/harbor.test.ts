import { describe, expect, it } from 'vitest';
import { Tile } from '../../core/types';
import { signSceneFor } from '../../data/places';
import { largestScc } from './analysis';
import { generateHarbor } from './harbor';

describe('harbor layout', () => {
  it('is deterministic and has a connected traffic network', () => {
    const world = generateHarbor(17);
    expect(generateHarbor(17)).toEqual(world);
    expect(world.laneGraph.nodes.length).toBeGreaterThan(500);
    expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    for (const place of world.places) expect(signSceneFor(place.word)).toBeTruthy();
  });
  it('keeps three separated crossings and dry goal approaches', () => {
    const world = generateHarbor(5), at = (x: number, y: number) => world.tiles[y * world.widthTiles + x];
    for (const y of [8, 20, 37]) expect(at(24, y)).toBe(Tile.Road);
    for (const y of [14, 28]) expect(at(24, y)).toBe(Tile.Water);
    // Closing the central drawbridge still leaves both shores connected by the other spans.
    const queue = [[8, 20]], seen = new Set(['8,20']);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= world.widthTiles || ny >= world.heightTiles || seen.has(key)) continue;
        if (nx >= 21 && nx <= 26 && ny >= 20 && ny <= 21) continue;
        if (at(nx, ny) !== Tile.Road) continue;
        seen.add(key); queue.push([nx, ny]);
      }
    }
    expect(seen.has('40,20')).toBe(true);
    for (const p of world.places) expect(at(Math.floor(p.front.x / world.tileSize), Math.floor(p.front.y / world.tileSize))).toBe(Tile.Road);
  });
});
