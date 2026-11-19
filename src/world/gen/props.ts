import type { Rng } from '../../core/rng';
import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Tile, type Prop, type Ramp } from '../../core/types';
import { DIRS, dirAngle, isRoad, straightAxis, type Grid } from './grid';
import type { Spawn } from './spawns';

const H = TILE_SIZE / 2;

/** Pass 6: props (pixel coords). Everything except cones stays on sidewalk/park/plaza tiles. */
export function generateProps(rng: Rng, g: Grid, ramps: Ramp[], spawns: Spawn[]): Prop[] {
  const props: Prop[] = [];
  const lampPhase = rng.int(0, WORLD.lampEveryTiles - 1);

  for (let ty = 0; ty < g.h; ty++) {
    for (let tx = 0; tx < g.w; tx++) {
      const t = g.tiles[ty * g.w + tx];
      const cx = (tx + 0.5) * TILE_SIZE, cy = (ty + 0.5) * TILE_SIZE;
      if (t === Tile.Sidewalk) {
        const roadDirs = DIRS.map((d, i) => (isRoad(g, tx + d.dx, ty + d.dy) ? i : -1)).filter((i) => i >= 0);
        if (roadDirs.length !== 1) continue;
        const d = roadDirs[0];
        const toRoad = DIRS[d];
        const alongX = toRoad.dy !== 0; // road above/below => street runs horizontally
        const lampTile = (alongX ? tx : ty) % WORLD.lampEveryTiles === lampPhase;
        if (lampTile) {
          props.push({ kind: 'lamp', x: cx + toRoad.dx * 44, y: cy + toRoad.dy * 44, angle: 0 });
        } else if (rng.chance(WORLD.hydrantChance)) {
          props.push({ kind: 'hydrant', x: cx + toRoad.dx * 40, y: cy + toRoad.dy * 40, angle: 0 });
        } else if (rng.chance(WORLD.parkedCarChance)) {
          const angle = alongX ? (rng.chance(0.5) ? 0 : Math.PI) : rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          props.push({ kind: 'parkedCar', x: cx + toRoad.dx * 26, y: cy + toRoad.dy * 26, angle });
        }
      } else if (t === Tile.Park) {
        const r = rng.next();
        const jx = cx + rng.range(-34, 34), jy = cy + rng.range(-34, 34);
        if (r < 0.45) props.push({ kind: 'tree', x: jx, y: jy, angle: rng.range(0, Math.PI * 2) });
        else if (r < 0.7) props.push({ kind: 'bush', x: jx, y: jy, angle: rng.range(0, Math.PI * 2) });
        else if (r < 0.74) props.push({ kind: 'bench', x: cx, y: cy, angle: rng.int(0, 3) * (Math.PI / 2) });
      } else if (t === Tile.Plaza) {
        if (rng.chance(0.3)) props.push({ kind: 'bench', x: cx + rng.range(-20, 20), y: cy + rng.range(-20, 20), angle: rng.int(0, 3) * (Math.PI / 2) });
        else if (rng.chance(0.08)) props.push({ kind: 'bush', x: cx, y: cy, angle: 0 });
      }
    }
  }

  // Cone clusters at the road edge of straight tiles (away from ramps and spawns).
  const straight: { x: number; y: number; axis: 'h' | 'v' }[] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const axis = straightAxis(g, x, y);
    if (axis) straight.push({ x, y, axis });
  }
  const avoid = [...ramps.map((r) => r), ...spawns].map((p) => ({ x: p.x / TILE_SIZE, y: p.y / TILE_SIZE }));
  let clusters = 0;
  for (const c of rng.shuffle(straight)) {
    if (clusters >= WORLD.coneClusters) break;
    if (avoid.some((a) => Math.hypot(a.x - c.x - 0.5, a.y - c.y - 0.5) < 2.5)) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    const n = rng.int(3, 4);
    for (let k = 0; k < n; k++) {
      const along = (k - (n - 1) / 2) * 26;
      const across = side * (H - 14);
      const px = (c.x + 0.5) * TILE_SIZE + (c.axis === 'h' ? along : across);
      const py = (c.y + 0.5) * TILE_SIZE + (c.axis === 'h' ? across : along);
      props.push({ kind: 'cone', x: px, y: py, angle: dirAngle(c.axis === 'h' ? 0 : 1) });
    }
    clusters++;
  }
  return props;
}
