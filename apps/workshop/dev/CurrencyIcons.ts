import Phaser from 'phaser';
import { ensureCurrencyIcon, ensurePriceTagIcon } from '../art/icons';

const DARK = '#1b1b3a';

/** `workshop.html?dev=CurrencyIcons` reviews wallet icons and a numbered price tag at two sizes. */
export default class CurrencyIcons extends Phaser.Scene {
  constructor() { super('CurrencyIcons'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#f4f1e9');
    const coin = ensureCurrencyIcon(this, 'race');
    const juice = ensureCurrencyIcon(this, 'dino');
    const tag = ensurePriceTagIcon(this);

    this.label(960, 78, 'Workshop currency icons', 62, DARK);
    this.label(360, 202, 'Race Shop coin', 44, DARK);
    this.label(960, 202, 'Dino Lab Bio Juice', 44, DARK);
    this.label(1560, 202, 'Price tag', 44, DARK);

    this.add.rectangle(960, 384, 1728, 256, 0x263454);
    this.label(960, 302, '40 px', 40, '#ffffff');
    this.sample(coin, juice, tag, 410, 40);

    this.add.rectangle(960, 771, 1728, 426, 0xc8edfa);
    this.label(960, 617, '176 px', 40, DARK);
    this.sample(coin, juice, tag, 806, 176);
  }

  private sample(coin: string, juice: string, tag: string, y: number, height: number): void {
    this.add.image(360, y, coin).setDisplaySize(height, height);
    this.add.image(960, y, juice).setDisplaySize(height, height);
    const badge = this.add.image(1560, y, tag);
    badge.setScale(height / badge.height);
    this.label(1560 + badge.displayWidth * 0.08, y, '12', Math.round(height * 0.65), DARK);
  }

  private label(x: number, y: number, text: string, size: number, color: string): void {
    this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: `${size}px`, color,
    }).setOrigin(0.5);
  }
}
