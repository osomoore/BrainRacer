import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD, WORLD_DRIVE } from '../config';
import type { ErrandSpotKind, HexPlan, Obstacle, Vec } from '../core/types';
import { edgeMidpoint, hexKey } from './hex';
import { hexInset, offset, type HexLayout } from './layout';
import { roadOverlap } from './roads';

const C = GEN.errands;

export function isPathLog(obstacle: Obstacle): boolean {
  return obstacle.kind === 'log' && obstacle.id.endsWith(':pathLog');
}

export function touchesPath(plan: HexPlan, log: Obstacle): boolean {
  return plan.roads.some(road => road.kind === 'path' && roadOverlap(road, log.at, log.radius));
}

function darkEdge(layout: HexLayout, rng: Rng): Vec | undefined {
  const { plan } = layout;
  for (const edge of rng.shuffle([0, 1, 2, 3, 4, 5])) {
    const middle = edgeMidpoint(plan.coord, edge);
    const dx = middle.x - plan.center.x, dy = middle.y - plan.center.y;
    const distance = Math.hypot(dx, dy);
    for (const along of rng.shuffle([-280, -140, 0, 140, 280])) {
      const at = offset(middle, (-dx * 22 - dy * along) / distance, (-dy * 22 + dx * along) / distance);
      if (layout.free(at, 0) && layout.groundAt?.(at.x, at.y).kind === 'grass') return at;
    }
  }
}

function lakeFrog(layout: HexLayout, rng: Rng): Vec | undefined {
  const ground = layout.groundAt;
  if (!ground) return;
  // The frog can sit in the shallows, within hand range of a dry approach.
  return layout.place(rng, 22, undefined, at => {
    if (ground(at.x, at.y).kind !== 'shallow') return false;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const dry = offset(at, Math.cos(angle) * 65, Math.sin(angle) * 65);
      if (hexInset(layout.plan.center, dry) > 0 && ground(dry.x, dry.y).kind === 'grass') return true;
    }
    return false;
  });
}

function pathLog(layout: HexLayout, rng: Rng, id: string): void {
  const { plan } = layout;
  const radius = C.pathLogRadius;
  for (const path of rng.shuffle(plan.roads.filter(road => road.kind === 'path'))) {
    for (let i = 1; i < path.points.length - 1; i++) {
      const a = path.points[i - 1], b = path.points[i];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (length < radius) continue;
      for (const sign of rng.shuffle([-1, 1])) {
        const nx = -dy / length * sign, ny = dx / length * sign;
        const shoulder = path.width / 2 + C.pathLogShoulderOffset;
        const at = { x: (a.x + b.x) / 2 + nx * shoulder, y: (a.y + b.y) / 2 + ny * shoulder };
        const clear = radius + GEN.placementClearance;
        const beyond = offset(at, nx * (clear + 15), ny * (clear + 15));
        const ground = (p: Vec) => layout.groundAt?.(p.x, p.y).kind;
        if (hexInset(plan.center, at) <= clear || !roadOverlap(path, at, radius)
          || roadOverlap(path, at, radius + Math.max(...WORLD_DRIVE.colliderRadius) - path.width / 2)
          || !layout.clearOfReservations(at, clear)
          || plan.roads.some(other => other !== path && roadOverlap(other, at, clear))
          || !layout.free(beyond, radius)
          || [at, beyond].some(p => ['cliff', 'deep', 'shallow'].some(kind => kind === ground(p)))) continue;
        layout.reserve(at, radius);
        // Keep the shoulder clear so pushing outward works even after obstacle scatter.
        layout.reserve(beyond, radius);
        plan.obstacles.push({ id, kind: 'log', at, radius, needs: [], effect: 'push' });
        return;
      }
    }
  }
}

export function buildErrandSites(layout: HexLayout, rng: Rng): void {
  const { plan } = layout;
  const { biome } = plan;
  const prefix = hexKey(plan.coord);
  const add = (kind: ErrandSpotKind, at: Vec, suffix: string = kind) => {
    (plan.errands ??= []).push({ id: `${prefix}:${suffix}`, kind, at });
  };
  const farmChance = biome === 'meadow' || biome === 'rocky' || biome === 'snow' ? C.farmChance[biome] : 0;
  const farm = farmChance > 0 && rng.chance(farmChance) && layout.place(rng, C.farmRadius, 'ground');
  if (farm) {
    add('barn', offset(farm, -82, -45));
    add('cowPen', offset(farm, 71, 17));
    add('hay', offset(farm, -83, 91), 'hay0');
    add('hay', offset(farm, -150, 64), 'hay1');
    add('bell', offset(farm, 63, -116), 'farmBell');
    add('doggy', offset(farm, 8, 115), 'farmDog');
  }
  if (plan.home) {
    const at = layout.place(rng, 38, undefined,
      at => Math.hypot(at.x - plan.center.x, at.y - plan.center.y) < WORLD.hexSize / 3);
    if (at) add('bell', at, 'campBell');
  }
  if ((biome === 'darkwood' || biome === 'snow') && rng.chance(C.bearChance)) {
    const at = biome === 'darkwood' ? darkEdge(layout, rng) : layout.place(rng, 58, 'ground');
    if (at) {
      layout.reserve(at, 55);
      add('bear', at);
    }
  }
  if ((biome === 'lake' || biome === 'mud') && rng.chance(C.frogChance)) {
    const at = biome === 'lake' ? lakeFrog(layout, rng)
      : layout.place(rng, 42, 'ground', at => layout.groundAt?.(at.x, at.y).kind === 'mud');
    if (at) add('frog', at);
  }
  if ((biome === 'meadow' || biome === 'jungle') && rng.chance(C.appleChance)) {
    const at = layout.place(rng, C.appleCanopy, 'ground');
    if (at) {
      plan.obstacles.push(
        { id: `${prefix}:appleTree`, kind: 'appleTree', at, radius: C.appleTrunk },
        { id: `${prefix}:appleCanopy`, kind: 'appleCanopy', at, radius: C.appleCanopy, needs: [], effect: 'pass' },
      );
    }
  }
  if ((biome === 'meadow' || biome === 'mud' || biome === 'rocky' || biome === 'snow') && rng.chance(C.pathLogChance)) {
    pathLog(layout, rng, `${prefix}:pathLog`);
  }
}
