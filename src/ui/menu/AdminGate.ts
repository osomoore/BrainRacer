import Phaser from 'phaser';
import { ADMIN_GATE, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../../config/gameConfig';
import { appendGateDigit, checkGateAnswer, makeGateQuestion, type GateQuestion } from './adminGateLogic';
import { MenuButton } from './MenuButton';
import { bigText, FONT_HEAD, hexNum, MENU } from './style';

const GEAR_TEX = 'ui-admin-gear';
const DEPTH = 1000;

/** Bakes the gear icon once (a round badge with a toothed gear on it). */
export function ensureGearTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(GEAR_TEX)) return GEAR_TEX;
  const s = ADMIN_GATE.gear.size, c = s / 2;
  const g = scene.add.graphics();
  g.fillStyle(MENU.panel, 0.92).fillCircle(c, c, c - 3);
  g.lineStyle(6, 0xffffff, 1).strokeCircle(c, c, c - 4);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.fillPoints([
      new Phaser.Geom.Point(c + Math.cos(a - 0.22) * 28, c + Math.sin(a - 0.22) * 28),
      new Phaser.Geom.Point(c + Math.cos(a - 0.16) * 40, c + Math.sin(a - 0.16) * 40),
      new Phaser.Geom.Point(c + Math.cos(a + 0.16) * 40, c + Math.sin(a + 0.16) * 40),
      new Phaser.Geom.Point(c + Math.cos(a + 0.22) * 28, c + Math.sin(a + 0.22) * 28),
    ], true);
  }
  g.fillCircle(c, c, 30);
  g.fillStyle(MENU.panel, 1).fillCircle(c, c, 13);
  g.generateTexture(GEAR_TEX, s, s);
  g.destroy();
  return GEAR_TEX;
}

/** Kid-proof gate: a multiplication question answered on a touch number pad. Calls onResult(true) only for a correct answer. */
export class AdminGate extends Phaser.GameObjects.Container {
  private q: GateQuestion;
  private entered = '';
  private answerText: Phaser.GameObjects.Text;
  private done = false;

  constructor(scene: Phaser.Scene, private onResult: (ok: boolean) => void, rng: () => number = Math.random) {
    super(scene, 0, 0);
    this.setDepth(DEPTH);
    this.q = makeGateQuestion(rng, ADMIN_GATE.factorMin, ADMIN_GATE.factorMax);
    const cx = GAME_WIDTH / 2;
    const color = hexNum(PLAYER_COLORS[0]);

    // Full-screen dim that swallows taps so nothing behind the gate reacts.
    const dim = scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setInteractive();
    const bg = scene.add.graphics();
    bg.fillStyle(MENU.navy, 1).fillRoundedRect(cx - 450, 25, 900, 1030, 40);
    bg.lineStyle(8, color, 1).strokeRoundedRect(cx - 450, 25, 900, 1030, 40);
    this.add([dim, bg]);
    this.add(bigText(scene, cx, 90, 'Grown-ups only!', 56, MENU.yellow, { font: FONT_HEAD }));
    this.add(bigText(scene, cx, 200, `${this.q.a} × ${this.q.b} = ?`, 110, '#ffffff', { font: FONT_HEAD }));
    const box = scene.add.graphics();
    box.fillStyle(0x0b1530, 1).fillRoundedRect(cx - 200, 285, 400, 110, 24);
    box.lineStyle(5, 0xffffff, 1).strokeRoundedRect(cx - 200, 285, 400, 110, 24);
    this.add(box);
    this.answerText = bigText(scene, cx, 340, '', 80, '#ffffff', { font: FONT_HEAD });
    this.add(this.answerText);

    const { w, h, gap, firstY } = ADMIN_GATE.key;
    const keys: { label: string; fn: () => void; color: number }[] = [
      ...[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => ({ label: String(d), fn: () => this.digit(d), color })),
      { label: 'DEL', fn: () => this.del(), color: 0xe67700 },
      { label: '0', fn: () => this.digit(0), color },
      { label: 'OK', fn: () => this.submit(), color: 0x2f9e44 },
    ];
    keys.forEach((k, i) => {
      const x = cx + ((i % 3) - 1) * (w + gap);
      const y = firstY + Math.floor(i / 3) * (h + gap) + h / 2;
      this.addKey(x, y, w, h, k.label, k.color, k.fn);
    });
    this.addKey(cx, firstY + 4 * (h + gap) + 50, 420, 100, 'CANCEL', 0xc92a2a, () => this.finish(false));
    scene.add.existing(this);
  }

  private addKey(x: number, y: number, w: number, h: number, label: string, color: number, fn: () => void) {
    const b = new MenuButton(this.scene, x, y, w, h, label, color, 56);
    const z = this.scene.add.zone(0, 0, w, h).setInteractive();
    z.on('pointerdown', () => { b.pulse(); fn(); });
    b.add(z);
    this.add(b);
  }

  private digit(d: number) { this.entered = appendGateDigit(this.entered, d, ADMIN_GATE.maxDigits); this.answerText.setText(this.entered); }
  private del() { this.entered = this.entered.slice(0, -1); this.answerText.setText(this.entered); }
  private submit() { if (this.entered) this.finish(checkGateAnswer(this.q, this.entered)); }
  private finish(ok: boolean) {
    if (this.done) return;
    this.done = true;
    this.onResult(ok);
  }
}
