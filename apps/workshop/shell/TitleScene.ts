/** Desktop joins by device. Touch starts one player directly. */
import Phaser from 'phaser';
import { goToHub } from '../../../shared/hub';
import type { DeviceId } from '../../../shared/input/deviceInput';
import { ConfirmPrompt, FaceButtonBadge } from '../../../shared/ui/menu/FaceButtonBadge';
import { JoinCard } from '../../../shared/ui/menu/JoinCard';
import { bigText, FONT_HEAD, MENU } from '../../../shared/ui/menu/style';
import { buildLabel } from '../../../src/buildInfo';
import { STAGE, WS_UI } from '../config';
import { carIconTexture, dinoIconTexture } from '../ui/icons';
import { ProfileMenuButton } from '../ui/ProfileMenuButton';
import { menuBackground, playerMenuColor } from '../ui/profileMenu';
import { COLORS, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { emptyJoin, goButtonLabel, reduceJoin, type JoinState } from './joinLogic';
import { shell } from './shell';
import { consumeFamilyJoinCode, openFamilySyncPanel } from '../../../shared/sync/panel';
import { familySync } from '../../../shared/sync/runtime';

export class TitleScene extends Phaser.Scene {
  private join: JoinState = emptyJoin;
  private cards: JoinCard[] = [];
  private play?: ProfileMenuButton;
  private leaving = false;

  constructor() { super('title'); }

  create(): void {
    this.join = emptyJoin;
    this.leaving = false;
    this.cards = [];
    this.cameras.main.setViewport(0, 0, STAGE.w, STAGE.h);
    menuBackground(this, STAGE.w, STAGE.h);
    bigText(this, STAGE.w / 2, shell.mobile ? 230 : 125, 'Adventure Workshop', 126, MENU.yellow, { font: FONT_HEAD, stroke: 16 }).setDepth(1);
    shell.baseAudio.music('title');

    this.buildBetaNotice();
    if (shell.mobile) this.buildMobile();
    else this.buildJoin();
    const joinCode = consumeFamilyJoinCode();
    if (joinCode && familySync.enabled) this.time.delayedCall(0, () => { shell.openAdmin(false); openFamilySyncPanel({ joinCode }); });
    const mobile = shell.mobile;
    bigText(this, mobile ? 24 : STAGE.w - 24, mobile ? 16 : STAGE.h - 16, buildLabel(), 32, '#ffffff',
      { origin: mobile ? [0, 0] : [1, 1], bold: false, shadow: false, stroke: 6 }).setAlpha(0.85);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tweens.killAll());
  }

  private buildBetaNotice(): void {
    const b = WS_UI.beta;
    const mobile = shell.mobile ? b.mobile : undefined;
    const { w, h, y } = mobile ?? b;
    const x = STAGE.w / 2;
    this.add.image(x, y, roundedTexture(this, w, h, b.fill, { radius: 36 })).setOrigin(0.5, roundedOriginY(h));
    makeText(this, x, mobile?.headingY ?? b.y - 24, mobile ? b.line1.replace(' — ', ' —\n') : b.line1,
      { size: mobile?.headingSize ?? 52, color: COLORS.ink, wrap: w - 60 });
    makeText(this, x, mobile?.detailY ?? b.y + 28, b.line2,
      { size: mobile?.detailSize ?? 40, bold: false, color: COLORS.ink, wrap: w - 60 });
  }

  private buildMobile(): void {
    const start = () => this.begin([{ kind: 'touch' }]);
    new ProfileMenuButton(this, STAGE.w / 2, WS_UI.beta.mobile.playY, 780, 180, 'Tap to play', COLORS.p1, 100, start);
    this.input.on('pointerdown', start);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', start));
  }

  private buildJoin(): void {
    const center = STAGE.w / 2;
    for (const slot of [0, 1] as const) {
      const texture = slot === 0 ? carIconTexture(this) : dinoIconTexture(this);
      const visual = this.add.container(0, -49, [this.add.image(0, 0, texture).setScale(0.65)]);
      const color = `#${playerMenuColor(slot).toString(16)}`;
      this.cards.push(new JoinCard(this, center, 445, slot, color, {
        visual,
        keyboardHint: slot === 0 ? 'Press any button\nor key to join' : 'Space / Enter',
        showConfirmPrompt: slot === 1,
        confirmPrompt: slot === 1 ? new ConfirmPrompt(this, 0, 0, 'to join', 44) : undefined,
      }));
    }
    this.play = new ProfileMenuButton(this, center, 752, 660, 112, '', COLORS.green, 60, () => this.begin(this.join.slots));
    new FaceButtonBadge(this, 67, STAGE.h - 63, 58, 'right', 'xbox', 'B');
    bigText(this, 111, STAGE.h - 63, 'Back to games', 44, MENU.white, { origin: [0, 0.5] });
    this.refresh();
  }

  private refresh(): void {
    const solo = this.join.slots.length === 0;
    this.cards.forEach((card, i) => {
      const device = this.join.slots[i];
      card.setX(solo ? STAGE.w / 2 : STAGE.w / 2 + (i === 0 ? -425 : 425));
      card.setVisible(!solo || i === 0);
      card.setJoined(device ? shell.router.deviceName(device) : null);
    });
    this.play?.setLabel(`Press ${goButtonLabel(this.join.slots[0])} to go`);
    this.play?.setVisible(!solo).setEnabled(!solo);
  }

  private begin(devices: readonly DeviceId[]): void {
    if (this.leaving || devices.length === 0) return;
    this.leaving = true;
    shell.startPanes(devices);
  }

  override update(): void {
    shell.router.step(this.game.getFrame());
    // The events of the frame the title was opened in belong to the pane that just closed.
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
