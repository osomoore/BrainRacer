import Phaser from 'phaser';
import { goToHub } from '../../../shared/hub';
import { reduceJoin, emptyJoin, goButtonLabel, type JoinState } from '../../workshop/shell/joinLogic';
import { Button } from '../../workshop/ui/Button';
import type { DeviceId, DeviceInput } from '../../../shared/input/deviceInput';
import { WORLD } from '../config';
import type { WorldPlayer } from './WorldScene';
import { bigText, FONT_HEAD, MENU } from '../../../shared/ui/menu/style';

/** Device join screen shared by keyboard layouts and gamepads. */
export class TitleScene extends Phaser.Scene {
  private join: JoinState = emptyJoin;
  private leaving = false;
  private statusText?: Phaser.GameObjects.Text;
  private cards: Phaser.GameObjects.Text[] = [];

  /** `resume`: players handed over by the Workshop; they skip the join and profile screens. Used once. */
  constructor(private readonly devices: DeviceInput, private readonly mobile: boolean, private resume: readonly WorldPlayer[] = []) { super('Title'); }

  create(): void {
    if (this.resume.length) {
      const players = this.resume;
      this.resume = [];
      this.leaving = true;
      this.scene.start('World', { players, resume: true });
      return;
    }
    this.join = emptyJoin;
    this.leaving = false;
    this.cards = [];
    const { width: w, height: h } = WORLD;
    this.paintBackground();
    bigText(this, w / 2, 150, 'ADVENTURE WORLD', 104, MENU.yellow, { font: FONT_HEAD, stroke: 12 });
    if (this.mobile) {
      new Button(this, { x: w / 2, y: 580, w: 620, h: 160, label: 'Tap to play', color: 0xffc35d,
        onClick: () => this.begin([{ kind: 'touch' }]) });
    } else {
      this.cards = [this.card(w / 2 - 430, 0x286c61), this.card(w / 2 + 430, 0x84602c)];
      this.statusText = bigText(this, w / 2, 805, '', 48);
      this.showJoined();
    }
    new Button(this, { x: 245, y: h - 90, w: 390, h: 82, label: 'Back to games', fontSize: 42,
      badge: this.mobile ? undefined : 'B', onClick: () => this.leave() });
  }

  private paintBackground(): void {
    this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x267e72);
    this.add.ellipse(300, 950, 1100, 360, 0x45a877).setAlpha(0.7);
    this.add.ellipse(1580, 210, 1050, 360, 0x58b881).setAlpha(0.65);
    for (let i = 0; i < 12; i++) this.add.circle(90 + i * 160, 950 - (i % 3) * 22, 14, 0xffe990).setAlpha(0.8);
  }

  private card(x: number, color: number): Phaser.GameObjects.Text {
    this.add.rectangle(x, 500, 660, 245, color).setStrokeStyle(8, 0xfff0b0);
    return bigText(this, x, 500, '', 48, MENU.white, { font: FONT_HEAD, stroke: 5, wrap: 570 });
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    goToHub();
  }

  private begin(devices: readonly DeviceId[]): void {
    if (this.leaving || !devices.length) return;
    this.leaving = true;
    this.scene.start('Profiles', { devices });
  }

  update(): void {
    const events = this.devices.poll();
    if (this.mobile || this.leaving) return;
    for (const event of events) {
      if (event.type !== 'action') continue;
      const reduced = reduceJoin(this.join, event.device, event.action, 2);
      this.join = reduced.state;
      if (reduced.result === 'hub') { this.leave(); return; }
      if (reduced.result === 'start') { this.begin(this.join.slots); return; }
      if (reduced.result !== 'none') this.showJoined();
    }
  }

  private showJoined(): void {
    const [first, second] = this.join.slots;
    const deviceName = (d: DeviceId) => d.kind === 'pad' ? `Controller ${d.index + 1}` : d.kind === 'kb' ? `Keyboard ${d.layout}` : 'Touch';
    this.cards[0].setText(`Player 1\n${first ? deviceName(first) : 'Press A, Space or Enter to join'}`);
    this.cards[1].setText(`Player 2\n${second ? deviceName(second) : 'Press A, Space or Enter to join'}`);
    this.statusText?.setText(first ? `Player 1, press ${goButtonLabel(first)} to pick profiles` : '');
  }
}
