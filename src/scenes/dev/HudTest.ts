/**
 * Dev scene (?dev=HudTest): exercises HudScene with a fake RaceContext (no gameplay).
 * Keys: L layout (single / merged / split)   1 2 3 = P1 answers X Y B   8 9 0 = P2 answers
 *       G new goal   N goal near P1   D dino banner   P pause   S score bump   T round tick to 0:25
 *       A goal:arrived (wait)   H halfway   B countdown banner   U popup   C goal complete   F freeze auto-challenges
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../../config/gameConfig';
import { ChallengeGenerator } from '../../challenge/ChallengeGenerator';
import { EventBus, type GoalState } from '../../core/events';
import type { ICameraRig, RaceContext } from '../../core/race';
import { Rng, randomSeed } from '../../core/rng';
import { services } from '../../core/services';
import type {
  AnswerSlot, CameraLayout, Challenge, ChallengeKind, PlayerId, Rect, Settings,
} from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { worldToScreen } from '../../ui/hud/hudMath';
import { REG, SCENE } from '../keys';

const KINDS: ChallengeKind[] = ['picToWord', 'math', 'wordToPic'];
const PLACES = ['bakery', 'hospital', 'school', 'zoo', 'library', 'fire station'];
const HALF_W = GAME_WIDTH / 2;
const CENTER = { x: 3000, y: 3000 };
type Mode = 'single' | 'merged' | 'split';
const MODES: Mode[] = ['single', 'merged', 'split'];

interface FakeCar { x: number; y: number; angle: number }

export default class HudTest extends Phaser.Scene {
  private bus = new EventBus();
  private cars: FakeCar[] = [{ x: 0, y: 0, angle: 0 }, { x: 0, y: 0, angle: 0 }];
  private modeIdx = 2;
  private layout!: CameraLayout;
  private gen = new ChallengeGenerator(new Rng(randomSeed()));
  private ctx!: RaceContext;
  private timers = [0, 2.5];
  private current: (Challenge | null)[] = [null, null];
  private resolved = [true, true];
  private counts = [0, 0];
  private nextId = 1;
  private score = { team: 0, per: [0, 0] };
  private remaining = 300;
  private tickAcc = 0;
  private time0 = 0;
  private paused = false;
  private frozen = false;
  private grid!: Phaser.GameObjects.Graphics;
  private goalId = 1;

  constructor() { super('HudTest'); }

  private get nPlayers() { return this.mode === 'single' ? 1 : 2; }
  private get mode(): Mode { return MODES[this.modeIdx]; }

  create() {
    this.cameras.main.setBackgroundColor('#2b3a4a');
    this.grid = this.add.graphics().setDepth(-10);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8, 'L layout | 1 2 3 / 8 9 0 answer | G goal | M magnet | D dino | P pause | S score | T 0:25 | A wait | H half | B 3 | U popup | C goal done | F freeze',
      { fontFamily: 'Arial', fontSize: '22px', color: '#6f8197' }).setOrigin(0.5, 1).setDepth(-5);

    this.layout = this.makeLayout();
    const goal = this.makeGoal(5200, 2300, 'bakery');
    const camera: ICameraRig = {
      layout: () => this.layout,
      worldView: (p) => this.worldView(p),
      shake: () => {},
      shakeAt: () => {},
      showOnlyTo: () => {},
      worldToScreen: (p, x, y) => {
        const wv = this.worldView(p), v = this.layout.playerViews[p] ?? this.layout.playerViews[0];
        return { x: v.x + (x - wv.x) * (v.w / wv.w), y: v.y + (y - wv.y) * (v.h / wv.h) };
      },
      viewRotation: () => 0,
    };
    const settings = {
      players: [{}, {}].slice(0, this.nPlayers), challengeIntervalSec: 5, roundLengthSec: 300,
      goalPointsPerCar: 3, seed: 1, musicVolume: 0, sfxVolume: 0,
    } as unknown as Settings;
    this.ctx = {
      scene: this, bus: this.bus, settings, players: this.cars.slice(0, this.nPlayers),
      goal, camera, elapsedSec: 0, roundLengthSec: 300, paused: false, questionBreak: false,
    } as unknown as RaceContext;
    this.registry.set(REG.race, this.ctx);
    this.launchHud();

    this.bus.on('game:pause', () => { this.paused = true; });
    this.bus.on('game:resume', () => { this.paused = false; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scene.stop(SCENE.hud); this.bus.clear(); });
    this.scene.manager.getScene(SCENE.title)?.events.once('start', () => this.scene.stop());
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e.code));
    this.time.delayedCall(250, () => this.bus.emit('round:tick', { remainingSec: this.remaining }));
  }

  // ───────────────────────── fake world ─────────────────────────
  private makeLayout(): CameraLayout {
    const full: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
    const l: Rect = { x: 0, y: 0, w: HALF_W, h: GAME_HEIGHT }, r: Rect = { x: HALF_W, y: 0, w: HALF_W, h: GAME_HEIGHT };
    return { mode: this.mode, playerViews: this.mode === 'single' ? [full] : [l, r] };
  }

  private worldView(p: PlayerId): Rect {
    const v = this.layout.playerViews[Math.min(p, this.layout.playerViews.length - 1)];
    if (this.mode === 'split') return { x: this.cars[p].x - v.w / 2, y: this.cars[p].y - v.h / 2, w: v.w, h: v.h };
    if (this.mode === 'single') return { x: this.cars[0].x - GAME_WIDTH / 2, y: this.cars[0].y - GAME_HEIGHT / 2, w: GAME_WIDTH, h: GAME_HEIGHT };
    const z = 1.3, w = GAME_WIDTH * z, h = GAME_HEIGHT * z;
    const cx = (this.cars[0].x + this.cars[1].x) / 2, cy = (this.cars[0].y + this.cars[1].y) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  private makeGoal(x: number, y: number, word: string): GoalState {
    const sceneId = scenesForWord(word)[0]?.id;
    return { id: this.goalId++, x, y, radius: 180, placeWord: word, sceneId };
  }

  // ───────────────────────── input ─────────────────────────
  private onKey(code: string) {
    const answers: Record<string, [PlayerId, AnswerSlot]> = {
      Digit1: [0, 0], Digit2: [0, 1], Digit3: [0, 2], Digit8: [1, 0], Digit9: [1, 1], Digit0: [1, 2],
    };
    if (answers[code]) { const [p, s] = answers[code]; this.answer(p, s); return; }
    const b = this.bus;
    switch (code) {
      case 'KeyL': this.cycleLayout(); break;
      case 'KeyG': {
        const a = Math.random() * Math.PI * 2, d = 900 + Math.random() * 2200;
        const g = this.makeGoal(CENTER.x + Math.cos(a) * d, CENTER.y + Math.sin(a) * d, PLACES[Math.floor(Math.random() * PLACES.length)]);
        this.ctx.goal = g;
        b.emit('goal:spawned', { goal: g });
        break;
      }
      case 'KeyN': { // goal right next to P1 (on-screen marker)
        const g = this.makeGoal(this.cars[0].x + 180, this.cars[0].y - 260, 'zoo');
        this.ctx.goal = g;
        b.emit('goal:spawned', { goal: g });
        break;
      }
      case 'KeyD': b.emit('dino:spawned', { x: CENTER.x, y: CENTER.y }); break;
      case 'KeyP': b.emit('game:pause', { by: 0 }); break;
      case 'KeyS': this.addScore(0, 1); break;
      case 'KeyT': this.remaining = 25; break;
      case 'KeyA': if (this.ctx.goal) b.emit('goal:arrived', { goal: this.ctx.goal, player: 0, waitSec: 20 }); break;
      case 'KeyH': b.emit('round:half', {}); break;
      case 'KeyB': b.emit('ui:banner', { text: '3', durationSec: 0.9 }); break;
      case 'KeyU': b.emit('ui:popup', { player: 0, text: 'Nice jump!', color: '#ffd43b' }); break;
      case 'KeyC': if (this.ctx.goal) b.emit('goal:completed', { goal: this.ctx.goal, arrived: [0, 1].slice(0, this.nPlayers) as PlayerId[] }); break;
      case 'KeyF': this.frozen = !this.frozen; break;
      default: break;
    }
  }

  private launchHud() {
    this.scene.launch(SCENE.hud);
    this.scene.bringToTop(SCENE.hud); // dev scenes are listed after Hud, so lift it above the grid
  }

  private cycleLayout() {
    const prevN = this.nPlayers;
    this.modeIdx = (this.modeIdx + 1) % MODES.length;
    this.layout = this.makeLayout();
    if (this.nPlayers !== prevN) {
      // HudScene reads the player count at create(): rebuild it.
      (this.ctx.settings as { players: unknown[] }).players = [{}, {}].slice(0, this.nPlayers);
      this.ctx.players = this.cars.slice(0, this.nPlayers) as never;
      this.current = [null, null];
      this.scene.stop(SCENE.hud);
      this.time.delayedCall(60, () => this.launchHud());
    } else {
      this.bus.emit('camera:layout', { layout: this.layout });
    }
  }

  private addScore(p: PlayerId, n: number) {
    this.score.team += n;
    this.score.per[p] += n;
    this.bus.emit('score:changed', { team: this.score.team, perPlayer: [...this.score.per] });
  }

  private answer(p: PlayerId, slot: AnswerSlot) {
    const c = this.current[p];
    if (p >= this.nPlayers || !c || this.resolved[p]) return;
    this.resolved[p] = true;
    const ok = slot === c.correct;
    this.bus.emit('challenge:resolved', { challenge: c, result: ok ? 'correct' : 'wrong', chosen: slot });
    if (ok) this.addScore(p, 1);
  }

  private newChallenge(p: PlayerId) {
    const old = this.current[p];
    if (old && !this.resolved[p]) this.bus.emit('challenge:resolved', { challenge: old, result: 'timeout', chosen: null });
    const n = this.counts[p]++;
    const place = p === 0 && n % 4 === 3 ? 'bakery' : undefined;
    const g = this.gen.generate(KINDS[n % 3], 'normal', { placeWord: place });
    const c: Challenge = {
      id: this.nextId++, player: p, kind: g.kind, prompt: g.prompt, options: g.options, correct: g.correct,
      durationSec: 5, source: place ? 'place' : 'random', placeWord: g.placeWord,
    };
    this.current[p] = c;
    this.resolved[p] = false;
    this.bus.emit('challenge:shown', { challenge: c });
  }

  // ───────────────────────── frame ─────────────────────────
  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    services.input.poll(); // the real RaceScene does this each frame; HudScene reads services.input.any()
    if (!this.paused) {
      this.time0 += dt;
      const w = this.time0;
      this.cars[0].x = 2600 + Math.cos(w * 0.45) * 800; this.cars[0].y = 3000 + Math.sin(w * 0.45) * 800;
      this.cars[1].x = 3500 + Math.cos(-w * 0.4 + 2) * (this.mode === 'split' ? 900 : 350);
      this.cars[1].y = 3100 + Math.sin(-w * 0.4 + 2) * (this.mode === 'split' ? 900 : 350);
      this.cars[0].angle = w * 0.45 + Math.PI / 2; this.cars[1].angle = -w * 0.4 + 2 - Math.PI / 2;

      if (!this.frozen) {
        for (let p = 0 as PlayerId; p < this.nPlayers; p++) {
          this.timers[p] -= dt;
          if (this.timers[p] <= 0) { this.timers[p] += 5; this.newChallenge(p); }
        }
      }
      this.tickAcc += dt;
      if (this.tickAcc >= 1) {
        this.tickAcc -= 1;
        this.remaining = Math.max(0, this.remaining - 1);
        this.bus.emit('round:tick', { remainingSec: this.remaining });
      }
    }
    this.drawWorld();
  }

  private drawWorld() {
    const g = this.grid.clear();
    const views = this.layout.playerViews;
    const shared = this.mode !== 'split';
    const mapFull: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
    for (let i = 0; i < (shared ? 1 : views.length); i++) {
      const v = shared ? mapFull : views[i];
      const wv = this.worldView(i as PlayerId);
      g.fillStyle(i === 0 ? 0x33485c : 0x3f4a63, 1).fillRect(v.x, v.y, v.w, v.h);
      const step = 200, sc = v.w / wv.w;
      g.lineStyle(2, 0x5d7690, 0.8);
      for (let wx = Math.ceil(wv.x / step) * step; wx < wv.x + wv.w; wx += step) {
        const sx = v.x + (wx - wv.x) * sc;
        g.lineBetween(sx, v.y, sx, v.y + v.h);
      }
      for (let wy = Math.ceil(wv.y / step) * step; wy < wv.y + wv.h; wy += step) {
        const sy = v.y + (wy - wv.y) * sc;
        g.lineBetween(v.x, sy, v.x + v.w, sy);
      }
    }
    for (let p = 0; p < this.nPlayers; p++) {
      const wv = this.worldView(p as PlayerId);
      const map = shared ? mapFull : views[p];
      const s = worldToScreen(this.cars[p].x, this.cars[p].y, wv, map);
      g.fillStyle(parseInt(PLAYER_COLORS[p].slice(1), 16), 1).fillCircle(s.x, s.y, 26);
      g.lineStyle(4, 0xffffff, 1).strokeCircle(s.x, s.y, 26);
      if (this.ctx.goal) {
        const gs = worldToScreen(this.ctx.goal.x, this.ctx.goal.y, wv, map);
        const z = map.w / wv.w;
        g.lineStyle(10, 0xffd43b, 0.7).strokeCircle(gs.x, gs.y, this.ctx.goal.radius * z);
      }
    }
  }
}
