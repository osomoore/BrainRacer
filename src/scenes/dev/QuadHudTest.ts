/**
 * Dev scene (?dev=QuadHudTest&n=4|3&perf=1): HudScene in the 2x2 quadrant layout with a fake RaceContext.
 * Shows: P1 question panel, P2 dino ride countdown, P3 waiting card, scoreboard (centre for 4 players, team
 * panel for 3), popups and banners. Keys: N 3/4 players, S score, G goal banner, D dino banner, T 0:25, P pause,
 * 1 2 3 answer P1, W popup in every quadrant, Q re-ask P1.
 */
import Phaser from 'phaser';
import { playerViewsFor } from '../../camera/cameraMath';
import { ChallengeGenerator } from '../../challenge/ChallengeGenerator';
import { CAMERA, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../../config/gameConfig';
import { EventBus } from '../../core/events';
import { perfProbe } from '../../core/perfProbe';
import type { ICameraRig, RaceContext } from '../../core/race';
import { Rng } from '../../core/rng';
import { services } from '../../core/services';
import type { AnswerSlot, CameraLayout, Challenge, ChallengeKind, PlayerId, Rect, Settings } from '../../core/types';
import { REG, SCENE } from '../keys';

const KINDS: ChallengeKind[] = ['picToWord', 'math', 'wordToPic'];
const SHADE = [0x33485c, 0x4a3a5c, 0x3a5c48, 0x5c4a33];

export default class QuadHudTest extends Phaser.Scene {
  private bus = new EventBus();
  private n = 4;
  private layout!: CameraLayout;
  private ctx!: RaceContext;
  private gen = new ChallengeGenerator(new Rng(7));
  private nextId = 1;
  private g!: Phaser.GameObjects.Graphics;
  private current: (Challenge | null)[] = [null, null, null, null];
  private remaining = 300;
  private tick = 0;
  private score = { team: 0, per: [0, 0, 0, 0] };
  private paused = false;
  private t = 0;

  constructor() { super('QuadHudTest'); }

  create() {
    const q = new URLSearchParams(location.search);
    this.n = q.get('n') === '3' ? 3 : 4;
    if (q.get('perf') === '1') perfProbe.enabled = true;
    this.t = 0;
    this.remaining = 300;
    this.score = { team: 0, per: [0, 0, 0, 0] };
    this.current = [null, null, null, null];
    this.paused = false;
    this.cameras.main.setBackgroundColor('#1b2430');
    this.g = this.add.graphics().setDepth(-10);
    this.buildCtx();
    this.registry.set(REG.race, this.ctx);
    this.scene.launch(SCENE.hud);
    this.scene.bringToTop(SCENE.hud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scene.stop(SCENE.hud); this.bus.clear(); perfProbe.enabled = false; });
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e.code));
    this.bus.on('game:pause', () => { this.paused = true; });
    this.bus.on('game:resume', () => { this.paused = false; });
    this.time.delayedCall(400, () => this.script());
  }

  private buildCtx() {
    const views = playerViewsFor(this.n, GAME_WIDTH, GAME_HEIGHT);
    this.layout = { mode: 'quad', playerViews: views };
    const carPos = (v: Rect) => ({ x: v.x + v.w / 2, y: v.y + v.h * CAMERA.quadCarScreenY });
    const camera = {
      layout: () => this.layout,
      worldView: () => ({ x: -480, y: -270, w: 960, h: 540 }),
      shake: () => {}, shakeAt: () => {}, showOnlyTo: () => {},
      worldToScreen: (p: PlayerId, x: number, y: number) => { const c = carPos(views[p]); return { x: c.x + x, y: c.y + y }; },
      viewRotation: () => 0,
    } as unknown as ICameraRig;
    const settings = {
      players: Array.from({ length: this.n }, () => ({})), challengeIntervalSec: 5, roundLengthSec: 300,
      goalPointsPerCar: 3, seed: 1, musicVolume: 0, sfxVolume: 0, map: 'city',
    } as unknown as Settings;
    const players = Array.from({ length: this.n }, () => ({ x: 0, y: 0, angle: 0 }));
    const dino = { active: true, rideLeftByPlayer: [0, 12, 0, 0], rideTotalSec: 20, riders: [1] };
    this.ctx = {
      scene: this, bus: this.bus, settings, players, camera, dino, goal: null,
      elapsedSec: 0, roundLengthSec: 300, paused: false, questionBreak: true,
    } as unknown as RaceContext;
  }

  private script() {
    this.show(0);
    this.show(2);
    // P3 answers right away: the HUD then shows its Waiting card while P1 still thinks.
    this.time.delayedCall(900, () => { const c = this.current[2]; if (c) this.answer(2, c.correct); });
    this.bus.emit('round:tick', { remainingSec: this.remaining });
    this.addScore(0, 4); this.addScore(1, 2); this.addScore(2, 1);
    if (this.n > 3) this.addScore(3, 6);
    this.bus.emit('ui:popup', { player: (this.n - 1) as PlayerId, text: '+1' });
  }

  private show(p: number) {
    const g = this.gen.generate(KINDS[p % 3], 'normal', {});
    const c: Challenge = { id: this.nextId++, player: p as PlayerId, kind: g.kind, prompt: g.prompt, options: g.options, correct: g.correct, durationSec: 5, source: 'random' };
    this.current[p] = c;
    this.bus.emit('challenge:shown', { challenge: c });
  }

  private answer(p: number, slot: AnswerSlot) {
    const c = this.current[p];
    if (!c) return;
    this.current[p] = null;
    this.bus.emit('challenge:resolved', { challenge: c, result: slot === c.correct ? 'correct' : 'wrong', chosen: slot });
    if (slot === c.correct) this.addScore(p as PlayerId, 1);
  }

  private addScore(p: PlayerId, d: number) {
    this.score.team += d;
    this.score.per[p] += d;
    this.bus.emit('score:changed', { team: this.score.team, perPlayer: [...this.score.per] });
  }

  private onKey(code: string) {
    const slots: Record<string, AnswerSlot> = { Digit1: 0, Digit2: 1, Digit3: 2 };
    if (code in slots) { this.answer(0, slots[code]); return; }
    switch (code) {
      case 'KeyN': this.n = this.n === 4 ? 3 : 4; this.scene.restart(); break;
      case 'KeyS': this.addScore(Math.floor(Math.random() * this.n) as PlayerId, 1); break;
      case 'KeyG': this.bus.emit('goal:completed', { goal: { id: 1, x: 0, y: 0, radius: 100, placeWord: 'zoo' }, arrived: [0, 1, 2] as PlayerId[] }); break;
      case 'KeyD': this.bus.emit('dino:spawned', { x: 0, y: 0 }); break;
      case 'KeyT': this.remaining = 25; break;
      case 'KeyP': this.bus.emit('game:pause', { by: 0 }); break;
      case 'KeyQ': this.show(0); break;
      case 'KeyW': for (let p = 0; p < this.n; p++) this.bus.emit('ui:popup', { player: p as PlayerId, text: '+1' }); break;
      default: break;
    }
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    services.input.poll();
    perfProbe.frame(performance.now());
    if (!this.paused) {
      this.t += dt;
      this.tick += dt;
      if (this.tick >= 1) { this.tick -= 1; this.remaining = Math.max(0, this.remaining - 1); this.bus.emit('round:tick', { remainingSec: this.remaining }); }
      const left = this.ctx.dino.rideLeftByPlayer;
      if (left) left[1] = Math.max(0.5, 12 - (this.t % 11));
    }
    this.drawWorld();
  }

  private drawWorld() {
    const g = this.g.clear();
    this.layout.playerViews.forEach((v, i) => {
      g.fillStyle(SHADE[i], 1).fillRect(v.x, v.y, v.w, v.h);
      g.fillStyle(0x2a2f38, 1).fillRect(v.x + v.w / 2 - 110, v.y, 220, v.h);
      g.fillStyle(0xe8f0ff, 0.8);
      for (let y = v.y + ((this.t * 160) % 80); y < v.y + v.h; y += 80) g.fillRect(v.x + v.w / 2 - 4, y, 8, 40);
      const c = { x: v.x + v.w / 2, y: v.y + v.h * CAMERA.quadCarScreenY };
      g.fillStyle(parseInt(PLAYER_COLORS[i].slice(1), 16), 1).fillRect(c.x - 26, c.y - 44, 52, 88);
    });
    if (this.n === 3) g.fillStyle(0x10151c, 1).fillRect(960, 540, 960, 540);
  }
}
