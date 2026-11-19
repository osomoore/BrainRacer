import { TILE_SIZE } from '../../config/gameConfig';
import type { LaneGraph, LaneNode } from '../../core/types';
import { DIRS, isRoad, opposite, type Grid } from './grid';

const LANE = TILE_SIZE / 4;   // lane center offset from road center (32 px)
const HALF = TILE_SIZE / 2;

/** Lane offset for travel direction d: right-hand traffic, +y down => offset = rot90cw(d) * LANE. */
export const offX = (d: number) => -DIRS[d].dy * LANE;
export const offY = (d: number) => DIRS[d].dx * LANE;

/**
 * Pass 7: directed lane graph.
 *  - One shared "edge node" per (tile, side with road) at the tile border, in the lane of travel.
 *  - Inside a tile, each (incoming dir, outgoing dir) pair gets its own chain of mid nodes
 *    (1 for straight, 3 along a quadratic Bezier for turns, a 3-node half circle for U-turns at dead ends).
 */
export function generateLaneGraph(g: Grid): LaneGraph {
  const nodes: LaneNode[] = [];
  const add = (x: number, y: number): number => { nodes.push({ id: nodes.length, x, y, next: [] }); return nodes.length - 1; };
  const link = (ids: number[]) => { for (let i = 0; i + 1 < ids.length; i++) nodes[ids[i]].next.push(ids[i + 1]); };

  const edge = new Int32Array(g.w * g.h * 4).fill(-1);
  for (let ty = 0; ty < g.h; ty++) for (let tx = 0; tx < g.w; tx++) {
    if (!isRoad(g, tx, ty)) continue;
    for (let d = 0; d < 4; d++) {
      if (!isRoad(g, tx + DIRS[d].dx, ty + DIRS[d].dy)) continue;
      const cx = (tx + 0.5) * TILE_SIZE, cy = (ty + 0.5) * TILE_SIZE;
      edge[(ty * g.w + tx) * 4 + d] = add(cx + offX(d) + DIRS[d].dx * HALF, cy + offY(d) + DIRS[d].dy * HALF);
    }
  }

  for (let ty = 0; ty < g.h; ty++) for (let tx = 0; tx < g.w; tx++) {
    if (!isRoad(g, tx, ty)) continue;
    const cx = (tx + 0.5) * TILE_SIZE, cy = (ty + 0.5) * TILE_SIZE;
    const outs = [0, 1, 2, 3].filter((d) => isRoad(g, tx + DIRS[d].dx, ty + DIRS[d].dy));
    for (let d = 0; d < 4; d++) {
      const from = opposite(d);
      if (!isRoad(g, tx + DIRS[from].dx, ty + DIRS[from].dy)) continue;
      const inId = edge[((ty + DIRS[from].dy) * g.w + tx + DIRS[from].dx) * 4 + d];
      const options = outs.filter((o) => o !== from);
      if (options.length === 0) {
        // Dead end: half-circle U-turn back out the way we came.
        const a = add(cx + offX(d), cy + offY(d));
        const b = add(cx + DIRS[d].dx * LANE, cy + DIRS[d].dy * LANE);
        const c = add(cx - offX(d), cy - offY(d));
        link([inId, a, b, c, edge[(ty * g.w + tx) * 4 + from]]);
        continue;
      }
      for (const o of options) {
        const outId = edge[(ty * g.w + tx) * 4 + o];
        if (o === d) {
          link([inId, add(cx + offX(d), cy + offY(d)), outId]);
          continue;
        }
        const p0 = nodes[inId], p2 = nodes[outId];
        // Control point = intersection of the incoming and outgoing lane center lines.
        const horizontal = DIRS[d].dx !== 0;
        const px = horizontal ? cx + offX(o) : cx + offX(d);
        const py = horizontal ? cy + offY(d) : cy + offY(o);
        const mids = [0.25, 0.5, 0.75].map((t) => {
          const u = 1 - t;
          return add(u * u * p0.x + 2 * u * t * px + t * t * p2.x, u * u * p0.y + 2 * u * t * py + t * t * p2.y);
        });
        link([inId, ...mids, outId]);
      }
    }
  }
  return { nodes };
}
