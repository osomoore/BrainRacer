import Phaser from 'phaser';
import { cameraRotationFor, facingCenter } from '../../camera/cameraMath';
import { CAMERA, GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { loadAllProgress } from '../../core/racerProgress';
import type { RaceContext } from '../../core/race';
import { isRaceMap, loadSettings } from '../../core/settings';
import { services } from '../../core/services';
import type { AnswerSlot, CarKind, PlayerId, PlayerInput, RaceMap, Settings } from '../../core/types';
import { REG, SCENE } from '../keys';

/**
 * Throwaway performance spike (?dev=FourViewPerf&map=city&seed=3&questions=off&views=4|2).
 * Runs a REAL race with scripted autopilot cars and either the normal 2 views or 4 quadrant views
 * (views=4 is a real 4-player race, all four cars auto-driven; the quadrant cameras are this scene's own hack until the camera rig lays out 'quad'). Overlay = FPS stats; after
 * WINDOW_SEC the numbers freeze on screen and are stored in window.__perf.
 * Build with VITE_ALLOW_QUESTIONS_OFF=1 so questions=off works in a production build.
 */
const WINDOW_SEC = 30;
const WARMUP_SEC = 2;
const QW = GAME_WIDTH / 2, QH = GAME_HEIGHT / 2;
const MAX_QUESTION_INTERVAL = 120; // URL-only launch option; pushes the first question past the 35 s test
const AUTOPILOT_STEER_GAIN = 2.2;
const AUTOPILOT_ARRIVE_PX = 180;
const AUTOPILOT_STUCK_SEC = 1.2;

interface Pilot { node: number; stuck: number; backing: number }
export interface PerfResult { views: number; map: string; renderer: string; gpu: string; avgFps: number; low1Fps: number; avgMs: number; frames: number; done: boolean }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default class FourViewPerf extends Phaser.Scene {
  private views = 4;
  private mapName = 'city';
  private race!: Phaser.Scene;
  private ctx: RaceContext | null = null;
  private text!: Phaser.GameObjects.Text;
  private extra: Phaser.Cameras.Scene2D.Camera[] = [];
  private pilots: Pilot[] = [0, 1, 2, 3].map(() => ({ node: -1, stuck: 0, backing: 0 }));
  private frames: number[] = [];
  private last = 0;
  private startT = -1;
  private winMs = 0;
  private askTick = [0, 0, 0, 0];
  private done = false;
  private gpu = 'n/a';
  private fpsNow = 0;
  private exiting = false;
  private rawBack = false; private rawConfirm = false; private padA = false; private padB = false;

  constructor() { super('FourViewPerf'); }

  /** Launched from the Admin menu with { map, views }, or via URL flags. */
  create(data: { map?: string; views?: number } = {}) {
    const q = new URLSearchParams(location.search);
    const v = data.views ?? Number(q.get('views'));
    this.views = v === 2 ? 2 : 4;
    const m = data.map ?? q.get('map');
    this.mapName = isRaceMap(m) ? m : 'city';
    this.exiting = false;
    this.gpu = this.gpuString();
    delete (window as unknown as { __race?: RaceContext }).__race;
    this.frames = []; this.extra = []; this.pilots = [0, 1, 2, 3].map(() => ({ node: -1, stuck: 0, backing: 0 })); this.done = false; this.startT = -1; this.winMs = 0; this.ctx = null;

    const base = loadSettings();
    const kinds: CarKind[] = ['dino', 'kart', 'dino', 'kart'];
    const settings = {
      ...base,
      map: this.mapName as RaceMap,
      players: Array.from({ length: this.views }, (_, i) => ({
        ...base.players[i],
        device: i < 2 ? { type: 'keyboard', layout: i === 0 ? 'left' : 'right' } : { type: 'gamepad', index: 100 + i },
        difficulty: base.players[i]?.difficulty ?? 'normal', car: base.players[i]?.car ?? kinds[i],
      })),
    } as Settings;
    loadAllProgress();
    this.registry.set(REG.settings, settings);
    services.input.reset();
    settings.players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));
    this.installAutopilot();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backspace' || e.code === 'Escape') this.rawBack = true;
      if (e.code === 'Enter' || e.code === 'Space') this.rawConfirm = true;
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    // Questions cannot be turned off in release builds; ?every= is the only override that is always honoured.
    const prevUrl = location.href;
    try {
      const u = new URL(location.href);
      u.searchParams.set('every', String(MAX_QUESTION_INTERVAL));
      history.replaceState(null, '', u.toString());
    } catch { /* ignore: questions may interrupt the run */ }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { try { history.replaceState(null, '', prevUrl); } catch { /* ignore */ } });

    this.text = this.add.text(GAME_WIDTH / 2, 8, '', {
      fontFamily: 'Arial Black, Arial', fontSize: '44px', color: '#ffffff', backgroundColor: '#000000dd',
      align: 'center', padding: { x: 14, y: 8 },
    }).setOrigin(0.5, 0).setDepth(1e6);

    this.scene.launch(SCENE.race, { previewMap: this.mapName as RaceMap });
    this.race = this.scene.get(SCENE.race);
    this.race.events.on(Phaser.Scenes.Events.POST_UPDATE, this.layoutViews, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.race?.events.off(Phaser.Scenes.Events.POST_UPDATE, this.layoutViews, this));
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.scene.bringToTop(this.scene.key) });
  }

  private gpuString(): string {
    try {
      const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \([^,]*, /, '').replace(/ \(0x.*$/, '') : 'n/a';
    } catch { return 'n/a'; }
  }

  // ───── autopilot: follow lane graph nodes by patching the input service ─────
  private installAutopilot() {
    const input = services.input as unknown as { get: (p: PlayerId) => PlayerInput; __orig?: (p: PlayerId) => PlayerInput };
    const orig = input.__orig ?? input.get.bind(input);
    input.__orig = orig;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { input.get = orig; delete input.__orig; });
    input.get = (p: PlayerId) => {
      const base = orig(p);
      const ap = this.drive(p);
      return ap ? { ...base, ...ap } : base;
    };
  }

  private drive(p: PlayerId): Partial<PlayerInput> | null {
    const ctx = this.ctx ?? ((window as unknown as { __race?: RaceContext }).__race ?? null);
    if (!ctx) return null;
    this.ctx = ctx;
    const car = ctx.players[p];
    const nodes = ctx.world.laneGraph.nodes;
    if (!car || !nodes.length) return { throttle: 0.8, steer: 0.2, brake: 0 };
    // Question break (always at 5 s in release builds): keep answering so the race resumes.
    if (ctx.questionBreak) {
      this.askTick[p]++; // fallback guess only; the correct slot normally comes from the test hook
      const hook = (globalThis as { __challenge?: { current(p: number): { correct: AnswerSlot } | null } }).__challenge;
      const slot = hook?.current(p)?.correct ?? ((this.askTick[p] >> 5) % 4) as AnswerSlot;
      return { throttle: 0, brake: 0, steer: 0, answer: Math.floor(performance.now() / 200) % 2 === 0 ? slot : null };
    }
    const pl = this.pilots[p];
    const dt = 1 / 60;
    if (pl.backing > 0) { pl.backing -= dt; return { throttle: 0, brake: 1, steer: -0.5 }; }
    const nearest = () => {
      let best = 0, bd = Infinity;
      nodes.forEach((n, i) => { const d = Math.hypot(n.x - car.x, n.y - car.y); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    if (pl.node < 0) pl.node = nearest();
    let n = nodes[pl.node];
    if (Math.hypot(n.x - car.x, n.y - car.y) < AUTOPILOT_ARRIVE_PX) {
      pl.node = n.next.length ? n.next[(pl.node + p) % n.next.length] : nearest();
      n = nodes[pl.node];
    }
    if (Math.abs(car.forwardSpeed) < 25) pl.stuck += dt; else pl.stuck = 0;
    if (pl.stuck > AUTOPILOT_STUCK_SEC) { pl.stuck = 0; pl.backing = 0.8; pl.node = nearest(); }
    const diff = wrap(Math.atan2(n.y - car.y, n.x - car.x) - car.angle);
    return { throttle: Math.abs(diff) > 1.2 ? 0.4 : 0.9, brake: 0, steer: Math.max(-1, Math.min(1, diff * AUTOPILOT_STEER_GAIN)) };
  }

  // ───── view layout (runs right after the race scene's update, before render) ─────
  private layoutViews() {
    const ctx = this.ctx;
    if (this.views !== 4 || !ctx || ctx.players.length < 4) return;
    const main = this.race.cameras.main;
    const second = this.race.cameras.getCamera('p1');
    if (!second) return;
    [main, second].forEach((cam, i) => {
      // The rig centres a 1080-tall view; recentre for a 540-tall view (car-to-centre offset halves).
      const car = ctx.players[i];
      const cx = car.x + (cam.midPoint.x - car.x) * 0.5, cy = car.y + (cam.midPoint.y - car.y) * 0.5;
      cam.setViewport(i * QW, 0, QW, QH);
      cam.setVisible(true);
      cam.centerOn(cx, cy);
    });
    if (!this.extra.length) {
      for (let i = 0; i < 2; i++) {
        const c = this.race.cameras.add(i * QW, QH, QW, QH, false, `x${i}`);
        c.setBackgroundColor(main.backgroundColor.color);
        this.extra.push(c);
      }
    }
    // Players 3-4: own cameras in the bottom row, rotated so the car points up.
    this.extra.forEach((cam, i) => {
      const t = ctx.players[2 + i];
      const zoom = CAMERA.facingSplitZoom;
      cam.setVisible(true);
      cam.setZoom(zoom);
      cam.setRotation(cameraRotationFor(t.angle));
      const c = facingCenter({ x: t.x, y: t.y }, t.angle, QH, zoom, CAMERA.carScreenY);
      cam.centerOn(c.x, c.y);
    });
  }

  // ───── stats ─────
  /**
   * Back (B / Backspace / Esc) any time, or A / Enter / Space once the result is frozen, returns to the title menu.
   * Raw key + pad reads (like the admin overlay): services.input edges proved unreliable after the admin-menu launch.
   */
  private checkExit() {
    if (this.exiting) return;
    let back = this.rawBack, confirm = this.rawConfirm;
    this.rawBack = this.rawConfirm = false;
    const inp = services.input.any();
    back ||= inp.back; confirm ||= inp.confirm;
    try {
      const pressed = Array.from(navigator.getGamepads?.() ?? []).some((g) => !!g && g.buttons[1]?.pressed);
      const pressedA = Array.from(navigator.getGamepads?.() ?? []).some((g) => !!g && g.buttons[0]?.pressed);
      if (pressed && !this.padB) back = true;
      if (pressedA && !this.padA) confirm = true;
      this.padB = pressed; this.padA = pressedA;
    } catch { /* ignore */ }
    if (!(back || (this.done && confirm))) return;
    this.exiting = true;
    this.scene.stop(SCENE.hud);
    this.scene.stop(SCENE.race);
    this.scene.start(SCENE.title);
  }

  update() {
    this.checkExit();
    const now = performance.now();
    const dtMs = this.last ? now - this.last : 0;
    this.last = now;
    const ctx = this.ctx;
    if (!this.done && ctx && ctx.elapsedSec >= WARMUP_SEC && dtMs > 0) {
      if (this.startT < 0) this.startT = now;
      // Question breaks freeze the world: those frames are not representative, so they do not count.
      if (!ctx.questionBreak) {
        this.frames.push(dtMs);
        this.winMs += dtMs;
        if (this.winMs >= WINDOW_SEC * 1000) this.finish();
      }
    }
    if (dtMs > 0) this.fpsNow = this.fpsNow ? this.fpsNow * 0.9 + (1000 / dtMs) * 0.1 : 1000 / dtMs;
    this.text.setText(this.format());
    this.text.setColor(this.done ? '#00ff66' : '#ffffff');
    this.text.setFontSize(this.done ? 56 : 44);
  }

  private stats() {
    const f = this.frames;
    if (!f.length) return { avgFps: 0, low1Fps: 0, avgMs: 0 };
    const sum = f.reduce((a, b) => a + b, 0);
    const sorted = [...f].sort((a, b) => b - a);
    const n = Math.max(1, Math.ceil(sorted.length * 0.01));
    const worst = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
    return { avgFps: 1000 * f.length / sum, low1Fps: 1000 / worst, avgMs: sum / f.length };
  }

  private rendererName(): string { return this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'; }

  private format(): string {
    const s = this.stats();
    const head = `${this.done ? 'FINAL ' : ''}${this.views} VIEWS - ${this.mapName} - ${this.rendererName()}`;
    if (this.startT < 0) return `${head}\nwarming up... FPS ${this.fpsNow.toFixed(0)}`;
    const t = Math.min(WINDOW_SEC, this.winMs / 1000);
    return `${head}\nFPS ${this.fpsNow.toFixed(0)}  AVG ${s.avgFps.toFixed(1)}  1%LOW ${s.low1Fps.toFixed(1)}  ${s.avgMs.toFixed(1)} ms\n`
      + `${this.done ? 'DONE - press A or B to go back' : t.toFixed(0) + '/' + WINDOW_SEC + ' s  (B = exit)'}
${this.gpu.slice(0, 45)}`;
  }

  private finish() {
    this.done = true;
    const s = this.stats();
    const result: PerfResult = {
      views: this.views, map: this.mapName, renderer: this.rendererName(), gpu: this.gpu,
      avgFps: +s.avgFps.toFixed(2), low1Fps: +s.low1Fps.toFixed(2), avgMs: +s.avgMs.toFixed(2),
      frames: this.frames.length, done: true,
    };
    (window as unknown as { __perf?: PerfResult }).__perf = result;
  }
}
