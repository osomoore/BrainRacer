import { questionsOffAllowed } from '../config/questionsPolicy';
import Phaser from 'phaser';
import { DEFAULT_SETTINGS, DIFFICULTY, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { services } from '../core/services';
import { isRaceMap, loadSettings, RACE_MAPS, saveSettings } from '../core/settings';
import type { CarKind, Difficulty, PlayerId, PlayerSettings, RaceMap, Settings } from '../core/types';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { MenuButton } from '../ui/menu/MenuButton';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, carName, carPreview, deviceLabel, FONT_HEAD, hexNum, MENU } from '../ui/menu/style';
import type { ConfigScene } from './ConfigScene';
import { REG, SCENE } from './keys';

const DIFFS: Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy ★', easyPlus: 'Easy+ ★½', normal: 'Normal ★★', hard: 'Hard ★★★' };
const DIFF_EXAMPLE: Record<Difficulty, string> = { easy: '3 + 4', easyPlus: '8 + 7', normal: '14 + 5', hard: '38 + 47' };
const DIFF_BLURB: Record<Difficulty, string> = { easy: 'Nice and relaxed', easyPlus: 'A little bigger', normal: 'Just right', hard: 'Super speedy' };
const CARS: CarKind[] = ['dino', 'kart'];

// P1 cursor rows
const ROW_DIFF = 0, ROW_CAR = 1, ROW_QUEST = 2, ROW_MAP = 3, ROW_ADVANCED = 4, ROW_START = 5;
const MAP_LABEL: Record<RaceMap, string> = { city: 'City', industrial: 'Factory', farm: 'Farm', harbor: 'Beach', underground: 'Mine' };
const MODES: Settings['challengeMode'][] = questionsOffAllowed() ? ['words', 'math', 'mixed', 'off'] : ['words', 'math', 'mixed'];
const MODE_LABEL: Record<Settings['challengeMode'], string> = { words: 'Words', math: 'Math', mixed: 'Mix', off: 'Off' };
const P1_LAST = ROW_START;
const P2_LAST = ROW_CAR;

const COL_W = 780;
const COL_ROW_W = 740;

interface Column {
  diff: OptionRow;
  car: OptionRow;
  hint: Phaser.GameObjects.Text;
  carObj: Phaser.GameObjects.Container;
}

export class SetupScene extends Phaser.Scene {
  private cfg!: Settings;
  private cursors: number[] = [0, 0];
  private cols: Column[] = [];
  private globals: OptionRow[] = [];
  private advancedBtn!: MenuButton;
  private startBtn!: MenuButton;
  private leaving = false;

  constructor() { super(SCENE.setup); }

