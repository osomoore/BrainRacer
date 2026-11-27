import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { HexPlan, RoadPath, SurfaceSample, Vec } from '../core/types';
import { curvedPath, roadOverlap } from './roads';

export const offset = (at: Vec, x: number, y: number): Vec => ({ x: at.x + x, y: at.y + y });

/** Low harmonics keep the outline irregular without producing sharp radial spikes. */
export function organic(at: Vec, xRadius: number, yRadius: number, rng: Rng, rotation = 0): Vec[] {
  const [a, b, c] = Array.from({ length: 3 }, () => rng.range(0, 2 * Math.PI));
  const sin = Math.sin(rotation), cos = Math.cos(rotation);
  return Array.from({ length: GEN.terrainVertices }, (_, i) => {
    const angle = i * 2 * Math.PI / GEN.terrainVertices;
    const scale = 1 + 0.10 * Math.sin(3 * angle + a) + 0.06 * Math.cos(5 * angle + b)
      + 0.025 * Math.sin(8 * angle + c);
    const x = Math.cos(angle) * xRadius * scale;
    const y = Math.sin(angle) * yRadius * scale;
    return offset(at, x * cos - y * sin, x * sin + y * cos);
  });
}

export function box(x0: number, y0: number, x1: number, y1: number): Vec[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

export function hexInset(center: Vec, at: Vec): number {
  const dx = at.x - center.x, dy = at.y - center.y;
  const edge = Math.max(Math.abs(dx), Math.abs(dx / 2 + dy * Math.sqrt(3) / 2),
    Math.abs(dx / 2 - dy * Math.sqrt(3) / 2));
  return WORLD.hexSize * Math.sqrt(3) / 2 - edge;
}

interface Circle { at: Vec; radius: number }

export class HexLayout {
  private readonly reserved: Circle[] = [];
  private readonly anchors: Vec[];
  groundAt?: (x: number, y: number) => SurfaceSample;
  private networkAt?: (x: number, y: number) => SurfaceSample;

  constructor(readonly plan: HexPlan, readonly hub: Vec) {
    this.anchors = plan.roads.flatMap(road => road.points.filter((at, i) =>
      i % 2 === 0 && hexInset(plan.center, at) > GEN.pathWidth));
  }

  reserve(at: Vec, radius: number): void {
    this.reserved.push({ at, radius });
  }

  setTerrain(groundAt: (x: number, y: number) => SurfaceSample, networkAt = groundAt): void {
    this.groundAt = groundAt;
    this.networkAt = networkAt;
  }

  private passableGround(at: Vec): boolean {
    const kind = this.groundAt?.(at.x, at.y).kind;
    return kind !== 'deep' && kind !== 'cliff';
  }

  private roadConnects(path: RoadPath): boolean {
    const margin = path.width / 2;
    if (this.reserved.some(zone => roadOverlap(path, zone.at, zone.radius + GEN.placementClearance))) return false;
    const passable = (p: Vec) => {
      if (hexInset(this.plan.center, p) <= 0) return false;
      const kind = this.networkAt?.(p.x, p.y).kind;
      return kind !== 'deep' && kind !== 'cliff';
    };
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      const steps = Math.ceil(length / 28);
      for (let step = 0; step <= steps; step++) {
        const p = offset(a, dx * step / steps, dy * step / steps);
        if (!passable(p)
          || !passable(offset(p, dy / length * margin, -dx / length * margin))
          || !passable(offset(p, -dy / length * margin, dx / length * margin))) return false;
      }
    }
    return true;
  }

  /** Join the closest safe stretch of the public road network. */
  private approach(at: Vec): boolean {
    const anchors = this.anchors
      .map(point => ({ point, distance: (point.x - at.x) ** 2 + (point.y - at.y) ** 2 }))
      .sort((a, b) => a.distance - b.distance);
    for (const { point } of anchors.slice(0, 24)) {
      for (const sign of [1, -1]) {
        const path = curvedPath(point, at, sign);
        if (!this.roadConnects(path)) continue;
        this.plan.roads.push(path);
        return true;
      }
    }
    return false;
  }

  free(at: Vec, radius: number): boolean {
    const clearance = radius + GEN.placementClearance;
    return hexInset(this.plan.center, at) > clearance
      && !this.plan.roads.some(road => roadOverlap(road, at, clearance))
      && this.clearOfReservations(at, clearance);
  }

  private clearOfReservations(at: Vec, clearance: number): boolean {
    return !this.reserved.some(zone =>
      (at.x - zone.at.x) ** 2 + (at.y - zone.at.y) ** 2 < (zone.radius + clearance) ** 2);
  }

  /** Fallback for crowded lakes. Activity sites also need room for targets around the road. */
  placeAlongRoad(rng: Rng, radius: number, needsOpenGround: boolean): Vec | undefined {
    const clearance = radius + GEN.placementClearance;
    for (const at of rng.shuffle([...this.anchors])) {
      if (hexInset(this.plan.center, at) <= clearance || !this.clearOfReservations(at, clearance)
        || (needsOpenGround && !this.clearGround(at, radius))) continue;
      this.reserve(at, radius);
      return at;
    }
  }

  private clearGround(at: Vec, radius: number): boolean {
    if (!this.passableGround(at)) return false;
    for (const fraction of [0.5, 1]) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        if (!this.passableGround(offset(at, Math.cos(angle) * radius * fraction, Math.sin(angle) * radius * fraction))) {
          return false;
        }
      }
    }
    return true;
  }

  place(rng: Rng, radius: number, connect = false): Vec | undefined {
    const start = rng.range(0, 2 * Math.PI);
    for (const range of [0.64, 0.78, 0.50, 0.89, 0.39, 0.28, 0.94]) {
      for (let step = 0; step < 36; step++) {
        const angle = start + step * Math.PI / 18;
        const at = offset(this.plan.center,
          Math.cos(angle) * WORLD.hexSize * range, Math.sin(angle) * WORLD.hexSize * range);
        if (this.free(at, radius) && this.clearGround(at, radius) && (!connect || this.approach(at))) {
          this.reserve(at, radius);
          return at;
        }
      }
    }
  }
}
