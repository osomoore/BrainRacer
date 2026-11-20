import Phaser from 'phaser';
import { guideArt } from '../art/loadoutKeys';
import { DEFAULT_SETTINGS, DIFFICULTY, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { normalizeQuestionTypes } from '../config/questionsPolicy';
import { services } from '../core/services';
import { availableLoadouts, availableMaps, loadUnlocks, MAP_LABEL, playableMap, selectedLoadout } from '../core/progression';
import { isRaceMap, loadSettings, saveSettings } from '../core/settings';
import type { CarKind, Difficulty, GuideKind, PlayerId, PlayerSettings, QuestionType, QuestionTypes, RaceMap, Settings } from '../core/types';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { MenuButton } from '../ui/menu/MenuButton';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, carName, carPreview, deviceLabel, FONT_HEAD, guideName, hexNum, MENU } from '../ui/menu/style';
import { REG, SCENE } from './keys';

const DIFFS: Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy ★', easyPlus: 'Easy+ ★½', normal: 'Normal ★★', hard: 'Hard ★★★' };
const DIFF_EXAMPLE: Record<Difficulty, string> = { easy: '3 + 4', easyPlus: '8 + 7', normal: '14 + 5', hard: '38 + 47' };
const DIFF_BLURB: Record<Difficulty, string> = { easy: 'Nice and relaxed', easyPlus: 'A little bigger', normal: 'Just right', hard: 'Super speedy' };

const QUESTIONS: { type: QuestionType; label: string }[] = [
  { type: 'addition', label: 'Addition' },
  { type: 'multiplication', label: 'Multiplication' },
  { type: 'spelling', label: 'Spelling' },
];
const ROW_DIFF = 0, ROW_CAR = 1, ROW_GUIDE = 2, ROW_QUEST = 3;
const ROW_MAP = ROW_QUEST + QUESTIONS.length, ROW_START = ROW_MAP + 1;

const COL_W = 780;
const COL_ROW_W = 740;
const CAR_PREVIEW_SCALE = 1.35;

interface Column {
  diff: OptionRow;
  car: OptionRow;
  guide: OptionRow;
  questions: OptionRow[];
  hint: Phaser.GameObjects.Text;
  carKind: CarKind;
  carObj: Phaser.GameObjects.Container;
  guideObj: Phaser.GameObjects.Image;
}

type SetupPlayer = PlayerSettings & { questionTypes: QuestionTypes };

export class SetupScene extends Phaser.Scene {
  private cfg!: Settings & { players: SetupPlayer[] };
  private cursors: number[] = [0, 0];
  private cols: Column[] = [];
  private mapRow!: OptionRow;
  private available!: ReturnType<typeof availableLoadouts>;
  private maps!: readonly RaceMap[];
  private modeLabel!: Phaser.GameObjects.Text;
  private startBtn!: MenuButton;
  private leaving = false;

  constructor() { super(SCENE.setup); }

