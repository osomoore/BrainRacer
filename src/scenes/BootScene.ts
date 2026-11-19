import Phaser from 'phaser';
import { generateTextures } from '../art';
import { services } from '../core/services';
import { createInput } from '../input';
import { loadSettings } from '../core/settings';
import { SCENES } from '../data/scenes';
import { REG, SCENE } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.boot); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 400, height / 2, 0, 24, 0x2ecc40).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 60, 'BrainRacer', { fontFamily: 'Arial Black, Arial', fontSize: '64px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => bar.setSize(800 * p, 24));
    for (const s of SCENES) this.load.image(s.id, s.file);
  }

  create() {
    services.input = createInput();
    generateTextures(this);
    this.registry.set(REG.settings, loadSettings());
    const dev = new URLSearchParams(location.search).get('dev');
    if (dev && this.scene.get(dev)) this.scene.start(dev);
    else this.scene.start(SCENE.title);
  }
}
