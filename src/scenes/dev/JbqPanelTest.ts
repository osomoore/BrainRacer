/**
 * Dev scene (?dev=JbqPanelTest&n=1|2|4&s=0..3&act=wrong|correct&pad=xbox|switch|kb): the real HudScene showing JBQ question panels
 * (long text, verse answers) with a fake RaceContext. Keys: V cycle 1/2/4 players, N next sample (all players),
 * C correct answer, X wrong answer (then the correct card is revealed big), R re-ask, 1-4 answer P1 by slot.
 * `act` auto-triggers C/X for player 1 about 1.2 s after the panel shows (for screenshots).
 */
import Phaser from 'phaser';
import { playerViewsFor } from '../../camera/cameraMath';
import { JBQ_QUESTIONS } from '../../challenge/jbqGenerator';
import { CAMERA, CHALLENGE, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../../config/gameConfig';
import { EventBus } from '../../core/events';
import type { ICameraRig, RaceContext } from '../../core/race';
import { services } from '../../core/services';
import type { AnswerSlot, CameraLayout, Challenge, ChallengeOption, PlayerId, Rect, Settings } from '../../core/types';
import { wrongRevealSecFor } from '../../challenge/reveal';
import { REG, SCENE } from '../keys';

const SHADE = [0x33485c, 0x4a3a5c, 0x3a5c48, 0x5c4a33];
const t = (text: string): ChallengeOption => ({ kind: 'text', text });
const verseOption = (id: number): ChallengeOption => {
  const question = JBQ_QUESTIONS.find((row) => row.id === id);
  if (!question?.ref || !question.verse) throw new Error(`Missing quotation sample Q${id}`);
  return { kind: 'verse', ref: question.ref, text: question.verse };
};

interface Sample { label: string; q: string; options: ChallengeOption[]; correct: AnswerSlot; kind?: 'wordToPic' }

const SAMPLES: Sample[] = [
  { label: 'num', q: 'How many books are there in the Bible?', options: [t('66'), t('39'), t('27'), t('40')], correct: 0 },
  {
    label: 'who', q: 'According to church history, who was the only one of the twelve apostles not martyred for his faith in the risen Christ?',
    options: [t('Peter'), t('James'), t('John'), t('Thomas')], correct: 2,
  },
  {
    label: 'quote', q: 'Which verse tells what happened when the Holy Spirit came at Pentecost?',
    options: [24, 86, 87, 409].map(verseOption),
    correct: 3,
  },
  {
    label: 'how', q: 'How did God stop the people from finishing the tower they were building at Babel?',
    options: [
      t('By confusing their languages so they couldn’t understand one another'),
      t('The tree of the knowledge of good and evil; the tree of life'),
      t('By sending a great flood over the whole land so that every one of the builders had to leave their half-finished city and run for the hills, and they never came back to it again afterwards'),
      t('Fire came down from heaven'),
    ],
    correct: 0,
  },
  // Not JBQ: the classic diamond with picture answers, to check the wrong-answer reveal on images.
  {
    label: 'pics', kind: 'wordToPic', q: 'skiing',
    options: ['scene_001', 'scene_002', 'scene_003', 'scene_004'].map((id): ChallengeOption => ({ kind: 'image', sceneId: id })), correct: 2,
  },
];

/** A JBQ challenge built from the inline samples (also used by HudTest / QuadHudTest). */
export function jbqChallenge(id: number, player: PlayerId, sampleIdx: number): Challenge {
  const s = SAMPLES[sampleIdx % SAMPLES.length];
  return {
    id, player, kind: s.kind ?? 'jbq', prompt: { kind: 'text', text: s.q }, options: s.options,
    correct: s.correct, durationSec: 5, source: 'random', ...(s.kind ? {} : { jbq: { id: id + 1000, points: 10 as const } }),
  };
}

export default class JbqPanelTest extends Phaser.Scene {
  private bus = new EventBus();
  private n = 2;
  private sample = 0;
  private nextId = 1;
  private layout!: CameraLayout;
  private ctx!: RaceContext;
  private g!: Phaser.GameObjects.Graphics;
  private current: (Challenge | null)[] = [null, null, null, null];

  constructor() { super('JbqPanelTest'); }

  create() {
    const q = new URLSearchParams(location.search);
    this.n = [1, 2, 4].includes(Number(q.get('n'))) ? Number(q.get('n')) : this.n;
    this.sample = Math.max(0, Math.min(SAMPLES.length - 1, Number(q.get('s') ?? this.sample) || 0));
    this.current = [null, null, null, null];
    this.cameras.main.setBackgroundColor('#1b2430');
    this.g = this.add.graphics().setDepth(-10);
    this.buildCtx();
    this.drawWorld();
    this.registry.set(REG.race, this.ctx);
    this.scene.launch(SCENE.hud);
    this.scene.bringToTop(SCENE.hud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scene.stop(SCENE.hud); this.bus.clear(); });
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e.code));
    this.time.delayedCall(400, () => {
      this.bus.emit('round:tick', { remainingSec: 250 });
      this.showAll();
      const act = q.get('act');
      if (act === 'wrong' || act === 'correct') {
        this.time.delayedCall(1200, () => this.answer(0, act === 'wrong'));
      }
    });
  }

  private buildCtx() {
    const views: Rect[] = playerViewsFor(this.n, GAME_WIDTH, GAME_HEIGHT);
    this.layout = { mode: this.n >= 3 ? 'quad' : this.n === 2 ? 'split' : 'single', playerViews: views };
    const carY = (vw: Rect) => vw.y + vw.h * (this.n >= 3 ? CAMERA.quadCarScreenY : CAMERA.carScreenY);
    const camera = {
      layout: () => this.layout,
      worldView: () => ({ x: -480, y: -270, w: 960, h: 540 }),
      shake: () => {}, shakeAt: () => {}, showOnlyTo: () => {},
      worldToScreen: (p: PlayerId, x: number, y: number) => ({ x: views[p].x + views[p].w / 2 + x, y: carY(views[p]) + y }),
      viewRotation: () => 0,
    } as unknown as ICameraRig;
    // ?pad=xbox|switch|kb picks the answer-badge family (default xbox colours).
    const pad = new URLSearchParams(location.search).get('pad');
    if (pad === 'xbox' || pad === 'switch') {
      const inp = services.input as unknown as { controllerFamily?: (d?: unknown) => string };
      inp.controllerFamily = () => (pad === 'switch' ? 'nintendo' : 'xbox');
    }
    const device = pad === 'kb' ? (i: number) => ({ type: 'keyboard', layout: i % 2 ? 'right' : 'left' })
      : pad ? () => ({ type: 'gamepad', index: 0 }) : () => undefined;
    const settings = {
      players: Array.from({ length: this.n }, (_, i) => ({ device: device(i) })), challengeIntervalSec: 5, roundLengthSec: 300,
      goalPointsPerCar: 3, seed: 1, musicVolume: 0, sfxVolume: 0, map: 'city', questionStyle: 'pause',
    } as unknown as Settings;
    const players = Array.from({ length: this.n }, () => ({ x: 0, y: 0, angle: 0 }));
    this.ctx = {
      scene: this, bus: this.bus, settings, players, camera, dino: { active: false }, goal: null,
      elapsedSec: 0, roundLengthSec: 300, paused: false, questionBreak: true,
    } as unknown as RaceContext;
  }

  private show(p: number) {
    const c = jbqChallenge(this.nextId++, p as PlayerId, this.sample + p);
    this.current[p] = c;
    this.bus.emit('challenge:shown', { challenge: c });
  }

  private showAll() { for (let p = 0; p < this.n; p++) this.show(p); }

  private answer(p: number, wrong: boolean, slot?: AnswerSlot) {
    const c = this.current[p];
    if (!c) return;
    const chosen = slot ?? (wrong ? (((c.correct + 1) % 4) as AnswerSlot) : c.correct);
    const ok = chosen === c.correct;
    this.current[p] = null;
    this.bus.emit('challenge:resolved', { challenge: c, result: ok ? 'correct' : 'wrong', chosen });
    if (!ok) {
      // Mimic BreakScheduler: the next question arrives after wrongRetrySec + wrongRevealSec.
      this.time.delayedCall((CHALLENGE.wrongRetrySec + wrongRevealSecFor(c.kind)) * 1000, () => { if (!this.current[p]) this.show(p); });
    }
  }

  private onKey(code: string) {
    switch (code) {
      case 'KeyV': this.n = this.n === 1 ? 2 : this.n === 2 ? 4 : 1; this.scene.restart(); break;
      case 'KeyN': this.sample = (this.sample + 1) % SAMPLES.length; this.showAll(); break;
      case 'KeyC': for (let p = 0; p < this.n; p++) this.answer(p, false); break;
      case 'KeyX': for (let p = 0; p < this.n; p++) this.answer(p, true); break;
      case 'KeyR': this.showAll(); break;
      case 'Digit1': this.answer(0, false, 0); break;
      case 'Digit2': this.answer(0, false, 1); break;
      case 'Digit3': this.answer(0, false, 2); break;
      case 'Digit4': this.answer(0, false, 3); break;
      default: break;
    }
  }

  update() { services.input.poll(); }

  private drawWorld() {
    const g = this.g.clear();
    this.layout.playerViews.forEach((vw, i) => {
      g.fillStyle(SHADE[i], 1).fillRect(vw.x, vw.y, vw.w, vw.h);
      g.fillStyle(0x2a2f38, 1).fillRect(vw.x + vw.w / 2 - 110, vw.y, 220, vw.h);
      const cy = vw.y + vw.h * (this.n >= 3 ? CAMERA.quadCarScreenY : CAMERA.carScreenY);
      g.fillStyle(parseInt(PLAYER_COLORS[i].slice(1), 16), 1).fillRect(vw.x + vw.w / 2 - 26, cy - 44, 52, 88);
    });
  }
}
