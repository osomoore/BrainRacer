import { describe, expect, it } from 'vitest';
import { FARM_GEN, GOALS, WORLD } from '../../config/gameConfig';
import { Tile, type FarmFence, type Vec2, type WorldData } from '../../core/types';
import { FARM_PLACE_WORDS, signSceneFor } from '../../data/places';
import { largestScc, toAscii } from './analysis';
import { DIRS } from './grid';
import { generateFarm } from './farm';

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);
const worlds = new Map(SEEDS.map((s) => [s, generateFarm(s)]));

const tileOf = (w: WorldData, p: Vec2) => Math.floor(p.y / w.tileSize) * w.widthTiles + Math.floor(p.x / w.tileSize);
const tileAtPx = (w: WorldData, x: number, y: number) => {
  const tx = Math.floor(x / w.tileSize), ty = Math.floor(y / w.tileSize);
  return tx < 0 || ty < 0 || tx >= w.widthTiles || ty >= w.heightTiles ? -1 : w.tiles[ty * w.widthTiles + tx];
};
/** Road or lane strip tile (paved, dirt lane, lane mud, bridge deck). */
const isLane = (w: WorldData, i: number) => w.roadMask[i] !== 0;
/** Ground a car can drive on in the farm (corn and mud included). */
const FARM_DRIVABLE = new Set<number>([Tile.Road, Tile.Grass, Tile.Dirt, Tile.Plaza, Tile.Sidewalk, Tile.Park, Tile.Corn, Tile.Mud]);

