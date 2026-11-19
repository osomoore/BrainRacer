import { Tile, type LaneGraph, type WorldData } from '../../core/types';

/** Size of the largest strongly connected component (iterative Tarjan). */
export function largestScc(graph: LaneGraph): number {
  const n = graph.nodes.length;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack: number[] = [];
  let counter = 0, best = 0;
  for (let s = 0; s < n; s++) {
    if (index[s] >= 0) continue;
    const work: [number, number][] = [[s, 0]];
    index[s] = low[s] = counter++;
    stack.push(s); onStack[s] = 1;
    while (work.length) {
      const top = work[work.length - 1];
      const v = top[0];
      const nexts = graph.nodes[v].next;
      if (top[1] < nexts.length) {
        const w = nexts[top[1]++];
        if (index[w] < 0) {
          index[w] = low[w] = counter++;
          stack.push(w); onStack[w] = 1;
          work.push([w, 0]);
        } else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
      } else {
        work.pop();
        if (work.length) { const p = work[work.length - 1][0]; low[p] = Math.min(low[p], low[v]); }
        if (low[v] === index[v]) {
          let size = 0, w: number;
          do { w = stack.pop()!; onStack[w] = 0; size++; } while (w !== v);
          best = Math.max(best, size);
        }
      }
    }
  }
  return best;
}

/** One character per tile; rows joined by newlines. Dirt ',' (farm lanes and yards), Corn '|', Mud '%'. */
export function toAscii(world: WorldData): string {
  const ch: string[] = new Array(world.tiles.length);
  const map: Record<number, string> = {
    [Tile.Water]: '~', [Tile.Grass]: '.', [Tile.Road]: '#', [Tile.Sidewalk]: ':',
    [Tile.Building]: 'B', [Tile.Park]: 'T', [Tile.Plaza]: 'o', [Tile.Dirt]: ',',
    [Tile.Corn]: '|', [Tile.Mud]: '%',
  };
  for (let i = 0; i < ch.length; i++) ch[i] = map[world.tiles[i]] ?? '?';
  for (const b of world.buildings) {
    if (!b.placeWord) continue;
    for (let y = b.ty; y < b.ty + b.th; y++) for (let x = b.tx; x < b.tx + b.tw; x++) ch[y * world.widthTiles + x] = 'P';
  }
  for (const r of world.ramps) {
    ch[Math.floor(r.y / world.tileSize) * world.widthTiles + Math.floor(r.x / world.tileSize)] = 'R';
  }
  const rows: string[] = [];
  for (let y = 0; y < world.heightTiles; y++) rows.push(ch.slice(y * world.widthTiles, (y + 1) * world.widthTiles).join(''));
  return rows.join('\n');
}
