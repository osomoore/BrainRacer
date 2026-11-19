/**
 * Farm ground mapping (Phaser-free): WorldData tiles -> farm atlas indices. The atlas is the art's
 * `farmTileSource` cells (src/art/farmTiles.ts) with the road cells redrawn as 2-tile country-road
 * halves, plus 16 two-track dirt-lane cells (one per road mask) appended by farmWorld.ts.
 */
import { FARM_TILE, FARM_TILE_COUNT } from '../art/farmTiles';
import { FARM_LOOK } from '../config/gameConfig';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type WorldData } from '../core/types';

/** Extra atlas cells after the art's 44: two-track dirt lanes by road mask. */
export const FARM_LANE_BASE = FARM_TILE_COUNT;
export const FARM_TILESET_COUNT = FARM_LANE_BASE + 16;

export const SIDES = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];

/** Which strip edges carry the shared center line (a 2-tile strip runs straight along one axis). */
export function centerSides(mask: number): boolean[] {
  const horiz = (mask & (ROAD_E | ROAD_W)) === (ROAD_E | ROAD_W);
  const vert = (mask & (ROAD_N | ROAD_S)) === (ROAD_N | ROAD_S);
  return SIDES.map((edge) => {
    if (!(mask & edge)) return false;
    const ns = edge === ROAD_N || edge === ROAD_S;
    return ns ? horiz && !vert : vert && !horiz;
  });
}

function hashPos(x: number, y: number): number {
  return (Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)) >>> 0;
}

/** Atlas index for every tile of a farm world (row-major). */
export function farmTileIndices(world: WorldData): number[] {
  const { widthTiles: W, heightTiles: Hh, tiles, roadMask } = world;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= Hh ? -1 : tiles[y * W + x]);
  const corn = cornTiles(world);
  const out: number[] = new Array(W * Hh);
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const grass = () => { const h = hashPos(x, y) % 7; return h < 4 ? FARM_TILE.grass : h < 6 ? FARM_TILE.grass2 : FARM_TILE.grass3; };
      switch (tiles[i] as Tile) {
        case Tile.Water: {
          let land = 0;
          [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], s) => {
            const t = at(x + dx, y + dy);
            if (t !== -1 && t !== Tile.Water) land |= 1 << s;
          });
          out[i] = land ? FARM_TILE.waterBankBase + land : FARM_TILE.water;
          break;
        }
        case Tile.Road: out[i] = FARM_TILE.roadBase + (roadMask[i] & 15); break;
        case Tile.Dirt: out[i] = roadMask[i] ? FARM_LANE_BASE + (roadMask[i] & 15) : FARM_TILE.yard; break;
        case Tile.Mud: out[i] = FARM_TILE.mud; break;
        case Tile.Corn: out[i] = corn.get(i) ?? FARM_TILE.corn; break;
        case Tile.Building: {
          // Lots inside farmyards stand on gravel, the rest on grass.
          const yard = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => at(x + dx, y + dy) === Tile.Dirt && !roadMask[(y + dy) * W + x + dx]);
          out[i] = yard ? FARM_TILE.yard : grass();
          break;
        }
        default: out[i] = grass();
      }
    }
  }
  return out;
}

/**
 * Corn row direction per tile: each field's rows follow its long side; thin maze walls follow
 * the wall. Every `ripeEvery`-th plain field (no mown paths inside) is ripe gold.
 */
function cornTiles(world: WorldData): Map<number, number> {
  const { widthTiles: W, heightTiles: Hh, tiles } = world;
  const isCorn = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hh && tiles[y * W + x] === Tile.Corn;
  const comp = new Int32Array(W * Hh).fill(-1);
  const out = new Map<number, number>();
  let fields = 0;
  for (let start = 0; start < W * Hh; start++) {
    if (tiles[start] !== Tile.Corn || comp[start] >= 0) continue;
    const id = fields++;
    const members: number[] = [];
    const stack = [start];
    comp[start] = id;
    let x0 = W, x1 = 0, y0 = Hh, y1 = 0;
    while (stack.length) {
      const k = stack.pop()!;
      members.push(k);
      const x = k % W, y = (k / W) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (isCorn(nx, ny) && comp[ny * W + nx] < 0) { comp[ny * W + nx] = id; stack.push(ny * W + nx); }
      }
    }
    const holes = (x1 - x0 + 1) * (y1 - y0 + 1) - members.length;
    const maze = holes > members.length * 0.15;
    const alongX = x1 - x0 >= y1 - y0;
    const ripe = !maze && id % FARM_LOOK.ripeEvery === 1;
    for (const k of members) {
      const x = k % W, y = (k / W) | 0;
      const hrun = (isCorn(x - 1, y) ? 1 : 0) + (isCorn(x + 1, y) ? 1 : 0);
      const vrun = (isCorn(x, y - 1) ? 1 : 0) + (isCorn(x, y + 1) ? 1 : 0);
      let rowsX = alongX;
      if (rowsX && hrun === 0 && vrun > 0) rowsX = false;
      else if (!rowsX && vrun === 0 && hrun > 0) rowsX = true;
      out.set(k, ripe && rowsX ? FARM_TILE.cornRipe : rowsX ? FARM_TILE.corn : FARM_TILE.cornVertical);
    }
  }
  return out;
}
