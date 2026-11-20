import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { INDUSTRIAL_LIGHTING } from '../config/gameConfig';
import { makeCanvas } from './draw';

/** Two soft beams spread forward from the bumper, baked once at boot. */
export function genIndustrialHeadlight(scene: Phaser.Scene): void {
  const length = INDUSTRIAL_LIGHTING.beamLength;
  const height = INDUSTRIAL_LIGHTING.beamHeight;
  const k = INDUSTRIAL_LIGHTING.beamStrength;
  const sx = length / 288;
  const { ctx, done } = makeCanvas(scene, TEX.industrial.headlight, length, height);
  ctx.globalCompositeOperation = 'lighter';
  for (let x = 0; x < length; x++) {
    const along = x / (length - 1);
    const fade = (1 - along) ** 1.65;
    const spread = (6 + 62 * along) * sx;
    for (const side of [-1, 1]) {
      const center = height / 2 + side * (14 + 30 * along * sx);
      const edge = 'rgba(255, 227, 162, 0)';
      const shoulder = `rgba(255, 229, 173, ${Math.min(1, fade * 0.21 * k)})`;
      const core = `rgba(255, 241, 201, ${Math.min(1, fade * 0.53 * k)})`;
      const cross = ctx.createLinearGradient(x, center - spread, x, center + spread);
      cross.addColorStop(0, edge);
      cross.addColorStop(0.25, shoulder);
      cross.addColorStop(0.5, core);
      cross.addColorStop(0.75, shoulder);
      cross.addColorStop(1, edge);
      ctx.fillStyle = cross;
      ctx.fillRect(x, center - spread, 1, 2 * spread);
    }
  }
  done();
}

export const NIGHT_GLOW_KEY = 'industrial-night-glow';

/** Soft white radial used (tinted, additive) for goal halos, car halos and ground light pools. */
export function ensureNightGlow(scene: Phaser.Scene): string {
  if (scene.textures.exists(NIGHT_GLOW_KEY)) return NIGHT_GLOW_KEY;
  const size = 128;
  const { ctx, done } = makeCanvas(scene, NIGHT_GLOW_KEY, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  done();
  return NIGHT_GLOW_KEY;
}
