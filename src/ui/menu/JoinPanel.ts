import Phaser from 'phaser';
import { guideArt } from '../../art/loadoutKeys';
import type { CarKind, ControllerFamily, GuideKind, InputDevice } from '../../core/types';
import { isMobile } from '../../../shared/device';
import { ConfirmPrompt } from './FaceButtonBadge';
import { OptionRow } from './OptionRow';
import { bigText, carPreview, deviceLabel, FONT_HEAD, hexNum, MENU } from './style';

export const JOIN_PANEL = { w: 450, h: 820, gap: 30, top: 120 } as const;
/** Centre x of panel `i` (4 panels fill the screen width). */
export const joinPanelX = (i: number): number => 15 + JOIN_PANEL.w / 2 + i * (JOIN_PANEL.w + JOIN_PANEL.gap);

export const ROW_RACER = 0, ROW_CAR = 1, ROW_GUIDE = 2;

export interface PanelView {
  device: InputDevice;
  family?: ControllerFamily;
  racer: string;
  hint: string;
  car: string;
  guide: string;
  carKind: CarKind;
  guideKind: GuideKind;
  cursor: number;
  ready: boolean;
}

/** One quarter of the Join screen: "press A to join" when empty, racer/car/buddy pickers when joined, a locked READY look when ready. */
export class JoinPanel extends Phaser.GameObjects.Container {
  readonly racerRow: OptionRow;
  readonly carRow: OptionRow;
  readonly guideRow: OptionRow;
  readonly hint: Phaser.GameObjects.Text;
  private readonly color: number;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly emptyGroup: Phaser.GameObjects.Container;
  private readonly joinedGroup: Phaser.GameObjects.Container;
  private readonly readyBanner: Phaser.GameObjects.Container;
  private readonly askBanner: Phaser.GameObjects.Container;
  private readonly askText: Phaser.GameObjects.Text;
  private readonly askPrompt: ConfirmPrompt;
  private readonly deviceText: Phaser.GameObjects.Text;
  private readonly rowsGroup: Phaser.GameObjects.Container;
  private carObj?: Phaser.GameObjects.Container;
  private carKind?: CarKind;
  private readonly guideObj: Phaser.GameObjects.Image;
  private readonly joinPrompt: ConfirmPrompt;
  joined = false;
  ready = false;
  /** Tap/click on a Racer/Car/Buddy row (dir 0 = the row body, -1/+1 = an arrow). */
  onRowTap?: (row: number, dir: -1 | 0 | 1) => void;

