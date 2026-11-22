import Phaser from 'phaser';
import { perfProbe } from '../../core/perfProbe';
import { perfBoxLines } from './perfLines';

const FONT = 'Consolas, "Courier New", monospace';

/** Big "Performance" box for the pause and results screens (text >= 40 px). Built only when the admin setting is on. */
export class PerfBox {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.bg = scene.add.rectangle(x, y, 10, 10, 0x000000, 0.85).setOrigin(0, 0).setStrokeStyle(4, 0xffd43b);
    this.text = scene.add.text(x + 16, y + 10, '', { fontFamily: FONT, fontSize: '40px', color: '#7dff8a', lineSpacing: 2 }).setOrigin(0, 0);
    this.objects = [this.bg, this.text];
    this.refresh();
  }

  /** Re-read the probe; hides itself if nothing was recorded. */
  refresh(): void {
    const lines = perfBoxLines(perfProbe.raceStats(), perfProbe.worst, 5);
    this.bg.setVisible(lines.length > 0);
    this.text.setVisible(lines.length > 0);
    if (!lines.length) return;
    this.text.setText(lines);
    this.bg.setSize(this.text.width + 32, this.text.height + 20);
  }
}
