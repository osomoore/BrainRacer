/**
 * Button: a baked rounded button (texture cached by size + colors) with a label, optional second line, optional
 * icon and optional prompt badge. Position = CENTER. Taps fire `onClick` on pointerdown (no ghost clicks after a
 * screen change). Mouse hover emits 'hover' (FocusGroup moves focus).
 *
 *   const b = new Button(scene, { x, y, w: 400, h: 140, label: 'Play', color: COLORS.green, onClick: () => ... });
 *   b.setFocused(true); b.setEnabled(false); b.setLabel('Go'); b.activate(); b.rect() // FocusRect
 *
 * opts: label, sub (smaller second line), fontSize (default 56), color (fill), textColor, icon (GameObject added
 * centered-left), badge (text for a prompt badge at the top-left corner, e.g. promptLabel(input,'confirm')), onClick.
 */
import Phaser from 'phaser';
import { WS_UI } from '../config';
import { COLORS, fitText, makeText, ringTexture, roundedOriginY, roundedTexture, SHADOW_H, type TextOpts } from './style';
import type { FocusRect } from './focusNav';
import { makeBadge } from './Badge';

export interface ButtonOpts {
  x: number; y: number; w: number; h: number;
  label?: string;
  sub?: string;
  fontSize?: number;
  color?: number;
  textColor?: number;
  icon?: Phaser.GameObjects.GameObject;
  badge?: string | null;
  onClick?: () => void;
  /** Grown-up screens: allow text below 40 px. */
  small?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  readonly w: number;
  readonly h: number;
  onClick?: () => void;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly face: Phaser.GameObjects.Image;
  private readonly text?: Phaser.GameObjects.Text;
  private enabled = true;
  private focused = false;

  constructor(scene: Phaser.Scene, o: ButtonOpts) {
    super(scene, o.x, o.y);
    this.w = o.w; this.h = o.h;
    this.onClick = o.onClick;
    const fill = o.color ?? COLORS.paper;
    this.ring = scene.add.image(0, 0, ringTexture(scene, o.w + 28, o.h + 28, COLORS.focus)).setVisible(false);
    this.face = scene.add.image(0, 0, roundedTexture(scene, o.w, o.h, fill)).setOrigin(0.5, roundedOriginY(o.h, SHADOW_H));
    this.add([this.ring, this.face]);
    const tOpts: TextOpts = { size: o.fontSize ?? 56, color: o.textColor ?? COLORS.ink, small: o.small };
    if (o.label !== undefined) {
      this.text = makeText(scene, 0, o.sub ? -o.h * 0.18 : 0, o.label, tOpts);
      fitText(this.text, o.w - 30, o.small ? 24 : WS_UI.minFont);
      this.add(this.text);
    }
    if (o.sub) {
      this.add(makeText(scene, 0, o.h * 0.22, o.sub, { size: Math.max(WS_UI.minFont, o.small ? 30 : 40), color: o.textColor ?? COLORS.ink, wrap: o.w - 40, bold: false, small: o.small }));
    }
    if (o.icon) this.add(o.icon);
    if (o.badge) this.add(makeBadge(scene, o.badge, -o.w / 2 + 12, -o.h / 2 + 12));
    this.setSize(o.w, o.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => { if (this.enabled) this.activate(); });
    this.on('pointerover', (p: Phaser.Input.Pointer) => { if (this.enabled && !p.wasTouch) this.emit('hover'); });
    scene.add.existing(this);
  }

  /** Fires onClick (same as a tap / confirm). */
  activate(): void {
    if (!this.enabled) return;
    this.onClick?.();
  }

  rect(): FocusRect { return { x: this.x, y: this.y, w: this.w, h: this.h, enabled: this.enabled && this.visible }; }

  setFocused(on: boolean): this {
    this.focused = on;
    this.ring.setVisible(on);
    this.setScale(on ? 1.04 : 1);
    return this;
  }

  get isFocused(): boolean { return this.focused; }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.45);
    return this;
  }

  get isEnabled(): boolean { return this.enabled; }

  setLabel(s: string): this { this.text?.setText(s); return this; }

  /** Quick squash for tap feedback. */
  pulse(): void {
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.focused ? 1.04 : 1);
    this.scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens?.killTweensOf(this);
    super.destroy(fromScene);
  }
}
