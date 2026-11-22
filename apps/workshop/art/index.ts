/**
 * Adventure Workshop art: draws any Race Shop / Dino Lab build as an animatable rig, in side and top view.
 * Look tables: art/race/looks.ts, art/dino/looks.ts. Parts are baked once into `ws:` canvas textures.
 */
import type { BuildRig } from '../core/runtime';
import { DinoRig } from './dino/rig';
import { RaceRig } from './race/rig';

export const buildRig: BuildRig = (scene, workshop, model, view) =>
  workshop === 'race' ? new RaceRig(scene, model, view) : new DinoRig(scene, model, view);
