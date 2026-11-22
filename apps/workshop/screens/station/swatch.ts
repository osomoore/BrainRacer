/** Swatch pictures for the station strip: a render of the model with ONLY that variant changed, cropped on the part. */
import Phaser from 'phaser';
import type { PaneContext } from '../../core/runtime';
import type { Model, WorkshopId } from '../../core/types';
import { modelKey, withVariant } from './layout';

/** Returns the texture key of the swatch (rendered once, then cached by workshop, aspect, variant and the rest of the model). */
export function swatchTexture(ctx: PaneContext, ws: WorkshopId, model: Model, aspect: string, variant: string, size: number): string {
  const scene = ctx.scene;
  const key = `ws:sw:${ws}:${aspect}:${variant}:${size}:${modelKey(model, aspect)}`;
  if (scene.textures.exists(key)) return key;
  const rig = ctx.buildRig(scene, ws, withVariant(model, aspect, variant), 'side');
  const f = rig.focus(aspect);
  const region = (Math.max(rig.height, rig.width * 0.5) * 1.05) / Math.max(1, f.zoom);
  const k = size / region;
  rig.root.setPosition(size / 2 - f.x * k, size / 2 - f.y * k).setScale(k);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: size, height: size }, false) as Phaser.GameObjects.RenderTexture;
  rt.draw(rig.root);
  rt.saveTexture(key);
  rig.destroy();
  rt.destroy();
  return key;
}
