import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { services } from '../core/services';
import { loadSettings, saveSettings } from '../core/settings';
import type { CarKind, InputDevice, PlayerSettings, Settings } from '../core/types';
import { JoinCard } from '../ui/menu/JoinCard';
import { bigText, FONT_HEAD } from '../ui/menu/style';
import { REG, SCENE } from './keys';

const LOGO_COLORS = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ff922b'];
const ROAD_TOP = 905;

interface Driver { obj: Phaser.GameObjects.Container; speed: number; dir: 1 | -1 }

export class TitleScene extends Phaser.Scene {
  private joined: InputDevice[] = [];
  private cards: JoinCard[] = [];
  private letters: Phaser.GameObjects.Text[] = [];
  private letterBaseY = 0;
  private drivers: Driver[] = [];
  private dashes!: Phaser.GameObjects.Graphics;
  private dashOffset = 0;
  private continueHint!: Phaser.GameObjects.Container;
  private base!: Settings;
  private audioStarted = false;
  private leaving = false;

  constructor() { super(SCENE.title); }

  create() {
    this.joined = []; this.cards = []; this.letters = []; this.drivers = []; this.leaving = false;
    this.base = loadSettings();
    services.input.reset();
    this.buildBackground();
    this.buildLogo();

    const carFor = (i: number): CarKind => (i === 0 ? 'dino' : 'kart');
    this.cards = [0, 1].map((i) => new JoinCard(this, 520 + i * 880, 600, i as 0 | 1, PLAYER_COLORS[i], carFor(i)));

    const press = bigText(this, 0, 0, 'Press  A  again to continue', 56, '#ffffff', { font: FONT_HEAD });
    this.continueHint = this.add.container(GAME_WIDTH / 2, 868, [press]).setVisible(false);
    this.tweens.add({ targets: this.continueHint, scale: { from: 1, to: 1.08 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.input.keyboard?.on('keydown', () => this.startAudio());
    this.input.on('pointerdown', () => this.startAudio());
  }

  private startAudio() {
    if (this.audioStarted) return;
    this.audioStarted = true;
    services.audio.unlock().then(() => services.audio.music('title')).catch(() => { /* silent is fine */ });
  }

  // ───────────────────────── visuals ─────────────────────────
  private buildBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2b8cff, 0x2b8cff, 0xaee3ff, 0xaee3ff, 1);
    g.fillRect(0, 0, GAME_WIDTH, ROAD_TOP);
    // sun
    g.fillStyle(0xfff3a0, 0.35).fillCircle(1650, 170, 150);
    g.fillStyle(0xffe45c, 1).fillCircle(1650, 170, 100);
    // hills + grass
    g.fillStyle(0x4cc36a, 1).fillEllipse(300, ROAD_TOP + 20, 1200, 260);
    g.fillStyle(0x38b05a, 1).fillEllipse(1400, ROAD_TOP + 30, 1500, 220);
    g.fillStyle(0x2f9e4e, 1).fillRect(0, ROAD_TOP - 20, GAME_WIDTH, 40);
    // road
    g.fillStyle(0x3a3f4b, 1).fillRect(0, ROAD_TOP, GAME_WIDTH, GAME_HEIGHT - ROAD_TOP);
    g.fillStyle(0xffd43b, 1).fillRect(0, ROAD_TOP, GAME_WIDTH, 8);
    g.fillStyle(0xffffff, 1).fillRect(0, GAME_HEIGHT - 8, GAME_WIDTH, 8);
    // clouds
    for (let i = 0; i < 5; i++) {
      const c = this.add.container(Math.random() * GAME_WIDTH, 60 + Math.random() * 300);
      const s = 0.8 + Math.random() * 0.8;
      c.add([this.add.ellipse(0, 0, 220, 80, 0xffffff, 0.9), this.add.ellipse(-60, -30, 120, 90, 0xffffff, 0.9), this.add.ellipse(50, -36, 140, 100, 0xffffff, 0.9)]);
      c.setScale(s);
      this.tweens.add({ targets: c, x: c.x + GAME_WIDTH + 400, duration: 60_000 / s, repeat: -1, onRepeat: () => { c.x = -300; } });
    }
    // lane dashes (scrolling, redrawn each frame)
    this.dashes = this.add.graphics();

    // traffic
    const lanes = [{ y: 965, dir: 1 as const }, { y: 1035, dir: -1 as const }];
    const kinds = ['dino', 'kart', 'tr0', 'tr1', 'tr2', 'tr3'];
    kinds.forEach((k, i) => {
      const lane = lanes[i % 2];
      const key = k === 'dino' ? TEX.carDino : k === 'kart' ? TEX.carKart : TEX.traffic[Number(k[2])];
      const cont = this.add.container(0, lane.y);
      if (this.textures.exists(key)) cont.add(this.add.image(0, 0, key));
      else {
        const col = k === 'dino' ? 0x2ecc40 : k === 'kart' ? 0xff3b30 : [0x4dabf7, 0xffd43b, 0xb197fc, 0xff922b][Number(k[2])];
        cont.add(this.add.rectangle(0, 0, 64, 36, col).setStrokeStyle(3, 0x000000));
        cont.add(this.add.rectangle(8, 0, 22, 24, 0xffffff, 0.55));
      }
      cont.setScale(lane.dir * 1.9, 1.9);
      cont.x = Math.random() * GAME_WIDTH;
      this.drivers.push({ obj: cont, dir: lane.dir, speed: 150 + (k === 'kart' ? 120 : 0) + Math.random() * 100 });
    });
  }

  private buildLogo() {
    const word = 'BRAINRACER';
    const size = 170;
    let total = 0;
    const adv: number[] = [];
    for (let i = 0; i < word.length; i++) {
      const t = bigText(this, 0, 0, word[i], size, LOGO_COLORS[i % LOGO_COLORS.length], { font: FONT_HEAD, stroke: 22, origin: [0, 0.5] });
      adv.push(t.width - 8);
      this.letters.push(t);
      total += t.width - 8;
    }
    let x = (GAME_WIDTH - total) / 2;
    this.letterBaseY = 175;
    this.letters.forEach((t, i) => { t.setX(x); t.setY(this.letterBaseY); x += adv[i]; });
    const sub = bigText(this, GAME_WIDTH / 2, 320, 'Race!  Think!  Win together!', 60, '#ffffff', { font: FONT_HEAD, stroke: 10 });
    this.tweens.add({ targets: sub, scale: { from: 1, to: 1.04 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  // ───────────────────────── logic ─────────────────────────
  update(time: number, delta: number) {
    const dt = delta / 1000;
    this.letters.forEach((t, i) => {
      t.y = this.letterBaseY + Math.sin(time / 330 + i * 0.6) * 16;
      t.angle = Math.sin(time / 410 + i) * 3;
    });
    for (const d of this.drivers) {
      d.obj.x += d.dir * d.speed * dt;
      if (d.dir > 0 && d.obj.x > GAME_WIDTH + 150) d.obj.x = -150;
      if (d.dir < 0 && d.obj.x < -150) d.obj.x = GAME_WIDTH + 150;
    }
    this.dashOffset = (this.dashOffset + 200 * dt) % 160;
    const gr = this.dashes;
    gr.clear().fillStyle(0xffffff, 0.8);
    for (let x = -160 + this.dashOffset; x < GAME_WIDTH; x += 160) gr.fillRect(x, 998, 80, 8);

    const input = services.input;
    input.poll();
    if (this.leaving) return;
    const any = input.any();
    if (any.confirm || any.back || any.pause || any.navX || any.navY) this.startAudio();

    // leave (only the last-joined player whose back was pressed)
    for (let i = this.joined.length - 1; i >= 0; i--) {
      if (input.get(i as 0 | 1).back) {
        this.joined.splice(i, 1);
        this.syncAssign();
        services.audio.sfx('menuMove');
        this.refreshCards();
        return;
      }
    }
    // continue
    for (let i = 0; i < this.joined.length; i++) {
      const inp = input.get(i as 0 | 1);
      if (inp.confirm || inp.pause) { this.goSetup(); return; }
    }
    // join
    if (this.joined.length < 2) {
      const d = input.pollJoin(this.joined);
      if (d) {
        this.joined.push(d);
        this.syncAssign();
        this.startAudio();
        services.audio.sfx('join');
        this.refreshCards();
      }
    }
  }

  private syncAssign() {
    services.input.reset();
    this.joined.forEach((d, i) => services.input.assign(i as 0 | 1, d));
  }

  private refreshCards() {
    this.cards.forEach((c, i) => c.setJoined(this.joined[i] ?? null));
    this.continueHint.setVisible(this.joined.length > 0);
  }

  private goSetup() {
    this.leaving = true;
    services.audio.sfx('menuSelect');
    const saved = this.base.players;
    const players: PlayerSettings[] = this.joined.map((device, i) => {
      const prev = saved[i];
      const p0car: CarKind = saved[0]?.car ?? 'dino';
      return {
        device,
        difficulty: prev?.difficulty ?? saved[0]?.difficulty ?? 'normal',
        car: prev?.car ?? (i === 0 ? 'dino' : p0car === 'dino' ? 'kart' : 'dino'),
      };
    });
    const settings: Settings = { ...this.base, players };
    saveSettings(settings);
    this.registry.set(REG.settings, settings);
    this.scene.start(SCENE.setup);
  }
}
