import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, NEW_RACER } from '../../config/gameConfig';
import { validRacerName, type NewRacerInput } from '../../core/racerProfiles';
import { services } from '../../core/services';
import type { Difficulty, JbqSettings, QuestionTypes } from '../../core/types';
import { LetterPicker, type PickerResult } from './LetterPicker';
import { MenuButton } from './MenuButton';
import { cycleChoice, DIFFICULTIES, DIFF_EXAMPLE, DIFF_LABEL, nameTaken } from './newRacerLogic';
import { OptionRow } from './OptionRow';
import { bigText, FONT_HEAD, MENU } from './style';

type Step = 'name' | 'age' | 'options';
type Nav = { navX: number; navY: number; confirm: boolean; back: boolean };
/** Question types and JBQ choices are picked on the Join screen; this panel only asks name, age and Level. */
const ROW_LEVEL = 0, ROW_GO = 1;

/** Full-screen "make a new racer" flow driven by one player's input. Call handle() every frame. */
export class NewRacerPanel extends Phaser.GameObjects.Container {
  result?: NewRacerInput;
  private step: Step = 'name';
  private page?: Phaser.GameObjects.Container;
  private picker?: LetterPicker;
  private msg: Phaser.GameObjects.Text;
  private racerNameText = '';
  private under10 = true;
  private difficulty: Difficulty = NEW_RACER.defaultDifficulty;
  private types: QuestionTypes = { ...NEW_RACER.defaultQuestionTypes };
  private jbq: JbqSettings = { ...NEW_RACER.defaultJbq };
  private sel = 0;
  private ageBtns: MenuButton[] = [];
  private rows: OptionRow[] = [];
  private go?: MenuButton;
  private exampleText?: Phaser.GameObjects.Text;
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
    } else if (step === 'age') {
      page.add(bigText(this.scene, cx, 280, 'ARE YOU UNDER 10 YEARS OLD?', 84, MENU.yellow, { font: FONT_HEAD, wrap: 1700 }));
      this.ageBtns = [
        new MenuButton(this.scene, cx - 330, 620, 520, 220, 'YES', this.color, 110),
        new MenuButton(this.scene, cx + 330, 620, 520, 220, 'NO', this.color, 110),
      ];
      this.ageBtns.forEach((b, i) => this.tappable(b, () => this.taps.push({ sel: i, nav: { confirm: true } })));
      page.add(this.ageBtns);
      this.sel = this.under10 ? 0 : 1;
      this.paintAge();
    } else {
      page.add(bigText(this.scene, cx, 120, 'HOW HARD SHOULD IT BE?', 72, MENU.yellow, { font: FONT_HEAD }));
      const opts = { width: 1200, height: 76, fontSize: 56, valueX: 330, arrowSpan: 230 };
      this.rows = [];
      this.rows.push(new OptionRow(this.scene, cx, 400, 'Level', opts));
      this.exampleText = bigText(this.scene, cx, 500, '', 44, MENU.dim, { bold: false, wrap: 1700 });
      this.go = new MenuButton(this.scene, cx, 800, 700, 140, 'GO!', this.color, 100);
      this.rows.forEach((r, i) => r.makeTappable((z) => this.taps.push({ sel: i, nav: { navX: z === 'left' ? -1 : 1 } }), 96));
      this.tappable(this.go, () => this.taps.push({ sel: ROW_GO, nav: { confirm: true } }));
      page.add([...this.rows, this.exampleText, this.go]);
      this.sel = 0;
      this.paintOptions();
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

  private paintOptions() {
    this.rows[ROW_LEVEL].setValue(DIFF_LABEL[this.difficulty]).setSelected(this.sel === ROW_LEVEL, this.color);
    this.exampleText?.setText(this.difficulty === 'hard' ? 'Math: times tables' : `Math: sums like ${DIFF_EXAMPLE[this.difficulty]}`);
    this.go?.setSelected(this.sel === ROW_GO, this.color);
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
    if (this.step === 'age') {
      if (inp.back) { services.audio.sfx('menuMove'); this.show('name'); return 'none'; }
      if (inp.navX || inp.navY) { this.sel = 1 - this.sel; services.audio.sfx('menuMove'); this.paintAge(); }
      if (inp.confirm) { this.under10 = this.sel === 0; services.audio.sfx('menuSelect'); this.show('options'); }
      return 'none';
    }
    if (inp.back) { services.audio.sfx('menuMove'); this.show('age'); return 'none'; }
    if (inp.navY) {
      this.sel = Phaser.Math.Wrap(this.sel + inp.navY, 0, ROW_GO + 1);
      services.audio.sfx('menuMove'); this.paintOptions();
    }
    if (inp.navX && this.sel === ROW_LEVEL) {
      this.difficulty = cycleChoice(DIFFICULTIES, this.difficulty, inp.navX > 0 ? 1 : -1);
      services.audio.sfx('menuMove'); this.paintOptions();
      this.rows[ROW_LEVEL].bump(inp.navX);
    } else if (inp.confirm) {
      if (this.sel === ROW_GO) {
        this.result = { name: this.racerNameText, under10: this.under10, difficulty: this.difficulty, questionTypes: { ...this.types }, jbq: { ...this.jbq } };
        services.audio.sfx('menuSelect');
        return 'done';
      }
      this.sel = Math.min(this.sel + 1, ROW_GO); this.paintOptions();
    }
    return 'none';
  }

  override destroy(fromScene?: boolean): void {
    this.picker?.destroy();
    super.destroy(fromScene);
  }
}
