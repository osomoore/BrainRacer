/**
 * UI kit basics: colors, text creation and baked rounded-rect textures.
 *
 *  - `css(n)`            0xRRGGBB -> '#rrggbb'
 *  - `makeText(scene, x, y, str, opts)`  Phaser Text in the workshop font. Size is clamped to WS_UI.minFont (40)
 *                         unless `opts.small` (grown-up screens only). opts: size, color, bold, stroke, wrap, align, origin.
 *  - `roundedTexture(scene, w, h, fill, opts)`  bakes (once per size+colors) a rounded rect with a gloss band and a
 *                         soft shadow; returns the texture key. CLAUDE.md rule 15: never draw rounded Graphics live.
 *  - `ringTexture(scene, w, h, color, thickness, radius)`  a transparent rounded outline (focus ring).
 *  - `circleTexture(scene, d, fill, stroke)`  a baked disc.
 *  - `lighten/darken` colour helpers.
 */
import Phaser from 'phaser';
import { WS_UI } from '../config';

export const COLORS = WS_UI.colors;

export const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function lighten(c: number, t: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const f = (v: number) => Math.round(v + (255 - v) * t);
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export function darken(c: number, t: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const f = (v: number) => Math.round(v * (1 - t));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export interface TextOpts {
  size?: number;
  color?: number;
  bold?: boolean;
  stroke?: number;
  strokeW?: number;
  /** Word-wrap width in px. */
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  origin?: [number, number];
  /** Allow sizes below WS_UI.minFont (grown-up screens only). */
  small?: boolean;
}

export function makeText(scene: Phaser.Scene, x: number, y: number, str: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
  const size = opts.small ? (opts.size ?? 36) : Math.max(opts.size ?? WS_UI.minFont, WS_UI.minFont);
  const t = scene.add.text(x, y, str, {
    fontFamily: WS_UI.font,
    fontSize: `${size}px`,
    fontStyle: opts.bold === false ? 'normal' : 'bold',
    color: css(opts.color ?? COLORS.ink),
    align: opts.align ?? 'center',
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    stroke: opts.stroke !== undefined ? css(opts.stroke) : undefined,
    strokeThickness: opts.stroke !== undefined ? (opts.strokeW ?? Math.max(4, Math.round(size / 9))) : 0,
  });
  const o = opts.origin ?? [0.5, 0.5];
  t.setOrigin(o[0], o[1]);
  return t;
}

/** Shrinks a Text's font until it fits `maxW` (never below `minSize`). */
export function fitText(t: Phaser.GameObjects.Text, maxW: number, minSize: number = WS_UI.minFont): void {
  let size = parseInt(String(t.style.fontSize), 10) || WS_UI.minFont;
  while (t.width > maxW && size > minSize) { size -= 2; t.setFontSize(size); }
}

export interface RoundedOpts {
  stroke?: number;
  strokeW?: number;
  radius?: number;
  /** Shadow height below the shape (px). Texture height is h + shadow. */
  shadow?: number;
  gloss?: boolean;
}

export const SHADOW_H = 10;

/** Texture key of a baked rounded rect; the image should use origin (0.5, h / 2 / (h + shadow)). */
export function roundedTexture(scene: Phaser.Scene, w: number, h: number, fill: number, o: RoundedOpts = {}): string {
  const stroke = o.stroke ?? COLORS.ink;
  const sw = o.strokeW ?? 6;
  const r = Math.min(o.radius ?? WS_UI.radius, w / 2, h / 2);
  const shadow = o.shadow ?? SHADOW_H;
  const gloss = o.gloss ?? true;
  const key = `ws:rr:${w}x${h}:${fill.toString(16)}:${stroke.toString(16)}:${sw}:${r}:${shadow}:${gloss ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  if (shadow > 0) { g.fillStyle(0x000000, 0.28); g.fillRoundedRect(sw / 2, shadow, w - sw, h - sw / 2, r); }
  g.fillStyle(fill, 1);
  g.fillRoundedRect(sw / 2, sw / 2, w - sw, h - sw, r);
  if (gloss) {
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(sw + 4, sw + 4, w - sw * 2 - 8, (h - sw * 2) * 0.42, Math.max(4, r - 8));
  }
  if (sw > 0) { g.lineStyle(sw, stroke, 1); g.strokeRoundedRect(sw / 2, sw / 2, w - sw, h - sw, r); }
  g.generateTexture(key, w, h + shadow);
  g.destroy();
  return key;
}

/** Origin Y for an image made with roundedTexture. */
export function roundedOriginY(h: number, shadow = SHADOW_H): number { return h / 2 / (h + shadow); }

export function ringTexture(scene: Phaser.Scene, w: number, h: number, color: number, thickness = 10, radius = WS_UI.radius + 6): string {
  const key = `ws:ring:${w}x${h}:${color.toString(16)}:${thickness}:${radius}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.lineStyle(thickness, 0x1b1b3a, 1);
  g.strokeRoundedRect(thickness / 2, thickness / 2, w - thickness, h - thickness, radius);
  g.lineStyle(thickness - 4, color, 1);
  g.strokeRoundedRect(thickness / 2, thickness / 2, w - thickness, h - thickness, radius);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

export function circleTexture(scene: Phaser.Scene, d: number, fill: number, stroke = COLORS.ink, strokeW = 5): string {
  const key = `ws:circle:${d}:${fill.toString(16)}:${stroke.toString(16)}:${strokeW}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(fill, 1).fillCircle(d / 2, d / 2, d / 2 - strokeW / 2);
  g.lineStyle(strokeW, stroke, 1).strokeCircle(d / 2, d / 2, d / 2 - strokeW / 2);
  g.generateTexture(key, d, d);
  g.destroy();
  return key;
}

/** Baked sky / hills backdrop for a pane (cached per size). */
export function backdropTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `ws:backdrop:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillGradientStyle(0x3fb7ff, 0x3fb7ff, 0xcdf3ff, 0xcdf3ff, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0xffffff, 0.8);
  for (const [cx, cy, s] of [[0.2, 0.16, 1], [0.7, 0.1, 1.3], [0.9, 0.3, 0.8]] as const) {
    const x = w * cx, y = h * cy, u = 60 * s;
    g.fillCircle(x, y, u); g.fillCircle(x + u * 0.9, y + u * 0.15, u * 0.8); g.fillCircle(x - u * 0.9, y + u * 0.2, u * 0.7);
  }
  g.fillStyle(0x7ed957, 1).fillCircle(w * 0.15, h + 120, 340);
  g.fillStyle(0x5bc043, 1).fillCircle(w * 0.75, h + 160, 420);
  g.fillStyle(0x7ed957, 1).fillCircle(w * 0.5, h + 230, 360);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}
