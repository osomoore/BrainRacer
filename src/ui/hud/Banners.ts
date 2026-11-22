import Phaser from 'phaser';
import { bigText, FONT_BODY, FONT_HEAD } from '../menu/style';
import { rrectImage } from './bake';
import { HUD } from './hudConfig';
import { easeOutBack } from './hudMath';

interface Item {
  obj: Phaser.GameObjects.Container;
  key: string;
  age: number;
  dur: number;
  inSec: number;
  outSec: number;
  shake: number;
  x0: number;
  y0: number;
}

/** Scale-in / hold / scale-out banners, plus rising popups. Frame-driven so it pauses with the HUD. */
export class Banners {
  private items: Item[] = [];
  private rises: { t: Phaser.GameObjects.Text; age: number; dur: number; y0: number; rise: number }[] = [];
  private flash: Phaser.GameObjects.Graphics;
  private flashT = 0;

  constructor(private scene: Phaser.Scene, private depth: number) {
    // Drawn once at full alpha; the pulse is the object's alpha (no per-frame redraw).
    const w = scene.scale.width, h = scene.scale.height;
    this.flash = scene.add.graphics().setDepth(depth - 1).setVisible(false);
    this.flash.lineStyle(36, 0xff3b30, 1).strokeRect(18, 18, w - 36, h - 36);
    this.flash.lineStyle(10, 0xffd43b, 1).strokeRect(40, 40, w - 80, h - 80);
  }

  /** Show a banner container at (x, y). Replaces any banner with the same key. */
  add(obj: Phaser.GameObjects.Container, key: string, x: number, y: number, durSec: number, shake = 0) {
    this.items = this.items.filter((it) => {
      if (it.key !== key) return true;
      it.obj.destroy();
      return false;
    });
    obj.setDepth(this.depth).setPosition(x, y).setScale(0);
    this.items.push({ obj, key, age: 0, dur: durSec, inSec: 0.3, outSec: 0.25, shake, x0: x, y0: y });
  }

  center(x: number, y: number, text: string, color = '#ffd43b', durSec = 1.2, opts: { size?: number; shake?: number; stroke?: string } = {}) {
    const size = opts.size ?? (text.length <= 3 ? 260 : 150);
    const t = bigText(this.scene, 0, 0, text, size, color, {
      font: FONT_HEAD, stroke: Math.round(size / 7), strokeColor: opts.stroke ?? '#14213d', wrap: 1700,
    });
    this.add(this.scene.add.container(0, 0, [t]), 'center', x, y, durSec, opts.shake ?? 0);
  }

  /** A dino-alert style banner: shaking, red text with yellow edge, plus a pulsing red screen frame. */
  alert(x: number, y: number, text: string, durSec = 2.6, size = 140) {
    this.center(x, y, text, '#ff3b30', durSec, { size, shake: 10, stroke: '#ffd43b' });
    this.flashT = durSec;
  }

  /** Banner with optional icon + text lines, placed at (x, y), keyed per zone. */
  lines(key: string, x: number, y: number, icon: Phaser.GameObjects.Image | null, lines: { text: string; size: number; color: string }[], durSec: number) {
    const c = this.scene.add.container(0, 0);
    const texts = lines.map((l) => bigText(this.scene, 0, 0, l.text, l.size, l.color, { font: l.size > 60 ? FONT_HEAD : FONT_BODY, stroke: Math.round(l.size / 7) }));
    const blockH = texts.reduce((a, t) => a + t.height, 0);
    const blockW = Math.max(...texts.map((t) => t.width));
    const iconW = icon ? 150 : 0;
    const totalW = iconW + blockW + 70;
    const bg = rrectImage(this.scene, { r: 34, fill: HUD.colors.navy, fillA: 0.9, stroke: HUD.colors.gold, strokeW: 7 }, 0, 0, Math.round(totalW), Math.round(blockH + 48));
    c.add(bg);
    let ty = -blockH / 2;
    const tx = -totalW / 2 + 35 + iconW + blockW / 2;
    for (const t of texts) { t.setPosition(tx, ty + t.height / 2); ty += t.height; c.add(t); }
    if (icon) {
      icon.setScale(130 / Math.max(icon.width, icon.height)).setPosition(-totalW / 2 + 35 + 65, 0);
      const ib = rrectImage(this.scene, { r: 24, fill: 0xffffff }, -totalW / 2 + 28 + 72, 0, 144, 144);
      c.add(ib);
      c.add(icon);
    }
    this.add(c, key, x, y, durSec);
  }

  popup(x: number, y: number, text: string, color = '#ffffff') {
    const t = bigText(this.scene, x, y, text, 56, color, { font: FONT_HEAD, stroke: 10 }).setDepth(this.depth - 2);
    this.rises.push({ t, age: 0, dur: HUD.popupSec, y0: y, rise: 120 });
  }

  update(dt: number) {
    for (const it of this.items) {
      it.age += dt;
      let s = 1;
      if (it.age < it.inSec) s = easeOutBack(it.age / it.inSec);
      else if (it.age > it.dur - it.outSec) { const k = Math.max(0, (it.dur - it.age) / it.outSec); s = k * k; }
      it.obj.setScale(Math.max(0, s));
      if (it.shake > 0) it.obj.setPosition(it.x0 + (Math.random() - 0.5) * it.shake * 2, it.y0 + (Math.random() - 0.5) * it.shake * 2);
    }
    this.items = this.items.filter((it) => {
      if (it.age < it.dur) return true;
      it.obj.destroy();
      return false;
    });
    for (const r of this.rises) {
      r.age += dt;
      const k = Math.min(1, r.age / r.dur);
      r.t.setY(r.y0 - r.rise * (1 - (1 - k) * (1 - k)));
      r.t.setAlpha(k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
      r.t.setScale(k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5));
    }
    this.rises = this.rises.filter((r) => {
      if (r.age < r.dur) return true;
      r.t.destroy();
      return false;
    });
    this.drawFlash(dt);
  }

  private drawFlash(dt: number) {
    if (this.flashT <= 0) { this.flash.setVisible(false); return; }
    this.flashT -= dt;
    const a = 0.25 + 0.3 * Math.abs(Math.sin(this.flashT * 7));
    this.flash.setVisible(true).setAlpha(a);
  }

  clear() {
    this.items.forEach((i) => i.obj.destroy());
    this.rises.forEach((r) => r.t.destroy());
    this.items = [];
    this.rises = [];
    this.flashT = 0;
    this.flash.setVisible(false);
  }

  destroy() { this.clear(); this.flash.destroy(); }
}
