import Phaser from 'phaser';
import { createInput } from '../../input';
import { services } from '../../core/services';
import { LetterPicker } from '../../ui/menu/LetterPicker';
import { bigText, MENU } from '../../ui/menu/style';

/** Dev scene (?dev=LetterPickerDev): letter picker driven by player 0 (keyboard WASD + Enter/Backspace, or a gamepad). */
export default class LetterPickerDev extends Phaser.Scene {
  private picker!: LetterPicker;
  private status!: Phaser.GameObjects.Text;

  constructor() { super('LetterPickerDev'); }

  create() {
    this.cameras.main.setBackgroundColor(MENU.navyHex);
    if (!services.input) services.input = createInput();
    services.input.assign(0, { type: 'keyboard', layout: 'left' });
    this.picker = new LetterPicker(this, 960, 110, { title: "WHAT'S YOUR NAME?", color: 0xff3b30, maxLen: 10, keyboardTyping: false });
    this.status = bigText(this, 960, 1040, 'Pick a name', 44, MENU.dim);
  }

  update() {
    services.input.poll();
    const r = this.picker.handle(services.input.get(0));
    if (r === 'done') this.status.setText(`Hello, ${this.picker.value}!`).setColor(MENU.yellow);
    else if (r === 'cancel') this.status.setText('Cancelled').setColor(MENU.dim);
  }
}
