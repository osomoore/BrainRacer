/** Title / join screen (full stage). Desktop: each pad / keyboard layout confirms to join (max 2). Mobile: tap to play. */
import Phaser from 'phaser';
import { goToHub } from '../../../shared/hub';
import type { DeviceId } from '../../../shared/input/deviceInput';
import { STAGE, WS_UI } from '../config';
import { Button } from '../ui/Button';
import { makeBadge } from '../ui/Badge';
import { backdropTexture, COLORS, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { emptyJoin, reduceJoin, slotLine, type JoinState } from './joinLogic';
import { shell } from './shell';

export class TitleScene extends Phaser.Scene {
  private join: JoinState = emptyJoin;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotSubs: Phaser.GameObjects.Text[] = [];
  private slotCards: Phaser.GameObjects.Image[] = [];
  private play?: Button;
  private leaving = false;

  constructor() { super('title'); }

  create(): void {
    this.join = emptyJoin;
    this.leaving = false;
    this.slotTexts = []; this.slotSubs = []; this.slotCards = [];
    this.cameras.main.setViewport(0, 0, STAGE.w, STAGE.h);
    this.add.image(0, 0, backdropTexture(this, STAGE.w, STAGE.h)).setOrigin(0);
    const title = makeText(this, STAGE.w / 2, 230, 'Adventure Workshop', { size: 150, color: COLORS.paper, stroke: COLORS.ink, strokeW: 16 });
    this.tweens.add({ targets: title, y: 244, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    shell.baseAudio.music('title');

    this.buildBetaNotice();
    if (shell.mobile) this.buildMobile();
    else this.buildJoin();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tweens.killAll());
  }

  /** Calm, always-visible beta notice (baked card + text). Does not take input. */
  private buildBetaNotice(): void {
    const b = WS_UI.beta;
    this.add.image(STAGE.w / 2, b.y, roundedTexture(this, b.w, b.h, b.fill, { radius: 36 })).setOrigin(0.5, roundedOriginY(b.h));
    makeText(this, STAGE.w / 2, b.y - 24, b.line1, { size: 52, color: COLORS.ink, wrap: b.w - 60 });
    makeText(this, STAGE.w / 2, b.y + 28, b.line2, { size: 40, bold: false, color: COLORS.ink, wrap: b.w - 60 });
  }

  private buildMobile(): void {
    const b = new Button(this, { x: STAGE.w / 2, y: 650, w: 760, h: 220, label: 'Tap to play', fontSize: 100, color: COLORS.yellow, onClick: () => this.begin([{ kind: 'touch' }]) });
    this.tweens.add({ targets: b, scale: 1.06, duration: 700, yoyo: true, repeat: -1 });
    this.input.on('pointerdown', () => this.begin([{ kind: 'touch' }]));
  }

  private buildJoin(): void {
    const cw = 760, ch = 190;
    for (let i = 0; i < WS_UI.maxPlayers; i++) {
      const x = STAGE.w / 2 + (i === 0 ? -400 : 400);
      const card = this.add.image(x, 520, roundedTexture(this, cw, ch, COLORS.paper, { radius: 36 })).setOrigin(0.5, roundedOriginY(ch));
      this.slotCards.push(card);
      this.slotTexts.push(makeText(this, x, 505, '', { size: 56, color: i === 0 ? COLORS.p1 : COLORS.p2, wrap: cw - 40 }));
      this.slotSubs.push(makeText(this, x, 570, '', { size: 40, bold: false, wrap: cw - 40 }));
    }
    this.play = new Button(this, { x: STAGE.w / 2, y: 760, w: 640, h: 170, label: 'PLAY', fontSize: 84, color: COLORS.green, onClick: () => this.begin(this.join.slots) });
    makeBadge(this, 'B', 120, STAGE.h - 70);
    makeText(this, 170, STAGE.h - 70, 'Back to games', { size: 44, color: COLORS.paper, stroke: COLORS.ink, origin: [0, 0.5] });
    this.refresh();
  }

  private refresh(): void {
    const n = this.join.slots.length;
    for (let i = 0; i < WS_UI.maxPlayers; i++) {
      const d = this.join.slots[i];
      const other = this.join.slots[0];
      const joinLabel = i === 0 ? 'press A, Space or Enter' : other && other.kind === 'kb' ? (other.layout === 1 ? 'press A or Enter' : 'press A or Space') : 'press A, Space or Enter';
      this.slotTexts[i].setText(slotLine(i, d, joinLabel));
      this.slotSubs[i].setText(d ? shell.router.deviceName(d) : i === 1 ? '(optional)' : '');
      this.slotCards[i].setAlpha(d ? 1 : 0.85);
    }
    this.play?.setVisible(n > 0);
    if (this.play) {
      this.play.setEnabled(n > 0);
      
    }
  }

  private begin(devices: readonly DeviceId[]): void {
    if (this.leaving || devices.length === 0) return;
    this.leaving = true;
    shell.startPanes(devices);
  }

  override update(): void {
    shell.router.step(this.game.getFrame());
    // Events of the frame the title was opened in belong to the pane that just closed.
    if (shell.mobile || this.leaving || shell.adminOpen || this.game.getFrame() === shell.titleFrame) return;
    for (const ev of shell.router.raw) {
      if (ev.type !== 'action') continue;
      const r = reduceJoin(this.join, ev.device, ev.action, WS_UI.maxPlayers);
      this.join = r.state;
      if (r.result === 'hub') { this.leaving = true; goToHub(); return; }
      if (r.result === 'start') { this.begin(this.join.slots); return; }
      if (r.result === 'joined') shell.baseAudio.sfx('select');
      if (r.result !== 'none') this.refresh();
    }
  }
}
