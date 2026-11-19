import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type WorldData } from '../../core/types';
import { CITY_PLACE_WORDS } from '../../data/places';
import { largestScc, toAscii } from './analysis';
import { cityGen } from './index';

const SEEDS = [1, 2, 3, 7, 42, 99, 1234, 99999];
const worlds = new Map<number, WorldData>(SEEDS.map((s) => [s, cityGen(s)]));
const each = (fn: (w: WorldData, seed: number) => void) => () => { for (const [s, w] of worlds) fn(w, s); };

const tileAt = (w: WorldData, px: number, py: number) => {
  const tx = Math.floor(px / w.tileSize), ty = Math.floor(py / w.tileSize);
  return tx < 0 || ty < 0 || tx >= w.widthTiles || ty >= w.heightTiles ? -1 : w.tiles[ty * w.widthTiles + tx];
};

describe('cityGen', () => {
  it('is deterministic and seed dependent', () => {
    const a = cityGen(5), b = cityGen(5), c = cityGen(6);
    expect(JSON.stringify(a, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v)))
      .toBe(JSON.stringify(b, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v)));
    expect(Buffer.from(a.tiles).equals(Buffer.from(c.tiles))).toBe(false);
  });

  it('has the right size and a water border', each((w) => {
    expect(w.widthTiles).toBe(WORLD.widthTiles);
    expect(w.tileSize).toBe(TILE_SIZE);
    expect(w.tiles.length).toBe(w.widthTiles * w.heightTiles);
    for (let y = 0; y < w.heightTiles; y++) for (let x = 0; x < w.widthTiles; x++) {
      const edge = Math.min(x, y, w.widthTiles - 1 - x, w.heightTiles - 1 - y);
      if (edge < WORLD.waterBorderTiles) expect(w.tiles[y * w.widthTiles + x]).toBe(Tile.Water);
    }
  }));

  it('has a connected road network and correct masks', each((w) => {
    const W = w.widthTiles;
    const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < w.heightTiles && w.tiles[y * W + x] === Tile.Road;
    let start = -1, total = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === Tile.Road) { total++; if (start < 0) start = i; }
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const t = stack.pop()!;
      const x = t % W, y = (t / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (y + dy) * W + x + dx;
        if (isRoad(x + dx, y + dy) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    expect(seen.size).toBe(total);
    for (let y = 0; y < w.heightTiles; y++) for (let x = 0; x < W; x++) {
      const expected = isRoad(x, y)
        ? (isRoad(x, y - 1) ? ROAD_N : 0) | (isRoad(x + 1, y) ? ROAD_E : 0) | (isRoad(x, y + 1) ? ROAD_S : 0) | (isRoad(x - 1, y) ? ROAD_W : 0)
        : 0;
      expect(w.roadMask[y * W + x]).toBe(expected);
    }
  }));

  it('keeps buildings dominant and has parks and plazas', () => {
    let parks = 0;
    for (const [, w] of worlds) {
      const count = (t: Tile) => w.tiles.reduce((n, v) => n + (v === t ? 1 : 0), 0);
      const b = count(Tile.Building), p = count(Tile.Park), z = count(Tile.Plaza);
      expect(b / (b + p + z)).toBeGreaterThanOrEqual(0.55);
      parks += p;
      for (const lot of w.buildings) {
        expect(lot.tw).toBeGreaterThanOrEqual(1); expect(lot.tw).toBeLessThanOrEqual(3);
        expect(lot.th).toBeGreaterThanOrEqual(1); expect(lot.th).toBeLessThanOrEqual(3);
        for (let y = lot.ty; y < lot.ty + lot.th; y++) for (let x = lot.tx; x < lot.tx + lot.tw; x++) expect(w.tiles[y * w.widthTiles + x]).toBe(Tile.Building);
      }
    }
    expect(parks).toBeGreaterThan(0);
  });

  it('places every word with a front on a road', each((w) => {
    for (const word of CITY_PLACE_WORDS) {
      const site = w.places.find((p) => p.word === word);
      expect(site, word).toBeDefined();
      const lot = w.buildings[site!.buildingId];
      expect(lot.placeWord).toBe(word);
      expect(tileAt(w, site!.front.x, site!.front.y)).toBe(Tile.Road);
      expect(tileAt(w, site!.sign.x, site!.sign.y)).toBe(Tile.Building);
    }
  }));

  it('puts ramps on straight runs, spaced apart', each((w) => {
    expect(w.ramps.length).toBe(WORLD.rampCount);
    const W = w.widthTiles;
    for (const r of w.ramps) {
      const tx = Math.floor(r.x / TILE_SIZE), ty = Math.floor(r.y / TILE_SIZE);
      const m = w.roadMask[ty * W + tx];
      const horiz = m === (ROAD_E | ROAD_W);
      expect(horiz || m === (ROAD_N | ROAD_S)).toBe(true);
      for (const k of [-2, -1, 1, 2]) {
        expect(w.roadMask[(horiz ? ty : ty + k) * W + (horiz ? tx + k : tx)]).toBe(m);
      }
      expect(Math.abs(Math.cos(r.angle)) > 0.99).toBe(horiz);
    }
    for (let i = 0; i < w.ramps.length; i++) for (let j = i + 1; j < w.ramps.length; j++) {
      expect(Math.hypot(w.ramps[i].x - w.ramps[j].x, w.ramps[i].y - w.ramps[j].y) / TILE_SIZE).toBeGreaterThanOrEqual(WORLD.rampSpacingTiles);
    }
  }));

  it('has a valid, strongly connected lane graph on road tiles', each((w) => {
    const n = w.laneGraph.nodes.length;
    expect(n).toBeGreaterThan(0);
    w.laneGraph.nodes.forEach((node, i) => {
      expect(node.id).toBe(i);
      expect(node.next.length).toBeGreaterThanOrEqual(1);
      for (const nx of node.next) { expect(nx).toBeGreaterThanOrEqual(0); expect(nx).toBeLessThan(n); }
      expect(tileAt(w, node.x, node.y)).toBe(Tile.Road);
    });
    expect(largestScc(w.laneGraph) / n).toBeGreaterThanOrEqual(0.98);
  }));

  it('uses right-hand lane offsets on straight segments', () => {
    const w = worlds.get(1)!;
    // Any node on a straight horizontal tile centre line: y must be center +/- 32.
    for (const node of w.laneGraph.nodes) {
      const tx = Math.floor(node.x / TILE_SIZE), ty = Math.floor(node.y / TILE_SIZE);
      if (w.roadMask[ty * w.widthTiles + tx] !== (ROAD_E | ROAD_W)) continue;
      const dy = node.y - (ty + 0.5) * TILE_SIZE;
      if (Math.abs(node.x - (tx + 0.5) * TILE_SIZE) < 1) expect(Math.abs(Math.abs(dy) - 32)).toBeLessThan(0.01);
    }
  });

  it('keeps props off roads (except cones) and off buildings', each((w) => {
    expect(w.props.length).toBeGreaterThan(0);
    for (const p of w.props) {
      const t = tileAt(w, p.x, p.y);
      expect(t).not.toBe(Tile.Building);
      expect(t).not.toBe(Tile.Water);
      if (p.kind !== 'cone') expect(t).not.toBe(Tile.Road);
    }
    const kinds = new Set(w.props.map((p) => p.kind));
    for (const k of ['tree', 'lamp', 'cone'] as const) expect(kinds.has(k)).toBe(true);
  }));

  it('spawns two cars on a road near the center, facing along it', each((w) => {
    expect(w.playerSpawns.length).toBeGreaterThanOrEqual(2);
    const [a, b] = w.playerSpawns;
    expect(a.angle).toBe(b.angle);
    for (const s of w.playerSpawns) {
      expect(tileAt(w, s.x, s.y)).toBe(Tile.Road);
      const m = w.roadMask[Math.floor(s.y / TILE_SIZE) * w.widthTiles + Math.floor(s.x / TILE_SIZE)];
      const horiz = Math.abs(Math.cos(s.angle)) > 0.99;
      expect(m).toBe(horiz ? ROAD_E | ROAD_W : ROAD_N | ROAD_S);
      expect(Math.hypot(s.x - (w.widthTiles * TILE_SIZE) / 2, s.y - (w.heightTiles * TILE_SIZE) / 2)).toBeLessThan(10 * TILE_SIZE);
    }
  }));

  it('renders ascii with one char per tile', () => {
    const rows = toAscii(worlds.get(1)!).split('\n');
    expect(rows.length).toBe(WORLD.heightTiles);
    expect(rows.every((r) => r.length === WORLD.widthTiles)).toBe(true);
  });

  it('generates fast', () => {
    cityGen(11);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) cityGen(100 + i);
    expect((performance.now() - t0) / 5).toBeLessThan(200);
  });
});
