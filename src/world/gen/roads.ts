import type { Rng } from '../../core/rng';
import { WORLD } from '../../config/gameConfig';
import { Tile } from '../../core/types';
import { computeRoadMask, type Grid } from './grid';

/** Road-line coordinates from lo to hi with randomly sized blocks (blockMin..blockMax tiles between roads). */
function gridLines(rng: Rng, lo: number, hi: number): number[] {
  const { blockMin, blockMax } = WORLD;
  const out = [lo];
  let cur = lo;
  while (cur < hi) {
    const rem = hi - cur;
    if (rem - 1 <= blockMax) { out.push(hi); break; }
    const maxGap = Math.max(blockMin, Math.min(blockMax, rem - 2 - blockMin));
    cur += rng.int(blockMin, maxGap) + 1;
    out.push(cur);
  }
  return out;
}

interface Edge { a: number; b: number; fixed: boolean; active: boolean; x0: number; y0: number; x1: number; y1: number }

/**
 * Pass 1: ring road + jittered grid. Reserve some pairs of blocks for larger features,
 * then remove random inner segments while the junction graph stays connected.
 * Returns a tile on the former dividing road of each reserved pair.
 */
export function generateRoads(rng: Rng, g: Grid): number[] {
  const lo = WORLD.waterBorderTiles + 1;
  const hiX = g.w - 1 - lo;
  const hiY = g.h - 1 - lo;
  const xs = gridLines(rng, lo, hiX);
  const ys = gridLines(rng, lo, hiY);
  const nx = xs.length, ny = ys.length;
  const node = (i: number, j: number) => j * nx + i;

  const edges: Edge[] = [];
  const blockEdges: Edge[][] = Array.from({ length: nx * ny }, () => []);
  const adjacentBlocks = (e: Edge): [number, number] => [
    e.a, e.y0 === e.y1 ? e.a - nx : e.a - 1,
  ];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (i + 1 < nx) edges.push({ a: node(i, j), b: node(i + 1, j), fixed: j === 0 || j === ny - 1, active: true, x0: xs[i], y0: ys[j], x1: xs[i + 1], y1: ys[j] });
      if (j + 1 < ny) edges.push({ a: node(i, j), b: node(i, j + 1), fixed: i === 0 || i === nx - 1, active: true, x0: xs[i], y0: ys[j], x1: xs[i], y1: ys[j + 1] });
    }
  }
  for (const e of edges) {
    const horizontal = e.y0 === e.y1;
    const i = e.a % nx, j = Math.floor(e.a / nx);
    const [after, before] = adjacentBlocks(e);
    if (i < nx - 1 && j < ny - 1) blockEdges[after].push(e);
    if (horizontal ? j > 0 : i > 0) blockEdges[before].push(e);
  }

  const connected = (): boolean => {
    const adj: number[][] = Array.from({ length: nx * ny }, () => []);
    for (const e of edges) if (e.active) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    const seen = new Uint8Array(nx * ny);
    const stack = [0];
    seen[0] = 1;
    let count = 1;
    while (stack.length) {
      const n = stack.pop()!;
      for (const m of adj[n]) if (!seen[m]) { seen[m] = 1; count++; stack.push(m); }
    }
    return count === nx * ny;
  };

  const innerEdges = rng.shuffle(edges.filter((e) => !e.fixed));
  const featureTiles: number[] = [];
  for (const e of innerEdges) {
    // Leave room for three park tiles across the short axis after adding sidewalks.
    if (e.x1 - e.x0 + e.y1 - e.y0 < 6 || e.fixed || !rng.chance(WORLD.mergedFeatureChance)) continue;
    const [a, b] = adjacentBlocks(e);
    const boundary = [...blockEdges[a], ...blockEdges[b]];
    if (boundary.some((edge) => !edge.active)) continue;
    // The intact perimeter provides a detour and keeps this pair from merging with a third block.
    e.active = false;
    for (const edge of boundary) edge.fixed = true;
    const x = Math.floor((e.x0 + e.x1) / 2), y = Math.floor((e.y0 + e.y1) / 2);
    featureTiles.push(y * g.w + x);
  }

  for (const e of innerEdges) {
    if (e.fixed || !rng.chance(WORLD.removeRoadChance + WORLD.additionalRoadRemovalChance)) continue;
    e.active = false;
    if (!connected()) e.active = true;
  }

  for (const e of edges) {
    if (!e.active) continue;
    for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) g.tiles[y * g.w + x] = Tile.Road;
  }
  computeRoadMask(g);
  return featureTiles;
}
