/** Swatch pictures for the station strip: a render of the model with ONLY that variant changed, cropped on the part. */
import Phaser from 'phaser';
import type { PaneContext } from '../../core/runtime';
import type { Model, WorkshopId } from '../../core/types';
import { engine } from '../../logic';
import { modelKey, withVariant } from './layout';

/** Returns the texture key of the swatch (rendered once, then cached by workshop, aspect, variant and the rest of the model). */
export function swatchTexture(ctx: PaneContext, ws: WorkshopId, model: Model, aspect: string, variant: string, size: number): string {
  const scene = ctx.scene;
  const key = `ws:sw:${ws}:${aspect}:${variant}:${size}:${modelKey(model, aspect)}`;
  if (scene.textures.exists(key)) return key;
  const rig = ctx.buildRig(scene, ws, withVariant(model, aspect, variant), 'side');
  const f = rig.focus(aspect);
  // Size swatches share one scale (fit to the biggest size), so Small, Medium and Large really look different.
  const region = aspect === 'size' ? sharedRegion(ctx, ws, model, aspect)
    : (Math.max(rig.height, rig.width * 0.5) * 1.05) / Math.max(1, f.zoom);
  const k = size / region;
  rig.root.setPosition(size / 2 - f.x * k, size / 2 - f.y * k).setScale(k);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: size, height: size }, false) as Phaser.GameObjects.RenderTexture;
  rt.draw(rig.root);
  rt.saveTexture(key);
  rig.destroy();
  rt.destroy();
  return key;
}

const sharedRegions = new Map<string, number>();

/** The crop region that fits the largest variant of `aspect` (same model otherwise); cached per model. */
function sharedRegion(ctx: PaneContext, ws: WorkshopId, model: Model, aspect: string): number {
  const key = `${ws}:${aspect}:${modelKey(model, aspect)}`;
  const hit = sharedRegions.get(key);
  if (hit !== undefined) return hit;
  let region = 0;
  for (const v of engine.catalog(ws).variants) {
    if (v.aspect !== aspect) continue;
    const rig = ctx.buildRig(ctx.scene, ws, withVariant(model, aspect, v.id), 'side');
    region = Math.max(region, Math.max(rig.height, rig.width) * 1.08); // the whole vehicle, no part zoom
    rig.destroy();
  }
  sharedRegions.set(key, region);
  return region;
}
