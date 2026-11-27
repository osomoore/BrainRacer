import type { Rng } from '../../workshop/core/rng';
import { GEN } from '../config';
import type { ActivityKind, ActivityTarget, Feature, FeatureKind, SurfaceKind, TraitNeed, Vec } from '../core/types';
import { hexKey } from './hex';
import { box, ellipse, offset, type HexLayout } from './layout';
import { pathThrough } from './roads';

export interface FeatureSite {
  kind: ActivityKind;
  at: Vec;
  targets: ActivityTarget[];
}

function buildLake(frame: FeatureFrame, rng: Rng): FeatureSite {
  frame.blob('shallow', ellipse({ x: 0, y: 20 }, 570, 316));
  frame.blob('deep', ellipse({ x: 0, y: 20 }, 448, 249));
  frame.blob('grass', ellipse({ x: 235, y: 55 }, 95, 77, rng));

  frame.connect(-220, -320);
  frame.path([{ x: -220, y: -320 }, { x: -220, y: 330 }]);
  const low = rng.chance(0.5);
  frame.feature('bridge', { x: -220, y: 20 }, box(-320, -253, -120, 293),
    low ? [{ trait: 'height', max: 2 }, { trait: 'width', max: 3 }] : undefined, low);
  if (low) {
    // This path crosses the shallow shelf, beyond the deep pool.
    frame.path([
      { x: -220, y: -320 }, { x: -490, y: -253 }, { x: -540, y: 20 },
      { x: -490, y: 280 }, { x: -220, y: 330 },
    ]);
  }

  frame.connect(235, -292);
  return { kind: 'islandSwim', at: frame.point(235, -292),
    targets: [{ at: frame.point(235, 55), role: 'island' }] };
}

function buildPassage(frame: FeatureFrame, kind: 'tunnel' | 'cave' | 'narrow' | 'jump'): FeatureSite | undefined {
  const canyon = frame.layout.plan.biome === 'canyon';
  if (canyon) {
    frame.blob('cliff', ellipse({ x: -245, y: 0 }, 144, 330));
    frame.blob('cliff', ellipse({ x: 232, y: 0 }, 118, 305));
  } else if (kind === 'narrow') {
    frame.blob('rough', ellipse({ x: -217, y: 0 }, 125, 305));
    frame.blob('rough', ellipse({ x: 217, y: 0 }, 125, 305));
  }
  if (kind === 'jump') frame.blob('cliff', box(-112, -18, 112, 132));

  const covered = kind === 'cave' || kind === 'tunnel';
  if (covered) {
    frame.layout.plan.terrain.push({
      kind: 'rough', poly: ellipse({ x: 0, y: 0 }, 150, 260).map(p => frame.point(p.x, p.y)),
      covered: true, dark: kind === 'cave' ? 0.92 : 0.78,
    });
  }
  const needs: TraitNeed[] = kind === 'jump' ? [{ trait: 'jump', min: 2 }] : [{ trait: 'width', max: 2 }];
  if (covered) needs.push({ trait: 'height', max: 2 });

  frame.connect(0, -505);
  frame.path([{ x: 0, y: -505 }, { x: 0, y: 505 }]);
  frame.path([
    { x: 0, y: -505 }, { x: 420, y: -390 }, { x: 464, y: 0 },
    { x: 420, y: 390 }, { x: 0, y: 505 },
  ]);
  const start = kind === 'jump' ? -175 : -255;
  frame.feature(kind, { x: 0, y: kind === 'jump' ? -150 : 0 },
    box(-105, start, 105, kind === 'jump' ? 158 : 255), needs, true);
  if (covered) return {
    kind: 'lanternCave', at: frame.point(0, -305),
    targets: [-145, 0, 145].map(y => ({ at: frame.point(0, y), role: 'lantern' })),
  };
  if (kind === 'jump') return {
    kind: 'ringJump', at: frame.point(0, -270),
    targets: [25, 120, 225].map(y => ({ at: frame.point(0, y), role: 'ring' })),
  };
}

export function buildFeatures(layout: HexLayout, rng: Rng): FeatureSite | undefined {
  const { biome } = layout.plan;
  if (biome !== 'lake' && biome !== 'canyon' && biome !== 'darkwood'
      && biome !== 'rocky' && biome !== 'jungle') return;
  const roomier = layout.place(rng, GEN.featureRadius);
  const scale = roomier ? 1 : 0.83;
  const at = roomier ?? layout.place(rng, GEN.featureRadius * scale);
  if (!at) return;
  const frame = new FeatureFrame(layout, at, scale);
  switch (biome) {
    case 'lake': return buildLake(frame, rng);
    case 'canyon': return buildPassage(frame, rng.pick(['jump', 'tunnel', 'narrow']));
    case 'darkwood': return buildPassage(frame, 'cave');
    case 'jungle': return buildPassage(frame, 'narrow');
    case 'rocky':
      frame.connect(0, -340);
      frame.path([{ x: 0, y: -340 }, { x: 0, y: 300 }]);
      frame.feature('jump', { x: 0, y: -100 }, box(-100, -145, 100, -50));
      return {
        kind: 'ringJump', at: frame.point(0, -245),
        targets: [0, 100, 200].map(y => ({ at: frame.point(0, y), role: 'ring' })),
      };
  }
}

/** Feature shapes are drawn in a local frame with +y pointing away from the hub. */
class FeatureFrame {
  private readonly dir: number;
  private readonly sin: number;
  private readonly cos: number;

  constructor(readonly layout: HexLayout, private readonly origin: Vec, private readonly scale: number) {
    const { center } = layout.plan;
    this.dir = Math.atan2(origin.y - center.y, origin.x - center.x);
    this.sin = Math.sin(this.dir);
    this.cos = Math.cos(this.dir);
  }

  point(x: number, y: number): Vec {
    return offset(this.origin, this.scale * (x * this.sin + y * this.cos),
      this.scale * (y * this.sin - x * this.cos));
  }

  blob(kind: SurfaceKind, local: Vec[]): void {
    this.layout.plan.terrain.push({ kind, poly: local.map(p => this.point(p.x, p.y)) });
  }

  feature(kind: FeatureKind, at: Vec, local: Vec[], needs?: TraitNeed[], bypass?: boolean): void {
    const plan = this.layout.plan;
    const feature: Feature = {
      id: `${hexKey(plan.coord)}:f${plan.features.length}`,
      kind, at: this.point(at.x, at.y), area: local.map(p => this.point(p.x, p.y)), dir: this.dir,
    };
    if (needs) feature.needs = needs;
    if (bypass) feature.bypass = true;
    plan.features.push(feature);
  }

  path(points: Vec[]): void {
    this.layout.plan.roads.push(pathThrough(points.map(p => this.point(p.x, p.y))));
  }

  connect(x: number, y: number): void {
    this.layout.plan.roads.push(pathThrough([this.layout.plan.center, this.point(x, y)]));
  }
}
