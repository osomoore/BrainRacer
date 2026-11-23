/**
 * Adventure Workshop art: draws any Race Shop / Dino Lab build as an animatable rig, in side and top view.
 * Look tables: art/race/looks.ts, art/dino/looks.ts. Parts are baked once into `ws:` canvas textures.
 */
import type Phaser from 'phaser';
import type { Model, WorkshopId } from '../core/types';
import type { BuildRig } from '../core/runtime';
import { DinoRig } from './dino/rig';
import { buildGearDetail } from './race/detail';
import { RaceRig } from './race/rig';

export const buildRig: BuildRig = (scene, workshop, model, view) =>
  workshop === 'race' ? new RaceRig(scene, model, view) : new DinoRig(scene, model, view);

export function buildDetail(scene: Phaser.Scene, workshop: WorkshopId, model: Model, aspect: string): Phaser.GameObjects.Container | null {
  return workshop === 'race' && aspect === 'gears' ? buildGearDetail(scene, model) : null;
}
