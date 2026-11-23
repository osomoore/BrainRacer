/**
 * Dino Lab scene kit, layer 5: environment builders and the `scenario()` wrapper.
 * Builders add scenery to `act.world` back to front: call them in painting order, the rig sits above `act.world` automatically
 * foreground props go to `act.fore` (drawn in front of the rig, which lives in `act.mid`).
 */
import type Phaser from 'phaser';
import type { ScenarioPlayer } from '../../types';
import { Act } from './act';
import { capKey, edgeKey, skyKey } from './art';
import { image } from './paint';

type Img = Phaser.GameObjects.Image;

export interface Palette { skyTop: string; skyBottom: string; far: string; groundTop: string; groundBody: string; edge: string }

/** Ready-made palettes (hex without #). */
export const PAL = {
  meadow: { skyTop: '4fc3ff', skyBottom: 'd8f4ff', far: 'hills', groundTop: '66cc55', groundBody: 'a8774a', edge: '66cc55' },
  forest: { skyTop: '7fd0e8', skyBottom: 'dff5e0', far: 'forest', groundTop: '4fb04a', groundBody: '8a6038', edge: '4fb04a' },
  desert: { skyTop: 'ffd27a', skyBottom: 'fff2c8', far: 'dunes', groundTop: 'f2cf79', groundBody: 'e5b95e', edge: 'f2cf79' },
  snow: { skyTop: 'a9c4e4', skyBottom: 'eef4fb', far: 'peaks', groundTop: 'ffffff', groundBody: 'dbe9f7', edge: 'ffffff' },
  canyon: { skyTop: '5fc0ff', skyBottom: 'ffe6c0', far: 'mesas', groundTop: 'c98a5a', groundBody: 'b4703f', edge: 'c98a5a' },
} as const;
export type PalName = keyof typeof PAL;

/** Sky gradient covering the whole visible area above the ground. */
export function sky(a: Act, top: string, bottom: string): Img {
  const im = image(a.scene, skyKey(top, bottom), 0, a.top - 20);
  im.setDisplaySize(a.W, a.gy - a.top + 80);
  a.world.add(im);
  return im;
}

/** A few clouds that drift slowly (looping tweens, stopped by dispose). */
export function clouds(a: Act, n = 3, yMin = 90, yMax = 280, avoid?: { x: number; y: number }): Img[] {
  const out: Img[] = [];
  for (let i = 0; i < n; i++) {
    let x = (a.W * (i + 0.5)) / n + a.rng.range(-80, 80), y = a.rng.range(yMin, yMax);
    if (avoid && Math.abs(x - avoid.x) < 300 && Math.abs(y - avoid.y) < 190) y = Math.max(y, avoid.y + 200);
    const c = image(a.scene, 'cloud', x, y, a.rng.range(0.9, 1.5)).setAlpha(0.95);
    a.world.add(c);
    a.loop({ targets: c, x: x + a.rng.range(60, 120), duration: a.rng.range(5000, 8000), yoyo: true, ease: 'Sine.easeInOut' });
    out.push(c);
  }
  return out;
}

export function sun(a: Act, x: number, y: number, scale = 1): Img {
  const im = image(a.scene, 'sun', x, y, scale);
  a.world.add(im);
  a.loop({ targets: im, angle: 360, duration: 24000, ease: 'Linear' });
  return im;
}

/** Distant hills / peaks / mesas / dunes strip standing on the ground line. */
export function farBackdrop(a: Act, kind: string, lift = -14, height = 320): Img {
  const im = image(a.scene, `far:${kind}`, 0, a.gy - lift);
  im.setDisplaySize(a.W, height);
  im.y = a.gy - lift;
  a.world.add(im);
  return im;
}

/** Ground: solid body below the ground line + a lip strip on top. Returns the lip tiles. */
export function ground(a: Act, topHex: string, bodyHex: string, edgeHex: string = topHex, tuft = true): Img[] {
  a.rect(parseInt(bodyHex, 16), -10, a.gy + 28, a.W + 20, a.bottom - a.gy + 40);
  const { tiles } = a.strip(edgeKey(edgeHex, bodyHex, tuft), -10, a.gy - 14, a.W + 20, 512);
  void topHex;
  return tiles;
}

/** Standard side-view backdrop from a palette: sky, clouds, far strip, ground. */
export function backdrop(a: Act, pal: PalName, opts: { clouds?: number; sunAt?: [number, number, number] } = {}): void {
  const p = PAL[pal];
  sky(a, p.skyTop, p.skyBottom);
  if (opts.sunAt) sun(a, opts.sunAt[0], opts.sunAt[1], opts.sunAt[2]);
  if (opts.clouds !== 0) clouds(a, opts.clouds ?? 3, 90, 300, opts.sunAt ? { x: opts.sunAt[0], y: opts.sunAt[1] } : undefined);
  farBackdrop(a, p.far);
  ground(a, p.groundTop, p.groundBody, p.edge, pal !== 'canyon' && pal !== 'desert');
}

/** Rock / cliff block: wall tiles with a cap on top. Box occupies [x, x+w] x [yTop, yBottom]. */
export function cliff(a: Act, x: number, yTop: number, w: number, yBottom: number, wall: 'cliff' | 'red' | 'ice' | 'dirt' = 'cliff', capHex: string | null = '66cc55'): Img[] {
  const out: Img[] = [];
  const hgt = yBottom - yTop;
  const key = `wall:${wall}`;
  const cols = Math.ceil(w / 256), rows = Math.ceil(hgt / 256);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const im = image(a.scene, key, x + c * 256, yTop + r * 256, 1);
      const cw = Math.min(256, w - c * 256), ch = Math.min(256, hgt - r * 256);
      if (cw < 256 || ch < 256) im.setCrop(0, 0, cw * 1.5, ch * 1.5);
      a.world.add(im); out.push(im);
    }
  }
  if (capHex) a.strip(capKey(capHex), x - 6, yTop - 6, w + 12, 256);
  return out;
}

/** Wrap a scenario script: builds the Act, runs it, always disposes. `topView` for the chase scene. */
export function scenario(id: string, run: (a: Act) => Promise<void>, opts: { topView?: boolean } = {}): ScenarioPlayer {
  return {
    workshop: 'dino',
    scenario: id,
    async play(ctx) {
      const a = new Act(ctx, opts);
      // An aborted run never resolves `run`, so also dispose when the stage layer is destroyed (runner.destroy / next stage).
      ctx.layer.once('destroy', () => a.dispose());
      try { await run(a); } finally { a.dispose(); }
    },
  };
}
