import Phaser from 'phaser';
import { perfProbe } from '../../core/perfProbe';
import { HUD } from './hudConfig';
import { perfLines } from './perfLines';

/**
 * Admin perf overlay (top-left corner). Costs nothing unless created (HudScene only creates it when
 * perfProbe.enabled); once enabled it touches the text only every `intervalSec` (one setText per second).
 */
export class PerfOverlay {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private acc = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    const { x, y, size } = HUD.perf;
    this.bg = scene.add.rectangle(x, y, 10, 10, 0x000000, 0.78).setOrigin(0, 0).setDepth(depth).setStrokeStyle(3, 0xffd43b);
    this.text = scene.add.text(x + 12, y + 8, 'perf...', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: `${size}px`, color: '#7dff8a', lineSpacing: 2,
    }).setOrigin(0, 0).setDepth(depth + 1);
    this.fit();
    perfProbe.reset();
  }

  update(dtSec: number): void {
    this.acc += dtSec;
    if (this.acc < HUD.perf.intervalSec) return;
    this.acc = 0;
    const snap = perfProbe.snapshot();
    perfProbe.reset();
    this.text.setText(perfLines(snap, HUD.perf.rows));
    this.text.setColor(snap.lowFps >= 55 ? '#7dff8a' : snap.lowFps >= 40 ? '#ffd43b' : '#ff6b6b');
    this.fit();
  }

  private fit(): void {
    this.bg.setSize(this.text.width + 24, this.text.height + 16);
  }

  destroy(): void {
    this.bg.destroy();
    this.text.destroy();
  }
}