  constructor(scene: Phaser.Scene, readonly slot: number, colorHex: string) {
    super(scene, joinPanelX(slot), JOIN_PANEL.top + JOIN_PANEL.h / 2);
    this.color = hexNum(colorHex);
    const { w, h } = JOIN_PANEL;
    const top = -h / 2;
    this.bg = scene.add.graphics();
    this.add(this.bg);

    // empty
    this.joinPrompt = new ConfirmPrompt(scene, 0, 0, 'to join', 40);
    const kb = bigText(scene, 0, 70, 'Space / Enter', 40, MENU.dim);
    const num = bigText(scene, 0, -150, `PLAYER ${slot + 1}`, 52, colorHex, { font: FONT_HEAD, stroke: 10 });
    this.emptyGroup = scene.add.container(0, 0, [num, this.joinPrompt, kb]);
    scene.tweens.add({ targets: [this.joinPrompt, kb], alpha: { from: 0.7, to: 1 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // joined
    const title = bigText(scene, 0, top + 50, `PLAYER ${slot + 1}`, 52, colorHex, { font: FONT_HEAD, stroke: 10 });
    this.deviceText = bigText(scene, 0, top + 105, '', 40, '#ffffff');
    const opts = { width: w - 30, valueX: 0, arrowSpan: 165, height: 56, fontSize: 44, noCursor: true };
    const cap = (y: number, t: string) => bigText(scene, 0, top + y, t, 40, MENU.dim, { bold: false, shadow: false, stroke: 4 });
    const racerCap = cap(160, 'RACER');
    this.racerRow = new OptionRow(scene, 0, top + 212, '', opts);
    this.hint = bigText(scene, 0, top + 255, '', 40, MENU.dim, { bold: false, shadow: false, stroke: 4, origin: [0.5, 0], wrap: w - 40 });
    const carCap = cap(545, 'CAR');
    this.carRow = new OptionRow(scene, 0, top + 597, '', opts);
    const guideCap = cap(665, 'BUDDY');
    this.guideRow = new OptionRow(scene, 0, top + 717, '', opts);
    this.guideObj = scene.add.image(150, top + 665, guideArt('star'));
    this.rowsGroup = scene.add.container(0, 0, [racerCap, this.racerRow, this.hint, carCap, this.carRow, guideCap, this.guideRow, this.guideObj]);

    const tapDir = { left: -1, body: 0, right: 1 } as const;
    [[this.racerRow, ROW_RACER], [this.carRow, ROW_CAR], [this.guideRow, ROW_GUIDE]].forEach(([row, idx]) => {
      (row as OptionRow).makeTappable((z) => this.onRowTap?.(idx as number, tapDir[z]), 100, this.rowsGroup);
    });

    const askY = top + h - 32;
    this.askText = bigText(scene, 0, askY, '', 40, '#ffffff');
    this.askPrompt = new ConfirmPrompt(scene, 0, askY, '= ready', 40);
    this.askBanner = scene.add.container(0, 0, [this.askPrompt, this.askText]);
    const back = scene.add.graphics();
    back.fillStyle(0x0b3a22, 0.92).fillRoundedRect(-205, -85, 410, 170, 30).lineStyle(8, this.color, 1).strokeRoundedRect(-205, -85, 410, 170, 30);
    const tick = bigText(scene, 0, -28, 'READY ✓', 72, '#ffd43b', { font: FONT_HEAD, stroke: 12 });
    const unready = bigText(scene, 0, 28, 'B = change', 40, MENU.white, { bold: false, shadow: false, stroke: 4 });
    this.readyBanner = scene.add.container(0, 0, [back, tick, unready]);
    scene.tweens.add({ targets: tick, scale: { from: 1, to: 1.1 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.joinedGroup = scene.add.container(0, 0, [title, this.deviceText, this.rowsGroup, this.askBanner, this.readyBanner]);
    this.add([this.emptyGroup, this.joinedGroup]);
    this.draw();
    this.render(null);
    scene.add.existing(this);
  }

  private draw() {
    const { w, h } = JOIN_PANEL;
    const j = this.joined, r = this.ready;
    this.bg.clear();
    if (r) for (let i = 3; i >= 1; i--) this.bg.fillStyle(this.color, 0.16).fillRoundedRect(-w / 2 - i * 8, -h / 2 - i * 8, w + i * 16, h + i * 16, 40 + i * 8);
    this.bg.fillStyle(r ? 0x1d5a3c : j ? 0x22407a : 0x14213d, j ? 0.94 : 0.6).fillRoundedRect(-w / 2, -h / 2, w, h, 40);
    this.bg.lineStyle(j ? 10 : 6, this.color, j ? 1 : 0.45).strokeRoundedRect(-w / 2, -h / 2, w, h, 40);
  }

  setPromptFamily(family: ControllerFamily) { this.joinPrompt.setFamily(family); }

  /** Draws the panel from a view (null = empty panel). */
  render(v: PanelView | null) {
    const was = this.joined;
    this.joined = !!v;
    this.ready = !!v?.ready;
    this.emptyGroup.setVisible(!v);
    this.joinedGroup.setVisible(!!v);
    this.draw();
    if (!v) { this.carObj?.destroy(); this.carObj = undefined; this.carKind = undefined; return; }
    const pad = v.device.type === 'gamepad';
    this.deviceText.setText(v.family === 'nintendo' ? 'Switch Pro' : deviceLabel(v.device, v.family));
    this.racerRow.setValue(v.racer);
    this.hint.setText(v.hint);
    this.carRow.setValue(v.car);
    this.guideRow.setValue(v.guide);
    this.guideObj.setTexture(guideArt(v.guideKind));
    this.guideObj.setScale(Math.min(1, 64 / this.guideObj.height, 90 / this.guideObj.width));
    if (this.carKind !== v.carKind) {
      this.carObj?.destroy();
      this.carObj = carPreview(this.scene, v.carKind, 130, -JOIN_PANEL.h / 2 + 545, 0.8);
      this.add(this.carObj);
      this.carKind = v.carKind;
    }
    this.carObj?.setVisible(true);
    // locked look: dimmed choices, no cursor
    this.rowsGroup.setAlpha(v.ready ? 0.4 : 1);
    this.carObj?.setAlpha(v.ready ? 0.4 : 1);
    this.racerRow.setSelected(!v.ready && v.cursor === ROW_RACER, this.color);
    this.carRow.setSelected(!v.ready && v.cursor === ROW_CAR, this.color);
    this.guideRow.setSelected(!v.ready && v.cursor === ROW_GUIDE, this.color);
    this.readyBanner.setVisible(v.ready);
    this.askBanner.setVisible(!v.ready && !(isMobile() && v.device.type === 'touch')); // phone: NEXT is tapped
    this.askPrompt.setVisible(pad);
    this.askText.setVisible(!pad).setText(v.device.type === 'keyboard' && v.device.layout === 'right' ? 'Enter = ready' : 'Space = ready');
    if (pad && v.family) this.askPrompt.setFamily(v.family);
    if (this.joined !== was) this.scene.tweens.add({ targets: this, scale: { from: 1.08, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  override destroy(fromScene?: boolean): void {
    this.carObj?.destroy();
    super.destroy(fromScene);
  }
}
