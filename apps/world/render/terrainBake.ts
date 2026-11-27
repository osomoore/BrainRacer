import type { WorldQuery } from '../core/runtime';
import type { Feature, HexCoord, HexPlan, RoadPath, SurfaceKind, Vec } from '../core/types';
import { prepareSurface } from '../gen/surface';

const COLORS: Record<SurfaceKind, readonly [number, number, number]> = {
  grass: [134, 173, 91],
  tallGrass: [74, 132, 76],
  sand: [222, 180, 114],
  snow: [223, 239, 244],
  ice: [143, 203, 218],
  mud: [162, 116, 77],
  deepMud: [104, 71, 62],
  rough: [162, 151, 132],
  shallow: [87, 178, 181],
  deep: [44, 119, 165],
  hotSpring: [91, 185, 155],
  cliff: [121, 86, 76],
  road: [107, 106, 112],
  path: [201, 156, 100],
  bridge: [180, 128, 78],
};

const ATLAS_TILE = 48;
const MOTIF_SPACING = 54;

/** Seeded integer lattice hash shared by the paint and surface details. */
function grain(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 0x3243f6a9) ^ Math.imul(y, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 15), 0x1b56c4e9);
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
}

function mottling(seed: number, gx: number, gy: number): number {
  const x = Math.floor(gx / 9);
  const y = Math.floor(gy / 9);
  const u = gx / 9 - x;
  const v = gy / 9 - y;
  const top = grain(seed, x, y) * (1 - u) + grain(seed, x + 1, y) * u;
  const bottom = grain(seed, x, y + 1) * (1 - u) + grain(seed, x + 1, y + 1) * u;
  return (top * (1 - v) + bottom * v - 0.5) * 23 + (grain(seed, gx, gy) - 0.5) * 7;
}

function water(kind: SurfaceKind): boolean {
  return kind === 'shallow' || kind === 'deep';
}

function travelSurface(kind: SurfaceKind): boolean {
  return kind === 'road' || kind === 'path' || kind === 'bridge';
}

function createCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d')!;
}

interface Ground {
  kind: SurfaceKind[];
  firstX: number;
  firstY: number;
  cells: number;
}

const surfaceSamplers = new WeakMap<HexPlan, ReturnType<typeof prepareSurface>>();

function samplerFor(plan: HexPlan): ReturnType<typeof prepareSurface> {
  let sample = surfaceSamplers.get(plan);
  if (!sample) {
    sample = prepareSurface(plan);
    surfaceSamplers.set(plan, sample);
  }
  return sample;
}

function shoreLand(kind: SurfaceKind): boolean {
  return !water(kind) && !travelSurface(kind);
}

let gridCanvas: CanvasRenderingContext2D | undefined;

