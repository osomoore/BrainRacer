import { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { HexPlan, Vec } from '../core/types';
import { pathThrough, roadOverlap } from './roads';

export const offset = (at: Vec, x: number, y: number): Vec => ({ x: at.x + x, y: at.y + y });

export function ellipse(at: Vec, xRadius: number, yRadius: number, rng?: Rng): Vec[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8;
    const scale = rng?.range(0.83, 1) ?? 1;
    return offset(at, Math.cos(angle) * xRadius * scale, Math.sin(angle) * yRadius * scale);
  });
}

export function box(x0: number, y0: number, x1: number, y1: number): Vec[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

interface Circle { at: Vec; radius: number }

export class HexLayout {
  private reserved: Circle[] = [];

  constructor(readonly plan: HexPlan) {}

  reserve(at: Vec, radius: number): void {
    this.reserved.push({ at, radius });
  }

  /** Connect an entry to the hub without cutting across an earlier site or feature. */
  approach(at: Vec): boolean {
    const path = pathThrough([this.plan.center, at]);
    if (this.reserved.some(zone =>
      roadOverlap(path, zone.at, zone.radius + GEN.placementClearance))) return false;
    this.plan.roads.push(path);
    return true;
  }

  free(at: Vec, radius: number): boolean {
    const dx = at.x - this.plan.center.x;
    const dy = at.y - this.plan.center.y;
    // Three pairs of opposite edge normals bound a pointy-top hex.
    const edge = Math.max(
      Math.abs(dx),
      Math.abs(dx / 2 + dy * Math.sqrt(3) / 2),
      Math.abs(dx / 2 - dy * Math.sqrt(3) / 2),
    );
    const clearance = radius + GEN.placementClearance;
    return edge + clearance < WORLD.hexSize * Math.sqrt(3) / 2
      && !this.plan.roads.some(road => roadOverlap(road, at, clearance))
      && !this.reserved.some(zone =>
        Math.hypot(at.x - zone.at.x, at.y - zone.at.y) < zone.radius + clearance);
  }

  place(rng: Rng, radius: number, connect = false): Vec | undefined {
    const start = rng.range(0, 2 * Math.PI);
    for (const range of [0.64, 0.78, 0.50, 0.89, 0.39, 0.28]) {
      for (let step = 0; step < 36; step++) {
        const angle = start + step * Math.PI / 18;
        const at = offset(this.plan.center,
          Math.cos(angle) * WORLD.hexSize * range, Math.sin(angle) * WORLD.hexSize * range);
        if (this.free(at, radius) && (!connect || this.approach(at))) {
          this.reserve(at, radius);
          return at;
        }
      }
    }
  }
}
