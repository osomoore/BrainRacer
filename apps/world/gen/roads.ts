import { GEN, WORLD } from '../config';
import type { HexCoord, RoadPath, Vec } from '../core/types';
import { segmentDistanceSquared } from './geometry';
import { hash } from './random';
import { distance, edgeMidpoint, hexToWorld, neighbor } from './hex';
/** Hard-coded gen distances were tuned for a 2400 px hex. */const K = WORLD.hexSize / 2400;

function canonicalPair(a: HexCoord, b: HexCoord): string[] {
  const ka = `${a.q},${a.r}`;
  const kb = `${b.q},${b.r}`;
  return ka < kb ? [ka, kb] : [kb, ka];
}

function unit(seed: number, ...parts: (number | string)[]): number {
  return hash(seed, ...parts) / 0x100000000;
}

function parentEdge(seed: number, coord: HexCoord): number {
  const here = distance(coord, { q: 0, r: 0 });
  if (here === 0) return -1;
  let bestEdge = -1;
  let bestRank = Infinity;
  for (let candidate = 0; candidate < 6; candidate += 1) {
    const next = neighbor(coord, candidate);
    if (distance(next, { q: 0, r: 0 }) >= here) continue;
    const [first, second] = canonicalPair(coord, next);
    const rank = hash(seed, 'parent', first, second);
    if (rank < bestRank) { bestRank = rank; bestEdge = candidate; }
  }
  return bestEdge;
}

/** Stable crossing point for an edge, shared exactly by both adjacent hexes. */
export function edgeCrossing(seed: number, coord: HexCoord, edge: number): Vec {
  const other = neighbor(coord, edge);
  const [first, second] = canonicalPair(coord, other);
  const isCanonical = `${coord.q},${coord.r}` === first;
  const canonicalCoord = isCanonical ? coord : other;
  const canonicalEdge = isCanonical ? edge : (edge + 3) % 6;
  const midpoint = edgeMidpoint(canonicalCoord, canonicalEdge);
  const offset = (unit(seed, 'crossing', first, second) * 2 - 1)
    * WORLD.hexSize * GEN.edgeJitter;
  // Edge 0's tangent points down; rotate clockwise with the edge index. Normalize its
  // orientation to the lexicographically first hex so the opposite edge gets the same point.
  const angle = (canonicalEdge * Math.PI) / 3 + Math.PI / 2;
  return { x: midpoint.x + Math.cos(angle) * offset, y: midpoint.y + Math.sin(angle) * offset };
}

/**
 * Symmetric road links. Every non-origin cell links to at least one neighbor closer to the origin,
 * while every row has a q-axis backbone. Hash-selected extra links add loops without breaking symmetry.
 */
export function linkedEdges(seed: number, coord: HexCoord): number[] {
  const result: number[] = [];
  const here = distance(coord, { q: 0, r: 0 });
  for (let edge = 0; edge < 6; edge += 1) {
    const next = neighbor(coord, edge);
    const [first, second] = canonicalPair(coord, next);
    const backbone = edge === 0 || edge === 3;
    const there = distance(next, { q: 0, r: 0 });
    const closer = (here > there && parentEdge(seed, coord) === edge)
      || (there > here && parentEdge(seed, next) === (edge + 3) % 6);
    const extra = unit(seed, 'link', first, second) < GEN.extraLinkChance;
    if (backbone || closer || extra) result.push(edge);
  }
  return result;
}

function sampleCurve(points: Vec[], kind: 'road' | 'path', width: number): RoadPath {
  if (points.length < 2) return { kind, points: points.slice(), width };
  if (points.length === 2) return { kind, points: points.slice(), width };
  const samples = Math.max(2, GEN.curveSamples);
  const result: Vec[] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const p0 = at(segment - 1);
    const p1 = at(segment);
    const p2 = at(segment + 1);
    const p3 = at(segment + 2);
    for (let i = 0; i < samples; i += 1) {
      const t = i / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      result.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  result.push(points[points.length - 1]);
  return { kind, points: result, width };
}

function between(a: Vec, b: Vec, t: number, lateral: number): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: a.x + dx * t - dy / length * lateral, y: a.y + dy * t + dx / length * lateral };
}

export function roadHub(seed: number, coord: HexCoord): Vec {
  const center = hexToWorld(coord);
  const angle = 2 * Math.PI * unit(seed, 'hubAngle', coord.q, coord.r);
  const [min, max] = GEN.hubOffset;
  const radius = min + (max - min) * unit(seed, 'hubRadius', coord.q, coord.r);
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/** Close arrivals share a trunk. Each crossing retains the common edge point and a normal approach. */
export function buildRoads(seed: number, coord: HexCoord, links: number[]): RoadPath[] {
  const hub = roadHub(seed, coord);
  const arrivals = links.map(edge => {
    const crossing = edgeCrossing(seed, coord, edge);
    return { edge, crossing, angle: Math.atan2(crossing.y - hub.y, crossing.x - hub.x) };
  });
  const roads: RoadPath[] = [];
  while (arrivals.length) {
    const first = arrivals.shift()!;
    const match = arrivals.findIndex(other => Math.cos(other.angle - first.angle) > Math.cos(GEN.sharedApproachAngle));
    const group = match < 0 ? [first] : [first, ...arrivals.splice(match, 1)];
    let fork = hub;
    if (group.length === 2) {
      const [a, b] = group.map(arrival => arrival.crossing);
      const midpoint = between(a, b, 0.5, 0);
      fork = between(hub, midpoint, 0.32, 0);
      roads.push(sampleCurve([hub, between(hub, fork, 0.50, 95 * K), fork], 'road', GEN.roadWidth));
    }
    for (const { edge, crossing } of group) {
      const rank = (tag: string) => unit(seed, tag, coord.q, coord.r, edge);
      const [few, many] = GEN.roadBends;
      const bends = few + Math.floor(rank('bends') * (many - few + 1));
      const [min, max] = GEN.roadBendOffset;
      const sign = rank('bend') < 0.5 ? -1 : 1;
      const angle = edge * Math.PI / 3;
      const approach = { x: crossing.x - 260 * K * Math.cos(angle), y: crossing.y - 260 * K * Math.sin(angle) };
      const controls = Array.from({ length: bends }, (_, i) =>
        between(fork, approach, (i + 1) / (bends + 1), sign * (-1) ** i * (min + (max - min) * rank('bend' + i))));
      roads.push(sampleCurve([fork, ...controls, approach, crossing], 'road', GEN.roadWidth));
    }
  }
  return roads;
}

/** Smoothed path through feature waypoints, retaining every endpoint. */
export function pathThrough(points: Vec[]): RoadPath {
  return sampleCurve(points, 'path', GEN.pathWidth);
}

export function curvedPath(a: Vec, b: Vec, sign: number): RoadPath {
  const bend = Math.min(GEN.pathBendOffset, Math.hypot(b.x - a.x, b.y - a.y) * 0.22);
  return pathThrough([a, between(a, b, 0.5, bend * sign), b]);
}

/** True when a point lies within a road/path corridor, with optional extra clearance. */
export function roadOverlap(road: RoadPath, point: Vec, margin = 0): boolean {
  const limit = Math.max(0, road.width / 2 + margin) ** 2;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1];
    const b = road.points[i];
    if (segmentDistanceSquared(point.x, point.y, a, b) <= limit) return true;
  }
  return false;
}
