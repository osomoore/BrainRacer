/**
 * Baked building looks (canvas 2D, once per unique size/style): a beveled frustum with four sloped
 * side faces shaded by a FIXED world light (top-left), an inset roof with parapet rim, and a soft
 * drop shadow. Static images, so they cost nothing per frame and rotate with each camera.
 * `ensureCastShadow` is the generalized baker (any direction/length, rect or ellipse footprint) used by the Farm.
 */
import Phaser from 'phaser';
import { TEX } from '../core/assetKeys';

export const BUILDING_3D = {
  bevelBase: 20,          // px, bevel width (visible slope of each side face)
  bevelPerStyle: [0, 5, 10] as number[], // extra bevel by style % 3 -> "taller" buildings
  shadowMargin: 56,       // transparent margin around the shadow texture
  shadowOffset: { x: 20, y: 24 },
  shadowBlur: 26,
  shadowAlpha: 0.38,
  outline: '#141a2c',
  // faces, light from the top-left: north/west lit, south/east in shade
  faceNorth: ['#e4eaf8', '#b9c3de'],
  faceWest: ['#c9d2ea', '#98a3c4'],
  faceSouth: ['#59627f', '#3d4560'],
  faceEast: ['#4a5270', '#303852'],
};

export function bevelFor(style: number): number {
  const B = BUILDING_3D;
  return B.bevelBase + B.bevelPerStyle[style % B.bevelPerStyle.length];
}

export function shadowKey(w: number, h: number): string { return `bshadow_${w}x${h}`; }
export function bodyKey(w: number, h: number, style: number): string { return `bbody_${w}x${h}_s${style}`; }

export function ensureShadowTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = shadowKey(w, h);
  if (scene.textures.exists(key)) return key;
  const B = BUILDING_3D, m = B.shadowMargin;
  const tex = scene.textures.createCanvas(key, w + m * 2, h + m * 2);
  if (!tex) return key;
  const c = tex.getContext();
  c.shadowColor = `rgba(0,0,0,${B.shadowAlpha})`;
  c.shadowBlur = B.shadowBlur;
  c.shadowOffsetX = B.shadowOffset.x + 2000; // draw the caster far off-canvas, keep only its shadow
  c.shadowOffsetY = B.shadowOffset.y;
  c.fillStyle = '#000';
  c.fillRect(m - 2000, m, w, h);
  tex.refresh();
  return key;
}

/** A long directional drop shadow (low sun). Footprint is centred on the caster's origin. */
export interface CastShadow {
  /** Footprint size (px) along the caster's local x / y. */
  w: number; h: number;
  shape?: 'rect' | 'ellipse';
  /** Caster's own rotation (rad); the shadow direction stays in world space. */
  rotation?: number;
  /** World-space direction the shadow falls (rad, 0 = +x) and its length (px) from base to tip. */
  angle: number; length: number;
  /** Offset (px, along `angle`) where the swept shadow starts: >0 for a lifted part like a tree canopy. */
  start?: number;
  alpha?: number;
  blur?: number;
  color?: string;
  /** 0..1: how much lighter the tip is than the base. */
  fade?: number;
}

export interface CastShadowTex {
  key: string;
  /** Texture-pixel position of the caster's centre (use as origin) and the texture size. */
  ox: number; oy: number; tw: number; th: number;
}

export const CAST_SHADOW_DEFAULTS = { alpha: 0.34, blur: 10, color: '#1a2150', fade: 0.45 };

const castShadowCache = new Map<string, CastShadowTex>();

/**
 * Generalized shadow baker: sweeps the footprint along (angle, length) — the projection of a box
 * standing on it — then softens it and fades it toward the tip. Baked once per unique shape;
 * place the image at the caster's centre with `setOrigin(ox / width, oy / height)`, unrotated.
 */
