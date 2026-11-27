import type { Rng } from '../../workshop/core/rng';
import { GEN } from '../config';
import type { ActivityKind, ActivityTarget, Feature, FeatureKind, SurfaceKind, TraitNeed, Vec } from '../core/types';
import { hexKey } from './hex';
import { box, organic, offset, type HexLayout } from './layout';
import { curvedPath, pathThrough } from './roads';

export interface FeatureSite {
  kind: ActivityKind;
  at: Vec;
  targets: ActivityTarget[];
}

function buildPassage(frame: FeatureFrame, kind: 'tunnel' | 'cave' | 'narrow', rng: Rng): FeatureSite | undefined {
  const canyon = frame.layout.plan.biome === 'canyon';
  const { wallOffset, wallWidth, wallLength, mouth, detour } = GEN.canyon;
  const end = canyon ? mouth : 505;
  const turn = canyon ? detour : 470;
  if (canyon) {
    frame.blob('cliff', organic({ x: -wallOffset, y: 0 }, wallWidth, wallLength, rng, 0.06));
    frame.blob('cliff', organic({ x: wallOffset, y: 0 }, wallWidth, wallLength, rng, 0.06));
    frame.blob('cliff', box(-112, -22, 112, 108));
  } else if (kind === 'narrow') {
    frame.blob('rough', organic({ x: -217, y: 0 }, 125, 305, rng));
    frame.blob('rough', organic({ x: 217, y: 0 }, 125, 305, rng));
  }
  const covered = kind === 'cave' || kind === 'tunnel';
  if (covered) {
    frame.layout.plan.terrain.push({
      kind: 'rough', poly: organic({ x: 0, y: 0 }, 145, 255, rng).map(p => frame.point(p.x, p.y)),
      covered: true, dark: kind === 'cave' ? 0.92 : 0.78,
    });
  }
  const needs: TraitNeed[] = [{ trait: 'width', max: 2 }];
  if (covered) needs.push({ trait: 'height', max: 2 });

  frame.path([
    { x: 0, y: -end }, { x: turn, y: -end + 85 }, { x: turn + 25, y: 0 },
    { x: turn, y: end - 85 }, { x: 0, y: end },
  ]);
  frame.path([{ x: 0, y: -end }, { x: -25, y: -end / 2 }, { x: 0, y: end }]);
  frame.connect(0, -end);
  frame.feature(kind, { x: 0, y: 0 }, box(-103, -255, 103, 255), needs, true);
  if (canyon) {
    if (covered) frame.feature('narrow', { x: 0, y: -365 }, box(-103, -450, 103, -275),
      [{ trait: 'width', max: 2 }], true);
    frame.feature('jump', { x: 0, y: -75 }, box(-104, -100, 104, 108), [{ trait: 'jump', min: 2 }], true);
  }
  if (kind === 'cave') return {
    kind: 'lanternCave', at: frame.point(0, -305),
    targets: [-145, 0, 145].map(y => ({ at: frame.point(0, y), role: 'lantern' })),
  };
}

export function buildFeatures(layout: HexLayout, rng: Rng): FeatureSite | undefined {
  const { biome } = layout.plan;
  if (biome !== 'canyon' && biome !== 'darkwood' && biome !== 'rocky' && biome !== 'jungle') return;
  const radius = biome === 'canyon' ? GEN.canyon.featureRadius : GEN.featureRadius;
  let frame: FeatureFrame | undefined;
  for (const scale of [1, 0.78, 0.53, 0.46]) {
    const at = layout.place(rng, radius * scale);
    if (!at) continue;
    frame = new FeatureFrame(layout, at, scale);
    break;
  }
  if (!frame) return;
  switch (biome) {
    case 'canyon': return buildPassage(frame, rng.chance(0.32) ? 'tunnel' : 'narrow', rng);
    case 'darkwood': return buildPassage(frame, 'cave', rng);
    case 'jungle': return buildPassage(frame, 'narrow', rng);
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
    const center = layout.hub;
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
    this.layout.plan.roads.push(curvedPath(this.layout.hub, this.point(x, y), -1));
  }
}