  create() {
    this.leaving = false;
    this.cols = []; this.globals = []; this.cursors = [0, 0];
    const reg = this.registry.get(REG.settings) as Settings | undefined;
    const saved = loadSettings();
    const base = reg && reg.players?.length ? reg : saved;
    const players: PlayerSettings[] = base.players.slice(0, 2).map((p, i) => ({
      device: p.device,
      difficulty: p.difficulty ?? saved.players[i]?.difficulty ?? 'normal',
      car: p.car ?? (i === 0 ? 'dino' : 'kart'),
    }));
    this.cfg = {
      ...base,
      players,
      map: isRaceMap(base.map) ? base.map : 'city',
      challengeMode: MODES.includes(base.challengeMode) ? base.challengeMode : 'words',
      questionStyle: base.questionStyle === 'drive' ? 'drive' : DEFAULT_SETTINGS.questionStyle,
    };
    services.input.reset();
    players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));

    this.buildBackground();
    bigText(this, GAME_WIDTH / 2, 62, 'GET READY!', 96, '#ffd43b', { font: FONT_HEAD, stroke: 14 });

    const n = players.length;
    players.forEach((_p, i) => {
      const cx = n === 1 ? GAME_WIDTH / 2 : 480 + i * 960;
      this.cols.push(this.buildColumn(i, cx));
    });
    this.buildGlobals();
    this.refreshAll();
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
    });
  }

  private buildBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a2a6c, 0x1a2a6c, 0x2b8cff, 0x2b8cff, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 14; i++) {
      const y = 40 + i * 80;
      g.fillStyle(0xffffff, i % 2 ? 0.04 : 0.07).fillRect(0, y, GAME_WIDTH, 40);
    }
  }

  private buildColumn(i: number, cx: number): Column {
    const color = hexNum(PLAYER_COLORS[i]);
    const top = 130, h = 480;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    g.lineStyle(10, color, 1).strokeRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    bigText(this, cx - 350, top + 55, `PLAYER ${i + 1}`, 52, PLAYER_COLORS[i], { font: FONT_HEAD, stroke: 10, origin: [0, 0.5] });
    const device = this.cfg.players[i].device;
    const family = services.input.controllerFamily?.(device);
    const label = family === 'nintendo' ? 'Switch Pro' : deviceLabel(device, family);
    bigText(this, cx + 350, top + 55, label, 40, '#ffffff', { origin: [1, 0.5] });
    const opts = { width: COL_ROW_W, valueX: 165, arrowSpan: 160 };
    const diff = new OptionRow(this, cx, top + 150, 'Difficulty', opts);
    const hint = bigText(this, cx, top + 200, '', 40, MENU.dim, { origin: [0.5, 0], bold: false, shadow: false, stroke: 4 });
    const car = new OptionRow(this, cx, top + 290, 'Car', opts);
    const carObj = carPreview(this, 'dino', cx, top + 405, 3.2);
    return { diff, car, hint, carObj };
  }

  private buildGlobals() {
    const cx = GAME_WIDTH / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - 560, 642, 1120, 174, 36);
    g.lineStyle(8, hexNum(PLAYER_COLORS[0]), 1).strokeRoundedRect(cx - 560, 642, 1120, 174, 36);
    const opts = { width: 1040, height: 56, fontSize: 48, valueX: 230, arrowSpan: 200 };
    ['Questions', 'Map'].forEach((l, i) => {
      this.globals.push(new OptionRow(this, cx, 690 + i * 78, l, opts));
    });
    const color = hexNum(PLAYER_COLORS[0]);
    this.advancedBtn = new MenuButton(this, cx, 886, 520, 64, 'Advanced settings', color, 44, false);
    this.startBtn = new MenuButton(this, cx, 995, 900, 86, 'START RACE!', color, 64);
    const padPlayers = this.cfg.players.filter((p) => p.device.type === 'gamepad');
    if (padPlayers.length) {
      const families = padPlayers.map((p) => services.input.controllerFamily?.(p.device) ?? 'other');
      const family = families.every((f) => f === families[0]) ? families[0] : 'other';
      this.startBtn.add(new FaceButtonBadge(this, -330, 0, 62, 'bottom', family));
    }
  }

  // ───────────────────────── view ─────────────────────────
  private hintText(d: Difficulty): string {
    if (this.cfg.challengeMode === 'off') return '';
    const extra = this.cfg.challengeMode === 'words' ? '' : `\nSums like ${DIFF_EXAMPLE[d]}`;
    if (this.cfg.questionStyle === 'pause') return `${DIFF_BLURB[d]}${extra}`;
    const secs = Number((this.cfg.challengeIntervalSec * DIFFICULTY[d].periodMultiplier).toFixed(1));
    return `${DIFF_BLURB[d]}: ${secs} s per question${extra}`;
  }

  private refreshAll() {
    const c = this.cfg;
    this.cols.forEach((col, i) => {
      const p = c.players[i];
      col.diff.setValue(DIFF_LABEL[p.difficulty]);
      col.hint.setText(this.hintText(p.difficulty));
      col.car.setValue(carName(p.car));
      col.carObj.destroy();
      const cx = col.car.x;
      col.carObj = carPreview(this, p.car, cx, col.car.y + 115, 3.2);
    });
    this.globals[0].setValue(MODE_LABEL[c.challengeMode]);
    this.globals[1].setValue(MAP_LABEL[c.map]);
    this.refreshCursors();
  }

  private refreshAdvanced() {
    const latest = this.registry.get(REG.settings) as Settings | undefined;
    if (!latest) return;
    this.cfg.questionStyle = latest.questionStyle === 'drive' ? 'drive' : DEFAULT_SETTINGS.questionStyle;
    this.cfg.challengeIntervalSec = latest.challengeIntervalSec;
    this.cfg.roundLengthSec = latest.roundLengthSec;
    this.cfg.musicVolume = latest.musicVolume;
    this.cfg.sfxVolume = latest.sfxVolume;
    this.cols.forEach((col, i) => col.hint.setText(this.hintText(this.cfg.players[i].difficulty)));
    if (this.cursors[0] === ROW_ADVANCED) {
      this.cursors[0] = ROW_START;
      this.refreshCursors();
    }
  }

  private refreshCursors() {
    const p1 = hexNum(PLAYER_COLORS[0]), p2 = hexNum(PLAYER_COLORS[1]);
    this.cols.forEach((col, i) => {
      const cur = this.cursors[i];
      const color = i === 0 ? p1 : p2;
      col.diff.setSelected(cur === ROW_DIFF, color);
      col.car.setSelected(cur === ROW_CAR, color);
    });
    const c1 = this.cursors[0];
    this.globals.forEach((r, i) => r.setSelected(c1 === ROW_QUEST + i, p1));
    this.advancedBtn.setSelected(c1 === ROW_ADVANCED, p1);
    this.startBtn.setSelected(c1 === ROW_START, p1);
  }

  // ───────────────────────── logic ─────────────────────────
  update() {
    services.input.poll();
    if (this.leaving) return;
    for (let p = 0; p < this.cfg.players.length; p++) {
      if (this.handle(p as PlayerId)) return;
    }
  }

  /** Returns true if the scene is being left. */
  private handle(p: PlayerId): boolean {
    const inp = services.input.get(p);
    const last = p === 0 ? P1_LAST : P2_LAST;
    let cur = this.cursors[p];
    if (inp.navY) {
      const n = Phaser.Math.Wrap(cur + inp.navY, 0, last + 1);
      if (n !== cur) { this.cursors[p] = cur = n; services.audio.sfx('menuMove'); this.refreshCursors(); }
    }
    if (inp.navX) this.change(p, cur, inp.navX);
    if (inp.confirm) {
      if (p === 0 && cur === ROW_ADVANCED) {
        services.audio.sfx('menuSelect');
        (this.scene.get(SCENE.config) as ConfigScene).openFromSetup();
      } else {
        this.startRace();
      }
      return true;
    }
    if (inp.back && p === 0) {
      if (cur === ROW_DIFF) {
        this.leaving = true;
        services.audio.sfx('menuMove');
        this.scene.start(SCENE.title);
        return true;
      }
      this.cursors[0] = ROW_DIFF; services.audio.sfx('menuMove'); this.refreshCursors();
    }
    return false;
  }

  private change(p: PlayerId, row: number, dir: 1 | -1) {
    const c = this.cfg;
    const ps = c.players[p];
    const cycle = <T,>(list: readonly T[], v: T) => list[Phaser.Math.Wrap(list.indexOf(v) + dir, 0, list.length)];
    let target: OptionRow | undefined;
    if (row === ROW_DIFF) { ps.difficulty = cycle(DIFFS, ps.difficulty); target = this.cols[p].diff; }
    else if (row === ROW_CAR) { ps.car = cycle(CARS, ps.car); target = this.cols[p].car; }
    else if (p === 0 && row === ROW_QUEST) { c.challengeMode = cycle(MODES, c.challengeMode); target = this.globals[0]; }
    else if (p === 0 && row === ROW_MAP) { c.map = cycle(RACE_MAPS, c.map); target = this.globals[1]; }
    if (!target) return;
    services.audio.sfx('menuMove');
    this.refreshAll();
    target.bump(dir);
  }

  private startRace() {
    this.leaving = true;
    services.audio.sfx('menuSelect');
    const settings: Settings = { ...this.cfg, seed: loadSettings().seed };
    saveSettings(settings);
    this.registry.set(REG.settings, settings);
    services.input.reset();
    settings.players.forEach((pl, i) => services.input.assign(i as PlayerId, pl.device));
    this.scene.start(SCENE.race);
  }
}