function bakeGround(ctx: CanvasRenderingContext2D, world: WorldQuery, x: number, y: number,
  size: number, cell: number): Ground {
  const padding = Math.ceil(ATLAS_TILE * 0.56 / cell) + 2;
  const firstX = Math.floor(x / cell) - padding;
  const firstY = Math.floor(y / cell) - padding;
  const cells = Math.ceil(size / cell) + 2 * padding + 1;
  if (gridCanvas?.canvas.width !== cells) gridCanvas = createCanvas(cells, cells);
  const grid = gridCanvas.createImageData(cells, cells);
  const pixels = grid.data;
  const kind: SurfaceKind[] = [];

  const sameHex = (a: HexCoord, b: HexCoord) => a.q === b.q && a.r === b.r;
  const lastX = (firstX + cells - 1) * cell;
  for (let row = 0; row < cells; row++) {
    const gy = firstY + row;
    const wy = gy * cell;
    const rightHex = world.hexAt(lastX, wy);
    let col = 0;
    while (col < cells) {
      const hex = world.hexAt((firstX + col) * cell, wy);
      let end = cells;
      if (!sameHex(hex, rightHex)) {
        // A hex is convex. Find the first sample outside this hex once for the whole run.
        let inside = col, outside = cells - 1;
        while (outside - inside > 1) {
          const mid = (inside + outside) >>> 1;
          if (sameHex(hex, world.hexAt((firstX + mid) * cell, wy))) inside = mid;
          else outside = mid;
        }
        end = outside;
      }
      const plan = world.plan(hex);
      const surfaceAt = samplerFor(plan);
      for (; col < end; col++) {
        const gx = firstX + col;
        const surface = surfaceAt(gx * cell, wy).kind;
        const i = row * cells + col;
        kind.push(surface);
        const [r, g, b] = COLORS[surface];
        const tint = mottling(world.seed, gx, gy);
        const darkwood = plan.biome === 'darkwood' && !travelSurface(surface);
        pixels[i * 4] = r + tint - (darkwood ? 22 : 0);
        pixels[i * 4 + 1] = g + tint - (darkwood ? 12 : 0);
        pixels[i * 4 + 2] = b + tint;
        pixels[i * 4 + 3] = 255;
      }
    }
  }

  for (let row = 1; row < cells - 1; row++) {
    for (let col = 1; col < cells - 1; col++) {
      const i = row * cells + col;
      const surface = kind[i];
      const north = kind[i - cells];
      const south = kind[i + cells];
      const west = kind[i - 1];
      const east = kind[i + 1];
      if (surface === 'shallow' && (shoreLand(north) || shoreLand(south) || shoreLand(west) || shoreLand(east))) {
        // A pale band of wet sand and foam along the shallow side of the shore.
        pixels.set([161, 204, 179], i * 4);
      } else if (surface === 'deep' && (north === 'shallow' || south === 'shallow' || west === 'shallow' || east === 'shallow')) {
        pixels.set([61, 151, 178], i * 4);
      } else if (surface === 'cliff' && (north !== 'cliff' || west !== 'cliff')) {
        pixels.set([169, 124, 101], i * 4);
      } else if (surface !== 'cliff' && !travelSurface(surface) && (north === 'cliff' || west === 'cliff')) {
        // Keep the shaded face on the south and east of a raised lip.
        pixels[i * 4] *= 0.69;
        pixels[i * 4 + 1] *= 0.67;
        pixels[i * 4 + 2] *= 0.71;
      }
    }
  }

  gridCanvas.putImageData(grid, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(gridCanvas.canvas, firstX * cell - x - cell / 2, firstY * cell - y - cell / 2,
    cells * cell, cells * cell);
  return { kind, firstX, firstY, cells };
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  color: string, tilt = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function tuft(ctx: CanvasRenderingContext2D, color: string, height: number): void {
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.quadraticCurveTo(-7, -height / 2, -13, -height / 2 - 1);
  ctx.moveTo(0, 4);
  ctx.quadraticCurveTo(-2, -height * 0.7, -4, -height);
  ctx.moveTo(6, 4);
  ctx.quadraticCurveTo(6, -height / 2, 13, -height + 3);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function ripples(ctx: CanvasRenderingContext2D, color: string, width: number, offset: number): void {
  ctx.beginPath();
  ctx.moveTo(-width / 2, 1);
  ctx.quadraticCurveTo(-width / 4, -3, 0, 1);
  ctx.quadraticCurveTo(width / 4, 5, width / 2, 1);
  ctx.moveTo(-width / 3 + offset, 7);
  ctx.quadraticCurveTo(offset, 3, width / 3 + offset, 7);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function pebbles(ctx: CanvasRenderingContext2D, dark: string, light: string): void {
  ellipse(ctx, -9, 3, 5, 3, dark, -0.38);
  ellipse(ctx, -10, 1, 4, 2, light, -0.38);
  ellipse(ctx, 5, -4, 7, 4, dark, 0.26);
  ellipse(ctx, 4, -6, 5, 2.8, light, 0.26);
  ellipse(ctx, 10, 5, 2, 1.5, light);
}

const MOTIFS = {
  grass(ctx: CanvasRenderingContext2D) {
    tuft(ctx, '#46683666', 8);
    ellipse(ctx, -7, -9, 2.3, 2.1, '#ffe8a0b3');
  },
  tallGrass(ctx: CanvasRenderingContext2D) {
    tuft(ctx, '#263b2c9c', 16);
    ctx.translate(1.5, -1);
    tuft(ctx, '#b6c8697a', 15);
  },
  sand(ctx: CanvasRenderingContext2D) {
    ripples(ctx, '#a46b3a6b', 35, 4);
    ctx.translate(0, -2);
    ripples(ctx, '#ffedb384', 34, 4);
  },
  snow(ctx: CanvasRenderingContext2D) {
    ellipse(ctx, 0, 0, 14, 5, '#b5d5e16e', -0.18);
    ellipse(ctx, 0, -2, 13, 4, '#ffffffb0', -0.18);
  },
  ice(ctx: CanvasRenderingContext2D) {
    ellipse(ctx, 0, -3, 17, 1.8, '#edfffeb0', -0.57);
    ellipse(ctx, 4, 3, 8, 1.2, '#e9fff198', -0.57);
  },
  mud(ctx: CanvasRenderingContext2D) {
    ellipse(ctx, 0, 2, 15, 5, '#70523a7d', -0.13);
    ellipse(ctx, -1, 1, 12, 3.8, '#c5a0778c', -0.13);
    ellipse(ctx, -5, 0, 6, 1.1, '#f2cb947d', -0.13);
  },
  deepMud(ctx: CanvasRenderingContext2D) {
    ellipse(ctx, 0, 0, 18, 6, '#3f34336b', -0.2);
    ellipse(ctx, -2, 1, 13, 3.3, '#c69e8f70', -0.2);
  },
  rough(ctx: CanvasRenderingContext2D) {
    pebbles(ctx, '#6259468f', '#e5d8b9c4');
  },
  shallow(ctx: CanvasRenderingContext2D) {
    ripples(ctx, '#d8f8dd94', 33, 5);
  },
  deep(ctx: CanvasRenderingContext2D) {
    ripples(ctx, '#a0e4f17a', 40, -3);
  },
  hotSpring(ctx: CanvasRenderingContext2D) {
    ellipse(ctx, 0, 1, 12, 7, '#def8a3a3', -0.15);
    ellipse(ctx, 0, 2, 9, 5, '#55a67cb0', -0.15);
    ellipse(ctx, -2, -1, 4, 1.5, '#f0fff1dc', -0.15);
    ellipse(ctx, 12, -5, 3, 2.5, '#eeffd4bd');
  },
  cliff(ctx: CanvasRenderingContext2D) {
    ripples(ctx, '#50382c91', 31, 4);
    ctx.translate(0, -2);
    ripples(ctx, '#bb8e71a3', 31, 4);
  },
} satisfies Partial<Record<SurfaceKind, (ctx: CanvasRenderingContext2D) => void>>;

let motifAtlas: { canvas: HTMLCanvasElement; tiles: Map<SurfaceKind, number> } | undefined;

function getMotifAtlas(): NonNullable<typeof motifAtlas> {
  if (motifAtlas) return motifAtlas;
  const entries = Object.entries(MOTIFS) as [SurfaceKind, (ctx: CanvasRenderingContext2D) => void][];
  const ctx = createCanvas(entries.length * ATLAS_TILE, ATLAS_TILE);
  const tiles = new Map<SurfaceKind, number>();
  entries.forEach(([kind, paint], index) => {
    const left = index * ATLAS_TILE;
    tiles.set(kind, left);
    ctx.save();
    ctx.translate(left + ATLAS_TILE / 2, ATLAS_TILE / 2);
    ctx.lineCap = 'round';
    paint(ctx);
    ctx.restore();
  });
  motifAtlas = { canvas: ctx.canvas, tiles };
  return motifAtlas;
}

function paintDetails(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number,
  size: number, cell: number, ground: Ground): void {
  const { canvas, tiles } = getMotifAtlas();
  const firstX = Math.floor((x - ATLAS_TILE) / MOTIF_SPACING);
  const firstY = Math.floor((y - ATLAS_TILE) / MOTIF_SPACING);
  for (let gy = firstY; gy * MOTIF_SPACING < y + size + ATLAS_TILE; gy++) {
    for (let gx = firstX; gx * MOTIF_SPACING < x + size + ATLAS_TILE; gx++) {
      const density = grain(seed ^ 0x7a19abdf, gx, gy);
      if (density < 0.19) continue;
      const wx = (gx + grain(seed, gx, gy)) * MOTIF_SPACING;
      const wy = (gy + grain(seed ^ 0x4f73a4f1, gx, gy)) * MOTIF_SPACING;
      const stamp = ATLAS_TILE * (0.68 + density * 0.44);
      const sx = wx - x - stamp / 2;
      const sy = wy - y - stamp / 2;
      if (sx >= size || sy >= size || sx + stamp <= 0 || sy + stamp <= 0) continue;

      const col = Math.round(wx / cell) - ground.firstX;
      const row = Math.round(wy / cell) - ground.firstY;
      const i = row * ground.cells + col;
      const kind = ground.kind[i];
      const tile = tiles.get(kind);
      if (tile === undefined) continue;
      // Fade stamps that straddle a boundary so the same surface blend remains visible beneath them.
      ctx.globalAlpha = ground.kind[i - 1] === kind && ground.kind[i + 1] === kind
        && ground.kind[i - ground.cells] === kind && ground.kind[i + ground.cells] === kind ? 1 : 0.32;
      ctx.drawImage(canvas, tile, 0, ATLAS_TILE, ATLAS_TILE, sx, sy, stamp, stamp);
    }
  }
  ctx.globalAlpha = 1;
}

interface Shape {
  path: Path2D;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function makeShape(points: readonly Vec[], margin: number, closed = false): Shape {
  const path = new Path2D();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  points.forEach(({ x, y }, index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  });
  if (closed) path.closePath();
  return { path, left: left - margin, top: top - margin, right: right + margin, bottom: bottom + margin };
}

function touches(shape: Shape, x: number, y: number, size: number): boolean {
  return shape.right > x && shape.bottom > y && shape.left < x + size && shape.top < y + size;
}

function centerline(road: RoadPath): Path2D {
  const path = new Path2D();
  const distances = [0];
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1];
    const b = road.points[i];
    distances.push(distances[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const trim = road.width * 0.72;
  const end = (distances.at(-1) ?? 0) - trim;
  if (end <= trim) return path;
  for (let i = 1; i < road.points.length; i++) {
    const from = distances[i - 1];
    const to = distances[i];
    if (to <= trim || from >= end || from === to) continue;
    const a = road.points[i - 1];
    const b = road.points[i];
    const t0 = (Math.max(from, trim) - from) / (to - from);
    const t1 = (Math.min(to, end) - from) / (to - from);
    if (from <= trim) path.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
    path.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
  }
  return path;
}

interface Route { shape: Shape; width: number; center?: Path2D }
const routeShapes = new WeakMap<RoadPath, Route>();
const bridgeShapes = new WeakMap<Feature, Shape>();

function routeShape(road: RoadPath): Route {
  let route = routeShapes.get(road);
  if (!route) {
    route = { shape: makeShape(road.points, road.width / 2 + 18), width: road.width,
      center: road.kind === 'road' ? centerline(road) : undefined };
    routeShapes.set(road, route);
  }
  return route;
}

function bridgeShape(bridge: Feature): Shape {
  let shape = bridgeShapes.get(bridge);
  if (!shape) {
    shape = makeShape(bridge.area, 8, true);
    bridgeShapes.set(bridge, shape);
  }
  return shape;
}

function paintRoutes(ctx: CanvasRenderingContext2D, routes: readonly Route[], path: boolean): void {
  ctx.strokeStyle = path ? '#896d4b' : '#625b54';
  for (const r of routes) {
    ctx.lineWidth = r.width + 20;
    ctx.stroke(r.shape.path);
  }
  ctx.strokeStyle = path ? '#e5b879' : '#c2bbae';
  for (const r of routes) {
    ctx.lineWidth = r.width + 8;
    ctx.stroke(r.shape.path);
  }
  ctx.strokeStyle = path ? '#c99c64' : '#6b6a70';
  for (const r of routes) {
    ctx.lineWidth = r.width - 4;
    ctx.stroke(r.shape.path);
  }
  if (path) return;
  ctx.setLineDash([27, 24]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f2d786';
  for (const r of routes) if (r.center) ctx.stroke(r.center);
  ctx.setLineDash([]);
}

function paintBridge(ctx: CanvasRenderingContext2D, bridge: Feature, shape: Shape): void {
  ctx.strokeStyle = '#523d33';
  ctx.lineWidth = 10;
  ctx.stroke(shape.path);
  ctx.fillStyle = '#bf9159';
  ctx.fill(shape.path);

  ctx.save();
  ctx.clip(shape.path);
  ctx.translate(bridge.at.x, bridge.at.y);
  ctx.rotate(bridge.dir);
  const cos = Math.cos(bridge.dir);
  const sin = Math.sin(bridge.dir);
  const local = bridge.area.map(p => ({
    x: (p.x - bridge.at.x) * cos + (p.y - bridge.at.y) * sin,
    y: -(p.x - bridge.at.x) * sin + (p.y - bridge.at.y) * cos,
  }));
  const start = Math.min(...local.map(p => p.x));
  const end = Math.max(...local.map(p => p.x));
  const left = Math.min(...local.map(p => p.y));
  const right = Math.max(...local.map(p => p.y));
  for (let board = start + 20; board < end; board += 20) {
    ctx.fillStyle = '#946741';
    ctx.fillRect(board, left, 2, right - left);
    ctx.fillStyle = '#e5b47b';
    ctx.fillRect(board + 2, left, 2, right - left);
  }
  ctx.fillStyle = '#77503a';
  ctx.fillRect(start, left, end - start, 8);
  ctx.fillRect(start, right - 8, end - start, 8);
  ctx.restore();
}

export function bakeTerrain(ctx: CanvasRenderingContext2D, world: WorldQuery, x: number, y: number,
  size: number, cellSize: number): void {
  const paths: Route[] = [];
  const roads: Route[] = [];
  const bridges: { feature: Feature; shape: Shape }[] = [];
  for (const coord of world.hexesNear(x + size / 2, y + size / 2, 1)) {
    const plan = world.plan(coord);
    for (const road of plan.roads) {
      const route = routeShape(road);
      if (touches(route.shape, x, y, size)) (road.kind === 'path' ? paths : roads).push(route);
    }
    for (const feature of plan.features) {
      if (feature.kind !== 'bridge') continue;
      const shape = bridgeShape(feature);
      if (touches(shape, x, y, size)) bridges.push({ feature, shape });
    }
  }

  ctx.save();
  const ground = bakeGround(ctx, world, x, y, size, cellSize);
  paintDetails(ctx, world.seed, x, y, size, cellSize, ground);
  ctx.translate(-x, -y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  paintRoutes(ctx, paths, true);
  paintRoutes(ctx, roads, false);
  for (const { feature, shape } of bridges) paintBridge(ctx, feature, shape);
  ctx.restore();
}
