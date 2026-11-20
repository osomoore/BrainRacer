import Phaser from 'phaser';
import type { Rect } from '../../core/types';
import { hexNum } from '../menu/style';
import { rrect, resizeRR } from './bake';
import { challengeRegion, HUD } from './hudConfig';

/** Bottom-of-view bar that drains over the challenge duration; flashes in the last second. Baked pills, no live Graphics. */
export class TimerBar {
  private root: Phaser.GameObjects.Container;
  private back: Phaser.GameObjects.NineSlice;
  private fillColor: Phaser.GameObjects.NineSlice;
  private fillWhite: Phaser.GameObjects.NineSlice;
  private shine: Phaser.GameObjects.NineSlice;
  private outline: Phaser.GameObjects.NineSlice;
  private duration = 0;
  private left = 0;
  private active = false;
  private clock = 0;
  private view: Rect = { x: 0, y: 0, w: 960, h: 1080 };

  constructor(scene: Phaser.Scene, color: string, depth: number) {
    const { h } = HUD.timerBar;
    const hb = h + 10;
    this.back = rrect(scene, { r: hb / 2, fill: 0x000000, fillA: 0.55 }, 0, 0, 100, hb);
    this.fillColor = rrect(scene, { r: h / 2, fill: hexNum(color) }, 0, 0, 100, h);
    this.fillWhite = rrect(scene, { r: h / 2, fill: 0xffffff }, 0, 0, 100, h);
    this.shine = rrect(scene, { r: 4, fill: 0xffffff, fillA: 0.3 }, 0, 0, 100, h / 3);
    this.outline = rrect(scene, { r: hb / 2, stroke: 0xffffff, strokeW: 3, strokeA: 0.8 }, 0, 0, 100, hb);
    this.root = scene.add.container(0, 0, [this.back, this.fillColor, this.fillWhite, this.shine, this.outline])
      .setDepth(depth).setVisible(false);
  }

  start(durationSec: number) { this.duration = durationSec; this.left = durationSec; this.active = true; this.clock = 0; this.root.setVisible(true); }
  stop() { this.active = false; this.root.setVisible(false); }
  setView(v: Rect) { this.view = v; }

  update(dt: number) {
    if (!this.active) return;
    this.left = Math.max(0, this.left - dt);
    this.clock += dt;
    const { h, bottomMargin, flashSec } = HUD.timerBar;
    const v = this.view;
    const r = challengeRegion(v);
    const x = r.x, w = r.w, y = v.y + v.h - bottomMargin - h;
    const frac = this.duration > 0 ? this.left / this.duration : 0;
    const flashing = this.left <= flashSec;
    const lit = !flashing || Math.floor(this.clock * 8) % 2 === 0;
    const hb = h + 10;
    this.back.setPosition(x + w / 2, y + h / 2); resizeRR(this.back, w + 10, hb);
    this.outline.setPosition(x + w / 2, y + h / 2); resizeRR(this.outline, w + 10, hb);
    const on = frac > 0;
    const fw = Math.max(h, w * frac);
    this.fillColor.setVisible(on && lit);
    this.fillWhite.setVisible(on && !lit);
    this.shine.setVisible(on);
    if (on) {
      const f = lit ? this.fillColor : this.fillWhite;
      f.setPosition(x + fw / 2, y + h / 2); resizeRR(f, fw, h);
      const sw = Math.max(8, fw - 12);
      this.shine.setPosition(x + 6 + sw / 2, y + 3 + h / 6); resizeRR(this.shine, sw, h / 3);
    }
  }

  destroy() { this.root.destroy(); }
}