export function ensureCastShadow(scene: Phaser.Scene, o: CastShadow): CastShadowTex {
  const D = CAST_SHADOW_DEFAULTS;
  const shape = o.shape ?? 'rect', rot = o.rotation ?? 0;
  const alpha = o.alpha ?? D.alpha, blur = o.blur ?? D.blur, color = o.color ?? D.color, fade = o.fade ?? D.fade;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const key = `cshadow_${shape}_${Math.round(o.w)}x${Math.round(o.h)}_r${r2(rot)}_a${r2(o.angle)}_l${Math.round(o.length)}_s${Math.round(o.start ?? 0)}_${r2(alpha)}_${Math.round(blur)}_${color}_${r2(fade)}`;
  const hit = castShadowCache.get(key);
  if (hit && scene.textures.exists(key)) return hit;
  // footprint outline (local), rotated into world space
  const pts: [number, number][] = [];
  if (shape === 'rect') pts.push([-o.w / 2, -o.h / 2], [o.w / 2, -o.h / 2], [o.w / 2, o.h / 2], [-o.w / 2, o.h / 2]);
  else for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push([Math.cos(a) * o.w / 2, Math.sin(a) * o.h / 2]); }
  const c0 = Math.cos(rot), s0 = Math.sin(rot);
  const base = pts.map(([x, y]) => [x * c0 - y * s0, x * s0 + y * c0] as [number, number]);
  const ux = Math.cos(o.angle), uy = Math.sin(o.angle), st = o.start ?? 0;
  const sx = ux * st, sy = uy * st, dx = ux * (st + o.length), dy = uy * (st + o.length);
  const hull = convexHull([
    ...base.map(([x, y]) => [x + sx, y + sy] as [number, number]),
    ...base.map(([x, y]) => [x + dx, y + dy] as [number, number]),
  ]);
  const pad = Math.ceil(blur * 2 + 4);
  const minX = Math.min(...hull.map((p) => p[0])) - pad, minY = Math.min(...hull.map((p) => p[1])) - pad;
  const maxX = Math.max(...hull.map((p) => p[0])) + pad, maxY = Math.max(...hull.map((p) => p[1])) + pad;
  const tw = Math.ceil(maxX - minX), th = Math.ceil(maxY - minY);
  const res: CastShadowTex = { key, ox: -minX, oy: -minY, tw, th };
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, tw, th);
    if (!tex) return res;
    const c = tex.getContext();
    c.save();
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.shadowOffsetX = 4000; // draw the caster far off-canvas, keep only its blurred shadow
    c.fillStyle = color;
    c.beginPath();
    hull.forEach(([x, y], i) => (i ? c.lineTo(x - minX - 4000, y - minY) : c.moveTo(x - minX - 4000, y - minY)));
    c.closePath();
    c.fill();
    c.restore();
    // fade toward the tip, overall alpha
    c.globalCompositeOperation = 'destination-in';
    const g = c.createLinearGradient(-minX + sx, -minY + sy, -minX + dx, -minY + dy);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, `rgba(0,0,0,${alpha * (1 - fade)})`);
    c.fillStyle = g;
    c.fillRect(0, 0, tw, th);
    c.globalCompositeOperation = 'source-over';
    tex.refresh();
  }
  castShadowCache.set(key, res);
  return res;
}

function convexHull(points: [number, number][]): [number, number][] {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export function ensureBodyTexture(scene: Phaser.Scene, w: number, h: number, style: number): string {
  const key = bodyKey(w, h, style);
  if (scene.textures.exists(key)) return key;
  const B = BUILDING_3D, bv = Math.min(bevelFor(style), Math.floor(Math.min(w, h) / 4));
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return key;
  const c = tex.getContext();
  const face = (pts: number[][], [c0, c1]: string[], from: number[], to: number[]) => {
    const g = c.createLinearGradient(from[0], from[1], to[0], to[1]);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); c.fill();
  };
  const x1 = bv, y1 = bv, x2 = w - bv, y2 = h - bv;
  // sloped faces: outer edge (base) -> inner edge (roof edge)
  face([[0, 0], [w, 0], [x2, y1], [x1, y1]], B.faceNorth, [0, 0], [0, bv]);
  face([[0, 0], [x1, y1], [x1, y2], [0, h]], B.faceWest, [0, 0], [bv, 0]);
  face([[0, h], [x1, y2], [x2, y2], [w, h]], B.faceSouth, [0, h], [0, y2]);
  face([[w, 0], [w, h], [x2, y2], [x2, y1]], B.faceEast, [w, 0], [x2, 0]);
  // hip edges + roof edge + strong outline
  c.strokeStyle = 'rgba(20,26,44,0.75)'; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(x1, y1); c.moveTo(w, 0); c.lineTo(x2, y1);
  c.moveTo(0, h); c.lineTo(x1, y2); c.moveTo(w, h); c.lineTo(x2, y2);
  c.stroke();
  // roof (tiled roof texture), clipped to the inset rect
  const src = scene.textures.get(TEX.roof[style % TEX.roof.length]).getSourceImage() as CanvasImageSource;
  const pat = c.createPattern(src, 'repeat');
  c.save();
  c.beginPath(); c.rect(x1, y1, x2 - x1, y2 - y1); c.clip();
  c.translate(x1, y1);
  c.fillStyle = pat ?? '#8892b0';
  c.fillRect(0, 0, x2 - x1, y2 - y1);
  c.restore();
  // parapet rim: light inner lip + dark outer edge + subtle inner shade
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 4;
  c.strokeRect(x1 + 2, y1 + 2, x2 - x1 - 4, y2 - y1 - 4);
  c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 3;
  c.strokeRect(x1 + 7, y1 + 7, x2 - x1 - 14, y2 - y1 - 14);
  c.strokeStyle = B.outline; c.lineWidth = 4;
  c.strokeRect(x1, y1, x2 - x1, y2 - y1);
  c.lineWidth = 6;
  c.strokeRect(3, 3, w - 6, h - 6);
  tex.refresh();
  return key;
}
