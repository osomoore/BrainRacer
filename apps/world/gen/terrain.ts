import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { BiomeId, HexPlan, Obstacle, SurfaceKind, Vec } from '../core/types';
import { hexKey } from './hex';
import { hexInset, offset, organic, type HexLayout } from './layout';

/** Hard-coded gen distances were tuned for a 2400 px hex. */
const K = WORLD.hexSize / 2400;

const PATCH_KIND = {
  meadow: 'shallow', mud: 'deepMud', rocky: 'cliff', darkwood: 'tallGrass',
  snow: 'ice', desert: 'rough', jungle: 'tallGrass', geyser: 'hotSpring',
} as const satisfies Partial<Record<BiomeId, SurfaceKind>>;

/** Keep large organic outlines just inside the hex seam. */
export function insideHex(center: Vec, points: Vec[]): Vec[] {
  return points.map(at => {
    const inset = hexInset(center, at);
    if (inset >= 1) return at;
    const apothem = WORLD.hexSize * Math.sqrt(3) / 2;
    const scale = (apothem - 1) / (apothem - inset);
    return offset(center, (at.x - center.x) * scale, (at.y - center.y) * scale);
  });
}

function buildLake(plan: HexPlan, rng: Rng): void {
  const scale = WORLD.hexSize / 1200;
  const pools = [-1, 1].map(sign => {
    const at = offset(plan.center, sign * GEN.lakeLobeOffset * scale, 0);
    const radius = rng.range(...GEN.lakeRadius) * scale;
    return { at, sign, poly: organic(at, radius * 0.63, radius, rng, sign * rng.range(-0.12, 0.12)) };
  });
  // Keep dry approaches to the junction and the neighboring hex, with each lobe
  // crossing only the east-west road. These limits include the second road's sweep.
  const shoreLimit = (p: Vec, sign: number, inset: number) => {
    const y = p.y - plan.center.y;
    const edge = (985 - inset) * scale;
    const inner = Math.max(290, sign * y / (Math.sqrt(3) * scale) + 310) * scale + inset * scale;
    return offset(plan.center, sign * Math.min(edge, Math.max(inner, sign * (p.x - plan.center.x))), y);
  };
  for (const { at, sign, poly } of pools) {
    const shore = poly.map(p => {
      const dx = p.x - at.x, dy = p.y - at.y;
      const expansion = 1 + GEN.lakeShore * scale / Math.hypot(dx, dy);
      return shoreLimit(offset(at, dx * expansion, dy * expansion), sign, 0);
    });
    plan.terrain.push({ kind: 'shallow', poly: insideHex(plan.center, shore) });
  }
  for (const { sign, poly } of pools) {
    plan.terrain.push({ kind: 'deep', poly: insideHex(plan.center, poly.map(p => shoreLimit(p, sign, 22))) });
  }
}

export function buildTerrain(layout: HexLayout, rng: Rng): void {
  const plan = layout.plan;
  if (plan.biome === 'lake') {
    buildLake(plan, rng);
    return;
  }
  if (plan.biome === 'canyon') return;

  const { count, orbit, radius, aspect } = GEN.terrainPatches[plan.biome];
  const start = rng.range(0, 2 * Math.PI);
  if (plan.biome === 'desert') {
    for (let i = 0; i < 7; i++) {
      const at = offset(plan.center, rng.range(-1450, 1450) * K, rng.range(-1460, 1460) * K);
      plan.terrain.push({ kind: 'sand', poly: insideHex(plan.center,
        organic(at, rng.range(360, 590) * K, rng.range(130, 240) * K, rng, start)) });
    }
  }
  for (let i = 0; i < count; i++) {
    const size = rng.range(radius[0], radius[1]);
    const angle = start + i * 2 * Math.PI / count + rng.range(-0.24, 0.24);
    const distance = orbit * rng.range(0.87, 1.12);
    const at = plan.biome === 'rocky' ? layout.place(rng, size * 1.2)
      : offset(plan.center, Math.cos(angle) * distance, Math.sin(angle) * distance);
    if (!at) continue;
    const poly = organic(at, size, size * rng.range(aspect[0], aspect[1]), rng, angle);
    plan.terrain.push({ kind: PATCH_KIND[plan.biome], poly: insideHex(plan.center, poly) });
  }
}

