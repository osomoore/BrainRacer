import Phaser from 'phaser';
import { bigText, FONT_HEAD, hexNum, MENU } from './style';
import type { ControllerFamily } from './FaceButtonBadge';

export interface JoinCardOptions {
  readyLabel?: string;
  keyboardHint?: string;
  showConfirmPrompt?: boolean;
  visual?: Phaser.GameObjects.Container;
  visualLabel?: string;
  /** Optional app-specific prompt object, for example a controller badge. */
  confirmPrompt?: Phaser.GameObjects.GameObject;
}

/** Shared title-screen join card. Apps own the visual and the wording of their join hint. */
export class JoinCard extends Phaser.GameObjects.Container {
  readonly cardW = 660;
  readonly cardH = 440;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly joinedGroup: Phaser.GameObjects.Container;
  private readonly joinGroup: Phaser.GameObjects.Container;
  private readonly deviceText: Phaser.GameObjects.Text;
  private readonly color: number;
  private readonly confirmPrompt?: Phaser.GameObjects.GameObject & { setFamily?: (family: ControllerFamily) => void };
  private readonly visual?: Phaser.GameObjects.Container;
  joined = false;

  constructor(scene: Phaser.Scene, x: number, y: number, slot: number, colorHex: string, opts: JoinCardOptions = {}) {
    super(scene, x, y);
    this.color = hexNum(colorHex);
    const hh = this.cardH / 2;
    this.bg = scene.add.graphics();
    const title = bigText(scene, 0, -hh + 55, `PLAYER ${slot + 1}`, 64, colorHex, { font: FONT_HEAD, stroke: 10 });
    this.visual = opts.visual;
    const visualLabel = opts.visualLabel ? bigText(scene, 0, 28, opts.visualLabel, 40, MENU.white) : undefined;
    const visualY = opts.visualLabel ? -52 : -49;
    if (this.visual) this.visual.setPosition(0, visualY);
    const pressY = 105;
    const prompt = opts.confirmPrompt;
    this.confirmPrompt = prompt as typeof this.confirmPrompt;
    const hint = opts.showConfirmPrompt === false ? undefined : prompt ?? bigText(scene, 0, pressY, 'Press A to join', 48, '#ffffff');
    if (hint instanceof Phaser.GameObjects.Container) hint.setPosition(0, pressY);
    const kbY = pressY + (opts.showConfirmPrompt === false ? 24 : 72);
    const kb = opts.keyboardHint ? bigText(scene, 0, kbY, opts.keyboardHint, 40, '#c9d6ff') : undefined;
    this.joinGroup = scene.add.container(0, 0, [hint, kb].filter((v): v is Phaser.GameObjects.GameObject => !!v));
    scene.tweens.add({ targets: this.joinGroup, scale: { from: 1, to: 1.07 }, alpha: { from: 0.75, to: 1 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.deviceText = bigText(scene, 0, opts.visualLabel ? 88 : 68, '', 48, '#ffffff');
    const ready = bigText(scene, 0, 160, opts.readyLabel ?? 'Ready!', 76, '#ffd43b', { font: FONT_HEAD, stroke: 10 });
    this.joinedGroup = scene.add.container(0, 0, [this.deviceText, ready]).setVisible(false);
    scene.tweens.add({ targets: ready, scale: { from: 1, to: 1.12 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add([this.bg, title, ...(this.visual ? [this.visual] : []), ...(visualLabel ? [visualLabel] : []), this.joinGroup, this.joinedGroup]);
    if (this.visual) scene.tweens.add({ targets: this.visual, y: visualY - 10, angle: { from: -3, to: 3 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.draw();
    scene.add.existing(this);
  }

  private draw() {
    const w = this.cardW, h = this.cardH;
    this.bg.clear();
    if (this.joined) for (let i = 3; i >= 1; i--) this.bg.fillStyle(this.color, 0.16).fillRoundedRect(-w / 2 - i * 10, -h / 2 - i * 10, w + i * 20, h + i * 20, 44 + i * 10);
    this.bg.fillStyle(this.joined ? 0x22407a : 0x14213d, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 44);
    this.bg.lineStyle(this.joined ? 12 : 8, this.color, this.joined ? 1 : 0.7).strokeRoundedRect(-w / 2, -h / 2, w, h, 44);
  }

  /** `label` is the app-provided joined-device label, or null to return to the join prompt. */
  setJoined(label: string | null, family?: ControllerFamily): void {
    const was = this.joined;
    this.joined = label !== null;
    this.joinGroup.setVisible(!this.joined);
    this.joinedGroup.setVisible(this.joined);
    if (label !== null) this.deviceText.setText(label);
    if (family) this.confirmPrompt?.setFamily?.(family);
    this.draw();
    if (this.joined !== was) this.scene.tweens.add({ targets: this, scale: { from: this.joined ? 1.12 : 0.92, to: 1 }, duration: 320, ease: 'Back.Out' });
  }
}
