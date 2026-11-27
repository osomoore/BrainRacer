import { GEN, WORLD } from '../config';
import type { HexCoord, RoadPath, Vec } from '../core/types';
import { hash } from './random';
import { distance, edgeMidpoint, hexToWorld, neighbor } from './hex';

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

/** Road legs from the hex hub to each shared edge crossing. */
export function buildRoads(seed: number, coord: HexCoord, links: number[]): RoadPath[] {
  const center = hexToWorld(coord);
  return links.map((edge) => {
    const crossing = edgeCrossing(seed, coord, edge);
    // A small deterministic bend, constrained to this hex, gives roads a natural winding feel.
    const toward = { x: crossing.x - center.x, y: crossing.y - center.y };
    const length = Math.hypot(toward.x, toward.y) || 1;
    const bendSign = unit(seed, 'bend', coord.q, coord.r, edge) < 0.5 ? -1 : 1;
    const bend = WORLD.hexSize * 0.12 * bendSign;
    const control = {
      x: (center.x + crossing.x) / 2 - (toward.y / length) * bend,
      y: (center.y + crossing.y) / 2 + (toward.x / length) * bend,
    };
    // Keep the curve control point inside the current hex footprint.
    const limit = WORLD.hexSize * 0.72;
    const cx = control.x - center.x;
    const cy = control.y - center.y;
    const scale = Math.min(1, limit / (Math.hypot(cx, cy) || 1));
    const safeControl = { x: center.x + cx * scale, y: center.y + cy * scale };
    return sampleCurve([center, safeControl, crossing], 'road', GEN.roadWidth);
  });
}

/** Smoothed path through activity locations, retaining every endpoint. */
export function pathThrough(points: Vec[]): RoadPath {
  return sampleCurve(points, 'path', GEN.pathWidth);
}

/** True when a point lies within a road/path corridor, with optional extra clearance. */
export function roadOverlap(road: RoadPath, point: Vec, margin = 0): boolean {
  const threshold = Math.max(0, road.width / 2 + margin);
  const limit = threshold * threshold;
  for (let i = 1; i < road.points.length; i += 1) {
    const a = road.points[i - 1];
    const b = road.points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
    const px = point.x - (a.x + t * dx);
    const py = point.y - (a.y + t * dy);
    if (px * px + py * py <= limit) return true;
  }
  return false;
}
