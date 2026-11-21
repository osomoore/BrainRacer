import Phaser from 'phaser';
import { guideArt } from '../art/loadoutKeys';
import { DEFAULT_SETTINGS, DIFFICULTY, GAME_HEIGHT, GAME_WIDTH, NEW_RACER, PLAYER_COLORS } from '../config/gameConfig';
import { applyRacerProfile, createRacer, playerRacer, racerIds, racerName, racerProfiles } from '../core/racerProfiles';
import { services } from '../core/services';
import { MAP_LABEL, selectedLoadout } from '../core/progression';
import { loadAllProgress, racerProgressOf, racerLoadouts, teamMaps, teamPlayableMap, type AllProgress } from '../core/racerProgress';
import { isRaceMap, loadSettings, saveSettings } from '../core/settings';
import type { RacerProfileId, CarKind, GuideKind, PlayerId, PlayerSettings, QuestionTypes, RaceMap, Settings } from '../core/types';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { MenuButton } from '../ui/menu/MenuButton';
import { cycleChoice, DIFF_EXAMPLE, DIFF_LABEL, QUESTION_LABEL, racerChoices } from '../ui/menu/newRacerLogic';
import { NewRacerPanel } from '../ui/menu/NewRacerPanel';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, carName, carPreview, deviceLabel, FONT_HEAD, guideName, hexNum, MENU } from '../ui/menu/style';
import { REG, SCENE } from './keys';

/** Stand-in id for "New Profile": no saved progress, so only starter cars/guides. */
const NEW_PROFILE_ID = 'u0' as RacerProfileId;
const ROW_RACER = 0, ROW_CAR = 1, ROW_GUIDE = 2, ROW_MAP = 3, ROW_START = 4;

const COL_W = 780;
const COL_ROW_W = 740;
const CAR_PREVIEW_SCALE = 1.35;

interface Column {
  racer: OptionRow;
  car: OptionRow;
  guide: OptionRow;
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
  private progress!: AllProgress;
  private available: ReturnType<typeof racerLoadouts>[] = [];
  private maps!: readonly RaceMap[];
  private modeLabel!: Phaser.GameObjects.Text;
  private startBtn!: MenuButton;
  private leaving = false;
  private isNew: boolean[] = [false, false];
  private panel?: NewRacerPanel;
  private panelPlayer: PlayerId = 0;

  constructor() { super(SCENE.setup); }

  create() {
    this.leaving = false;
    this.cols = []; this.cursors = [0, 0]; this.isNew = [false, false]; this.panel = undefined;
    const reg = this.registry.get(REG.settings) as Settings | undefined;
    const saved = loadSettings();
    const base = reg && reg.players?.length ? reg : saved;
    const players: SetupPlayer[] = base.players.slice(0, 2).map((p, i) => applyRacerProfile({
      ...p,
      car: p.car ?? (i === 0 ? 'dino' : 'kart'),
    }, i, base));
    this.cfg = {
      ...base,
      players,
      map: isRaceMap(base.map) ? base.map : 'city',
      challengeMode: 'words',
      questionStyle: base.questionStyle === 'drive' ? 'drive' : DEFAULT_SETTINGS.questionStyle,
    };
    this.dedupeRacers();
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
    const top = 130, h = 500;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    g.lineStyle(10, color, 1).strokeRoundedRect(cx - COL_W / 2, top, COL_W, h, 40);
    bigText(this, cx - 350, top + 33, `PLAYER ${i + 1}`, 52, PLAYER_COLORS[i], { font: FONT_HEAD, stroke: 10, origin: [0, 0.5] });
    const device = this.cfg.players[i].device;
    const family = services.input.controllerFamily?.(device);
    const label = family === 'nintendo' ? 'Switch Pro' : deviceLabel(device, family);
    bigText(this, cx + 350, top + 33, label, 40, '#ffffff', { origin: [1, 0.5] });
    const opts = { width: COL_ROW_W, valueX: 155, arrowSpan: 175, height: 56 };
    const racer = new OptionRow(this, cx, top + 100, 'Racer', opts);
    const hint = bigText(this, cx, top + 190, '', 40, MENU.dim, { bold: false, shadow: false, stroke: 4 });
    const car = new OptionRow(this, cx, top + 300, 'Car', opts);
    const guide = new OptionRow(this, cx, top + 365, 'Guide', opts);
    const { car: carKind, guide: guideKind } = this.loadout(i);
    const carObj = carPreview(this, carKind, cx - 68, top + 440, CAR_PREVIEW_SCALE);
    const guideObj = this.add.image(cx + 74, top + 440, guideArt(guideKind));
    return { racer, car, guide, hint, carKind, carObj, guideObj };
  }

