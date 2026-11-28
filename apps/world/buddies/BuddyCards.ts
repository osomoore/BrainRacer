import type Phaser from 'phaser';
import { buddyName, buddyTexture, type BuddyKind } from '../../../shared/buddies/catalog';
import { BUTTONS, WORLD } from '../config';
import type { WorldPlayer } from '../core/runtime';
import { bakeDisc, bakePlate } from '../hud/icons';
import { padConnected } from '../hud/questDialog';
import { buddyQuestion } from './text';

const C = BUTTONS.card;
const KEY = 'world-buddy';
const DEPTH = BUTTONS.depth + 7;
type Inputs = {
  buy: (yes: boolean) => void;
  cycle: (dir: -1 | 1) => void;
  pick: () => void;
  back: () => void;
};

export class BuddyCards {
  private readonly offer: Phaser.GameObjects.Container;
  private readonly picker: Phaser.GameObjects.Container;
  private readonly offerText: Phaser.GameObjects.Text;
  private readonly pickerText: Phaser.GameObjects.Text;
  private readonly offerArt: Phaser.GameObjects.Image;
  private readonly pickerArt: Phaser.GameObjects.Image;
  private readonly hints: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, player: WorldPlayer, playerCount: number, inputs: Inputs) {
    const width = WORLD.width / playerCount;
    const root = (height: number) => {
      const texture = `${KEY}:panel:${height}`;
      bakePlate(scene, texture, C.width, height, 0x152640, 0.99, 44, 0xffdf66);
      const dim = scene.add.rectangle(0, 0, width, WORLD.height, 0, C.dim);
      const panel = scene.add.image(0, 0, texture);
      return scene.add.container(width * (player.index + 0.5), WORLD.height / 2, [dim, panel])
        .setDepth(DEPTH).setVisible(false);
    };
    const label = (x: number, y: number, value: string, size: number = C.fontSize) =>
      scene.add.text(x, y, value, {
        fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: `${size}px`, color: '#ffffff',
        align: 'center', wordWrap: { width: C.width - 90 },
      }).setOrigin(0.5);

    const button = (parent: Phaser.GameObjects.Container, x: number, y: number, w: number, caption: string,
      color: number, press: () => void, pad?: 'A' | 'B') => {
      const texture = `${KEY}:btn:${color}:${w}`;
      bakePlate(scene, texture, w, C.minTap, color, 1, 32);
      const plate = scene.add.image(x, y, texture).setInteractive({ useHandCursor: true });
      plate.on('pointerdown', () => { if (parent.visible) press(); });
      parent.add([plate, label(x, y, caption)]);
      if (!pad) return;
      const discKey = `${KEY}:pad:${pad}`;
      bakeDisc(scene, discKey, 24, pad === 'A' ? BUTTONS.colors.a : BUTTONS.colors.b);
      const hint = scene.add.container(x + w / 2 - 18, y - C.minTap / 2 + 8, [
        scene.add.image(0, 0, discKey), label(0, 0, pad, 30),
      ]);
      parent.add(hint);
      this.hints.push(hint);
    };

    this.offer = root(510);
    this.offerArt = scene.add.image(0, -166, buddyTexture('dino'));
    this.offerText = label(0, -17, '');
    this.offer.add([this.offerArt, this.offerText]);
    button(this.offer, -150, 150, 260, 'Yes', 0x13613b, () => inputs.buy(true), 'A');
    button(this.offer, 150, 150, 260, 'No', 0x84343c, () => inputs.buy(false), 'B');

    this.picker = root(580);
    this.pickerArt = scene.add.image(0, -65, buddyTexture('dino'));
    this.pickerText = label(0, 22, '');
    this.picker.add([label(0, -210, 'Buddy', C.titleSize), this.pickerArt, this.pickerText]);
    button(this.picker, -258, -65, C.minTap, '‹', 0x214778, () => inputs.cycle(-1));
    button(this.picker, 258, -65, C.minTap, '›', 0x214778, () => inputs.cycle(1));
    button(this.picker, -150, 170, 260, 'Back', 0x84343c, inputs.back, 'B');
    button(this.picker, 150, 170, 260, 'Pick', 0x13613b, inputs.pick, 'A');
  }

  showOffer(player: WorldPlayer, kind: BuddyKind | undefined): void {
    if (kind) {
      this.offerText.setText(buddyQuestion(kind, player.reading));
      this.setArt(this.offerArt, kind);
      this.showHints();
    }
    this.offer.setVisible(!!kind);
  }

  showPicker(open: boolean, kind: BuddyKind | undefined): void {
    if (open) {
      this.pickerText.setText(kind ? buddyName(kind) : 'None');
      this.pickerArt.setVisible(!!kind);
      if (kind) this.setArt(this.pickerArt, kind);
      this.showHints();
    }
    this.picker.setVisible(open);
  }

  destroy(): void {
    this.offer.destroy();
    this.picker.destroy();
  }

  private setArt(image: Phaser.GameObjects.Image, kind: BuddyKind): void {
    const texture = buddyTexture(kind);
    if (image.texture.key !== texture) image.setTexture(texture);
    image.setScale(112 / Math.max(image.width, image.height));
  }

  private showHints(): void {
    const connected = padConnected();
    for (const hint of this.hints) hint.setVisible(connected);
  }
}
