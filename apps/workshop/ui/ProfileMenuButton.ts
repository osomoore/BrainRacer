import { MenuButton } from '../../../shared/ui/menu/MenuButton';
import type { FocusRect } from './focusNav';
import { fitText } from './style';

/** Adapts the shared button to the Workshop's spatial focus navigation. */
export class ProfileMenuButton extends MenuButton {
  private enabled = true;
  private focused = false;

  constructor(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, color: number,
    fontSize: number, readonly activate: () => void,
  ) {
    super(scene, x, y, w, h, label, color, fontSize);
    this.setLabel(label);
    this.setSize(w, h).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.activate();
    });
    this.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (this.enabled && !pointer.wasTouch) this.emit('hover');
    });
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.setSelected(focused && this.enabled);
  }

  setLabel(label: string): void {
    this.label.setText(label);
    const width = this.w - 28;
    fitText(this.label, width);
    this.label.setScale(Math.min(1, width / this.label.width), 1);
  }

  get isEnabled(): boolean { return this.enabled; }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.45);
    if (this.input) this.input.enabled = enabled;
    this.setSelected(this.focused && enabled);
    return this;
  }

  rect(): FocusRect {
    return { x: this.x, y: this.y, w: this.w, h: this.h, enabled: this.enabled && this.visible };
  }
}
