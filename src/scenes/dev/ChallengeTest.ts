/** Dev scene (?dev=ChallengeTest): one challenge at a time. Keys 1/2/3 answer, N = next (cycles kind x difficulty). */
import Phaser from 'phaser';
import { ANSWER_COLORS, ANSWER_LABELS, GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { ChallengeGenerator, type GeneratedChallenge } from '../../challenge/ChallengeGenerator';
import { Rng, randomSeed } from '../../core/rng';
import type { ChallengeKind, ChallengeOption, Difficulty } from '../../core/types';

const KINDS: ChallengeKind[] = ['picToWord', 'wordToPic', 'math'];
const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
const FONT = 'Arial Black, Arial';
const IMG = 320;

export default class ChallengeTest extends Phaser.Scene {
  private gen = new ChallengeGenerator(new Rng(randomSeed()));
  private index = 0;
  private current!: GeneratedChallenge;
  private answered = false;
  private layer!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() { super('ChallengeTest'); }

  create() {
    this.cameras.main.setBackgroundColor('#20304a');
    this.header = this.add.text(GAME_WIDTH / 2, 50, '', { fontFamily: FONT, fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
    this.feedback = this.add.text(GAME_WIDTH / 2, 440, '', { fontFamily: FONT, fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Keys: 1 / 2 / 3 = X / Y / B    N = next', { fontFamily: 'Arial', fontSize: '28px', color: '#9fb4d6' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.answer(0));
    kb.on('keydown-TWO', () => this.answer(1));
    kb.on('keydown-THREE', () => this.answer(2));
    kb.on('keydown-N', () => this.next());
    this.next();
  }

  private next() {
    const kind = KINDS[this.index % KINDS.length];
    const d = LEVELS[Math.floor(this.index / KINDS.length) % LEVELS.length];
    this.index++;
    this.answered = false;
    this.current = this.gen.generate(kind, d);
    this.feedback.setText('');
    this.header.setText(`${kind} / ${d}`);
    this.layer.removeAll(true);
    this.drawPrompt();
    this.current.options.forEach((o, i) => this.drawOption(o, i));
  }

  private drawPrompt() {
    const p = this.current.prompt;
    if (p.kind === 'image') this.layer.add(this.add.image(GAME_WIDTH / 2, 300, p.sceneId).setDisplaySize(IMG, IMG));
    else this.layer.add(this.add.text(GAME_WIDTH / 2, 300, p.text, { fontFamily: FONT, fontSize: '110px', color: '#ffffff' }).setOrigin(0.5));
  }

  private drawOption(o: ChallengeOption, i: number) {
    const x = GAME_WIDTH / 2 + (i - 1) * 560;
    const y = 700;
    this.layer.add(this.add.rectangle(x, y, 500, 380, 0xffffff, 0.12).setStrokeStyle(6, 0xffffff, 0.5));
    if (o.kind === 'image') this.layer.add(this.add.image(x, y, o.sceneId).setDisplaySize(340, 340));
    else this.layer.add(this.add.text(x, y, o.text, { fontFamily: FONT, fontSize: '72px', color: '#ffffff', wordWrap: { width: 460 }, align: 'center' }).setOrigin(0.5));
    const color = Phaser.Display.Color.HexStringToColor(ANSWER_COLORS[i]).color;
    this.layer.add(this.add.circle(x, y + 230, 40, color));
    this.layer.add(this.add.text(x, y + 230, ANSWER_LABELS[i], { fontFamily: FONT, fontSize: '44px', color: '#000000' }).setOrigin(0.5));
  }

  private answer(slot: 0 | 1 | 2) {
    if (this.answered) return;
    this.answered = true;
    const ok = slot === this.current.correct;
    this.feedback.setText(ok ? 'CORRECT!' : `Wrong - answer was ${ANSWER_LABELS[this.current.correct]}`).setColor(ok ? '#5dff7a' : '#ff6b6b');
  }
}
