import Phaser from 'phaser';
import { bus } from '../core/events';
import { SCENE } from './keys';

/** Integration point (orchestrator-owned). Placeholder until Wave 4 wiring. */
export class RaceScene extends Phaser.Scene {
  constructor() { super(SCENE.race); }
  create() {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'RACE (placeholder)', { fontFamily: 'Arial', fontSize: '72px', color: '#fff' }).setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.clear());
  }
}
