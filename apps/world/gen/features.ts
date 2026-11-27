import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { ActivityKind, ActivityTarget, FeatureKind, TraitNeed, Vec } from '../core/types';
import { hexKey } from './hex';
import { box, organic, offset, type HexLayout } from './layout';
import { curvedPath } from './roads';

export interface FeatureSite {
  kind: ActivityKind;
  at: Vec;
  targets: ActivityTarget[];
}

function addFeature(layout: HexLayout, kind: FeatureKind, at: Vec, dir: number, area: Vec[],
    needs?: TraitNeed[], bypassAt?: Vec): void {
  const { plan } = layout;
  plan.features.push({
    id: `${hexKey(plan.coord)}:f${plan.features.length}`, kind, at, dir, area,
    ...(needs && { needs }), ...(bypassAt && { bypass: true, bypassAt }),
  });
}

function buildCanyon(layout: HexLayout, rng: Rng): void {
  const { plan, hub } = layout;
  const scale = WORLD.hexSize / 1200;
  const { valleyWidth, wallThickness, wallExtent, crosscutHalfWidth } = GEN.canyon;
  const crossroad = plan.roads[1].points;
  const crossX = (y: number) => {
    const worldY = hub.y + y * scale;
    const index = crossroad.findIndex(at => at.y >= worldY);
    const a = crossroad[index - 1], b = crossroad[index];
    return (a.x + (b.x - a.x) * (worldY - a.y) / (b.y - a.y) - hub.x) / scale;
  };
  const at = (x: number, y: number) => offset(hub, x * scale, y * scale);
  const side = rng.chance(0.5) ? 1 : -1;
  const phase = rng.range(0, Math.PI * 2);
  for (const sign of [-1, 1]) {
    const inner = valleyWidth / 2;
    const outer = inner + wallThickness;
    const shortcutX = -sign * 560;
    const narrow = sign === side;
    const shortcutHalfWidth = 77;
    const wave = (t: number) => 15 * Math.sin(t * 8 + phase + sign) + 9 * Math.cos(t * 15 - phase);
    type WallEdge = (y: number) => number;
    const start = () => -wallExtent;
    const end = () => wallExtent;
    const crossLeft = (y: number) => crossX(y) - crosscutHalfWidth;
    const crossRight = (y: number) => crossX(y) + crosscutHalfWidth;
    const cutLeft = () => shortcutX - shortcutHalfWidth;
    const cutRight = () => shortcutX + shortcutHalfWidth;

    function wall(left: WallEdge, right: WallEdge): void {
      const edge = (depth: number) => Array.from({ length: 15 }, (_, i) => {
        const t = i / 14;
        const y = sign * (depth + wave(t));
        const a = left(y), b = right(y);
        return at(a + (b - a) * t, y);
      });
      plan.terrain.push({ kind: 'cliff', poly: [...edge(inner), ...edge(outer).reverse()] });
    }

    if (narrow && shortcutX < 0) {
      wall(start, cutLeft);
      wall(cutRight, crossLeft);
      wall(crossRight, end);
    } else if (narrow) {
      wall(start, crossLeft);
      wall(crossRight, cutLeft);
      wall(cutRight, end);
    } else {
      wall(start, crossLeft);
      wall(crossRight, end);
    }

    const inside = at(shortcutX, sign * (inner - 53));
    const outside = at(shortcutX, sign * (outer + 105));
    const road = plan.roads[0].points.reduce((closest, p) =>
      Math.abs(p.x - inside.x) < Math.abs(closest.x - inside.x) ? p : closest, hub);
    const bypassAt = at(crossX(sign * (inner + outer) / 2), sign * (inner + outer) / 2);
    const dir = sign * Math.PI / 2;
    const footprint = box(shortcutX - shortcutHalfWidth, Math.min(sign * (inner - 26), sign * (outer + 26)),
      shortcutX + shortcutHalfWidth, Math.max(sign * (inner - 26), sign * (outer + 26))).map(p => at(p.x, p.y));

    plan.roads.push(curvedPath(road, inside, sign));
    if (narrow) {
      plan.roads.push(curvedPath(inside, outside, 0));
      addFeature(layout, 'narrow', at(shortcutX, sign * (inner + outer) / 2), dir, footprint,
        [{ trait: 'width', max: 2 }], bypassAt);
      if (rng.chance(0.38)) {
        const tunnel = at(shortcutX, sign * (inner + outer) / 2);
        const roof = organic(tunnel, 62 * scale, 103 * scale, rng);
        plan.terrain.push({ kind: 'rough', poly: roof, covered: true, dark: 0.78 });
        addFeature(layout, 'tunnel', tunnel, dir, roof, [{ trait: 'height', max: 2 }], bypassAt);
      }
      layout.reserve(outside, 65 * scale);
    } else {
      const landing = at(shortcutX, sign * (outer + 150));
      plan.roads.push(curvedPath(at(shortcutX, sign * (outer + 27)), landing, 0));
      addFeature(layout, 'jump', inside, dir, footprint, [{ trait: 'jump', min: 2 }], bypassAt);
      layout.reserve(landing, 76 * scale);
    }
  }
}

export function buildFeatures(layout: HexLayout, rng: Rng): FeatureSite | undefined {
  const { plan, hub } = layout;
  const { biome } = plan;
  if (biome === 'canyon') {
    buildCanyon(layout, rng);
    return;
  }
  if (biome !== 'darkwood' && biome !== 'rocky' && biome !== 'jungle') return;
  const scale = WORLD.hexSize / 1200;
  const origin = layout.place(rng, GEN.featureRadius * scale);
  if (!origin) return;
  const dir = Math.atan2(origin.y - hub.y, origin.x - hub.x);
  const cos = Math.cos(dir), sin = Math.sin(dir);
  const at = (x: number, y: number) => offset(origin, scale * (x * sin + y * cos), scale * (y * sin - x * cos));
  const mouth = at(0, -239);
  const road = plan.roads.flatMap(route => route.points).reduce((closest, p) =>
    Math.hypot(p.x - mouth.x, p.y - mouth.y) < Math.hypot(closest.x - mouth.x, closest.y - mouth.y) ? p : closest, hub);
  plan.roads.push(curvedPath(road, mouth, -1), curvedPath(mouth, at(0, 239), 0));
  if (biome === 'rocky') {
    addFeature(layout, 'jump', at(0, -92), dir, box(-68, -128, 68, -57).map(p => at(p.x, p.y)));
    return {
      kind: 'ringJump', at: at(0, -181),
      targets: [0, 92, 184].map(y => ({ at: at(0, y), role: 'ring' })),
    };
  }

  const cave = biome === 'darkwood';
  const gate = box(-106, -151, 106, 151).map(p => at(p.x, p.y));
  const bypassAt = at(193, 0);
  plan.terrain.push(cave ? {
    kind: 'rough', poly: organic(origin, 177 * scale, 177 * scale, rng), covered: true, dark: 0.92,
  } : {
    kind: 'rough', poly: organic(at(-174, 0), 72 * scale, 193 * scale, rng, dir + Math.PI / 2),
  });
  const needs: TraitNeed[] = [{ trait: 'width', max: 2 }];
  if (cave) needs.push({ trait: 'height', max: 2 });
  addFeature(layout, cave ? 'cave' : 'narrow', origin, dir, gate, needs, bypassAt);
  layout.reserve(bypassAt, 52 * scale);
  if (cave) return {
    kind: 'lanternCave', at: mouth,
    targets: [-110, 0, 110].map(y => ({ at: at(0, y), role: 'lantern' })),
  };
}
