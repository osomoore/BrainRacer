import Phaser from 'phaser';
import type { CarKind, InputDevice } from '../../core/types';
import { aBadge, bigText, carName, carPreview, deviceLabel, FONT_HEAD, hexNum } from './style';

/** Title-screen player card: "Press A to join" until a device joins, then device label + Ready!. */
export class JoinCard extends Phaser.GameObjects.Container {
  readonly cardW = 660;
  readonly cardH = 440;
  private bg: Phaser.GameObjects.Graphics;
  private car: Phaser.GameObjects.Container;
  private joinGroup: Phaser.GameObjects.Container;
  private readyGroup: Phaser.GameObjects.Container;
  private deviceText: Phaser.GameObjects.Text;
  private color: number;
  joined = false;

  constructor(scene: Phaser.Scene, x: number, y: number, slot: 0 | 1, colorHex: string, carKind: CarKind) {
    super(scene, x, y);
    this.color = hexNum(colorHex);
    const hh = this.cardH / 2;
    this.bg = scene.add.graphics();
    const title = bigText(scene, 0, -hh + 55, `PLAYER ${slot + 1}`, 64, colorHex, { font: FONT_HEAD, stroke: 10 });
    this.car = carPreview(scene, carKind, 0, -52, 2.8);
    const carLbl = bigText(scene, 0, 28, carName(carKind), 40, '#ffffff');

    // not joined
    const pressY = 105;
    const p1 = bigText(scene, 0, pressY, 'Press', 52);
    const badge = aBadge(scene, 0, pressY, 62);
    const p2 = bigText(scene, 0, pressY, 'to join', 52);
    const widthTotal = p1.width + 62 + p2.width + 40;
    p1.setX(-widthTotal / 2 + p1.width / 2);
    badge.setX(-widthTotal / 2 + p1.width + 20 + 31);
    p2.setX(widthTotal / 2 - p2.width / 2);
    const kb = bigText(scene, 0, pressY + 72, 'Space / Enter', 40, '#c9d6ff');
    this.joinGroup = scene.add.container(0, 0, [p1, badge, p2, kb]);
    scene.tweens.add({ targets: this.joinGroup, scale: { from: 1, to: 1.07 }, alpha: { from: 0.75, to: 1 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // joined
    this.deviceText = bigText(scene, 0, 88, "", 48, '#ffffff');
    const ready = bigText(scene, 0, 160, 'Ready!', 76, '#ffd43b', { font: FONT_HEAD, stroke: 10 });
    this.readyGroup = scene.add.container(0, 0, [this.deviceText, ready]).setVisible(false);
    scene.tweens.add({ targets: ready, scale: { from: 1, to: 1.12 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add([this.bg, title, this.car, carLbl, this.joinGroup, this.readyGroup]);
    scene.tweens.add({ targets: this.car, y: this.car.y - 10, angle: { from: -3, to: 3 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.draw();
    scene.add.existing(this);
  }

  private draw() {
    const w = this.cardW, h = this.cardH, j = this.joined;
    this.bg.clear();
    if (j) for (let i = 3; i >= 1; i--) this.bg.fillStyle(this.color, 0.16).fillRoundedRect(-w / 2 - i * 10, -h / 2 - i * 10, w + i * 20, h + i * 20, 44 + i * 10);
    this.bg.fillStyle(j ? 0x22407a : 0x14213d, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 44);
    this.bg.lineStyle(j ? 12 : 8, this.color, j ? 1 : 0.7).strokeRoundedRect(-w / 2, -h / 2, w, h, 44);
  }

  setJoined(device: InputDevice | null) {
    const was = this.joined;
    this.joined = !!device;
    this.joinGroup.setVisible(!device);
    this.readyGroup.setVisible(!!device);
    if (device) this.deviceText.setText(deviceLabel(device));
    this.draw();
    if (this.joined !== was) this.scene.tweens.add({ targets: this, scale: { from: this.joined ? 1.12 : 0.92, to: 1 }, duration: 320, ease: 'Back.Out' });
  }
}