type ObstacleStyle = Omit<Obstacle, 'id' | 'at' | 'radius'> & { size: readonly [number, number] };
const BUSH: ObstacleStyle = { kind: 'bush', size: [24, 46], needs: [{ trait: 'push', min: 1 }], effect: 'pass' };
const BOULDER: ObstacleStyle = { kind: 'boulder', size: [40, 90] };
const LOG: ObstacleStyle = { kind: 'log', size: [40, 64], needs: [{ trait: 'push', min: 2 }], effect: 'push' };
const TREE: ObstacleStyle = { kind: 'tree', size: [49, 76] };
const OBSTACLES: Record<BiomeId, readonly ObstacleStyle[]> = {
  meadow: [{ kind: 'flower', size: [18, 30], needs: [], effect: 'pass' }, BUSH, TREE],
  mud: [LOG, BUSH],
  rocky: [BOULDER],
  lake: [BUSH, LOG],
  darkwood: [TREE, TREE, TREE, LOG],
  snow: [{ kind: 'iceBlock', size: [40, 69], needs: [{ trait: 'push', min: 2 }], effect: 'break' }],
  desert: [{ kind: 'cactus', size: [35, 61] }, { kind: 'cactus', size: [35, 61] }, BOULDER],
  jungle: [TREE, TREE, TREE, { kind: 'vine', size: [30, 55], needs: [{ trait: 'reach', min: 1 }], effect: 'pass' }],
  canyon: [BOULDER],
  geyser: [BOULDER],
};

export function scatterObstacles(layout: HexLayout, rng: Rng): void {
  const plan = layout.plan;
  const prefix = hexKey(plan.coord);
  const styles = OBSTACLES[plan.biome];
  const centerCandidate = () => offset(plan.center, rng.range(-1, 1) * WORLD.hexSize, rng.range(-1, 1) * WORLD.hexSize);
  const clustered = plan.biome === 'desert' || plan.biome === 'jungle' || plan.biome === 'darkwood' || plan.biome === 'rocky';
  const clusters = clustered ? Array.from({ length: 12 }, centerCandidate) : [];

  const springs = plan.terrain.filter(blob => blob.kind === 'hotSpring').map(({ poly }) => ({
    x: poly.reduce((sum, at) => sum + at.x, 0) / poly.length,
    y: poly.reduce((sum, at) => sum + at.y, 0) / poly.length,
  }));

  function scatter(style: ObstacleStyle, atSpring = false): void {
    const { size, kind, needs, effect } = style;
    const radius = rng.range(...size);
    for (let i = 0; i < GEN.scatterAttempts; i++) {
      const center = atSpring ? rng.pick(springs)
        : clusters.length && i < GEN.scatterAttempts / 2 ? rng.pick(clusters) : undefined;
      const spread = atSpring ? 85 : 460 * K;
      const at = center ? offset(center, rng.range(-spread, spread), rng.range(-spread, spread)) : centerCandidate();
      if (!layout.free(at, radius)) continue;
      const ground = layout.groundAt?.(at.x, at.y).kind;
      if (ground === 'cliff' || ground === 'deep' || ground === 'shallow' || (atSpring && ground !== 'hotSpring')) continue;
      layout.reserve(at, radius);
      plan.obstacles.push({ id: `${prefix}:o${plan.obstacles.length}`, kind, radius, at,
        ...(needs && { needs: needs.map(need => ({ ...need })) }), ...(effect && { effect }) });
      return;
    }
  }

  if (plan.biome === 'geyser') {
    for (let i = 0; i < 4; i++) scatter({ kind: 'vent', size: [38, 60], needs: [], effect: 'pass' }, true);
  }
  for (let i = 0; i < GEN.scatterDensity[plan.biome]; i++) scatter(rng.pick(styles));
}
