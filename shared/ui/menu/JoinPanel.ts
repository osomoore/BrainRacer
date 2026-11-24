import Phaser from 'phaser';
import type { CarKind, InputDevice } from './joinLogic';
import type { ControllerFamily } from './FaceButtonBadge';
import { bigText, FONT_HEAD, hexNum, MENU, drawJoinPanelFrame } from './style';
import { ConfirmPrompt } from './FaceButtonBadge';
import { MenuButton } from './MenuButton';
import { OptionRow } from './OptionRow';
export type GuideKind = string;
export interface JoinPanelDependencies {
  guideArt(kind: GuideKind): string;
  carPreview(scene: Phaser.Scene, kind: CarKind, x: number, y: number, scale: number): Phaser.GameObjects.Container;
  deviceLabel(device: InputDevice, family?: ControllerFamily): string;
  isMobile(): boolean;
  jbqSetup: { chipWidths: readonly number[]; chipGap: number; chipHeight: number };
  chipKeys: readonly string[];
  chipLabels: Readonly<Record<string, string>>;
  rows: { RACER: number; CAR: number; GUIDE: number; QUESTIONS: number; POINTS: number; SCOPE: number; DONE: number };
}
export { drawJoinPanelFrame } from './style';

export const JOIN_PANEL = { w: 450, h: 820, gap: 30, top: 120 } as const;
/** Centre x of panel `i` (4 panels fill the screen width). */
export const joinPanelX = (i: number): number => 15 + JOIN_PANEL.w / 2 + i * (JOIN_PANEL.w + JOIN_PANEL.gap);

/** Y offsets (from the panel top) of the Join panel rows. */
const Y = { racerCap: 160, racer: 205, car: 390, buddy: 557, questions: 716,
  qCap: 350, chips: 420, points: 508, scope: 596, done: 716 } as const;
const LOADOUT_LAYOUT = { rowOffset: 82, width: 200, height: 96 } as const;
const PICK_ART_X = 96;
const PICK_LABEL_X = -104;

/** Math / Reading / JBQ toggle chips. On = filled in the player color, off = dim outline; the focused chip gets a white ring. */
class QuestionChips extends Phaser.GameObjects.Container {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[];
  private readonly xs: number[] = [];
  private readonly ws: readonly number[];
  private readonly gap: number;
  private readonly chipHeight: number;
  onTap?: (chip: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly color: number, deps: JoinPanelDependencies) {
    super(scene, x, y);
    this.ws = deps.jbqSetup.chipWidths; this.gap = deps.jbqSetup.chipGap; this.chipHeight = deps.jbqSetup.chipHeight;
    const total = this.ws.reduce((a, b) => a + b, 0) + this.gap * (this.ws.length - 1);
    let cx = -total / 2;
    this.ws.forEach((w) => { this.xs.push(cx + w / 2); cx += w + this.gap; });
    this.gfx = scene.add.graphics();
    this.labels = deps.chipKeys.map((k, i) => bigText(scene, this.xs[i], 0, deps.chipLabels[k], 40, '#ffffff', { stroke: 0, shadow: false }));
    this.add([this.gfx, ...this.labels]);
  }

  /** Tap zones go to `host` (not this container) so they do not enlarge its bounds. */
  makeTappable(host: Phaser.GameObjects.Container, hostY: number): void {
    this.xs.forEach((cx, i) => {
      const z = this.scene.add.zone(this.x + cx, hostY, this.ws[i] + 8, 100).setInteractive();
      z.on('pointerdown', () => this.onTap?.(i));
      host.add(z);
    });
  }

