/** Buddy catalog and idle animation review. `workshop.html?dev=WorkshopBuddies`. */
import Phaser from 'phaser';
import { animateBuddyIdle, bakeBuddyTextures, BUDDY_KINDS, buddyName, buddyTexture } from '../../../shared/buddies';

const INK = '#1b1b3a';

export default class WorkshopBuddies extends Phaser.Scene {
  constructor() { super('WorkshopBuddies'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#f4f1e9');
    bakeBuddyTextures(this);

    this.add.text(960, 42, 'Buddy collection', {
      fontFamily: 'Arial, sans-serif', fontSize: '56px', fontStyle: 'bold', color: INK,
    }).setOrigin(0.5, 0);

    const columns = Math.min(6, BUDDY_KINDS.length);
    const rows = Math.ceil(BUDDY_KINDS.length / columns);
    const cellWidth = 1920 / columns;
    const top = 150;
    const cellHeight = (1080 - top - 50) / rows;

    BUDDY_KINDS.forEach((kind, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = cellWidth * (column + 0.5);
      const y = top + cellHeight * row;
      const texture = buddyTexture(kind);
      const buddy = this.add.image(x, y + cellHeight * 0.36, texture);
      const fit = Math.min(cellWidth * 0.58 / buddy.width, cellHeight * 0.44 / buddy.height);
      buddy.setScale(fit);
      animateBuddyIdle(this, buddy);

      this.add.text(x, y + cellHeight * 0.75, buddyName(kind), {
        fontFamily: 'Arial, sans-serif', fontSize: '40px', fontStyle: 'bold', color: INK,
        align: 'center', wordWrap: { width: cellWidth - 24 },
      }).setOrigin(0.5);
    });
  }
}
