import type { Rng } from '../../workshop/core/rng';
import type { BiomeId, Obstacle, SurfaceKind } from '../core/types';
import { hexKey } from './hex';
import { ellipse, type HexLayout } from './layout';

interface TerrainPatch {
  kind: SurfaceKind;
  size: number;
  inner?: SurfaceKind;
  dark?: number;
}

const PATCHES: Record<BiomeId, readonly TerrainPatch[]> = {
  meadow: [{ kind: 'tallGrass', size: 290 }, { kind: 'grass', size: 170 }],
  mud: [{ kind: 'mud', size: 355, inner: 'deepMud' }, { kind: 'deepMud', size: 230 }],
  rocky: [{ kind: 'rough', size: 335 }, { kind: 'cliff', size: 160 }],
  lake: [{ kind: 'deep', size: 280, inner: 'grass' }, { kind: 'grass', size: 220 }],
  darkwood: [{ kind: 'tallGrass', size: 320, dark: 0.75 }, { kind: 'rough', size: 240, dark: 0.65 }],
  snow: [{ kind: 'ice', size: 340 }, { kind: 'ice', size: 225 }],
  desert: [{ kind: 'sand', size: 390 }, { kind: 'rough', size: 215 }],
  jungle: [{ kind: 'tallGrass', size: 370 }, { kind: 'mud', size: 190 }],
  canyon: [{ kind: 'cliff', size: 320 }, { kind: 'rough', size: 190 }],
  geyser: [{ kind: 'hotSpring', size: 330 }, { kind: 'hotSpring', size: 250 }],
};

type ObstacleStyle = Pick<Obstacle, 'kind' | 'radius' | 'needs' | 'effect'>;
const BUSH: ObstacleStyle = { kind: 'bush', radius: 45, needs: [{ trait: 'push', min: 1 }], effect: 'pass' };
const BOULDER: ObstacleStyle = { kind: 'boulder', radius: 66, needs: [{ trait: 'push', min: 3 }], effect: 'push' };
const LOG: ObstacleStyle = { kind: 'log', radius: 56, needs: [{ trait: 'push', min: 2 }], effect: 'push' };
const TREE: ObstacleStyle = { kind: 'tree', radius: 62 };
const OBSTACLES: Record<BiomeId, readonly ObstacleStyle[]> = {
  meadow: [BUSH, TREE],
  mud: [LOG, BUSH],
  rocky: [BOULDER],
  lake: [BUSH, LOG],
  darkwood: [TREE, LOG],
  snow: [{ kind: 'iceBlock', radius: 52, needs: [{ trait: 'push', min: 2 }], effect: 'break' }],
  desert: [{ kind: 'cactus', radius: 49 }],
  jungle: [TREE, BUSH],
  canyon: [BOULDER],
  geyser: [BOULDER],
};

export function buildTerrain(layout: HexLayout, rng: Rng): void {
  const plan = layout.plan;
  for (const patch of PATCHES[plan.biome]) {
    const size = patch.size * rng.range(0.85, 1.15);
    const at = layout.place(rng, size);
    if (!at) continue;
    plan.terrain.push({ kind: patch.kind, poly: ellipse(at, size, size * rng.range(0.55, 1), rng),
      ...(patch.dark !== undefined ? { dark: patch.dark } : {}) });
    if (patch.inner) {
      plan.terrain.push({ kind: patch.inner, poly: ellipse(at, size * 0.34, size * 0.32, rng) });
    }
  }

  const count = rng.int(3, 6);
  for (let index = 0; index < count; index++) {
    const style = rng.pick(OBSTACLES[plan.biome]);
    const at = layout.place(rng, style.radius);
    if (!at) break;
    plan.obstacles.push({ ...style, needs: style.needs?.map(need => ({ ...need })),
      id: `${hexKey(plan.coord)}:o${index}`, at });
  }
}
