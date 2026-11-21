import Phaser from 'phaser';
import { collectibleName, UNLOCK_GUIDE_IDS, type Collectible, type UnlockGuide, type UnlockVehicle } from '../config/collectibles';
import { carArt, guideArt } from '../art/loadoutKeys';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, GOALS, PLAYER_COLORS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { COMPLETION_OBJECTIVES, MAP_LABEL } from '../core/progression';
import { loadAllProgress, racerProgressOf, teamNextMap, type RacerReward } from '../core/racerProgress';
import { playerRacer, racerName } from '../core/racerProfiles';
import { Rng, randomSeed } from '../core/rng';
import { services } from '../core/services';
import type { PlayerStats, RaceMap, RoundResults, Settings } from '../core/types';
import { starRating } from '../systems/roundStats';
import { MenuButton } from '../ui/menu/MenuButton';
import { bigText, carPreview, FONT_BODY, FONT_HEAD, hexNum, MENU } from '../ui/menu/style';
import { starShape } from '../ui/results/starShape';
import { messageFor } from '../ui/results/messages';
import { worldKeyArt } from '../ui/results/worldKeyArt';
import { REG, SCENE } from './keys';

const CX = GAME_WIDTH / 2;
const CARD_W = 600, CARD_H = 330, CARD_Y = 600;
const INPUT_GRACE_MS = 1200;

/** `rewards`: one entry per player slot (RaceScene → awardRacers). */
interface ResultsData { settings?: Settings; rewards?: RacerReward[] }

/** Celebratory end-of-round screen with the next map preselected. */
export class ResultsScene extends Phaser.Scene {
  private buttons: MenuButton[] = [];
  private sel = 0;
  private leaving = false;
  private readyAt = 0;
  private settings!: Settings;
  private actions?: Phaser.GameObjects.Container;

  constructor() { super(SCENE.results); }