  /** `focus` = chip with the ring, or -1 when the row is not selected. */
  set(on: readonly boolean[], focus: number, struck = -1) {
    const h = this.chipHeight, g = this.gfx;
    g.clear();
    if (focus >= 0) g.fillStyle(this.color, 0.35).fillRoundedRect(-215, -h / 2 - 7, 430, h + 14, 24);
    on.forEach((isOn, i) => {
      const x = this.xs[i] - this.ws[i] / 2, w = this.ws[i];
      if (isOn) g.fillStyle(this.color, 1).fillRoundedRect(x, -h / 2, w, h, 18);
      else g.fillStyle(0x000000, 0.3).fillRoundedRect(x, -h / 2, w, h, 18).lineStyle(3, 0xffffff, 0.35).strokeRoundedRect(x, -h / 2, w, h, 18);
      if (i === focus) g.lineStyle(6, 0xffffff, 1).strokeRoundedRect(x - 3, -h / 2 - 3, w + 6, h + 6, 20);
      this.labels[i].setColor(isOn ? '#0b1329' : MENU.dim);
      if (i === struck) {   // not allowed with this many players: kept on, but crossed out
        g.fillStyle(0x000000, 0.45).fillRoundedRect(x, -h / 2, w, h, 18);
        g.lineStyle(7, 0xff6b6b, 1).lineBetween(x + 8, h / 2 - 8, x + w - 8, -h / 2 + 8);
        this.labels[i].setColor('#ffb4b4');
      }
    });
  }
}

export interface PanelView {
  device: InputDevice;
  family?: ControllerFamily;
  racer: string;
  car: string;
  guide: string;
  /** Present only while this player is editing questions. */
  questions?: QuestionView;
  carKind: CarKind;
  guideKind: GuideKind;
  cursor: number;
  ready: boolean;
  /** The RACER row is on New Profile: only that row (and the make-racer prompt) is shown. */
  newProfile?: boolean;
}

interface QuestionView {
  chipsOn: readonly boolean[];
  chipFocus: number;
  jbqPoints: string;
  jbqScope: string;
  /** Basics has no scope row. */
  jbqBasics: boolean;
  /** Short note when the chosen JBQ level isn't allowed with this many players (else null). */
  jbqLimit: string | null;
  cursor: number;
}

/** One quarter of the Join screen: "press A to join" when empty, racer/car/buddy pickers when joined, a locked READY look when ready. */
export class JoinPanel extends Phaser.GameObjects.Container {
  private readonly deps: JoinPanelDependencies;
  private readonly rows: JoinPanelDependencies['rows'];
  readonly racerRow: OptionRow;
  readonly carRow: OptionRow;
  readonly guideRow: OptionRow;
  readonly pointsRow: OptionRow;
  readonly scopeRow: OptionRow;
  readonly chips: QuestionChips;
  private readonly qCap: Phaser.GameObjects.Text;
  private readonly questionsBtn: MenuButton;
  private readonly doneBtn: MenuButton;
  private readonly loadoutGroup: Phaser.GameObjects.Container;
  private readonly questionsGroup: Phaser.GameObjects.Container;
  private readonly jbqGroup: Phaser.GameObjects.Container;
  private readonly carGroup: Phaser.GameObjects.Container;
  private readonly guideGroup: Phaser.GameObjects.Container;
  readonly hint: Phaser.GameObjects.Text;
  private readonly color: number;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly emptyGroup: Phaser.GameObjects.Container;
  private readonly joinedGroup: Phaser.GameObjects.Container;
  private readonly readyBanner: Phaser.GameObjects.Container;
  private readonly askBanner: Phaser.GameObjects.Container;
  private readonly askText: Phaser.GameObjects.Text;
  private readonly askPrompt: ConfirmPrompt;
  private readonly openPrompt: ConfirmPrompt;
  private readonly makePrompt: ConfirmPrompt;
  private readonly deviceText: Phaser.GameObjects.Text;
  private readonly rowsGroup: Phaser.GameObjects.Container;
  private carObj?: Phaser.GameObjects.Container;
  private carKind?: CarKind;
  private readonly guideObj: Phaser.GameObjects.Image;
  private readonly joinPrompt: ConfirmPrompt;
  joined = false;
  ready = false;
  /** Tap/click on a row or button (dir 0 = the body, -1/+1 = an arrow). */
  onRowTap?: (row: number, dir: -1 | 0 | 1) => void;
  /** Tap on one of the Math / Reading / JBQ chips (0..2). */
  onChipTap?: (chip: number) => void;

