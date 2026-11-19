import Phaser from 'phaser';
import { SCENE } from './keys';

/** Placeholder — replaced by package P. */
export class SetupScene extends Phaser.Scene {
  constructor() { super(SCENE.setup); }
  create() { this.scene.start(SCENE.race); }
}
