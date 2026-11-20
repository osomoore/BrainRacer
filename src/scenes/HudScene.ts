import Phaser from 'phaser';
import { CHALLENGE, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import type { GameEvents } from '../core/events';
import type { RaceContext } from '../core/race';
import { services } from '../core/services';
import type { CameraLayout, PlayerId, Rect, Vec2 } from '../core/types';
import { bigText, FONT_HEAD, hexNum } from '../ui/menu/style';
import { PauseOverlay } from '../ui/menu/PauseOverlay';
import { Banners } from '../ui/hud/Banners';
import { bakedImage, rrectImage } from '../ui/hud/bake';
import { ChallengePanel } from '../ui/hud/ChallengePanel';
import { HUD } from '../ui/hud/hudConfig';
import { easeInOut, smoothFactor } from '../ui/hud/hudMath';
import { Scoreboard } from '../ui/hud/Scoreboard';
import { TimerBar } from '../ui/hud/TimerBar';
import { REG, SCENE } from './keys';
import { TEX } from '../core/assetKeys';
import { rideSecondsShown } from '../entities/dinoRide';

const D = { divider: 1, bars: 2, scoreboard: 5, panel: 6, banner: 20, fly: 30 };
const CENTER_Y = 430;
/** Dino ride countdown card (bottom centre of the rider's view): dino head, seconds, shrinking bar. */
const RIDE = { w: 520, h: 132, barW: 250, barH: 38, fromBottom: 100 };

type Kind = 'dino' | 'half' | 'goal';
const KIND_RE: [Kind, RegExp][] = [['dino', /dino alert/i], ['half', /half/i], ['goal', /^goal/i]];

const copy = (r: Rect): Rect => ({ ...r });

/** HUD overlay scene: scoreboard, challenge panels, timer bars, banners, wait pills, popups, pause. */
export class HudScene extends Phaser.Scene {
  private ctx!: RaceContext;
  private subs: (() => void)[] = [];
  private nPlayers = 1;
  private layout: CameraLayout = { mode: 'single', playerViews: [{ x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT }] };
  private curViews: Rect[] = [];
  private divider: Phaser.GameObjects.Rectangle[] = [];
  private dividerAlpha = 0;
  private dividerKey = '';
  private scoreboard!: Scoreboard;
  private panels: (ChallengePanel | null)[] = [null, null];
  private bars: TimerBar[] = [];
  private banners!: Banners;
  private overlay!: PauseOverlay;
  private skipFrames = 0;
  private lastKind: Partial<Record<Kind, number>> = {};
  private clock = 0;
  private pauseStyle = true;
  private waiting = [false, false];
  private waitCards: Phaser.GameObjects.Container[] = [];
  private rideCards: { box: Phaser.GameObjects.Container; num: Phaser.GameObjects.Text; fill: Phaser.GameObjects.Rectangle; shown: number; low: boolean | null }[] = [];
  private dim: Phaser.GameObjects.Rectangle[] = [];
  private dimA = 0;

  constructor() { super(SCENE.hud); }

  create() {
    const ctx = this.registry.get(REG.race) as RaceContext | undefined;
    this.subs = [];
    this.panels = [null, null];
    this.bars = [];
    this.lastKind = {};
    this.clock = 0;
    this.dividerAlpha = 0;
    this.waiting = [false, false];
    this.waitCards = [];
    this.rideCards = [];
    this.dimA = 0;
    if (!ctx) {
      bigText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'HudScene: no RaceContext in registry', 48, '#ff6b6b');
      return;
    }
    this.ctx = ctx;
    this.nPlayers = Math.max(1, Math.min(2, ctx.settings?.players?.length ?? ctx.players.length ?? 1));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    this.pauseStyle = (ctx.settings?.questionStyle ?? 'pause') === 'pause';
    // Plain rectangles (cheap) instead of a Graphics cleared and redrawn every frame.
    const bar = () => this.add.rectangle(0, 0, 1, GAME_HEIGHT, 0xe8f0ff).setOrigin(0, 0).setDepth(D.divider).setVisible(false);
    this.divider = [bar(), bar(), bar()];
    this.divider[0].setFillStyle(0x0b1226).setSize(16, GAME_HEIGHT);
    this.divider[1].setSize(3, GAME_HEIGHT);
    this.divider[2].setSize(3, GAME_HEIGHT);
    this.dividerKey = '';
    this.dim = [0, 1].map(() => this.add.rectangle(0, 0, 1, 1, 0x0b1226).setOrigin(0, 0).setDepth(0.5).setVisible(false));
    this.scoreboard = new Scoreboard(this, this.nPlayers, D.scoreboard);
    this.scoreboard.setRemaining(ctx.roundLengthSec);
    for (let p = 0; p < this.nPlayers; p++) {
      this.bars.push(new TimerBar(this, PLAYER_COLORS[p], D.bars));
      this.waitCards.push(this.buildWaitCard(PLAYER_COLORS[p]));
      this.rideCards.push(this.buildRideCard(PLAYER_COLORS[p]));
    }
    this.banners = new Banners(this, D.banner);
    this.overlay = new PauseOverlay(this, {
      onResume: () => ctx.bus.emit('game:resume', {}),
      onRestart: () => this.restartRace(),
      onQuit: () => this.quitToTitle(),
    });

    this.applyLayout(ctx.camera.layout(), true);
    this.bind();
  }

  // ───────────────────────── events ─────────────────────────
  private on<K extends keyof GameEvents>(type: K, fn: (e: GameEvents[K]) => void) {
    this.subs.push(this.ctx.bus.on(type, fn));
  }

  private bind() {
    this.on('camera:layout', (e) => this.applyLayout(e.layout, false));
    this.on('score:changed', (e) => this.scoreboard.setScore(e.team, e.perPlayer));
    this.on('round:tick', (e) => this.scoreboard.setRemaining(e.remainingSec));

    this.on('challenge:shown', ({ challenge }) => {
      const p = challenge.player;
      if (p >= this.nPlayers) return;
      this.panels[p]?.destroy();
      this.panels[p] = new ChallengePanel(this, PLAYER_COLORS[p], challenge, this.curViews[p], {
        depth: D.panel,
        centered: this.pauseStyle,
        onCorrect: (x, y) => this.flyPlusOne(x, y),
      });
      this.waiting[p] = false;
      if (!this.pauseStyle) this.bars[p].start(challenge.durationSec);
    });
    this.on('challenge:resolved', ({ challenge, result, chosen }) => {
      const p = challenge.player;
      if (this.pauseStyle && result === 'correct' && this.nPlayers > 1) this.waiting[p] = true;
      const panel = this.panels[p];
      if (!panel || panel.challenge.id !== challenge.id) return;
      panel.resolve(result, chosen);
      this.bars[p]?.stop();
    });

    this.on('goal:arrived', ({ player, waitSec }) => {
      if (waitSec > 0 && player < this.nPlayers && this.nPlayers > 1) this.waitBanner(player);
    });
    this.on('goal:completed', ({ arrived }) => {
      const pts = (this.ctx.settings.goalPointsPerCar ?? 3) * arrived.length;
      this.kindBanner('goal', `GOAL! +${pts}`, '#7dff8a');
    });
    this.on('round:half', () => this.kindBanner('half', 'Halfway!', '#ffd43b'));
    this.on('dino:spawned', () => this.kindBanner('dino',
      this.ctx.settings.map === 'underground' ? '⚠ ROCK MONSTER ALERT ⚠' : '⚠ DINO ALERT ⚠'));
    this.on('ui:banner', (e) => {
      const kind = KIND_RE.find(([, re]) => re.test(e.text))?.[0];
      if (kind) this.kindBanner(kind, e.text, e.color, e.durationSec);
      else this.banners.center(GAME_WIDTH / 2, CENTER_Y, e.text, e.color ?? '#ffd43b', e.durationSec ?? 1.2);
    });
    // Only score-like popups (+1, -2 ...) and the dino ROAR show; other words are ignored on purpose.
    this.on('ui:popup', (e) => {
      if (/^[+-]\d/.test(e.text) || /^roar/i.test(e.text)) this.popup(e.player, e.text, e.world, e.color);
    });

    this.on('game:pause', () => {
      if (this.overlay.visible) return;
      this.overlay.show();
      this.skipFrames = 1; // the press that opened pause must not also trigger "resume"
    });
    this.on('game:resume', () => this.overlay.hide());
  }

  private teardown() {
    this.subs.forEach((u) => u());
    this.subs = [];
    this.panels.forEach((p) => p?.destroy());
    this.panels = [null, null];
    this.banners?.destroy();
  }

  /** Friendly "waiting for teammate" indicator: big check mark plus a small Waiting label. */
  private buildWaitCard(color: string): Phaser.GameObjects.Container {
    const g = bakedImage(this, `wait:${color}`, 360, 360, 0, 0, (gr, k) => {
      const c = 180 * k;
      gr.fillStyle(0x14213d, 0.9).fillCircle(c, c, 170 * k).lineStyle(14 * k, hexNum(color), 1).strokeCircle(c, c, 170 * k);
      gr.fillStyle(HUD.colors.green, 1).fillCircle(c, c, 134 * k).lineStyle(8 * k, 0xffffff, 1).strokeCircle(c, c, 134 * k);
      gr.lineStyle(34 * k, 0xffffff, 1).beginPath().moveTo(c - 62 * k, c + 4 * k).lineTo(c - 18 * k, c + 52 * k).lineTo(c + 66 * k, c - 50 * k).strokePath();
    });
    const t = bigText(this, 0, 222, 'Waiting…', 48, '#ffffff', { font: FONT_HEAD, stroke: 8 });
    return this.add.container(0, 0, [g, t]).setDepth(D.panel).setVisible(false);
  }

  private buildRideCard(color: string) {
    const { w, h, barW, barH } = RIDE;
    const g = rrectImage(this, { r: 34, fill: HUD.colors.navy, fillA: 0.92, stroke: hexNum(color), strokeW: 8 }, 0, 0, w, h);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    const head = this.ctx.settings.map === 'underground' ? TEX.rockMonster.head : TEX.dinoHead;
    if (this.textures.exists(head)) {
      const icon = this.add.image(-w / 2 + 72, 0, head);
      icon.setScale(119 / icon.width);
      parts.push(icon);
    }
    const num = bigText(this, -w / 2 + 182, 2, '20', 76, '#ffd43b', { font: FONT_HEAD, stroke: 10 });
    const bx = w / 2 - barW - 30;
    const back = this.add.rectangle(bx + barW / 2, 0, barW, barH, 0x2b3557).setStrokeStyle(5, 0xffffff);
    const fill = this.add.rectangle(bx, 0, barW, barH, 0x7cfc5a).setOrigin(0, 0.5);
    parts.push(num, back, fill);
    const box = this.add.container(0, 0, parts).setDepth(D.panel).setVisible(false).setName('dino-ride-countdown');
    return { box, num, fill, shown: -1, low: null as boolean | null };
  }

  /** Ride countdown for the player riding the dino (numbers and a bar only). */
  private updateRideCards() {
    const st = this.ctx.dino;
    for (let p = 0; p < this.rideCards.length; p++) {
      const card = this.rideCards[p];
      const left = st.rider === p ? st.rideLeftSec ?? 0 : 0;
      const on = st.active && left > 0 && !this.panels[p];
      card.box.setVisible(on);
      if (!on) { card.shown = -1; card.low = null; continue; }
      const v = this.curViews[p];
      const secs = rideSecondsShown(left);
      if (secs !== card.shown) { card.shown = secs; card.num.setText(String(secs)); }
      const frac = Math.max(0, Math.min(1, left / Math.max(0.001, st.rideTotalSec ?? left)));
      const low = secs <= 5;
      card.fill.width = Math.max(1, RIDE.barW * frac);
      if (low !== card.low) { // setColor re-renders the text texture: only on change
        card.low = low;
        card.fill.setFillStyle(low ? 0xffa53b : 0x7cfc5a);
        card.num.setColor(low ? '#ffa53b' : '#ffd43b');
      }
      const pulse = low ? 1 + 0.05 * Math.sin(this.clock * 10) : 1;
      card.box.setPosition(v.x + v.w / 2, v.y + v.h - RIDE.fromBottom).setScale(Math.min(1, v.w / (RIDE.w + 40)) * pulse);
    }
  }

  private updateBreakVisuals(realDt: number) {
    const breaking = this.ctx.questionBreak && this.pauseStyle;
    this.dimA += ((breaking ? CHALLENGE.breakDimAlpha : 0) - this.dimA) * smoothFactor(realDt, 12);
    const dimOn = this.dimA > 0.01;
    const dimRects: Rect[] = !dimOn ? [] : this.shared() ? [this.mapRect(0)] : this.curViews.slice(0, this.nPlayers);
    this.dim.forEach((d, i) => {
      const r = dimRects[i];
      d.setVisible(!!r);
      if (r) d.setPosition(r.x, r.y).setSize(r.w, r.h).setAlpha(this.dimA);
    });
    for (let p = 0; p < this.waitCards.length; p++) {
      const card = this.waitCards[p];
      const show = breaking && this.waiting[p] && !this.panels[p];
      card.setVisible(show);
      if (!show) continue;
      const v = this.curViews[p];
      const pulse = 1 + 0.05 * Math.sin(this.clock * 6);
      card.setPosition(v.x + v.w / 2, v.y + v.h / 2).setScale(pulse);
    }
    if (!breaking) this.waiting = [false, false];
  }

  // ───────────────────────── layout ─────────────────────────
  private applyLayout(layout: CameraLayout, snap: boolean) {
    this.layout = layout;
    const views = layout.playerViews.slice(0, this.nPlayers);
    if (snap || this.curViews.length !== views.length) this.curViews = views.map(copy);
    // Keep curViews at the right length without resetting a running animation.
    while (this.curViews.length < this.nPlayers) this.curViews.push(copy(views[views.length - 1] ?? this.curViews[0]));
  }

  private targetView(p: number): Rect {
    const v = this.layout.playerViews;
    return v[p] ?? v[v.length - 1];
  }

  private shared() { return this.layout.mode !== 'split'; }

  /** Rect that world views are mapped into: the player's view in split, the whole screen otherwise. */
  private mapRect(p: number): Rect {
    if (!this.shared()) return this.curViews[p];
    const vs = this.curViews;
    const x0 = Math.min(...vs.map((v) => v.x)), y0 = Math.min(...vs.map((v) => v.y));
    const x1 = Math.max(...vs.map((v) => v.x + v.w)), y1 = Math.max(...vs.map((v) => v.y + v.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private toScreen(p: number, wx: number, wy: number): Vec2 {
    return this.ctx.camera.worldToScreen(p as PlayerId, wx, wy);
  }

  // ───────────────────────── banners ─────────────────────────
  private kindBanner(kind: Kind, text: string, color?: string, dur?: number) {
    const now = this.clock;
    const last = this.lastKind[kind];
    if (last !== undefined && now - last < 3) return;
    this.lastKind[kind] = now;
    if (kind === 'dino') this.banners.alert(GAME_WIDTH / 2, CENTER_Y, text, dur ?? 2.8);
    else this.banners.center(GAME_WIDTH / 2, CENTER_Y, text, color ?? '#ffd43b', dur ?? 1.6);
  }

  /** Small "Waiting…" pill near the top of the player's view while the teammate catches up. */
  private waitBanner(p: number) {
    const r = this.curViews[p];
    this.banners.lines(`wait${p}`, r.x + r.w / 2, r.y + HUD.hint.y + 30, null, [
      { text: 'Waiting…', size: HUD.hint.textSize, color: PLAYER_COLORS[p] === '#2ecc40' ? '#7dff8a' : '#ff8a80' },
    ], HUD.hint.waitSec);
  }

  private popup(p: number, text: string, world?: Vec2, color?: string) {
    if (p >= this.nPlayers) return;
    const car = this.ctx.players[p];
    const w = world ?? (car ? { x: car.x, y: car.y } : undefined);
    const v = this.curViews[p];
    const s = w ? this.toScreen(p, w.x, w.y) : { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const x = Math.min(v.x + v.w - 120, Math.max(v.x + 120, s.x));
    const y = Math.min(v.y + v.h - 120, Math.max(v.y + 300, s.y - 70));
    this.banners.popup(x, y, text, color ?? '#ffffff');
  }

  private flyPlusOne(sx: number, sy: number) {
    const t = bigText(this, sx, sy, '+1', 96, '#7dff8a', { font: FONT_HEAD, stroke: 12 }).setDepth(D.fly);
    const tg = this.scoreboard.target();
    const arc = -140;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 800, delay: 120,
      onUpdate: (tw) => {
        const k = easeInOut(tw.getValue() ?? 0);
        t.setPosition(sx + (tg.x - sx) * k, sy + (tg.y - sy) * k + arc * Math.sin(k * Math.PI));
        t.setScale(1.2 - 0.6 * k);
      },
      onComplete: () => t.destroy(),
    });
  }

  // ───────────────────────── pause actions ─────────────────────────
  private restartRace() {
    const race = this.scene.get(SCENE.race);
    this.overlay.hide();
    if (!race || !race.scene.isActive()) { this.ctx.bus.emit('game:resume', {}); return; }
    // The race rebuilds the HUD when it restarts; make sure one HUD exists afterwards either way.
    race.events.once(Phaser.Scenes.Events.CREATE, () => {
      race.time.delayedCall(60, () => {
        if (race.scene.isActive() && !race.scene.isActive(SCENE.hud)) race.scene.launch(SCENE.hud);
      });
    });
    this.scene.stop(SCENE.hud);
    race.scene.restart();
  }

  private quitToTitle() {
    this.overlay.hide();
    this.scene.stop(SCENE.race);
    this.scene.start(SCENE.title);
  }

  // ───────────────────────── frame ─────────────────────────
  update(_time: number, deltaMs: number) {
    if (!this.ctx) return;
    const realDt = Math.min(deltaMs / 1000, 0.1);
    const paused = this.overlay.visible;
    const dt = paused ? 0 : realDt;
    this.clock += dt;

    if (paused) {
      if (this.skipFrames > 0) this.skipFrames--;
      else this.overlay.update(services.input.any());
    }

    // Smooth re-layout.
    const f = smoothFactor(realDt, 9);
    for (let p = 0; p < this.nPlayers; p++) {
      const c = this.curViews[p], t = this.targetView(p);
      c.x += (t.x - c.x) * f; c.y += (t.y - c.y) * f; c.w += (t.w - c.w) * f; c.h += (t.h - c.h) * f;
      if (Math.abs(t.x - c.x) + Math.abs(t.w - c.w) + Math.abs(t.y - c.y) + Math.abs(t.h - c.h) < 0.5) Object.assign(c, t);
    }
    this.drawDivider(realDt);

    this.updateBreakVisuals(realDt);
    this.updateRideCards();
    this.scoreboard.update(dt);
    for (let p = 0; p < this.nPlayers; p++) {
      const panel = this.panels[p];
      if (panel) {
        panel.setView(this.curViews[p]);
        panel.update(dt);
        if (panel.finished) { panel.destroy(); this.panels[p] = null; }
      }
      this.bars[p].setView(this.curViews[p]);
      this.bars[p].update(dt);
    }
    this.banners.update(dt);
  }

  private drawDivider(dt: number) {
    const want = this.layout.mode === 'split' && this.nPlayers > 1 ? 1 : 0;
    this.dividerAlpha += (want - this.dividerAlpha) * smoothFactor(dt, 10);
    const vis = this.dividerAlpha >= 0.02;
    if (!vis) { if (this.dividerKey !== 'off') { this.dividerKey = 'off'; this.divider.forEach((d) => d.setVisible(false)); } return; }
    const x = this.curViews[1]?.x ?? GAME_WIDTH / 2;
    const a = Math.round(this.dividerAlpha * 1000) / 1000;
    const key = `${x}|${a}`;
    if (key === this.dividerKey) return; // only touch the rectangles when the layout/fade changed
    this.dividerKey = key;
    const [dark, l, r] = this.divider;
    dark.setPosition(x - 8, 0).setAlpha(a).setVisible(true);
    l.setPosition(x - 11, 0).setAlpha(a).setVisible(true);
    r.setPosition(x + 8, 0).setAlpha(a).setVisible(true);
  }
}
