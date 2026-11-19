import type { Rng } from '../../core/rng';
import { TILE_SIZE } from '../../config/gameConfig';
import type { BuildingLot, PlaceSite } from '../../core/types';
import { DIRS, isRoad, type Grid } from './grid';
import type { BlockInfo } from './blocks';

/** Pass 3: give each place word a building, spread out by farthest-point sampling. */
export function generatePlaces(rng: Rng, g: Grid, info: BlockInfo, words: readonly string[]): PlaceSite[] {
  const { lots } = info;
  const isBig = (l: BuildingLot) => l.tw >= 2 && l.th >= 2;
  const big = lots.filter(isBig);
  const cands = big.length >= words.length ? big : big.concat(lots.filter((l) => !isBig(l)));
  const cx = (l: BuildingLot) => l.tx + l.tw / 2;
  const cy = (l: BuildingLot) => l.ty + l.th / 2;

  const chosen: BuildingLot[] = [rng.pick(cands)];
  const minD = cands.map((c) => Math.hypot(cx(c) - cx(chosen[0]), cy(c) - cy(chosen[0])));
  while (chosen.length < words.length) {
    let best = -1;
    for (let i = 0; i < cands.length; i++) {
      if (chosen.includes(cands[i])) continue;
      if (best < 0 || minD[i] > minD[best]) best = i;
    }
    const c = cands[best];
    chosen.push(c);
    for (let i = 0; i < cands.length; i++) minD[i] = Math.min(minD[i], Math.hypot(cx(cands[i]) - cx(c), cy(cands[i]) - cy(c)));
  }

  const assigned = rng.shuffle(words.slice());
  return chosen.map((lot, i) => {
    lot.placeWord = assigned[i];
    return {
      word: assigned[i],
      buildingId: lot.id,
      sign: { x: cx(lot) * TILE_SIZE, y: cy(lot) * TILE_SIZE },
      front: frontOf(g, info, lot),
    };
  });
}

/** Pixel center of the road tile (adjacent to the lot's block) nearest to the lot. */
function frontOf(g: Grid, info: BlockInfo, lot: BuildingLot): { x: number; y: number } {
  const block = info.blocks[info.lotBlock[lot.id]];
  const lx = lot.tx + lot.tw / 2 - 0.5, ly = lot.ty + lot.th / 2 - 0.5;
  let best = { x: 0, y: 0 }, bestD = Infinity;
  for (const t of block.tiles) {
    const tx = t % g.w, ty = (t / g.w) | 0;
    for (const d of DIRS) {
      const rx = tx + d.dx, ry = ty + d.dy;
      if (!isRoad(g, rx, ry)) continue;
      const dist = Math.hypot(rx - lx, ry - ly);
      if (dist < bestD) { bestD = dist; best = { x: rx, y: ry }; }
    }
  }
  return { x: (best.x + 0.5) * TILE_SIZE, y: (best.y + 0.5) * TILE_SIZE };
}
