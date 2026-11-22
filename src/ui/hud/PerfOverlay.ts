import Phaser from 'phaser';
import { perfProbe } from '../../core/perfProbe';
import { HUD } from './hudConfig';
import { perfLines, worstHeader, worstRows } from './perfLines';

/**
 * Admin perf overlay (top-left corner). Costs nothing unless created (HudScene only creates it when
 * perfProbe.enabled); once enabled it touches the text only every `intervalSec` (one setText per second).
 */
export class PerfOverlay {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly worstText: Phaser.GameObjects.Text;
  private acc = 0;

  /** `compact` (quad layout): the worst block is a single line so the overlay stays out of the question panels. */
  constructor(scene: Phaser.Scene, depth: number, private readonly compact = false) {
    const { x, y, size } = HUD.perf;
    this.bg = scene.add.rectangle(x, y, 10, 10, 0x000000, 0.78).setOrigin(0, 0).setDepth(depth).setStrokeStyle(3, 0xffd43b);
    this.text = scene.add.text(x + 12, y + 8, 'perf...', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: `${size}px`, color: '#7dff8a', lineSpacing: 2,
    }).setOrigin(0, 0).setDepth(depth + 1);
    this.worstText = scene.add.text(x + 12, y + 8, '', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: `${size}px`, color: '#ffffff', lineSpacing: 2,
    }).setOrigin(0, 0).setDepth(depth + 1).setVisible(false);
    this.fit();
    perfProbe.reset();
  }

  update(dtSec: number, elapsedSec = 0): void {
    this.acc += dtSec;
    if (this.acc < HUD.perf.intervalSec) return;
    this.acc = 0;
    const snap = perfProbe.closeWindow(elapsedSec);
    const worst = perfProbe.worst;
    this.text.setText(perfLines(snap, worst ? HUD.perf.rowsWithWorst : HUD.perf.rows));
    if (worst) {
      this.worstText.setText([worstHeader(worst), ...(this.compact ? [] : worstRows(worst, 3))]);
      this.worstText.setVisible(true);
    }
    this.text.setColor(snap.lowFps >= 55 ? '#7dff8a' : snap.lowFps >= 40 ? '#ffd43b' : '#ff6b6b');
    this.fit();
  }

  private fit(): void {
    const showWorst = this.worstText.visible;
    this.worstText.setY(this.text.y + this.text.height + 8);
    const w = Math.max(this.text.width, showWorst ? this.worstText.width : 0);
    const h = this.text.height + (showWorst ? this.worstText.height + 8 : 0);
    this.bg.setSize(w + 24, h + 16);
  }

  destroy(): void {
    this.bg.destroy();
    this.text.destroy();
    this.worstText.destroy();
  }
}
