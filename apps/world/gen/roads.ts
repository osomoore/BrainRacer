import { GEN, WORLD } from '../config';
import type { BiomeId, HexCoord, RoadPath, RoadSurface, Vec } from '../core/types';
import { segmentDistanceSquared } from './geometry';
import { hash01 } from './random';
import { edgeMidpoint, hexToWorld, neighbor } from './hex';

const ROAD_SURFACE: Record<BiomeId, RoadSurface> = {
  meadow: 'paved', lake: 'paved', snow: 'paved', mud: 'dirt', jungle: 'dirt',
  darkwood: 'dirt', desert: 'dirt', rocky: 'rocky', canyon: 'rocky', geyser: 'rocky',
};

/** Stable crossing point for an edge, shared exactly by both adjacent hexes. */
export function edgeCrossing(seed: number, coord: HexCoord, edge: number): Vec {
  const other = neighbor(coord, edge);
  const opposite = (edge + 3) % 6;
  if (edge >= 3) return edgeCrossing(seed, other, opposite);
  const midpoint = edgeMidpoint(coord, edge);
  const offset = (2 * hash01(seed, 'crossing', coord.q, coord.r, edge) - 1) * WORLD.hexSize * GEN.edgeJitter;
  const angle = edge * Math.PI / 3 + Math.PI / 2;
  return { x: midpoint.x + Math.cos(angle) * offset, y: midpoint.y + Math.sin(angle) * offset };
}

/** Opposite edge pairs make two continuous routes. The q/r lattice connects every hex. */
export function linkedEdges(): number[] {
  return [0, 1, 3, 4];
}

export function roadHub(seed: number, coord: HexCoord): Vec {
  const center = hexToWorld(coord);
  const angle = 2 * Math.PI * hash01(seed, 'junction', coord.q, coord.r);
  const radius = WORLD.hexSize * GEN.hubOffset * hash01(seed, 'junction-offset', coord.q, coord.r);
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/** Each half interpolates only its sideways displacement, with a normal tangent at the seam. */
export function buildRoads(seed: number, coord: HexCoord, biome: BiomeId): RoadPath[] {
  const hub = roadHub(seed, coord);
  return [0, 1].map(edge => {
    const a = edgeCrossing(seed, coord, edge + 3);
    const b = edgeCrossing(seed, coord, edge);
    const angle = edge * Math.PI / 3;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const samples = GEN.roadSamplesPerSide;
    const points = [a];
    for (const [from, to] of [[a, hub], [hub, b]]) {
      const dx = to.x - from.x, dy = to.y - from.y;
      const forward = dx * ux + dy * uy;
      const sideways = dy * ux - dx * uy;
      for (let i = 1; i < samples; i++) {
        const t = i / samples;
        const lateral = sideways * t * t * (3 - 2 * t);
        points.push({ x: from.x + ux * forward * t - uy * lateral, y: from.y + uy * forward * t + ux * lateral });
      }
      points.push(to);
    }
    return { kind: 'road', points, width: GEN.roadWidth, surface: ROAD_SURFACE[biome] };
  });
}

export function curvedPath(a: Vec, b: Vec, sign: number): RoadPath {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const radius = GEN.pathBendRadius * WORLD.hexSize / 1200;
  const sag = sign * Math.min(length * 0.12, length * length / (8 * radius));
  const points = length === 0 ? [a, b] : Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const bend = 4 * t * (1 - t) * sag;
    return { x: a.x + dx * t - dy / length * bend, y: a.y + dy * t + dx / length * bend };
  });
  return { kind: 'path', points, width: GEN.pathWidth, surface: 'dirt' };
}

/** True when a point lies within a road/path corridor, with optional extra clearance. */
export function roadOverlap(road: RoadPath, point: Vec, margin = 0): boolean {
  const limit = Math.max(0, road.width / 2 + margin) ** 2;
  for (let i = 1; i < road.points.length; i++) {
    if (segmentDistanceSquared(point.x, point.y, road.points[i - 1], road.points[i]) <= limit) return true;
  }
  return false;
}
