import Phaser from 'phaser';

/**
 * Baked HUD shapes (CLAUDE.md rule 15): rounded rects and circles are drawn ONCE into a texture (cached by
 * spec) instead of a live Graphics that is re-triangulated every frame. Rounded rects become NineSlices, so
 * one small texture serves any size; textures are drawn at BAKE_SCALE x and the objects are scaled back down,
 * so they stay crisp when a panel is scaled up (the big challenge panel reaches ~2x).
 */
export const BAKE_SCALE = 2;

export interface RRectSpec {
  r: number;
  fill?: number;
  fillA?: number;
  stroke?: number;
  strokeW?: number;
  strokeA?: number;
  /** Bake scale override (soft glows do not need the extra resolution). */
  scale?: number;
}

/** Slice size of the texture's straight middle band (logical px); it is stretched by the NineSlice. */
const BAND = 4;

function pad(spec: RRectSpec): number { return spec.stroke === undefined ? 0 : Math.ceil((spec.strokeW ?? 1) / 2); }

function rrKey(s: RRectSpec): string {
  return `hud:rr:${s.r}:${s.fill ?? 'n'}:${s.fillA ?? 1}:${s.stroke ?? 'n'}:${s.strokeW ?? 0}:${s.strokeA ?? 1}:${s.scale ?? BAKE_SCALE}`;
}

function bakeRR(scene: Phaser.Scene, s: RRectSpec): { key: string; inset: number; k: number } {
  const k = s.scale ?? BAKE_SCALE;
  const p = pad(s);
  const inset = p + s.r;
  const key = rrKey(s);
  if (!scene.textures.exists(key)) {
    const size = 2 * inset + BAND;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const inner = size - 2 * p;
    if (s.fill !== undefined) g.fillStyle(s.fill, s.fillA ?? 1).fillRoundedRect(p * k, p * k, inner * k, inner * k, s.r * k);
    if (s.stroke !== undefined) g.lineStyle((s.strokeW ?? 1) * k, s.stroke, s.strokeA ?? 1).strokeRoundedRect(p * k, p * k, inner * k, inner * k, s.r * k);
    g.generateTexture(key, size * k, size * k);
    g.destroy();
  }
  return { key, inset, k };
}

/** A rounded rect (path size w x h, stroke extends outside it) centered on (x, y). Resize with {@link resizeRR}. */
export function rrect(scene: Phaser.Scene, spec: RRectSpec, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
  const { key, inset, k } = bakeRR(scene, spec);
  const p = pad(spec);
  const ins = inset * k;
  const ns = scene.add.nineslice(x, y, key, undefined, (w + 2 * p) * k, (h + 2 * p) * k, ins, ins, ins, ins);
  ns.setScale(1 / k);
  ns.setData('rr', { p, k });
  return ns;
}

export function resizeRR(ns: Phaser.GameObjects.NineSlice, w: number, h: number): void {
  const { p, k } = ns.getData('rr') as { p: number; k: number };
  ns.setSize((w + 2 * p) * k, (h + 2 * p) * k);
}

export interface CircleSpec { r: number; fill?: number; fillA?: number; stroke?: number; strokeW?: number }

/** A baked circle centered on its origin. */
export function circle(scene: Phaser.Scene, spec: CircleSpec, x: number, y: number): Phaser.GameObjects.Image {
  const k = BAKE_SCALE;
  const key = `hud:c:${spec.r}:${spec.fill ?? 'n'}:${spec.fillA ?? 1}:${spec.stroke ?? 'n'}:${spec.strokeW ?? 0}`;
  const p = spec.stroke === undefined ? 0 : Math.ceil((spec.strokeW ?? 1) / 2);
  const size = 2 * (spec.r + p);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const c = (spec.r + p) * k;
    if (spec.fill !== undefined) g.fillStyle(spec.fill, spec.fillA ?? 1).fillCircle(c, c, spec.r * k);
    if (spec.stroke !== undefined) g.lineStyle((spec.strokeW ?? 1) * k, spec.stroke, 1).strokeCircle(c, c, spec.r * k);
    g.generateTexture(key, size * k, size * k);
    g.destroy();
  }
  return scene.add.image(x, y, key).setScale(1 / k);
}

/** Bake an arbitrary static drawing into a texture once (cached by key); returns an Image centered on (x, y). */
export function bakedImage(
  scene: Phaser.Scene, key: string, w: number, h: number, x: number, y: number,
  draw: (g: Phaser.GameObjects.Graphics, k: number) => void,
): Phaser.GameObjects.Image {
  const k = BAKE_SCALE;
  const full = `hud:b:${key}`;
  if (!scene.textures.exists(full)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g, k);
    g.generateTexture(full, w * k, h * k);
    g.destroy();
  }
  return scene.add.image(x, y, full).setScale(1 / k);
}

/**
 * Soft attention halo: `layers` stacked translucent rounded rects, each `step` px bigger than the last (radius
 * grows with it). Baked once at 1x; pulse it with the object's alpha. Resize with {@link resizeRR}.
 */
export function glowRect(
  scene: Phaser.Scene, color: number, layerA: number, layers: number, step: number, baseR: number,
  x: number, y: number, w: number, h: number,
): Phaser.GameObjects.NineSlice {
  const grow = layers * step;
  const inset = baseR + grow;
  const key = `hud:glow:${color}:${layerA}:${layers}:${step}:${baseR}`;
  if (!scene.textures.exists(key)) {
    const size = 2 * inset + BAND;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let i = layers; i >= 1; i--) {
      const o = grow - i * step, side = size - 2 * o;
      g.fillStyle(color, layerA).fillRoundedRect(o, o, side, side, baseR + i * step);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }
  const ns = scene.add.nineslice(x, y, key, undefined, w + 2 * grow, h + 2 * grow, inset, inset, inset, inset);
  ns.setData('rr', { p: grow, k: 1 });
  return ns;
}

/**
 * Exact-size baked rounded rect (one Image, cached by spec + size). Use for shapes whose size is fixed or takes
 * only a few values: unlike a NineSlice it has no slice seams (hairline cracks show up when scaled/rotated).
 */
export function rrectImage(scene: Phaser.Scene, spec: RRectSpec, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
  const k = spec.scale ?? BAKE_SCALE;
  const p = pad(spec);
  const key = `${rrKey(spec)}:${Math.round(w * 10)}x${Math.round(h * 10)}`;
  const tw = w + 2 * p, th = h + 2 * p;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    if (spec.fill !== undefined) g.fillStyle(spec.fill, spec.fillA ?? 1).fillRoundedRect(p * k, p * k, w * k, h * k, spec.r * k);
    if (spec.stroke !== undefined) g.lineStyle((spec.strokeW ?? 1) * k, spec.stroke, spec.strokeA ?? 1).strokeRoundedRect(p * k, p * k, w * k, h * k, spec.r * k);
    g.generateTexture(key, Math.ceil(tw * k), Math.ceil(th * k));
    g.destroy();
  }
  return scene.add.image(x, y, key).setScale(1 / k);
}
