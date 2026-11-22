import Phaser from 'phaser';
import { arrowShape, drawArrow, bigText, MENU, type Selectable } from './style';

export interface OptionRowOpts {
  width: number;
  height?: number;
  fontSize?: number;
  /** x of the value block center, relative to the row center. */
  valueX: number;
  /** half distance between the < > arrows. */
  arrowSpan: number;
  /** Hide the bobbing arrow outside the row (when there is no room beside it). */
  noCursor?: boolean;
}

/** "Label        < value >" row. Selected = highlight + scale + arrow cursor in the player's color. */
export class OptionRow extends Phaser.GameObjects.Container implements Selectable {
  private bg: Phaser.GameObjects.Graphics;
  private value: Phaser.GameObjects.Text;
  private cursor: Phaser.GameObjects.Graphics;
  private left: Phaser.GameObjects.Graphics;
  private right: Phaser.GameObjects.Graphics;
  private cursorTween?: Phaser.Tweens.Tween;
  private selected = false;
  private color = 0xffffff;
  private readonly rw: number;
  private readonly rh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, readonly opts: OptionRowOpts) {
    super(scene, x, y);
    const fs = opts.fontSize ?? 44;
    this.rw = opts.width; this.rh = opts.height ?? 70;
    this.bg = scene.add.graphics();
    this.cursor = arrowShape(scene, 0xffffff).setPosition(-this.rw / 2 - 40, 0).setVisible(false);
    this.left = arrowShape(scene, 0xffffff, 18).setPosition(opts.valueX - opts.arrowSpan, 0).setScale(-1, 1);
    this.right = arrowShape(scene, 0xffffff, 18).setPosition(opts.valueX + opts.arrowSpan, 0);
    this.value = bigText(scene, opts.valueX, 0, '', fs, MENU.yellow);
    this.add([this.bg, bigText(scene, -this.rw / 2 + 24, 0, label, fs, '#ffffff', { origin: [0, 0.5] }), this.left, this.right, this.value, this.cursor]);
    this.draw();
    scene.add.existing(this);
  }

  private draw() {
    const { rw: w, rh: h, selected, color } = this;
    this.bg.clear();
    this.bg.fillStyle(selected ? color : 0x000000, selected ? 0.35 : 0.25).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    this.bg.lineStyle(selected ? 6 : 3, selected ? color : 0xffffff, selected ? 1 : 0.25).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
  }

  /**
   * Make the row tappable: the whole row (body) plus both arrows (bigger hit areas on top). Pointer-down on the row,
   * mouse or touch. With `host` the zones are added to that container (at this row's position) instead of the row, so they do not enlarge the row's bounds. `hitH` is the tap height in logical px (default 100, enlarged beyond the art).
   */
  makeTappable(onTap: (zone: 'left' | 'body' | 'right') => void, hitH = 100, host?: Phaser.GameObjects.Container): this {
    const { valueX, arrowSpan } = this.opts;
    const mk = (x: number, w: number, zone: 'left' | 'body' | 'right') => {
      const z = this.scene.add.zone(host ? this.x + x : x, host ? this.y : 0, w, hitH).setInteractive();
      z.on('pointerdown', () => {
        this.scene.tweens.add({ targets: this.value, scale: { from: 0.82, to: 1 }, duration: 140, ease: 'Back.Out' });
        onTap(zone);
      });
      (host ?? this).add(z);
    };
    mk(0, this.rw, 'body');
    const aw = Math.max(110, arrowSpan);
    mk(valueX - arrowSpan, aw, 'left');
    mk(valueX + arrowSpan, aw, 'right');
    return this;
  }

  /** Sets the value text, shrinking its font when it would run into the arrows. */
  setValue(text: string): this {
    const fs = this.opts.fontSize ?? 44;
    this.value.setFontSize(fs).setText(text);
    const room = 2 * (this.opts.arrowSpan - 30);
    if (this.value.width > room) this.value.setFontSize(Math.floor(fs * room / this.value.width));
    return this;
  }

  /** Flash the arrow on the side the value moved. */
  bump(dir: number) {
    const a = dir < 0 ? this.left : this.right;
    const sign = dir < 0 ? -1 : 1;
    this.scene.tweens.add({ targets: a, scaleX: { from: 1.7 * sign, to: sign }, scaleY: { from: 1.7, to: 1 }, duration: 160 });
    const room = 2 * (this.opts.arrowSpan - 24);
    const scale = Phaser.Math.Clamp(room / this.value.width, 1, 1.18);
    this.scene.tweens.add({ targets: this.value, scale: { from: scale, to: 1 }, duration: 160 });
  }

  setSelected(selected: boolean, color?: number): void {
    if (color !== undefined) { this.color = color; drawArrow(this.cursor, color); }
    const changed = selected !== this.selected;
    this.selected = selected;
    this.draw();
    this.cursor.setVisible(selected && !this.opts.noCursor);
    if (!changed) return;
    this.scene.tweens.add({ targets: this, scale: selected ? 1.05 : 1, duration: 120, ease: 'Back.Out' });
    this.cursorTween?.remove();
    this.cursor.x = -this.rw / 2 - 40;
    if (selected) this.cursorTween = this.scene.tweens.add({ targets: this.cursor, x: this.cursor.x + 12, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  override destroy(fromScene?: boolean): void {
    this.cursorTween?.remove();
    super.destroy(fromScene);
  }
}
