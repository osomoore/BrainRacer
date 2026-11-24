/** Orchestrator smoke scene: default models through buildRig in both views. `workshop.html?dev=RigPreview`. */
import Phaser from 'phaser';
import { buildRig } from '../art';
import { engine } from '../logic';

export default class RigPreview extends Phaser.Scene {
  constructor() { super('RigPreview'); }
  create(): void {
    (['race', 'dino'] as const).forEach((w, i) => {
      const side = buildRig(this, w, engine.defaultModel(w), 'side');
      side.root.setPosition(480 + i * 960, 520);
      const top = buildRig(this, w, engine.defaultModel(w), 'top');
      top.root.setPosition(480 + i * 960, 850);
      this.add.text(480 + i * 960, 120, engine.catalog(w).title, { fontSize: '64px', color: '#1b1b3a', fontStyle: 'bold' }).setOrigin(0.5);
    });
  }
}
