import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { services } from '../core/services';
import type { InputDevice } from '../core/types';
import { goToHub } from '../../shared/hub';
import { isMobile } from '../../shared/device';
import { ConfirmPrompt } from '../ui/menu/FaceButtonBadge';
import { bigText, FONT_HEAD } from '../ui/menu/style';
import { buildLabel } from '../buildInfo';
import { SCENE } from './keys';

const LOGO_COLORS = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ff922b'];
const ROAD_TOP = 905;

interface Driver { obj: Phaser.GameObjects.Container; speed: number; dir: 1 | -1 }

export class TitleScene extends Phaser.Scene {
  private letters: Phaser.GameObjects.Text[] = [];
  private letterBaseY = 0;
  private drivers: Driver[] = [];
  private dashes!: Phaser.GameObjects.Graphics;
  private dashOffset = 0;
  private continueHint?: ConfirmPrompt;
  private audioStarted = false;
  private leaving = false;

  constructor() { super(SCENE.title); }

  create() {
    this.letters = []; this.drivers = []; this.leaving = false;
    this.audioStarted = services.audio.unlocked;
    // Always request title music: before the first gesture it is queued and starts the moment audio unlocks
    // (on phones that tap usually also leaves this screen, so asking later would leave the menus silent).
    services.audio.music('title');
    services.input.reset();
    this.buildBackground();
    this.buildLogo();

    // Any controller (or keyboard confirm key) starts: that device claims Player 1's panel on the Join screen.
    const mobile = isMobile();
    if (mobile) {
      // Phone/tablet: single player; a tap anywhere (or A on the touch buttons / a pad) starts as player 1.
      const tap = bigText(this, GAME_WIDTH / 2, 640, 'Tap to play!', 120, '#ffffff', { font: FONT_HEAD, stroke: 14 });
      tap.setName('tap-to-play');
      this.tweens.add({ targets: tap, scale: { from: 1, to: 1.08 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else {
      this.continueHint = new ConfirmPrompt(this, GAME_WIDTH / 2, 600, 'to play!', 96);
      this.tweens.add({ targets: this.continueHint, scale: { from: 1, to: 1.08 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      bigText(this, GAME_WIDTH / 2, 710, 'Keyboard: Space or Enter', 48, '#ffffff');
      bigText(this, GAME_WIDTH / 2, 780, '1 to 4 players', 56, '#ffd43b', { font: FONT_HEAD, stroke: 10 });
    }

    // Nobody has joined on the title screen, so back (B / Backspace) returns to the game launcher.
    this.add.circle(64, 56, 31, 0xe03131).setStrokeStyle(4, 0xffffff);
    bigText(this, 64, 56, 'B', 44, '#ffffff', { stroke: 5, shadow: false });
    bigText(this, 112, 56, 'Back to games', 44, '#ffffff', { origin: [0, 0.5], stroke: 8 });
    if (mobile) {
      // Tappable on a phone (a tap anywhere else starts the game).
      const back = this.add.zone(0, 0, 520, 130).setOrigin(0, 0).setInteractive();
      back.on('pointerdown', () => { if (this.leaving) return; this.leaving = true; goToHub(); });
    }

    bigText(this, GAME_WIDTH - 24, 20, buildLabel(), 32, '#ffffff', { origin: [1, 0], bold: false, shadow: false, stroke: 6 }).setAlpha(0.85);

    this.input.keyboard?.on('keydown', () => this.startAudio());
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.startAudio();
      if (mobile && !this.leaving && over.length === 0) this.goJoin({ type: 'touch' });
    });
  }

  private startAudio() {
    if (this.audioStarted) return;
    this.audioStarted = true;
    services.audio.unlock().then(() => {
      this.audioStarted = services.audio.unlocked;
      if (this.audioStarted && this.scene.isActive()) services.audio.music('title');
    }).catch(() => { this.audioStarted = false; });
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
    const family = input.controllerFamily?.() ?? 'other';
    this.continueHint?.setFamily(family);
    if (this.leaving) return;
    const any = input.any();
    if (any.back) { this.leaving = true; goToHub(); return; }
    if (any.confirm || any.back || any.pause || any.navX || any.navY) this.startAudio();
    const d = input.pollJoin([]);
    if (d) this.goJoin(d);
  }

  private goJoin(device: InputDevice) {
    this.leaving = true;
    this.startAudio();
    services.audio.sfx('join');
    this.scene.start(SCENE.setup, { device });
  }
}
