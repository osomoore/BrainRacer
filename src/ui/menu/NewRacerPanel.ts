import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, NEW_RACER } from '../../config/gameConfig';
import { validRacerName, type NewRacerInput } from '../../core/racerProfiles';
import { services } from '../../core/services';
import { AGE_BANDS, bandDifficulty, difficultyBand, type AgeBand } from '../../core/ageBands';
import type { JbqSettings, QuestionTypes } from '../../core/types';
import { LetterPicker, type PickerResult } from './LetterPicker';
import { MenuButton } from './MenuButton';
import { bandChoiceLabel, nameTaken } from './newRacerLogic';
import { bigText, FONT_HEAD, MENU } from './style';

type Step = 'name' | 'age';
type Nav = { navX: number; navY: number; confirm: boolean; back: boolean };
/** Question types and JBQ choices are picked on the Join screen; this panel only asks name and age (the age band sets level and race time). */

/** Full-screen "make a new racer" flow driven by one player's input. Call handle() every frame. */
export class NewRacerPanel extends Phaser.GameObjects.Container {
  result?: NewRacerInput;
  private step: Step = 'name';
  private page?: Phaser.GameObjects.Container;
  private picker?: LetterPicker;
  private msg: Phaser.GameObjects.Text;
  private racerNameText = '';
  private band: AgeBand = difficultyBand(NEW_RACER.defaultDifficulty);
  private types: QuestionTypes = { ...NEW_RACER.defaultQuestionTypes };
  private jbq: JbqSettings = { ...NEW_RACER.defaultJbq };
  private sel = 0;
  private ageBtns: MenuButton[] = [];
  /** Taps waiting for the next handle(): an optional row/button to select, plus the nav edge to apply. Same logic path as the controller. */
  private taps: { sel?: number; nav: Partial<Nav> }[] = [];
  private cancelTap = false;

  constructor(scene: Phaser.Scene, private readonly color: number, private readonly colorHex: string, private readonly playerNum: number,
    private readonly takenNames: readonly string[], private readonly keyboardTyping: boolean,
    initialTypes?: QuestionTypes, initialJbq?: JbqSettings) {
    super(scene, 0, 0);
    this.setDepth(1000);
    // Start from what the player already picked on the Join screen.
    if (initialTypes) this.types = { ...initialTypes };
    if (initialJbq) this.jbq = { ...initialJbq };
    const g = scene.add.graphics();
    g.fillGradientStyle(0x1a2a6c, 0x1a2a6c, 0x2b8cff, 0x2b8cff, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(14, color, 1).strokeRect(7, 7, GAME_WIDTH - 14, GAME_HEIGHT - 14);
    this.msg = bigText(scene, GAME_WIDTH / 2, GAME_HEIGHT - 50, '', 48, '#ffd43b', { font: FONT_HEAD });
    this.add([g, this.msg]);
    scene.add.existing(this);
    this.show('name');
  }

  private show(step: Step) {
    this.step = step;
    this.picker?.destroy(); this.picker = undefined;
    this.page?.destroy(); this.page = undefined;
    this.msg.setText('');
    this.taps = [];
    const page = this.scene.add.container(0, 0);
    this.page = page;
    this.add(page);
    const cx = GAME_WIDTH / 2;
    const back = new MenuButton(this.scene, GAME_WIDTH - 190, 70, 300, 100, 'BACK', this.color, 52);
    page.add(this.tappable(back, () => { if (step === 'name') this.cancelTap = true; else this.taps.push({ nav: { back: true } }); }));
    page.add(bigText(this.scene, 40, 40, `PLAYER ${this.playerNum}`, 48, this.colorHex, { font: FONT_HEAD, stroke: 10, origin: [0, 0.5] }));
    if (step === 'name') {
      this.picker = new LetterPicker(this.scene, cx, 70, { title: 'WHAT\'S YOUR NAME?', initial: this.racerNameText, maxLen: NEW_RACER.nameMaxLen, color: this.color, keyboardTyping: this.keyboardTyping });
      this.add(this.picker);
    } else {
      page.add(bigText(this.scene, cx, 200, 'HOW OLD ARE YOU?', 84, MENU.yellow, { font: FONT_HEAD, wrap: 1700 }));
      this.ageBtns = AGE_BANDS.map((b, i) => new MenuButton(this.scene, cx, 380 + i * 170, 1100, 140, bandChoiceLabel(b, bandDifficulty(b)), this.color, 76));
      this.ageBtns.forEach((b, i) => this.tappable(b, () => this.taps.push({ sel: i, nav: { confirm: true } })));
      page.add(this.ageBtns);
      this.sel = AGE_BANDS.indexOf(this.band);
      this.paintAge();
    }
  }

  /** Adds an invisible tap zone over a button (at least 110 logical px tall) and a press squash. */
  private tappable(b: MenuButton, onTap: () => void): MenuButton {
    const z = this.scene.add.zone(0, 0, b.w + 20, Math.max(b.h, 110)).setInteractive();
    z.on('pointerdown', () => { b.pulse(); onTap(); });
    b.add(z);
    return b;
  }

  private paintAge() {
    this.ageBtns.forEach((b, i) => b.setSelected(i === this.sel, this.color));
  }

  /** 'done' once the player finished (see `result`), 'cancel' to abandon the whole flow. */
  handle(input: Nav): PickerResult {
    if (this.cancelTap) { this.cancelTap = false; services.audio.sfx('menuMove'); return 'cancel'; }
    let inp = input;
    const t = this.step === 'name' ? undefined : this.taps.shift();
    if (t) {
      if (t.sel !== undefined) this.sel = t.sel;
      inp = { navX: input.navX || t.nav.navX || 0, navY: input.navY, confirm: input.confirm || !!t.nav.confirm, back: input.back || !!t.nav.back };
    }
    if (this.step === 'name') {
      const r = this.picker!.handle(inp);
      if (r === 'cancel') return 'cancel';
      if (r === 'done') {
        const n = validRacerName(this.picker!.value);
        if (!n) { this.msg.setText('Try using letters!'); return 'none'; }
        if (nameTaken(n, this.takenNames)) { this.msg.setText('Someone is already called that! Try another name.'); services.audio.sfx('menuMove'); return 'none'; }
        this.racerNameText = n;
        this.show('age');
      }
      return 'none';
    }
    if (inp.back) { services.audio.sfx('menuMove'); this.show('name'); return 'none'; }
    const dir = inp.navY || inp.navX;
    if (dir) { this.sel = Phaser.Math.Wrap(this.sel + (dir > 0 ? 1 : -1), 0, AGE_BANDS.length); services.audio.sfx('menuMove'); this.paintAge(); }
    if (inp.confirm) {
      this.band = AGE_BANDS[this.sel];
      this.result = { name: this.racerNameText, ageBand: this.band, questionTypes: { ...this.types }, jbq: { ...this.jbq } };
      services.audio.sfx('menuSelect');
      return 'done';
    }
    return 'none';
  }

  override destroy(fromScene?: boolean): void {
    this.picker?.destroy();
    super.destroy(fromScene);
  }
}