  create(data: ResultsData = {}) {
    this.buttons = []; this.sel = 0; this.leaving = false;
    this.actions = undefined;
    this.readyAt = Infinity;
    const results: RoundResults = this.registry.get(REG.results) ?? { teamPoints: 0, players: [], goalsCompleted: 0, seed: 0 };
    this.settings = data.settings ?? this.registry.get(REG.settings) ?? DEFAULT_SETTINGS;
    const summary = () => this.showSummary(results);
    const rewards = data.rewards ?? [];
    const world = rewards.find(r => r.world)?.world;
    const earners = rewards.filter(r => r.reward);
    const world0 = MAP_LABEL[this.settings.map];
    const nothing = !world && !earners.length && results.goalsCompleted >= COMPLETION_OBJECTIVES && !this.settings.developerMode && rewards.length > 0;
    // Racers reveal one after another; with several reels each runs faster so the screen stays about as long as before.
    const reveal = (i: number) => {
      const r = earners[i];
      if (!r) { if (nothing) this.showFoundAll(world0, summary); else summary(); return; }
      this.showReward(r.reward!, r.rewardPool ?? [r.reward!], results.seed + i, () => reveal(i + 1), racerName(this.latestSettings(), r.racer), earners.length > 1);
    };
    if (world) this.showWorld(world, () => reveal(0));
    else reveal(0);
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshActions, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshActions, this);
    });
  }

  private showWorld(map: RaceMap, next: () => void): void {
    const layer = this.add.container().setName('world-unlock-reveal');
    worldKeyArt(this, layer, map);
    layer.add(bigText(this, CX, 154, 'WORLD UNLOCKED!', 90, MENU.yellow, { font: FONT_HEAD, stroke: 15 }));
    const title = bigText(this, CX, 928, MAP_LABEL[map].toUpperCase(), 128, '#ffffff', { font: FONT_HEAD, stroke: 20 });
    layer.add(title);
    this.tweens.add({ targets: title, scale: { from: 0.72, to: 1 }, duration: 700, ease: 'Back.Out' });
    this.cameras.main.flash(400, 255, 230, 164);
    services.audio.sfx('goal');
    this.time.delayedCall(3200, () => { layer.destroy(); next(); });
  }

  private showFoundAll(world: string, next: () => void): void {
    const layer = this.add.container().setName('found-everything');
    layer.add(this.drawBackground());
    layer.add(bigText(this, CX, 440, 'YOU FOUND EVERYTHING', 84, MENU.yellow, { font: FONT_HEAD }));
    layer.add(bigText(this, CX, 570, `in ${world}!`, 84, '#ffffff', { font: FONT_HEAD, stroke: 12 }));
    services.audio.sfx('goal');
    this.time.delayedCall(2200, () => { layer.destroy(); next(); });
  }

  private showReward(reward: Collectible, pool: Collectible[], seed: number, next: () => void, racer = '', quick = false): void {
    const layer = this.add.container().setName('collectible-reveal');
    layer.add(this.drawBackground());
    layer.add(bigText(this, CX, 170, racer ? `${racer.toUpperCase()}'S REWARD REEL` : 'REWARD REEL', 92, MENU.yellow, { font: FONT_HEAD }));
    const landing = this.add.rectangle(CX, 512, 350, 355, 0x32498c, 0.8).setStrokeStyle(8, 0xffd43b);
    layer.add(landing);
    const picks = new Rng(seed ^ 0x36d19c).shuffle(pool.filter(id => id !== reward));
    const length = Math.min(12, picks.length * 3);
    const items = [...Array.from({ length }, (_, i) => picks[i % picks.length]), reward];
    const cards = Array.from({ length: 7 }, () => {
      const frame = this.add.rectangle(0, 0, 290, 300, 0x27376b, 1).setStrokeStyle(4, 0x7896da);
      const icon = this.add.image(0, -34, TEX.buddyStar);
      const label = bigText(this, 0, 99, '', 39, '#ffffff', { font: FONT_HEAD, stroke: 5 });
      const view = this.add.container(0, 512, [frame, icon, label]);
      layer.add(view);
      return { view, icon, label, id: undefined as Collectible | undefined };
    });
    const cursor = { position: 0 };
    let last = -1;
    const draw = () => {
      const center = Math.round(cursor.position);
      cards.forEach((card, i) => {
        const index = center + i - 3;
        const id = items[index];
        card.view.setVisible(!!id);
        if (!id) return;
        if (card.id !== id) {
          card.id = id;
          const isGuide = UNLOCK_GUIDE_IDS.includes(id as UnlockGuide);
          const texture = isGuide ? guideArt(id as UnlockGuide) : carArt(id as UnlockVehicle);
          card.icon.setTexture(texture);
          card.icon.setScale(Math.min(214 / card.icon.width, 178 / card.icon.height));
          card.label.setText(collectibleName(id));
          card.label.setScale(Math.min(1, 266 / card.label.width));
        }
        const offset = index - cursor.position;
        const distance = Math.abs(offset);
        card.view.setX(CX + offset * 312).setScale(Math.max(0.8, 1 - distance * 0.074))
          .setAlpha(Phaser.Math.Clamp(1.18 - distance * 0.24, 0, 1));
      });
      if (center !== last) {
        last = center;
        services.audio.sfx('menuMove', { volume: 0.55 });
      }
    };
    draw();
    this.tweens.add({
      targets: cursor, position: length, duration: length ? (quick ? 3600 : 5700) : 550, ease: 'Sine.Out',
      onUpdate: draw,
      onComplete: () => {
        draw();
        landing.setStrokeStyle(12, 0xffdf6a);
        layer.add(bigText(this, CX, 855, `${racer ? racer.toUpperCase() + ' GOT' : 'YOU EARNED'} ${collectibleName(reward).toUpperCase()}!`, 62, MENU.yellow, { font: FONT_HEAD }));
        services.audio.sfx('goal');
        this.time.delayedCall(quick ? 1300 : 1800, () => {
          // The reveal and summary share the scene, so remove all reveal objects before laying out results.
          layer.destroy();
          next();
        });
      },
    });
  }

  private showSummary(results: RoundResults): void {
    this.readyAt = this.time.now + INPUT_GRACE_MS;
    const roundSec = this.settings.roundLengthSec;
    const stars = starRating(results.teamPoints, roundSec, GOALS.starThresholds);

    this.drawBackground();
    this.confettiRain();

    bigText(this, CX, 80, 'ROUND COMPLETE!', 72, '#ffd43b', { font: FONT_HEAD });
    bigText(this, CX, 165, 'TEAM SCORE', 48, MENU.dim);
    const scoreText = bigText(this, CX, 275, "0", 190, '#ffffff', { font: FONT_HEAD, stroke: 18 });

    const starObjs = [0, 1, 2].map((i) => {
      const s = starShape(this, CX + (i - 1) * 130, 435, i < stars);
      return s.setScale(0);
    });
    const msg = bigText(this, CX, 520, messageFor(stars, results.players.length), 56, '#ffffff', { font: FONT_HEAD }).setAlpha(0);

    this.buildCards(results);
    this.actions = this.add.container().setName('results-actions');
    this.refreshActions();
    if (!this.settings.developerMode && results.goalsCompleted < COMPLETION_OBJECTIVES) {
      msg.setText(`${results.goalsCompleted} / ${COMPLETION_OBJECTIVES} objectives for world completion`);
    }

    // Count up with ticks, then stars pop in.
    const counter = { v: 0 };
    let last = 0;
    this.tweens.add({
      targets: counter, v: results.teamPoints, duration: Math.min(3000, 600 + results.teamPoints * 60), ease: 'Sine.Out',
      onUpdate: () => {
        const n = Math.round(counter.v);
        if (n !== last) {
          last = n;
          scoreText.setText(String(n));
          services.audio.sfx('menuMove', { rate: 1 + Math.min(1, n / Math.max(1, results.teamPoints)) * 0.6, volume: 0.5 });
          this.tweens.add({ targets: scoreText, scale: { from: 1.08, to: 1 }, duration: 90 });
        }
      },
      onComplete: () => {
        scoreText.setText(String(results.teamPoints));
        starObjs.forEach((s, i) => this.tweens.add({
          targets: s, scale: 1, duration: 450, delay: i * 260, ease: 'Back.Out',
          onStart: () => services.audio.sfx(i < stars ? 'goalArrive' : 'pop'),
        }));
        this.tweens.add({ targets: msg, alpha: 1, duration: 500, delay: 800 });
        if (stars >= 2) this.time.delayedCall(700, () => services.audio.sfx('goal'));
      },
    });
  }

  update() {
    services.input.poll();
    if (this.leaving || !this.buttons.length || this.time.now < this.readyAt) return;
    const inp = services.input.any();
    const dir = inp.navX || inp.navY;
    if (dir) {
      this.sel = Phaser.Math.Wrap(this.sel + dir, 0, this.buttons.length);
      this.refreshButtons();
      services.audio.sfx('menuMove');
    }
    if (inp.confirm) this.choose(this.sel);
  }

  // ───────────── building blocks ─────────────
  private drawBackground(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1b2a5e, 0x1b2a5e, 0x0b1230, 0x0b1230, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 14; i++) g.fillCircle(CX, 300, 120 + i * 90);
    return g;
  }

  private confettiRain() {
    const tints = [0xff4d4d, 0xffd43b, 0x4dabf7, 0x69db7c, 0xff922b, 0xe599f7];
    if (!this.textures.exists(TEX.fxConfetti)) return;
    this.add.particles(0, -30, TEX.fxConfetti, {
      x: { min: 0, max: GAME_WIDTH }, speedY: { min: 120, max: 320 }, speedX: { min: -60, max: 60 },
      lifespan: 6500, frequency: 70, scale: { min: 1, max: 2 }, rotate: { min: 0, max: 360 }, tint: tints,
    }).setDepth(0);
  }

  private buildCards(results: RoundResults) {
    const n = Math.max(1, results.players.length);
    const gap = 70;
    const total = n * CARD_W + (n - 1) * gap;
    results.players.forEach((p, i) => {
      const x = CX - total / 2 + CARD_W / 2 + i * (CARD_W + gap);
      this.playerCard(x, CARD_Y, i, p);
    });
  }

  private playerCard(x: number, y: number, i: number, p: PlayerStats) {
    const color = hexNum(PLAYER_COLORS[i] ?? PLAYER_COLORS[0]);
    const c = this.add.container(x, y + 135);
    const g = this.add.graphics();
    g.fillStyle(MENU.panel, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 32);
    g.lineStyle(8, color, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 32);
    g.fillStyle(color, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 78, { tl: 32, tr: 32, bl: 0, br: 0 });
    c.add(g);
    const kind = this.settings.players[i]?.car ?? (i === 0 ? 'dino' : 'kart');
    c.add(carPreview(this, kind, -CARD_W / 2 + 80, -CARD_H / 2 + 39, 1.3));
    c.add(bigText(this, -CARD_W / 2 + 150, -CARD_H / 2 + 39, `PLAYER ${i + 1}`, 44, '#ffffff', { origin: [0, 0.5], stroke: 6 }));
    c.add(bigText(this, CARD_W / 2 - 30, -CARD_H / 2 + 39, `${p.points} pts`, 48, '#ffffff', { origin: [1, 0.5], stroke: 6, font: FONT_HEAD }));
    const rows: [string, string, string][] = [
      ['✓', `${p.correct} correct`, '#7CFC00'],
      ['✗', `${p.wrong} wrong`, '#ffb4a8'],
      ['…', `${p.timeouts} too slow`, '#ffd43b'],
      ['★', `${p.goals} goals reached`, '#74c0fc'],
    ];
    rows.forEach(([icon, label, col], k) => {
      const ry = -CARD_H / 2 + 125 + k * 52;
      c.add(bigText(this, -CARD_W / 2 + 60, ry, icon, 44, col, { stroke: 4, shadow: false }));
      c.add(this.add.text(-CARD_W / 2 + 110, ry, label, { fontFamily: FONT_BODY, fontStyle: 'bold', fontSize: '42px', color: '#ffffff' }).setOrigin(0, 0.5));
    });
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 500, delay: 300 + i * 200, ease: 'Back.Out' });
  }

  private latestSettings(): Settings {
    return (this.registry.get(REG.settings) as Settings | undefined) ?? this.settings;
  }

  private followingMap(): RaceMap {
    const latest = this.latestSettings();
    const all = loadAllProgress();
    const team = this.settings.players.map((p, i) => racerProgressOf(all, playerRacer(p, i)));
    return teamNextMap(this.settings.map, team, latest.developerMode === true);
  }

  private refreshActions() {
    if (!this.actions) return;
    this.actions.removeAll(true);
    const defs = [
      { label: this.followingMap() === this.settings.map ? 'PLAY AGAIN' : 'NEXT MAP', x: CX - 500, color: 0x2ecc40 },
      { label: 'SETUP', x: CX, color: 0x4dabf7 },
      { label: 'TITLE', x: CX + 500, color: 0x4dabf7 },
    ];
    this.buttons = defs.map((d) => new MenuButton(this, d.x, 1000, 430, 100, d.label, d.color, 52));
    this.actions.add(this.buttons);
    this.refreshButtons();
  }

  private refreshButtons() {
    this.buttons.forEach((b, i) => b.setSelected(i === this.sel));
  }

  private choose(i: number) {
    if (this.leaving) return;
    this.leaving = true;
    this.buttons[i].pulse();
    services.audio.sfx('menuSelect');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (i === 0) {
        const latest = this.latestSettings();
        const seed = randomSeed();
        this.registry.set(REG.settings, { ...latest, map: this.followingMap(), seed });
        this.scene.start(SCENE.race);
      } else if (i === 1) {
        this.scene.start(SCENE.setup);
      } else {
        this.scene.start(SCENE.title);
      }
    });
  }
}