  constructor(scene: Phaser.Scene, readonly slot: number, colorHex: string, deps: JoinPanelDependencies) {
    super(scene, joinPanelX(slot), JOIN_PANEL.top + JOIN_PANEL.h / 2);
    this.deps = deps; this.rows = deps.rows;
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
    const racerCap = cap(Y.racerCap, 'RACER');
    this.racerRow = new OptionRow(scene, 0, top + Y.racer, '', opts);
    this.hint = cap(270, 'Make your racer!');
    this.qCap = cap(Y.qCap, 'QUESTION TYPES');
    this.chips = new QuestionChips(scene, 0, top + Y.chips, this.color, deps);
    this.chips.onTap = (i) => this.onChipTap?.(i);
    const jbqOpts = { ...opts, height: 56 };
    this.pointsRow = new OptionRow(scene, 0, top + Y.points, '', jbqOpts);
    this.scopeRow = new OptionRow(scene, 0, top + Y.scope, '', jbqOpts);
    this.jbqGroup = scene.add.container(0, 0, [this.pointsRow, this.scopeRow]);
    const carCap = cap(0, 'CAR').setPosition(PICK_LABEL_X, 0);
    this.carRow = new OptionRow(scene, 0, LOADOUT_LAYOUT.rowOffset, '', opts);
    this.carGroup = scene.add.container(0, top + Y.car, [carCap, this.carRow]);
    const guideCap = cap(0, 'BUDDY').setPosition(PICK_LABEL_X, 0);
    this.guideRow = new OptionRow(scene, 0, LOADOUT_LAYOUT.rowOffset, '', opts);
    this.guideObj = scene.add.image(PICK_ART_X, 0, deps.guideArt('star'));
    this.guideGroup = scene.add.container(0, top + Y.buddy, [guideCap, this.guideRow, this.guideObj]);
    const button = (y: number, label: string, row: number) => {
      const b = new MenuButton(scene, 0, top + y, 290, 68, label, this.color, 40);
      const zone = scene.add.zone(0, 0, b.w, 84).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onRowTap?.(row, 0));
      b.add(zone);
      return b;
    };
    this.questionsBtn = button(Y.questions, 'Questions', this.rows.QUESTIONS);
    this.doneBtn = button(Y.done, 'Done', this.rows.DONE);
    this.loadoutGroup = scene.add.container(0, 0, [this.carGroup, this.guideGroup, this.questionsBtn]);
    this.questionsGroup = scene.add.container(0, 0, [this.qCap, this.chips, this.jbqGroup, this.doneBtn]);
    this.rowsGroup = scene.add.container(0, 0, [racerCap, this.racerRow, this.hint, this.loadoutGroup, this.questionsGroup]);

    const tapDir = { left: -1, body: 0, right: 1 } as const;
    this.racerRow.makeTappable((z) => this.onRowTap?.(this.rows.RACER, tapDir[z]));
    this.carRow.makeTappable((z) => this.onRowTap?.(this.rows.CAR, tapDir[z]), 60);
    this.guideRow.makeTappable((z) => this.onRowTap?.(this.rows.GUIDE, tapDir[z]), 60);
    this.pointsRow.makeTappable((z) => this.onRowTap?.(this.rows.POINTS, tapDir[z]), 76);
    this.scopeRow.makeTappable((z) => this.onRowTap?.(this.rows.SCOPE, tapDir[z]), 76);
    this.chips.makeTappable(this.questionsGroup, top + Y.chips);

