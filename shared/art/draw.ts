import type Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;

export interface Canvas { ctx: Ctx; done: () => void }

/** Create (or replace) a canvas texture. Call done() after drawing. */
export function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number): Canvas {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  return { ctx, done: () => tex.refresh() };
}

export const OUTLINE = '#1b2233';

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

/** Fill the current path then stroke an outline. */
export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, line: string | null = OUTLINE, lw = 3): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radial(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Top-left lit vertical-ish gradient for a body spanning the box. */
export function bodyGrad(ctx: Ctx, x: number, y: number, w: number, h: number, light: string, dark: string): CanvasGradient {
  return lin(ctx, x, y, x + w * 0.6, y + h, [[0, light], [1, dark]]);
}

export function star(ctx: Ctx, cx: number, cy: number, ro: number, ri: number, pts = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rot + (i * Math.PI) / pts;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function poly(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function glossHighlight(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.5): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ellipse(ctx, x, y, rx, ry);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}
