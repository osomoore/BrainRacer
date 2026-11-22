/**
 * STUB from the orchestrator (grey boxes). The art package REPLACES this file; keep the `buildRig` export.
 */
import type { BuildRig, ModelRig } from '../core/runtime';

export const buildRig: BuildRig = (scene, _workshop, model, view) => {
  const w = 360;
  const h = view === 'side' ? 200 : 180;
  const root = scene.add.container(0, 0);
  const box = scene.add.rectangle(0, view === 'side' ? -h / 2 : 0, w, h, 0x9aa5b1).setStrokeStyle(6, 0x1b1b3a);
  root.add(box);
  const parts = Object.fromEntries(Object.keys(model).map((a) => [a, [box]]));
  const rig: ModelRig = {
    root, view, width: w, height: h, parts,
    focus: () => ({ x: 0, y: -h / 2, zoom: 1.6 }),
    anchor: () => ({ x: 0, y: -h / 2 }),
    play: () => {},
    setModel: () => {},
    destroy: () => root.destroy(),
  };
  return rig;
};
