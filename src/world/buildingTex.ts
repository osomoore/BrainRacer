/**
 * Baked building looks (canvas 2D, once per unique size/style): a beveled frustum with four sloped
 * side faces shaded by a FIXED world light (top-left), an inset roof with parapet rim, and a soft
 * drop shadow. Static images, so they cost nothing per frame and rotate with each camera.
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
