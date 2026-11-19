import Phaser from 'phaser';
import { services } from '../core/services';
import { SCENE } from './keys';

/** Placeholder — replaced by package P (title + controller join flow). */
export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENE.title); }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 80, 'BRAINRACER', { fontFamily: 'Arial Black, Arial', fontSize: '120px', color: '#ffdd00' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 80, 'Press A / Enter to start', { fontFamily: 'Arial', fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(SCENE.race));
  }

  update() {
    services.input.poll();
    if (services.input.any().confirm) this.scene.start(SCENE.race);
  }
}