  private buildGlobals() {
    const cx = GAME_WIDTH / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0d1840, 0.88).fillRoundedRect(cx - 560, 690, 1120, 84, 36);
    g.lineStyle(8, hexNum(PLAYER_COLORS[0]), 1).strokeRoundedRect(cx - 560, 690, 1120, 84, 36);
    this.mapRow = new OptionRow(this, cx, 732, 'Map', { width: 1040, height: 56, fontSize: 48, valueX: 230, arrowSpan: 200 });
    const color = hexNum(PLAYER_COLORS[0]);
    this.startBtn = new MenuButton(this, cx, 870, 900, 86, 'START RACE!', color, 64);
    const padPlayers = this.cfg.players.filter((p) => p.device.type === 'gamepad');
    if (padPlayers.length) {
      const families = padPlayers.map((p) => services.input.controllerFamily?.(p.device) ?? 'other');
      const family = families.every((f) => f === families[0]) ? families[0] : 'other';
      this.startBtn.add(new FaceButtonBadge(this, -330, 0, 62, 'bottom', family));
    }
  }

  // ───────────────────────── view ─────────────────────────
  private hintText(p: SetupPlayer): string {
    const { difficulty: d, questionTypes } = p;
    const names = (Object.keys(QUESTION_LABEL) as (keyof QuestionTypes)[]).filter((t) => questionTypes[t]).map((t) => QUESTION_LABEL[t]);
    const examples: string[] = [];
    if (questionTypes.addition) examples.push(`Sums like ${DIFF_EXAMPLE[d]}`);
    if (questionTypes.multiplication) examples.push(`Tables up to ${DIFFICULTY[d].multiplication.maxFactor}`);
    const lines = [`${DIFF_LABEL[d]} · ${names.join(' + ')}`];
    const slot = this.cfg.players.indexOf(p);
    if (this.isNew[slot]) return 'Make a new racer!';
    const sec = racerProfiles(this.cfg)[playerRacer(p, slot, this.cfg)].roundSec;
    examples.push(`${sec % 60 ? (sec / 60).toFixed(1) : sec / 60} min races`);
    lines.push(examples.join(' · '));
    if (this.cfg.questionStyle !== 'pause') {
      lines.push(`${Number((this.cfg.challengeIntervalSec * DIFFICULTY[d].periodMultiplier).toFixed(1))} s per question`);
    }
    return lines.join('\n');
  }

  /** Re-applies each player's racer preset (difficulty + question types) from the latest profiles. */
  private applyRacers() {
    this.cfg.players = this.cfg.players.map((p, i) => applyRacerProfile(p, i, this.cfg));
  }

  private refreshAll() {
    const c = this.cfg;
    this.modeLabel.setVisible(c.developerMode === true);
    this.cols.forEach((col, i) => {
      const p = c.players[i];
      const { car, guide } = this.loadout(i);
      col.racer.setValue(this.isNew[i] ? 'New Profile' : racerName(this.cfg, playerRacer(p, i, this.cfg)));
      col.hint.setText(this.hintText(p));
      col.car.setValue(carName(car));
      col.guide.setValue(guideName(guide));
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
    this.cfg.racerProfiles = racerProfiles(latest);
    this.cfg.customRacers = latest.customRacers;
    this.applyRacers();
    this.dedupeRacers();
    this.refreshAvailability();
    this.refreshAll();
  }

  private refreshAvailability() {
    const admin = this.cfg.developerMode === true;
    this.progress = loadAllProgress();
    const team = this.cfg.players.map((p, i) => racerProgressOf(this.progress, this.isNew[i] ? NEW_PROFILE_ID : playerRacer(p, i, this.cfg)));
    this.available = team.map((rp) => racerLoadouts(rp, admin));
    this.maps = teamMaps(team, admin);
    this.cfg.map = teamPlayableMap(this.cfg.map, team, admin);
  }

  /** Two players can't be the same racer: move later players to the next free racer. "New Profile" players are skipped. */
  private dedupeRacers() {
    const ids = racerIds(this.cfg);
    const used: string[] = [];
    this.cfg.players = this.cfg.players.map((p, i): SetupPlayer => {
      if (this.isNew[i]) return p as SetupPlayer;
      const cur = playerRacer(p, i, this.cfg);
      let r: RacerProfileId = cur;
      for (let k = 0; used.includes(r) && k < ids.length; k++) r = ids[(ids.indexOf(r) + 1) % ids.length];
      used.push(r);
      return r === cur ? applyRacerProfile(p, i, this.cfg) as SetupPlayer : applyRacerProfile({ ...p, profile: r }, i, this.cfg);
    });
  }

  private loadout(player: number): { car: CarKind; guide: GuideKind } {
    return selectedLoadout(this.cfg.players[player], player, this.cfg.developerMode === true, this.available[player]);
  }

  private refreshCursors() {
    const p1 = hexNum(PLAYER_COLORS[0]), p2 = hexNum(PLAYER_COLORS[1]);
    this.cols.forEach((col, i) => {
      const cur = this.cursors[i];
      const color = i === 0 ? p1 : p2;
      col.racer.setSelected(cur === ROW_RACER, color);
      col.car.setSelected(cur === ROW_CAR, color);
      col.guide.setSelected(cur === ROW_GUIDE, color);
    });
    const c1 = this.cursors[0];
    this.mapRow.setSelected(c1 === ROW_MAP, p1);
    this.startBtn.setSelected(c1 === ROW_START, p1);
  }

  // ───────────────────────── logic ─────────────────────────
  update() {
    services.input.poll();
    if (this.leaving) return;
    if (this.panel) { this.updatePanel(); return; }
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
      if (cur === ROW_RACER) {
        this.leaving = true;
        services.audio.sfx('menuMove');
        this.scene.start(SCENE.title);
        return true;
      }
      this.cursors[0] = ROW_RACER; services.audio.sfx('menuMove'); this.refreshCursors();
    }
    return false;
  }

  private change(p: PlayerId, row: number, dir: 1 | -1) {
    const c = this.cfg;
    const ps = c.players[p];
    const cycle = <T,>(list: readonly T[], v: T) => list[Phaser.Math.Wrap(list.indexOf(v) + dir, 0, list.length)];
    let target: OptionRow | undefined;
    if (row === ROW_RACER) {
      const otherSlot = 1 - p;
      const other = c.players.length > 1 && !this.isNew[otherSlot] ? playerRacer(c.players[otherSlot], otherSlot, c) : undefined;
      const customCount = racerIds(c).filter((r) => r.startsWith('u')).length;
      const list = racerChoices(racerIds(c), other, customCount < NEW_RACER.maxCustomRacers);
      const next = cycleChoice(list, this.isNew[p] ? 'new' : playerRacer(ps, p, c), dir);
      if (next === 'new') this.isNew[p] = true;
      else { this.isNew[p] = false; c.players[p] = applyRacerProfile({ ...ps, profile: next }, p, c); }
      this.refreshAvailability();
      target = this.cols[p].racer;
    }
    else if (row === ROW_CAR) {
      const value = cycle(this.available[p].cars, this.loadout(p).car);
      if (c.developerMode) ps.devCar = value; else ps.car = value;
      target = this.cols[p].car;
    } else if (row === ROW_GUIDE) {
      const value = cycle(this.available[p].guides, this.loadout(p).guide);
      if (c.developerMode) ps.devGuide = value; else ps.guide = value;
      target = this.cols[p].guide;
    } else if (p === 0 && row === ROW_MAP) { c.map = cycle(this.maps, c.map); target = this.mapRow; }
    if (!target) return;
    services.audio.sfx('menuMove');
    this.refreshAll();
    target.bump(dir);
  }

  private startRace() {
    const next = this.isNew.findIndex((v, i) => v && i < this.cfg.players.length);
    if (next >= 0) { this.openPanel(next as PlayerId); return; }
    this.leaving = true;
    services.audio.sfx('menuSelect');
    this.applyRacers();
    this.persist();
    services.input.reset();
    this.cfg.players.forEach((pl, i) => services.input.assign(i as PlayerId, pl.device));
    this.scene.start(SCENE.race);
  }

  private persist() {
    const settings: Settings = { ...this.cfg, seed: loadSettings().seed };
    saveSettings(settings);
    this.registry.set(REG.settings, settings);
  }

  private openPanel(p: PlayerId) {
    services.audio.sfx('menuSelect');
    const taken = racerIds(this.cfg).map((id) => racerName(this.cfg, id));
    const keyboard = this.cfg.players[p].device.type === 'keyboard';
    this.panelPlayer = p;
    this.panel = new NewRacerPanel(this, hexNum(PLAYER_COLORS[p]), PLAYER_COLORS[p], p + 1, taken, !keyboard);
  }

  private updatePanel() {
    const panel = this.panel!;
    const res = panel.handle(services.input.get(this.panelPlayer));
    if (res === 'none') return;
    this.panel = undefined;
    panel.destroy();
    if (res === 'cancel') { services.audio.sfx('menuMove'); return; }
    const p = this.panelPlayer;
    const { id, patch } = createRacer(this.cfg, panel.result!);
    Object.assign(this.cfg, patch);
    this.isNew[p] = false;
    this.cfg.players[p] = applyRacerProfile({ ...this.cfg.players[p], profile: id }, p, this.cfg);
    this.persist();
    this.refreshAvailability();
    this.refreshAll();
    this.startRace();   // next new player, or the race
  }
}
