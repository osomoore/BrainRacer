import Phaser from 'phaser';
import type { Rect } from '../../core/types';
import { hexNum } from '../menu/style';
import { HUD } from './hudConfig';

/** Bottom-of-view bar that drains over the challenge duration; flashes in the last second. */
export class TimerBar {
  private g: Phaser.GameObjects.Graphics;
  private duration = 0;
  private left = 0;
  private active = false;
  private clock = 0;
  private view: Rect = { x: 0, y: 0, w: 960, h: 1080 };

  constructor(scene: Phaser.Scene, private color: string, depth: number) {
    this.g = scene.add.graphics().setDepth(depth).setVisible(false);
  }

  start(durationSec: number) { this.duration = durationSec; this.left = durationSec; this.active = true; this.clock = 0; this.g.setVisible(true); }
  stop() { this.active = false; this.g.setVisible(false); }
  setView(v: Rect) { this.view = v; }

  update(dt: number) {
    if (!this.active) return;
    this.left = Math.max(0, this.left - dt);
    this.clock += dt;
    const { h, sideMargin, bottomMargin, flashSec } = HUD.timerBar;
    const v = this.view;
    const x = v.x + sideMargin, w = v.w - 2 * sideMargin, y = v.y + v.h - bottomMargin - h;
    const frac = this.duration > 0 ? this.left / this.duration : 0;
    const flashing = this.left <= flashSec;
    const lit = !flashing || Math.floor(this.clock * 8) % 2 === 0;
    const g = this.g;
    g.clear();
    g.fillStyle(0x000000, 0.55).fillRoundedRect(x - 5, y - 5, w + 10, h + 10, (h + 10) / 2);
    if (frac > 0) {
      g.fillStyle(lit ? hexNum(this.color) : 0xffffff, 1).fillRoundedRect(x, y, Math.max(h, w * frac), h, h / 2);
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 6, y + 3, Math.max(0, Math.max(h, w * frac) - 12), h / 3, 4);
    }
    g.lineStyle(3, 0xffffff, 0.8).strokeRoundedRect(x - 5, y - 5, w + 10, h + 10, (h + 10) / 2);
  }

  destroy() { this.g.destroy(); }
}