function laneReach(w: WorldData, from: number): Set<number> {
  const seen = new Set([from]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const x = queue[q] % w.widthTiles, y = Math.floor(queue[q] / w.widthTiles);
    for (const { dx, dy } of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w.widthTiles || ny >= w.heightTiles) continue;
      const n = ny * w.widthTiles + nx;
      if (!seen.has(n) && isLane(w, n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

function distToFence(p: Vec2, f: FarmFence): number {
  const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y;
  const t = Math.max(0, Math.min(1, ((p.x - f.a.x) * dx + (p.y - f.a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - f.a.x - t * dx, p.y - f.a.y - t * dy);
}

describe('generateFarm', () => {
  it('is deterministic per seed and varies with the seed', () => {
    expect(generateFarm(7)).toEqual(generateFarm(7));
    expect(generateFarm(7).tiles).not.toEqual(generateFarm(8).tiles);
    const w = worlds.get(1)!;
    expect(w.widthTiles).toBe(WORLD.widthTiles);
    expect(w.heightTiles).toBe(WORLD.heightTiles);
    expect(toAscii(w).split('\n')).toHaveLength(w.heightTiles);
  });

  it('has a strongly connected lane graph covering the paved loop and the dirt lanes', () => {
    for (const w of worlds.values()) {
      const { nodes } = w.laneGraph;
      expect(nodes.length).toBeGreaterThan(500);
      expect(largestScc(w.laneGraph)).toBe(nodes.length);
      const nodeTiles = new Set(nodes.map((n) => tileOf(w, n)));
      for (const t of nodeTiles) expect(isLane(w, t)).toBe(true);
      let dirt = 0;
      for (let i = 0; i < w.tiles.length; i++) {
        if (!isLane(w, i)) continue;
        expect([Tile.Road, Tile.Dirt, Tile.Mud]).toContain(w.tiles[i]);
        if (w.tiles[i] === Tile.Dirt) dirt++;
        expect(nodeTiles.has(i)).toBe(true);
      }
      expect(dirt).toBeGreaterThan(60);
      // Paved outer loop: the ring 4 tiles in from every edge is road all the way round.
      const W = w.widthTiles, H = w.heightTiles;
      for (let k = 4; k < W - 4; k++) {
        for (const i of [4 * W + k, (H - 5) * W + k, k * W + 4, k * W + W - 5]) expect(w.tiles[i]).toBe(Tile.Road);
      }
    }
  });

  it('places every farm and village word on a reachable, open road front', () => {
    for (const w of worlds.values()) {
      expect(w.places.map((p) => p.word).sort()).toEqual([...FARM_PLACE_WORDS].sort());
      expect(w.playerSpawns.length).toBeGreaterThanOrEqual(2);
      const reach = laneReach(w, tileOf(w, w.playerSpawns[0]));
      for (const s of w.playerSpawns) {
        expect(w.tiles[tileOf(w, s)]).toBe(Tile.Road);
        expect(reach.has(tileOf(w, s))).toBe(true);
      }
      for (const p of w.places) {
        expect(signSceneFor(p.word)).toBeTruthy();
        expect(reach.has(tileOf(w, p.front))).toBe(true);
        expect(w.tiles[tileOf(w, p.sign)]).toBe(Tile.Building);
        expect(w.buildings[p.buildingId].placeWord).toBe(p.word);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const t = tileAtPx(w, p.front.x + Math.cos(a) * GOALS.radius, p.front.y + Math.sin(a) * GOALS.radius);
          expect(FARM_DRIVABLE.has(t)).toBe(true);
          expect(t).not.toBe(Tile.Mud);
        }
        for (const f of w.farm!.fences) expect(distToFence(p.front, f)).toBeGreaterThan(GOALS.radius);
      }
      for (const r of w.ramps) expect(reach.has(tileOf(w, r))).toBe(true);
    }
  });

  it('keeps fences off roads and gives every pasture a wide gate', () => {
    for (const w of worlds.values()) {
      const { fences, animalZones } = w.farm!;
      for (const f of fences) {
        const len = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
        for (let d = 0; d <= len; d += 16) {
          const x = f.a.x + ((f.b.x - f.a.x) * d) / len, y = f.a.y + ((f.b.y - f.a.y) * d) / len;
          for (const [ox, oy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
            const t = tileOf(w, { x: x + ox, y: y + oy });
            expect(isLane(w, t)).toBe(false);
            expect(w.tiles[t]).not.toBe(Tile.Water);
          }
        }
      }
      const pastures = animalZones.filter((z) => z.fenced);
      expect(pastures.length).toBeGreaterThanOrEqual(4);
      for (const z of pastures) {
        // Walk the perimeter; record open (unfenced) runs.
        const corners = [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x + z.w, y: z.y + z.h }, { x: z.x, y: z.y + z.h }];
        let longestGap = 0, fenced = 0, total = 0;
        for (let s = 0; s < 4; s++) {
          const a = corners[s], b = corners[(s + 1) % 4];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          let gap = 0;
          for (let d = 4; d < len; d += 8) {
            const p = { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len };
            total++;
            if (fences.some((f) => distToFence(p, f) < 1)) { fenced++; gap = 0; } else { gap += 8; longestGap = Math.max(longestGap, gap); }
          }
        }
        expect(longestGap).toBeGreaterThanOrEqual(FARM_GEN.gateTiles * w.tileSize - 16);
        expect(fenced / total).toBeGreaterThan(0.7);
      }
    }
  });

  it('keeps animal zones off roads, with every herd and bird kind present', () => {
    for (const w of worlds.values()) {
      const zones = w.farm!.animalZones;
      expect(new Set(zones.map((z) => z.kind))).toEqual(new Set(['cow', 'sheep', 'pig', 'horse', 'chicken', 'duck']));
      for (const z of zones) {
        expect(z.count).toBeGreaterThan(0);
        expect(z.w).toBeGreaterThan(0);
        expect(z.h).toBeGreaterThan(0);
        for (let y = z.y + 1; y < z.y + z.h; y += w.tileSize / 2) {
          for (let x = z.x + 1; x < z.x + z.w; x += w.tileSize / 2) expect(isLane(w, tileOf(w, { x, y }))).toBe(false);
        }
      }
      for (const z of zones.filter((q) => q.kind === 'duck')) {
        let water = 0;
        for (let y = z.y + 1; y < z.y + z.h; y += w.tileSize) for (let x = z.x + 1; x < z.x + z.w; x += w.tileSize) if (tileAtPx(w, x, y) === Tile.Water) water++;
        expect(water).toBeGreaterThan(0);
      }
    }
  });

  it('never covers roads with corn and builds a corn maze with open paths', () => {
    for (const w of worlds.values()) {
      let corn = 0;
      for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === Tile.Corn) { corn++; expect(isLane(w, i)).toBe(false); }
      expect(corn).toBeGreaterThan(80);
      const mazes = w.farm!.decorations.filter((d) => d.kind === 'cornMaze');
      expect(mazes).toHaveLength(1);
      const m = mazes[0];
      let paths = 0, entrances = 0;
      for (let y = m.y - m.h / 2 + 64; y < m.y + m.h / 2; y += 128) {
        for (let x = m.x - m.w / 2 + 64; x < m.x + m.w / 2; x += 128) {
          if (tileAtPx(w, x, y) !== Tile.Grass) continue;
          paths++;
          const edge = x < m.x - m.w / 2 + 128 || x > m.x + m.w / 2 - 128 || y < m.y - m.h / 2 + 128 || y > m.y + m.h / 2 - 128;
          if (edge && DIRS.some(({ dx, dy }) => isLane(w, tileOf(w, { x: x + dx * 128, y: y + dy * 128 })))) entrances++;
        }
      }
      expect(paths).toBeGreaterThan(5);
      expect(entrances).toBeGreaterThanOrEqual(2);
    }
  });

  it('never has a building run longer than WORLD.maxBuildingRun and dresses lots with matching decorations', () => {
    for (const w of worlds.values()) {
      const W = w.widthTiles, H = w.heightTiles;
      let best = 0;
      for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { r = w.tiles[y * W + x] === Tile.Building ? r + 1 : 0; best = Math.max(best, r); } }
      for (let x = 0; x < W; x++) { let r = 0; for (let y = 0; y < H; y++) { r = w.tiles[y * W + x] === Tile.Building ? r + 1 : 0; best = Math.max(best, r); } }
      expect(best).toBeLessThanOrEqual(WORLD.maxBuildingRun);
      for (const b of w.buildings) {
        for (let y = b.ty; y < b.ty + b.th; y++) for (let x = b.tx; x < b.tx + b.tw; x++) expect(w.tiles[y * W + x]).toBe(Tile.Building);
      }
      const decos = w.farm!.decorations;
      for (const d of decos) {
        if (d.buildingId === undefined) continue;
        const b = w.buildings[d.buildingId];
        expect(d.solid).toBe(false);
        expect(d.x).toBe((b.tx + b.tw / 2) * w.tileSize);
        expect(d.y).toBe((b.ty + b.th / 2) * w.tileSize);
      }
      const kinds = new Set(decos.map((d) => d.kind));
      for (const k of ['barn', 'silo', 'farmhouse', 'windmill', 'windTurbine', 'orchardTree', 'pumpkinPatch', 'cornMaze', 'streamBridge'] as const) {
        expect(kinds.has(k)).toBe(true);
      }
      expect(decos.filter((d) => d.kind === 'barn').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('crosses the stream on at least two drivable bridges', () => {
    for (const w of worlds.values()) {
      const bridges = w.farm!.decorations.filter((d) => d.kind === 'streamBridge');
      expect(bridges.length).toBeGreaterThanOrEqual(2);
      const reach = laneReach(w, tileOf(w, w.playerSpawns[0]));
      for (const b of bridges) {
        const across = { x: -Math.sin(b.angle), y: Math.cos(b.angle) };
        for (const s of [-0.5, 0.5]) {
          const p = { x: b.x + across.x * s * w.tileSize, y: b.y + across.y * s * w.tileSize };
          expect(w.tiles[tileOf(w, p)]).toBe(Tile.Road);
          expect(reach.has(tileOf(w, p))).toBe(true);
        }
        for (const s of [-1, 1]) {
          const d = b.h / 2 + w.tileSize / 2;
          expect(tileAtPx(w, b.x + across.x * s * d, b.y + across.y * s * d)).toBe(Tile.Water);
        }
      }
    }
  });

  it('puts the hay-bale ramp on a dirt lane, keeps every landing on lanes, and puts mud only on dirt lanes', () => {
    for (const w of worlds.values()) {
      expect(w.ramps.length).toBeGreaterThanOrEqual(2);
      expect(w.tiles[tileOf(w, w.ramps[0])]).toBe(Tile.Dirt);
      for (const r of w.ramps.slice(1)) expect(w.tiles[tileOf(w, r)]).toBe(Tile.Road);
      for (const r of w.ramps) {
        for (let k = -2; k <= 6; k++) {
          const p = { x: r.x + Math.cos(r.angle) * k * w.tileSize, y: r.y + Math.sin(r.angle) * k * w.tileSize };
          expect(isLane(w, tileOf(w, p))).toBe(true);
          expect(w.tiles[tileOf(w, p)]).not.toBe(Tile.Mud);
        }
      }
      let laneMud = 0;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.tiles[i] !== Tile.Mud || !isLane(w, i)) continue;
        laneMud++;
        // Lane mud sits on a dirt lane: its strip neighbours along the lane are dirt or mud.
        const x = i % w.widthTiles, y = Math.floor(i / w.widthTiles);
        const lanes = DIRS.map(({ dx, dy }) => (y + dy) * w.widthTiles + x + dx).filter((n) => isLane(w, n));
        expect(lanes.some((n) => w.tiles[n] === Tile.Dirt)).toBe(true);
      }
      expect(laneMud).toBeGreaterThan(0);
    }
  });

  it('casts fixed late-afternoon shadows east-ish', () => {
    const { shadowAngle, shadowLength } = worlds.get(3)!.farm!;
    expect(Math.cos(shadowAngle)).toBeGreaterThan(0.8);
    expect(shadowLength).toBeGreaterThan(1.5);
    for (const w of worlds.values()) expect(w.farm!.shadowAngle).toBe(shadowAngle);
  });
});
