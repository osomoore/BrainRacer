/** Baked ">>" fast-forward icon (two triangles on a dark disc), cached per scene. */
import type Phaser from 'phaser';
import { COLORS } from '../../ui/style';

export function fastForwardTexture(scene: Phaser.Scene): string {
  const key = 'ws:ff-icon';
  if (scene.textures.exists(key)) return key;
  const w = 130, h = 90;
  const g = scene.make.graphics({}, false);
  g.fillStyle(COLORS.ink, 0.75).fillCircle(w / 2, h / 2, h / 2).fillCircle(w / 2 - 20, h / 2, h / 2).fillCircle(w / 2 + 20, h / 2, h / 2);
  g.fillStyle(COLORS.yellow, 1);
  for (const x of [w / 2 - 34, w / 2 + 4]) g.fillTriangle(x, h / 2 - 24, x, h / 2 + 24, x + 32, h / 2);
  g.generateTexture(key, w + 20, h);
  g.destroy();
  return key;
}