    const askY = top + h - 32;
    this.askText = bigText(scene, 0, askY, '', 40, '#ffffff');
    this.askPrompt = new ConfirmPrompt(scene, 0, askY, '= ready', 40);
    this.openPrompt = new ConfirmPrompt(scene, 0, askY, '= open', 40);
    this.makePrompt = new ConfirmPrompt(scene, 0, askY, '= create', 40);
    this.askBanner = scene.add.container(0, 0, [this.askPrompt, this.openPrompt, this.makePrompt, this.askText]);
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
    drawJoinPanelFrame(this.bg, w, h, this.color, j, r);
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
    this.deviceText.setText(v.family === 'nintendo' ? 'Switch Pro' : this.deps.deviceLabel(v.device, v.family));
    this.racerRow.setValue(v.racer);
    this.hint.setVisible(!!v.newProfile);
    this.carRow.setValue(v.car);
    this.guideRow.setValue(v.guide);
    const q = v.questions;
    this.questionsGroup.setVisible(!!q);
    if (q) {
      const jbqOn = q.chipsOn[2];
      const limited = jbqOn && !!q.jbqLimit;
      this.qCap.setText(limited ? q.jbqLimit! : 'QUESTION TYPES').setColor(limited ? '#ffb4b4' : MENU.dim);
      this.chips.set(q.chipsOn, q.cursor === this.rows.QUESTIONS ? q.chipFocus : -1, limited ? 2 : -1);
      this.jbqGroup.setVisible(jbqOn);
      this.scopeRow.setVisible(!q.jbqBasics);
      this.pointsRow.setValue(q.jbqPoints);
      this.scopeRow.setValue(q.jbqScope);
    }
    const layout = LOADOUT_LAYOUT;
    this.guideObj.setTexture(this.deps.guideArt(v.guideKind));
    this.guideObj.setScale(Math.min(layout.height / this.guideObj.height, layout.width / this.guideObj.width));
    if (!this.carObj || this.carKind !== v.carKind) {
      this.carObj?.destroy();
      this.carObj = this.deps.carPreview(this.scene, v.carKind, PICK_ART_X, 0, 1);
      const { width, height } = this.carObj.getBounds();
      this.carObj.setSize(width, height);
      this.carGroup.add(this.carObj);
      this.carKind = v.carKind;
    }
    this.carObj.setVisible(!v.newProfile).setScale(Math.min(layout.height / this.carObj.height, layout.width / this.carObj.width));
    // locked look: dimmed choices, no cursor
    this.loadoutGroup.setVisible(!v.newProfile && !q);
    this.rowsGroup.setAlpha(v.ready ? 0.4 : 1);
    this.racerRow.setSelected(!v.ready && !q && v.cursor === this.rows.RACER, this.color);
    this.carRow.setSelected(!v.ready && !q && v.cursor === this.rows.CAR, this.color);
    this.guideRow.setSelected(!v.ready && !q && v.cursor === this.rows.GUIDE, this.color);
    this.questionsBtn.setSelected(!v.ready && !q && v.cursor === this.rows.QUESTIONS);
    this.pointsRow.setSelected(q?.cursor === this.rows.POINTS, this.color);
    this.scopeRow.setSelected(q?.cursor === this.rows.SCOPE, this.color);
    this.doneBtn.setSelected(q?.cursor === this.rows.DONE);
    this.readyBanner.setVisible(v.ready);
    this.askBanner.setVisible(!q && !v.ready && !(this.deps.isMobile() && v.device.type === 'touch')); // phone: NEXT is tapped
    const open = v.cursor === this.rows.QUESTIONS;
    this.askPrompt.setVisible(pad && !v.newProfile && !open);
    this.openPrompt.setVisible(pad && open);
    this.makePrompt.setVisible(pad && !!v.newProfile);
    const action = v.newProfile ? 'create' : open ? 'open' : 'ready';
    this.askText.setVisible(!pad).setText(`${v.device.type === 'keyboard' && v.device.layout === 'right' ? 'Enter' : 'Space'} = ${action}`);
    if (pad && v.family) { this.askPrompt.setFamily(v.family); this.openPrompt.setFamily(v.family); this.makePrompt.setFamily(v.family); }
    if (this.joined !== was) this.scene.tweens.add({ targets: this, scale: { from: 1.08, to: 1 }, duration: 300, ease: 'Back.Out' });
  }
}
