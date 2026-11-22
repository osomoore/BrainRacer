import Phaser from 'phaser';
import { createInput } from '../../input';
import type { IInput } from '../../core/services';
import type { InputDevice, PlayerInput } from '../../core/types';

const fmt = (n: number) => n.toFixed(2).padStart(5, ' ');
const devName = (d: InputDevice | null) =>
  !d ? 'none' : d.type === 'gamepad' ? `pad ${d.index}` : d.type === 'touch' ? 'touch' : `keyboard ${d.layout}`;

/** Dev scene (?dev=InputTest): live readout of both players' input plus a join demo. F2 toggles the raw overlay. */
export default class InputTest extends Phaser.Scene {
  private input2!: IInput;
  private texts: Phaser.GameObjects.Text[] = [];
  private joinText!: Phaser.GameObjects.Text;
  private joined: InputDevice[] = [];
  private flash: PlayerInput[] = [];
  private flashUntil: number[] = [0, 0];

  constructor() { super('InputTest'); }

  create() {
    this.input2 = createInput();
    this.input2.assign(0, { type: 'keyboard', layout: 'left' });

    const style = { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', lineSpacing: 8 };
    this.add.text(960, 30, 'INPUT TEST  (F2 = raw overlay)', { ...style, fontSize: '48px', color: '#ffd700' }).setOrigin(0.5, 0);
    this.texts = [0, 1].map((i) => this.add.text(60 + i * 940, 130, '', style));
    this.joinText = this.add.text(60, 760, '', { ...style, color: '#7fdbff' });
  }

  update(time: number) {
    const input = this.input2;
    input.poll();

    const pad = input.devices().find((d) => d.type === 'gamepad');
    if (pad) input.assign(1, pad);
    const p1 = input.get(1);

    const players = [input.get(0), p1];
    players.forEach((p, i) => {
      // edges only last one frame, so hold a copy on screen for a moment
      if (p.answer !== null || p.confirm || p.back || p.pause || p.navX || p.navY) {
        this.flash[i] = p;
        this.flashUntil[i] = time + 700;
      }
      const e = time < this.flashUntil[i] ? this.flash[i] : p;
      const dev = i === 0 ? { type: 'keyboard', layout: 'left' } as InputDevice : pad ?? null;
      this.texts[i].setText([
        `PLAYER ${i + 1}  [${devName(dev)}]`,
        `steer    ${fmt(p.steer)}`,
        `throttle ${fmt(p.throttle)}`,
        `brake    ${fmt(p.brake)}`,
        `answer   ${e.answer === null ? '-' : ['X/1 (left)', 'Y/2 (mid)', 'B/3 (right)'][e.answer]}`,
        `confirm  ${e.confirm ? 'YES' : '-'}`,
        `back     ${e.back ? 'YES' : '-'}`,
        `pause    ${e.pause ? 'YES' : '-'}`,
        `nav      ${e.navX},${e.navY}`,
      ]);
      this.texts[i].setColor(pad || i === 0 ? '#ffffff' : '#777777');
    });

    const joiner = input.pollJoin(this.joined);
    if (joiner) this.joined.push(joiner);
    if (this.joined.length > 2) this.joined = [];
    this.joinText.setText([
      'JOIN DEMO: press A (pad), Space (kb left) or Enter (kb right)',
      `joined: ${this.joined.map(devName).join(', ') || '(nobody)'}`,
      `devices: ${input.devices().map(devName).join(', ')}`,
    ]);
    if (input.any().back) this.joined = [];
  }
}
