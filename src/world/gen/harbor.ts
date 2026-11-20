import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type PlaceSite, type WorldData } from '../../core/types';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

/** Fixed connected waterfront plan; seeded details keep races repeatable. */
export function generateHarbor(seed: number): WorldData {
  const rng = new Rng(seed), w = WORLD.widthTiles, h = WORLD.heightTiles, ts = TILE_SIZE;
  const g: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const skeleton: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const fill = (x: number, y: number, width: number, height: number, t: Tile) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) g.tiles[yy * w + xx] = t;
  };
  fill(2, 2, w - 4, h - 4, Tile.Grass);
  // A navigable north-south channel separates the mainland and island.
  fill(21, 0, 6, h, Tile.Water);
  // Sandy beach on the eastern shore, with open drivable sand.
  fill(27, 7, 15, 34, Tile.Dirt);
  const road = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      skeleton.tiles[y * w + x] = Tile.Road;
      fill(x, y, 2, 2, Tile.Road);
    }
  };
  // Three crossings with a complete bypass loop on either shore.
  for (const y of [8, 20, 37]) road(5, y, 40, y);
  for (const x of [5, 17, 30, 40]) road(x, 8, x, 37);
  // Preserve the channel between the bridges.
  for (let y = 0; y < h; y++) if (![8, 9, 20, 21, 37, 38].includes(y)) fill(21, y, 6, 1, Tile.Water);
  computeRoadMask(g);
  const laneGraph = generateLaneGraph(skeleton);
  for (const n of laneGraph.nodes) { n.x += ts / 2; n.y += ts / 2; }
  const buildings: BuildingLot[] = [], places: PlaceSite[] = [];
  const lots: [number, number, string][] = [
    [7, 11, 'shop'], [11, 11, 'bakery'], [15, 11, 'school'],
    [7, 23, 'house'], [11, 23, 'restaurant'], [15, 23, 'library'], [32, 11, 'park'], [36, 23, 'tower'],
  ];
  for (const [x, y, word] of lots) {
    const id = buildings.length;
    buildings.push({ id, tx: x, ty: y, tw: 2, th: 2, style: rng.int(0, 5), placeWord: word });
    fill(x, y, 2, 2, Tile.Building);
    places.push({ word, buildingId: id, sign: { x: (x + 1) * ts, y: (y + 1) * ts }, front: { x: (x + 1) * ts, y: (y - 2) * ts } });
  }
  return { seed, widthTiles: w, heightTiles: h, tileSize: ts, tiles: g.tiles, roadMask: g.mask,
    buildings, places, ramps: [], props: [], laneGraph,
    playerSpawns: [{ x: 28.8 * ts, y: 8.7 * ts, angle: 0 }, { x: 27.8 * ts, y: 9.35 * ts, angle: 0 }] };
}