  create() {
    this.leaving = false;
    this.cols = []; this.cursors = [0, 0];
    const reg = this.registry.get(REG.settings) as Settings | undefined;
    const saved = loadSettings();
    const base = reg && reg.players?.length ? reg : saved;
    const players: SetupPlayer[] = base.players.slice(0, 2).map((p, i) => ({
      ...p,
      difficulty: p.difficulty ?? saved.players[i]?.difficulty ?? 'normal',
      car: p.car ?? (i === 0 ? 'dino' : 'kart'),
      questionTypes: normalizeQuestionTypes(p.questionTypes, base.challengeMode),
    }));
    this.cfg = {
      ...base,
      players,
      map: isRaceMap(base.map) ? base.map : 'city',
      challengeMode: 'words',
      questionStyle: base.questionStyle === 'drive' ? 'drive' : DEFAULT_SETTINGS.questionStyle,
    };
    this.refreshAvailability();
    services.input.reset();
    players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));

    this.buildBackground();
    bigText(this, GAME_WIDTH / 2, 62, 'GET READY!', 96, '#ffd43b', { font: FONT_HEAD, stroke: 14 });
    this.modeLabel = bigText(this, 36, 62, 'Admin Mode', 40, MENU.dim, { origin: [0, 0.5] });

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
    const top = 130, h = 636;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    g.lineStyle(10, color, 1).strokeRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    bigText(this, cx - 350, top + 33, `PLAYER ${i + 1}`, 52, PLAYER_COLORS[i], { font: FONT_HEAD, stroke: 10, origin: [0, 0.5] });
    const device = this.cfg.players[i].device;
    const family = services.input.controllerFamily?.(device);
    const label = family === 'nintendo' ? 'Switch Pro' : deviceLabel(device, family);
    bigText(this, cx + 350, top + 33, label, 40, '#ffffff', { origin: [1, 0.5] });
    const opts = { width: COL_ROW_W, valueX: 155, arrowSpan: 175, height: 56 };
    const diff = new OptionRow(this, cx, top + 100, 'Difficulty', opts);
    const hint = bigText(this, cx, top + 183, '', 40, MENU.dim, { bold: false, shadow: false, stroke: 4 });
    const car = new OptionRow(this, cx, top + 266, 'Car', opts);
    const guide = new OptionRow(this, cx, top + 331, 'Guide', opts);
    const { car: carKind, guide: guideKind } = this.loadout(i);
    const carObj = carPreview(this, carKind, cx - 68, top + 396, CAR_PREVIEW_SCALE);
    const guideObj = this.add.image(cx + 74, top + 396, guideArt(guideKind));
    const toggleOpts = { ...opts, valueX: 224, arrowSpan: 90 };
    const questions = QUESTIONS.map(({ label }, j) => new OptionRow(this, cx, top + 462 + j * 63, label, toggleOpts));
    return { diff, car, guide, questions, hint, carKind, carObj, guideObj };
  }

  private buildGlobals() {
    const cx = GAME_WIDTH / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - 560, 790, 1120, 84, 36);
    g.lineStyle(8, hexNum(PLAYER_COLORS[0]), 1).strokeRoundedRect(cx - 560, 790, 1120, 84, 36);
    this.mapRow = new OptionRow(this, cx, 832, 'Map', { width: 1040, height: 56, fontSize: 48, valueX: 230, arrowSpan: 200 });
    const color = hexNum(PLAYER_COLORS[0]);
    this.startBtn = new MenuButton(this, cx, 944, 900, 86, 'START RACE!', color, 64);
    bigText(this, cx, 1024, 'Keep at least one question type on per player', 40, MENU.dim);
    const padPlayers = this.cfg.players.filter((p) => p.device.type === 'gamepad');
    if (padPlayers.length) {
      const families = padPlayers.map((p) => services.input.controllerFamily?.(p.device) ?? 'other');
      const family = families.every((f) => f === families[0]) ? families[0] : 'other';
      this.startBtn.add(new FaceButtonBadge(this, -330, 0, 62, 'bottom', family));
    }
  }

  // ───────────────────────── view ─────────────────────────
  private hintText({ difficulty: d, questionTypes }: SetupPlayer): string {
    const examples: string[] = [];
    if (questionTypes.addition) examples.push(`Sums like ${DIFF_EXAMPLE[d]}`);
    if (questionTypes.multiplication) examples.push(`Tables up to ${DIFFICULTY[d].multiplication.maxFactor}`);
    const extra = examples.length ? `\n${examples.join(' · ')}` : '';
    if (this.cfg.questionStyle === 'pause') return `${DIFF_BLURB[d]}${extra}`;
    const secs = Number((this.cfg.challengeIntervalSec * DIFFICULTY[d].periodMultiplier).toFixed(1));
    return `${DIFF_BLURB[d]}: ${secs} s per question${extra}`;
  }

  private refreshAll() {
    const c = this.cfg;
    this.modeLabel.setVisible(c.developerMode === true);
    this.cols.forEach((col, i) => {
      const p = c.players[i];
      const { car, guide } = this.loadout(i);
      col.diff.setValue(DIFF_LABEL[p.difficulty]);
      col.hint.setText(this.hintText(p));
      col.car.setValue(carName(car));
      col.guide.setValue(guideName(guide));
      QUESTIONS.forEach(({ type }, j) => col.questions[j].setValue(p.questionTypes[type] ? 'On' : 'Off'));
      col.guideObj.setTexture(guideArt(guide));
      if (col.carKind !== car) {
        const { x, y } = col.carObj;
        col.carObj.destroy();
        col.carObj = carPreview(this, car, x, y, CAR_PREVIEW_SCALE);
        col.carKind = car;
      }
    });
    this.mapRow.setValue(MAP_LABEL[c.map]);
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
    this.cfg.developerMode = latest.developerMode;
    this.refreshAvailability();
    this.refreshAll();
  }

  private refreshAvailability() {
    const admin = this.cfg.developerMode === true;
    this.available = availableLoadouts(loadUnlocks(), admin);
    this.maps = availableMaps(admin);
    this.cfg.map = playableMap(this.cfg.map, admin);
  }

  private loadout(player: number): { car: CarKind; guide: GuideKind } {
    return selectedLoadout(this.cfg.players[player], player, this.cfg.developerMode === true, this.available);
  }

  private refreshCursors() {
    const p1 = hexNum(PLAYER_COLORS[0]), p2 = hexNum(PLAYER_COLORS[1]);
    this.cols.forEach((col, i) => {
      const cur = this.cursors[i];
      const color = i === 0 ? p1 : p2;
      col.diff.setSelected(cur === ROW_DIFF, color);
      col.car.setSelected(cur === ROW_CAR, color);
      col.guide.setSelected(cur === ROW_GUIDE, color);
      col.questions.forEach((r, j) => r.setSelected(cur === ROW_QUEST + j, color));
    });
    const c1 = this.cursors[0];
    this.mapRow.setSelected(c1 === ROW_MAP, p1);
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
    const last = p === 0 ? ROW_START : ROW_MAP - 1;
    let cur = this.cursors[p];
    if (inp.navY) {
      const n = Phaser.Math.Wrap(cur + inp.navY, 0, last + 1);
      if (n !== cur) { this.cursors[p] = cur = n; services.audio.sfx('menuMove'); this.refreshCursors(); }
    }
    if (inp.navX) this.change(p, cur, inp.navX);
    if (inp.confirm) {
      this.startRace();
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
    else if (row === ROW_CAR) {
      const value = cycle(this.available.cars, this.loadout(p).car);
      if (c.developerMode) ps.devCar = value; else ps.car = value;
      target = this.cols[p].car;
    } else if (row === ROW_GUIDE) {
      const value = cycle(this.available.guides, this.loadout(p).guide);
      if (c.developerMode) ps.devGuide = value; else ps.guide = value;
      target = this.cols[p].guide;
    } else if (row >= ROW_QUEST && row < ROW_MAP) {
      const { type } = QUESTIONS[row - ROW_QUEST];
      const enabled = !ps.questionTypes[type];
      if (!enabled && !QUESTIONS.some((q) => q.type !== type && ps.questionTypes[q.type])) return;
      ps.questionTypes[type] = enabled;
      target = this.cols[p].questions[row - ROW_QUEST];
    } else if (p === 0 && row === ROW_MAP) { c.map = cycle(this.maps, c.map); target = this.mapRow; }
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
