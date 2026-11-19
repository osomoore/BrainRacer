import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { makeCanvas } from './draw';

/** Two soft beams spread forward from the bumper, baked once at boot. */
export function genIndustrialHeadlight(scene: Phaser.Scene): void {
  const length = 288;
  const height = 176;
  const { ctx, done } = makeCanvas(scene, TEX.industrial.headlight, length, height);
  ctx.globalCompositeOperation = 'lighter';
  for (let x = 0; x < length; x++) {
    const along = x / (length - 1);
    const fade = (1 - along) ** 1.65;
    const spread = 4 + 46 * along;
    for (const side of [-1, 1]) {
      const center = height / 2 + side * (12 + 22 * along);
      const edge = 'rgba(255, 227, 162, 0)';
      const shoulder = `rgba(255, 229, 173, ${fade * 0.21})`;
      const core = `rgba(255, 241, 201, ${fade * 0.53})`;
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
