import type Phaser from 'phaser';
import { paintBomb } from '../../shared/buddies/bombArt';
import { makeCanvas, radial } from './draw';
import { TEX } from '../core/assetKeys';

export { paintBomb };

/** Large outlined cartoon bomb and a separate animated fuse glow. */
export function ensureBombArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEX.homingBomb)) {
    const { ctx, done } = makeCanvas(scene, TEX.homingBomb, 220, 220);
    paintBomb(ctx);
    done();
  }
  if (!scene.textures.exists(TEX.homingBombGlow)) {
    const { ctx: c, done } = makeCanvas(scene, TEX.homingBombGlow, 160, 160);
    c.fillStyle = radial(c, 80, 80, 0, 80, [[0, 'rgba(255,245,150,0.95)'], [0.2, 'rgba(255,145,28,0.8)'], [1, 'rgba(255,60,0,0)']]);
    c.fillRect(0, 0, 160, 160); done();
  }
}
