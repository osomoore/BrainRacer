/**
 * Fog looks for every fog scenario (race fog now; dino stages can call it too). Pick with the dev query `&fog=a|b|c|d`.
 *  a: drifting layered mist bands, thicker near the ground.
 *  b: depth haze: far things (hills, trees, sky) fade, the near road, car and ducks stay clear.
 *  c: patchy cloud puffs drifting past with gaps.
 *  d: b behind everything + low bands behind the action + a few thin puffs in front (default).
 * `behind` is a screen-space container under the vehicle/hazards, `front` a screen-space one above them.
 * All textures are baked once (no live Graphics). Everything is screen space.
 */
import type Phaser from 'phaser';
import { WS_FOG } from '../../config';
import { bakeKey } from './draw';
import type { StageContext } from '../types';

export type FogLook = 'a' | 'b' | 'c' | 'd';

export function fogLook(): FogLook {
  let q: string | null = null;
  try { q = new URLSearchParams(location.search).get('fog'); } catch { /* no location */ }
  return q === 'a' || q === 'b' || q === 'c' || q === 'd' ? q : WS_FOG.defaultLook;
}

function bandTexture(ctx: StageContext): string {
  return bakeKey(ctx.scene, 'fog2:band', 768, 192, (g) => {
    for (let i = 0; i < 9; i++) {
      const cx = 90 + i * 74 + (i % 3) * 14, cy = 96 + ((i * 37) % 40 - 20), r = 80 + (i % 4) * 10;
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, r);
      gr.addColorStop(0, 'rgba(238,244,248,0.9)'); gr.addColorStop(0.6, 'rgba(238,244,248,0.35)'); gr.addColorStop(1, 'rgba(238,244,248,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  });
}

function puffTexture(ctx: StageContext): string {
  return bakeKey(ctx.scene, 'fog2:puff', 512, 256, (g) => {
    const blobs = [[256, 130, 110], [160, 150, 80], [350, 150, 85], [100, 170, 55], [410, 172, 55], [230, 90, 70], [310, 95, 60]];
    for (const [cx, cy, r] of blobs) {
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, 'rgba(244,248,250,0.85)'); gr.addColorStop(0.55, 'rgba(244,248,250,0.4)'); gr.addColorStop(1, 'rgba(244,248,250,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  });
}

function hazeTexture(ctx: StageContext): string {
  const { top, horizon, clearFrom, color } = WS_FOG.haze;
  return bakeKey(ctx.scene, 'fog2:haze', 4, 256, (g) => {
    const m = /#(..)(..)(..)/.exec(color)!;
    const c = `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, `rgba(${c},${top})`); gr.addColorStop(0.6, `rgba(${c},${horizon})`);
    gr.addColorStop(clearFrom, `rgba(${c},0.12)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  });
}

type Add = (o: Phaser.GameObjects.GameObject) => void;

function haze(ctx: StageContext, add: Add, mul: number): void {
  const { w, h } = ctx.size;
  add(ctx.scene.add.image(0, 0, hazeTexture(ctx)).setOrigin(0, 0).setDisplaySize(w, h).setAlpha(Math.min(1, mul)));
}

/** Seamless drift: a row of images wider than the screen, each looping across one image-spacing. */
function bands(ctx: StageContext, add: Add, mul: number): void {
  const { w, h } = ctx.size;
  const key = bandTexture(ctx);
  const B = WS_FOG.bands;
  for (let l = 0; l < B.layers; l++) {
    const scale = 1.5 + l * 0.5;
    const step = 768 * scale * 0.7;
    const n = Math.ceil((w + 768 * scale) / step) + 2;
    const dir = l % 2 ? -1 : 1;
    const y = h * B.yFrac[l];
    for (let i = 0; i < n; i++) {
      const x0 = -step + i * step;
      const img = ctx.scene.add.image(x0, y + (i % 2) * 18, key).setScale(scale, scale * 0.9).setAlpha(Math.min(0.9, B.alpha[l] * mul));
      add(img);
      void ctx.tween({ targets: img, x: x0 + dir * step, duration: step / B.speed[l] * 1000, ease: 'Linear', repeat: -1 });
    }
  }
}

function clouds(ctx: StageContext, add: Add, mul: number, alphaMul: number): void {
  const { w, h } = ctx.size;
  const key = puffTexture(ctx);
  const C = WS_FOG.clouds;
  const span = w + 1000;
  for (let i = 0; i < C.count; i++) {
    const sc = ctx.rng.range(C.scale[0], C.scale[1]);
    const y = h * (0.45 + 0.45 * (i / C.count)) + ctx.rng.range(-30, 30);
    const x0 = -500 + (i / C.count) * span;
    const sp = ctx.rng.range(C.speed[0], C.speed[1]);
    const img = ctx.scene.add.image(x0, y, key).setScale(sc, sc * 0.8).setAlpha(Math.min(0.9, C.alpha * mul * alphaMul));
    add(img);
    const lap = (): void => { img.x = -500; void ctx.tween({ targets: img, x: w + 500, duration: span / sp * 1000, ease: 'Linear', repeat: -1 }); };
    void ctx.tween({ targets: img, x: w + 500, duration: (w + 500 - x0) / sp * 1000, ease: 'Linear', onComplete: lap });
  }
}

export function addFog(ctx: StageContext, behind: Phaser.GameObjects.Container, front: Phaser.GameObjects.Container, bright: boolean, look: FogLook = fogLook()): void {
  const mul = bright ? WS_FOG.brightMul : WS_FOG.dullMul;
  const b: Add = (o) => { behind.add(o); };
  const f: Add = (o) => { front.add(o); };
  if (look === 'a') bands(ctx, f, mul * 0.9);
  else if (look === 'b') haze(ctx, b, mul);
  else if (look === 'c') clouds(ctx, f, mul, 1);
  else { haze(ctx, b, mul); bands(ctx, b, mul * 0.9); clouds(ctx, f, mul, 0.45); }
}
