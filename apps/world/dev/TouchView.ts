import Phaser from 'phaser';
import { TOUCH, WORLD } from '../config';
import { createTouchOverlay, type TouchOverlay } from '../input/touchOverlay';
import { TouchState } from '../input/touchMapping';

/** Overlay preview: touch (or click) to try the stick and buttons; the readout shows the mapped controls. */
export default class TouchView extends Phaser.Scene {
  private overlay?: TouchOverlay;
  constructor() { super('TouchView'); }

  create(): void {
    this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x4f8a46);
    const state = new TouchState({ width: WORLD.width, ...TOUCH });
    this.overlay = createTouchOverlay(this, state);
    const text = this.add.text(WORLD.width / 2, 60, '', {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 16, y: 10 },
    }).setOrigin(0.5, 0).setDepth(2000);
    const log: string[] = [];
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      this.overlay?.update();
      const c = state.frame();
      for (const k of ['a', 'b', 'x', 'y'] as const) if (c.pressed[k]) log.unshift(k.toUpperCase());
      log.length = Math.min(log.length, 6);
      text.setText(`x ${c.x.toFixed(2)}  y ${c.y.toFixed(2)}  thr ${c.throttle.toFixed(2)}  brk ${c.brake.toFixed(2)}\npressed: ${log.join(' ') || '-'}`);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.overlay?.destroy());
  }
}
