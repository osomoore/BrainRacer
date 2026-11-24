import Phaser from 'phaser';
import { arrowShape, drawArrow, bigText, FONT_HEAD, MENU, type Selectable } from './style';

/** Big rounded button. Selected = scale-up + glow + bobbing arrow cursor in the player's color. */
export class MenuButton extends Phaser.GameObjects.Container implements Selectable {
  private glow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private arrow: Phaser.GameObjects.Graphics;
  private arrowTween?: Phaser.Tweens.Tween;
  protected readonly label: Phaser.GameObjects.Text;
  private selected = false;
  private color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly w: number, readonly h: number, label: string, color: number, fontSize = 64, head = true) {
    super(scene, x, y);
    this.color = color;
    this.glow = scene.add.graphics();
    this.bg = scene.add.graphics();
    this.arrow = arrowShape(scene, color);
    this.arrow.setPosition(-w / 2 - 55, 0).setVisible(false);
    this.label = bigText(scene, 0, 0, label, fontSize, '#ffffff', { font: head ? FONT_HEAD : undefined });
    this.add([this.glow, this.bg, this.label, this.arrow]);
    this.draw();
    scene.add.existing(this);
  }

  private draw() {
    const { w, h, color, selected } = this;
    this.glow.clear();
    if (selected) {
      for (let i = 3; i >= 1; i--) this.glow.fillStyle(color, 0.18).fillRoundedRect(-w / 2 - i * 9, -h / 2 - i * 9, w + i * 18, h + i * 18, 30 + i * 9);
    }
    this.bg.clear();
    this.bg.fillStyle(selected ? color : MENU.panel, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 30);
    this.bg.lineStyle(selected ? 8 : 5, selected ? 0xffffff : color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
  }

  setSelected(selected: boolean, color?: number): void {
    if (color !== undefined) { this.color = color; drawArrow(this.arrow, color); }
    const changed = selected !== this.selected;
    this.selected = selected;
    this.draw();
    this.arrow.setVisible(selected);
    if (!changed) return;
    this.scene.tweens.add({ targets: this, scale: selected ? 1.07 : 1, duration: 120, ease: 'Back.Out' });
    this.arrowTween?.remove();
    this.arrow.x = -this.w / 2 - 55;
    if (selected) this.arrowTween = this.scene.tweens.add({ targets: this.arrow, x: this.arrow.x + 14, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Quick "pressed" squash. */
  pulse() { this.scene.tweens.add({ targets: this, scale: { from: 0.95, to: 1.07 }, duration: 160, ease: 'Back.Out' }); }

  override destroy(fromScene?: boolean): void {
    this.arrowTween?.remove();
    super.destroy(fromScene);
  }
}
