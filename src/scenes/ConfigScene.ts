import Phaser from 'phaser';
import { AGE_BANDS, bandDifficulty, bandRoundSec, difficultyBand } from '../core/ageBands';
import { ageLabel } from '../ui/menu/newRacerLogic';
import { changeJbq, jbqPointsLabel, jbqScopeLabel, ROW_POINTS, ROW_SCOPE } from '../ui/menu/questionPick';
import { ENGINE_LEVELS, getTuning, resetTuning, setTuning, type DeviceTuning, type GasMode } from '../config/deviceTuning';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, RACER_ROUND_SEC } from '../config/gameConfig';
import { audioDiagnostics } from '../audio';
import { BUILD_ID } from '../buildInfo';
import { collectibleName, WORLD_REWARDS, worldRewards } from '../config/collectibles';
import { developerModeSettings, MAP_LABEL, RACE_MAPS } from '../core/progression';
import { deleteRacerProgress, earned, loadRacerProgress, setRacerOverride, type Content } from '../core/racerProgress';
import { deleteRacer, racerIds, racerName, racerProfiles, renameRacer, validRacerName, withRacerProfile } from '../core/racerProfiles';
import { services } from '../core/services';
import { isRaceMap, loadSettings, saveSettings } from '../core/settings';
import type { QuestionType, RaceMap, RacerProfile, RacerProfileId, Settings } from '../core/types';
import { faceButton, xboxFaceLetter } from '../input/buttonPrompts';
import { LetterPicker } from '../ui/menu/LetterPicker';
import { clampPage, pageCount, pageItems } from '../ui/menu/paging';
import { MenuButton } from '../ui/menu/MenuButton';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, FONT_HEAD, hexNum, MENU, type Selectable } from '../ui/menu/style';
import { REG, SCENE } from './keys';
import { consumeFamilyJoinCode, openFamilySyncPanel } from '../../shared/sync/panel';
import { familySync } from '../../shared/sync/runtime';

/**
 * Hidden advanced settings. Open with LT+RT+Start on a gamepad or F9 on a keyboard.
 * While open it pauses every other running scene.
 * Also hosts the optional always-on-top debug readout.
 */

const COMBO_THRESHOLD = 0.7;
const DEBOUNCE_MS = 450;
const DEPTH = 100000;
const ROW_W = 820;
const ROW_H = 58;
const COL_X = [525, 1430];
const FIRST_ROW = 221;
const ROW_STEP = 58;   // 13 slots per column; rows are ROW_H_MAIN high with a 4 px gap
const ROW_H_MAIN = 54;

const ENGINE: readonly DeviceTuning['engineSound'][] = ['full', 'lite', 'sample', 'off'];
const ENGINE_LABEL = { full: 'Full', lite: 'Lite', sample: 'Sample', off: 'Off' } as const;
const AUDIO_MODE: readonly DeviceTuning['audioMode'][] = ['live', 'prerendered', 'files'];
const AUDIO_MODE_LABEL = { live: 'Live', prerendered: 'Pre-render', files: 'Files' } as const;
const LATENCY: readonly DeviceTuning['audioLatency'][] = ['interactive', 'balanced', 'playback'];
const LATENCY_LABEL = { interactive: 'Fast', balanced: 'Balanced', playback: 'Safe' } as const;
const AHEAD: readonly DeviceTuning['lookAheadSec'][] = [0.1, 0.2, 0.3];
const FPS: readonly DeviceTuning['fpsCap'][] = [60, 30];
const TRAFFIC_LEVELS: readonly DeviceTuning['traffic'][] = ['normal', 'reduced', 'minimal'];
const TRAFFIC_LABEL = { normal: 'Normal', reduced: 'Reduced', minimal: 'Minimal' } as const;
const GAS_MODES: readonly GasMode[] = ['a', 'trigger', 'auto'];
const GAS_LABEL = { a: 'Bottom button', trigger: 'Trigger', auto: 'Auto' } as const;
const KEY_HISTORY = 3;
/** Step to the neighbour of the closest list value. */
function cycleNum(list: readonly number[], v: number, dir: 1 | -1): number {
  let idx = 0;
  list.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(list[idx] - v)) idx = i; });
  return list[Phaser.Math.Wrap(idx + dir, 0, list.length)];
}
const minutes = (sec: number): string => sec % 60 ? `${(sec / 60).toFixed(1)} min` : `${sec / 60} min`;
const EVERY_SEC = [5, 8, 10, 15, 20, 30];
const CONTENT_ROWS = 8;
function contentPages(name: string, ids: readonly Content[]) {
  const total = Math.ceil(ids.length / CONTENT_ROWS);
  return Array.from({ length: total }, (_, i) => ({
    name: total > 1 ? `${name} ${i + 1} / ${total}` : name,
    ids: ids.slice(i * CONTENT_ROWS, (i + 1) * CONTENT_ROWS),
  }));
}
/** One "Worlds" page (all but City), then one page per world listing its cars and its buddy. */
const CONTENT_PAGES = [
  ...contentPages('Worlds', RACE_MAPS.filter(map => map !== 'city')),
  ...RACE_MAPS.flatMap(map => contentPages(`${MAP_LABEL[map]} items`, worldRewards(map))),
];
const PROFILE_TYPES: readonly { type: QuestionType; label: string }[] = [
  { type: 'math', label: 'Math' },
  { type: 'reading', label: 'Reading' },
  { type: 'jbq', label: 'JBQ' },
];
const PROFILES_PER_PAGE = 2;
const CONTENT_OVERRIDES = [undefined, true, false] as const;
const cycle = <T,>(list: readonly T[], v: T, dir: 1 | -1): T => list[Phaser.Math.Wrap(list.indexOf(v) + dir, 0, list.length)];
const onOff = (b: boolean): string => (b ? 'On' : 'Off');

interface Row {
  selectable: Selectable;
  change?: (dir: 1 | -1) => void;
  activate?: () => void;
  refresh?: () => void;
  bump?: (dir: number) => void;
}

export class ConfigScene extends Phaser.Scene {
  private isOpen = false;
  private lastToggle = 0;
  private paused: string[] = [];
  private rows: Row[] = [];
  private subRows: Row[] = [];
  private subPanel?: Phaser.GameObjects.Container;
  private contentPage = 0;
  private contentRacer = 0;
  private profilePage = 0;
  private modal?: { container: Phaser.GameObjects.Container; id: RacerProfileId; picker?: LetterPicker; msg?: Phaser.GameObjects.Text; rows?: Row[]; cursor?: number };
  private adminCursor = 0;
  private perfMap: RaceMap = 'city';
  private perfViews: 2 | 4 = 4;
  private cursor = 0;
  private panel!: Phaser.GameObjects.Container;
  private readout!: Phaser.GameObjects.Text;
  private inputReadout!: Phaser.GameObjects.Text;
  private recentKeys: { code: string; at: number }[] = [];
  private readoutAt = 0;
  private frame = 0;

  constructor() { super(SCENE.config); }

  create(): void {
    this.isOpen = false;
    this.rows = [];
    this.cursor = 0;
    this.paused = [];
    this.buildPanel();
    this.panel.setVisible(false);
    this.readout = this.add.text(12, GAME_HEIGHT - 8, '', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: '36px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.72)', padding: { x: 10, y: 6 }, lineSpacing: 4,
    }).setOrigin(0, 1).setDepth(DEPTH).setVisible(false);
    // Top-right so it clears the bottom timer bar and the centered 2-player scoreboard.
    this.inputReadout = this.add.text(GAME_WIDTH - 12, 8, '', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: '36px', color: '#9be7ff',
      backgroundColor: 'rgba(0,0,0,0.72)', padding: { x: 10, y: 6 }, lineSpacing: 4,
    }).setOrigin(1, 0).setDepth(DEPTH).setVisible(false);
    // Diagnostic exception to rule 8: raw keyboard/gamepad reads, to see what a TV browser actually reports.
    const onKey = (e: KeyboardEvent): void => {
      this.recentKeys = [{ code: e.code || e.key, at: performance.now() }, ...this.recentKeys].slice(0, KEY_HISTORY);
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.input.keyboard?.on('keydown-F9', () => this.toggle());
    // Mobile setup gear (after its math gate) asks for the menu through a game-level event, so no contract change is needed.
    const onAdminOpen = (): void => { if (!this.isOpen) this.toggle(); };
    this.game.events.on('admin:open', onAdminOpen);
    this.events.once('shutdown', () => this.game.events.off('admin:open', onAdminOpen));
    this.scene.bringToTop();
    const joinCode = consumeFamilyJoinCode();
    if (joinCode && familySync.enabled) this.time.delayedCall(0, () => { this.toggle(); openFamilySyncPanel({ joinCode }); });
  }

  // ───────────────────────── panel ─────────────────────────
  private buildPanel(): void {
    const c = this.add.container(0, 0).setDepth(DEPTH);
    this.panel = c;
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1329));
    c.add(bigText(this, GAME_WIDTH / 2, 72, 'ADMIN SETTINGS', 72, MENU.yellow, { font: FONT_HEAD, stroke: 10 }));
    c.add(bigText(this, 30, 30, `Build ${BUILD_ID}`, 32, MENU.dim, { origin: [0, 0], bold: false, shadow: false, stroke: 4 }));
    const color = hexNum(PLAYER_COLORS[0]);
    const opts = { width: ROW_W, height: ROW_H_MAIN, fontSize: 40, valueX: 205, arrowSpan: 169 };

    const header = (col: number, y: number, text: string): void => {
      c.add(bigText(this, COL_X[col] - ROW_W / 2 + 8, y, text, 44, MENU.dim, { origin: [0, 0.5], stroke: 6, shadow: false }));
    };
    const option = (col: number, y: number, label: string, get: () => string, change: (dir: 1 | -1) => void): void => {
      const r = new OptionRow(this, COL_X[col], y, label, opts);
      c.add(r);
      const refresh = (): void => { r.setValue(get()); };
      refresh();
      this.rows.push({ selectable: r, change, refresh, bump: (d) => r.bump(d) });
    };
    const action = (col: number, y: number, label: string, fn: () => void): MenuButton => {
      const b = new MenuButton(this, COL_X[col], y, ROW_W, ROW_H_MAIN, label, color, 44, false);
      c.add(b);
      this.rows.push({ selectable: b, activate: fn });
      return b;
    };

    const rowY = (i: number) => FIRST_ROW + i * ROW_STEP;
    header(0, 155, 'NEXT RACE');
    // Race length is per racer now (Racer Profiles → Race time); the longer of the two players' times is used.
    option(0, rowY(0), 'Question interval', () => `${this.settings().challengeIntervalSec} s`,
      (d) => this.patchSettings({ challengeIntervalSec: cycleNum(EVERY_SEC, this.settings().challengeIntervalSec, d) }));
    option(0, rowY(1), 'Traffic', () => TRAFFIC_LABEL[getTuning().traffic],
      (d) => setTuning({ traffic: cycle(TRAFFIC_LEVELS, getTuning().traffic, d) }));

    action(0, rowY(2), 'Performance test', () => {
      this.adminCursor = this.cursor;
      this.showPerf();
    });

    header(0, rowY(3), 'GAMEPAD');
    for (const p of [0, 1, 2, 3] as const) {
      option(0, rowY(4 + p), `P${p + 1} gas`, () => {
        const mode = getTuning().gas[p];
        const device = this.settings().players[p]?.device;
        const family = device ? services.input.controllerFamily?.(device) : undefined;
        const label = family === 'xbox' ? xboxFaceLetter('bottom') : family && faceButton(family, 'bottom').label;
        return mode === 'a' && label ? `${label} button` : GAS_LABEL[mode];
      }, (d) => {
        const gas: DeviceTuning['gas'] = [...getTuning().gas];
        gas[p] = cycle(GAS_MODES, gas[p], d);
        setTuning({ gas });
      });
    }
    header(0, rowY(8), 'DISPLAY   (* needs reload)');
    option(0, rowY(9), 'Frame-rate cap*', () => `${getTuning().fpsCap} fps`,
      (d) => setTuning({ fpsCap: cycle(FPS, getTuning().fpsCap, d) }));
    option(0, rowY(10), 'Debug readout', () => onOff(getTuning().debugReadout),
      () => setTuning({ debugReadout: !getTuning().debugReadout }));
    option(0, rowY(11), 'Perf overlay', () => onOff(getTuning().perfHud),
      () => setTuning({ perfHud: !getTuning().perfHud }));

    header(1, 155, 'DEVICE');
    const audioCursor = this.rows.length;
    const openAudio = () => {
      this.adminCursor = audioCursor;
      this.showAudio();
    };
    const audio = action(1, rowY(0), 'Audio', openAudio);
    audio.setSize(audio.w, audio.h).setInteractive().on('pointerdown', openAudio);
    header(1, rowY(2), 'ACTIONS');
    option(1, rowY(3), 'Admin Mode', () => onOff(this.settings().developerMode === true),
      () => this.patchSettings(developerModeSettings(this.settings().developerMode !== true)));
    action(1, rowY(4), 'Reload game', () => { try { location.reload(); } catch { /* ignore */ } });
    action(1, rowY(5), 'Reset to defaults', () => this.resetAll());
    action(1, rowY(7), 'Racer Unlocks', () => {
      this.adminCursor = this.cursor;
      this.showContent();
    });
    action(1, rowY(8), 'Racer Profiles', () => {
      this.adminCursor = this.cursor;
      this.showProfiles();
    });
    if (familySync.enabled) {
      const sync = action(1, rowY(9), 'Family sync', () => { openFamilySyncPanel(); });
      sync.setSize(sync.w, sync.h).setInteractive().on('pointerdown', () => openFamilySyncPanel());
    }
    const close = action(1, 987, 'Close', () => this.close());
    close.setSize(close.w, close.h).setInteractive().on('pointerdown', () => this.close());

    c.add(bigText(this, GAME_WIDTH / 2, 1040, '↑ ↓ Move       ← → Change       Bottom button / Space / Enter accepts', 40, MENU.dim, { stroke: 6, shadow: false }));
  }

  private showAudio(): void {
    const panel = this.openSub('AUDIO', '* Needs reload', '↑ ↓ Move       ← → Change       B / Backspace goes back');
    const cx = GAME_WIDTH / 2;
    const color = hexNum(PLAYER_COLORS[0]);
    const opts = { width: 920, height: 60, fontSize: 40, valueX: 215, arrowSpan: 175 };
    const option = (label: string, get: () => string, change: (dir: 1 | -1) => void): void => {
      const i = this.subRows.length;
      const row = new OptionRow(this, cx, 224 + i * 76, label, opts);
      panel.add(row);
      row.makeTappable((zone) => {
        this.cursor = i;
        change(zone === 'left' ? -1 : 1);
        this.refreshRows();
      }, opts.height);
      this.subRows.push({ selectable: row, change, activate: () => { change(1); this.refreshRows(); },
        refresh: () => row.setValue(get()), bump: (dir) => row.bump(dir) });
    };
    const volume = (label: string, key: 'musicVolume' | 'sfxVolume') => {
      option(label, () => `${Math.round(this.settings()[key] * 100)}%`, (dir) => {
        const v = Math.round((this.settings()[key] + dir * 0.1) * 10) / 10;
        this.patchSettings({ [key]: Phaser.Math.Clamp(v, 0, 1) });
      });
    };
    volume('Music volume', 'musicVolume');
    volume('Sound FX volume', 'sfxVolume');
    option('Engine level', () => `${getTuning().engineLevel}%`,
      (d) => setTuning({ engineLevel: cycle(ENGINE_LEVELS, getTuning().engineLevel, d) }));
    option('Engine sound', () => ENGINE_LABEL[getTuning().engineSound],
      (d) => setTuning({ engineSound: cycle(ENGINE, getTuning().engineSound, d) }));
    option('Audio mode', () => AUDIO_MODE_LABEL[getTuning().audioMode],
      (d) => setTuning({ audioMode: cycle(AUDIO_MODE, getTuning().audioMode, d) }));
    option('Audio buffer*', () => LATENCY_LABEL[getTuning().audioLatency],
      (d) => setTuning({ audioLatency: cycle(LATENCY, getTuning().audioLatency, d) }));
    option('Schedule ahead', () => `${getTuning().lookAheadSec} s`,
      (d) => setTuning({ lookAheadSec: cycle(AHEAD, getTuning().lookAheadSec, d) }));
    option('Compressor', () => onOff(getTuning().compressor),
      () => setTuning({ compressor: !getTuning().compressor }));
    const back = new MenuButton(this, cx, 868, 600, ROW_H, 'Back', color, 44, false);
    back.setSize(back.w, back.h).setInteractive().on('pointerdown', () => this.closeSub());
    panel.add(back);
    this.subRows.push({ selectable: back, activate: () => this.closeSub() });
    this.cursor = 0;
    this.refreshRows();
  }

  /** Replaces the main panel with a full-screen settings page. */
  private openSub(title: string, subtitle: string, hint: string): Phaser.GameObjects.Container {
    this.subPanel?.destroy();
    this.panel.setVisible(false);
    const cx = GAME_WIDTH / 2;
    const panel = this.add.container(0, 0).setDepth(DEPTH);
    this.subPanel = panel;
    this.subRows = [];
    panel.add(this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1329));
    panel.add(bigText(this, cx, 76, title, 72, MENU.yellow, { font: FONT_HEAD }));
    if (subtitle) panel.add(bigText(this, cx, 142, subtitle, 40, MENU.dim));
    panel.add(bigText(this, cx, 1030, hint, 40, MENU.dim));
    return panel;
  }

  private showProfiles(page = this.profilePage, cursor = 0): void {
    const ids = racerIds(this.settings());
    const pages = pageCount(ids.length, PROFILES_PER_PAGE);
    this.profilePage = clampPage(page, pages);
    const panel = this.openSub('RACER PROFILES', '', 'Up / Down move    Left / Right change    Back to Admin Settings');
    const color = hexNum(PLAYER_COLORS[0]);
    const colW = 840;
    const xs = [490, 1430];
    const y0 = 215;
    const rowStep = 68;
    const opts = { width: colW, height: 60, fontSize: 40, valueX: 130, arrowSpan: 105 };
    const save = (id: RacerProfileId, mutate: (p: RacerProfile) => void): void => {
      const cur = racerProfiles(this.settings())[id];
      const next: RacerProfile = { difficulty: cur.difficulty, questionTypes: { ...cur.questionTypes }, roundSec: cur.roundSec, jbq: { ...cur.jbq } };
      mutate(next);
      this.patchSettings(withRacerProfile(this.settings(), id, next));
    };
    // Page row first, then one racer block per column; Up/Down walks one racer at a time.
    const pageRow = new OptionRow(this, GAME_WIDTH / 2, 148, 'Page', { ...opts, width: 700, valueX: 150, arrowSpan: 130 });
    panel.add(pageRow);
    const changePage = (dir: 1 | -1) => this.showProfiles(Phaser.Math.Wrap(this.profilePage + dir, 0, pages), 0);
    this.subRows.push({ selectable: pageRow, refresh: () => pageRow.setValue(`${this.profilePage + 1} / ${pages}`), change: changePage, activate: () => changePage(1), bump: d => pageRow.bump(d) });
    pageItems(ids, this.profilePage, PROFILES_PER_PAGE).forEach((id, col) => {
      const x = xs[col];
      panel.add(bigText(this, x, y0, racerName(this.settings(), id).toUpperCase(), 52, MENU.yellow, { font: FONT_HEAD }));
      let n = 0;
      const rowY = () => y0 + 70 + (n++) * rowStep;
      const diff = new OptionRow(this, x, rowY(), 'Age', { ...opts, valueX: 115, arrowSpan: 150 });
      panel.add(diff);
      const changeDiff = (dir: 1 | -1) => save(id, p => {
        const band = AGE_BANDS[Phaser.Math.Wrap(AGE_BANDS.indexOf(difficultyBand(p.difficulty)) + dir, 0, AGE_BANDS.length)];
        p.difficulty = bandDifficulty(band); p.roundSec = bandRoundSec(band);
      });
      this.subRows.push({ selectable: diff, refresh: () => diff.setValue(ageLabel(racerProfiles(this.settings())[id].difficulty)), change: changeDiff, activate: () => changeDiff(1), bump: d => diff.bump(d) });
      for (const { type, label } of PROFILE_TYPES) {
        const row = new OptionRow(this, x, rowY(), label, { ...opts, valueX: 150, arrowSpan: 105 });
        panel.add(row);
        // Ignore the toggle that would turn off the last remaining question type.
        const toggle = () => save(id, p => {
          const on = !p.questionTypes[type];
          if (!on && PROFILE_TYPES.filter(t => p.questionTypes[t.type]).length <= 1) return;
          p.questionTypes[type] = on;
        });
        this.subRows.push({ selectable: row, refresh: () => row.setValue(racerProfiles(this.settings())[id].questionTypes[type] ? 'On' : 'Off'), change: toggle, activate: toggle, bump: d => row.bump(d) });
      }
      for (const [label, rowId] of [['JBQ points', ROW_POINTS], ['JBQ scope', ROW_SCOPE]] as const) {
        // Basics is a fixed set (Q1-144), so the scope row does not apply.
        if (rowId === ROW_SCOPE && racerProfiles(this.settings())[id].jbq.points === 'basics') continue;
        const row = new OptionRow(this, x, rowY(), label, { ...opts, valueX: 115, arrowSpan: 150 });
        panel.add(row);
        const change = (dir: 1 | -1) => {
          const was = racerProfiles(this.settings())[id].jbq.points === 'basics';
          save(id, p => { p.jbq = changeJbq(p.jbq, rowId, dir); });
          // Entering or leaving Basics adds or removes the scope row: rebuild the page after this input.
          if (was !== (racerProfiles(this.settings())[id].jbq.points === 'basics')) this.time.delayedCall(0, () => this.showProfiles(this.profilePage, this.cursor));
        };
        const text = () => { const j = racerProfiles(this.settings())[id].jbq; return rowId === ROW_POINTS ? jbqPointsLabel(j.points) : jbqScopeLabel(j.points, j.scope); };
        this.subRows.push({ selectable: row, refresh: () => row.setValue(text()), change, activate: () => change(1), bump: d => row.bump(d) });
      }
      const time = new OptionRow(this, x, rowY(), 'Race time', { ...opts, valueX: 150, arrowSpan: 105 });
      panel.add(time);
      const changeTime = (dir: 1 | -1) => save(id, p => { p.roundSec = cycleNum(RACER_ROUND_SEC, p.roundSec, dir); });
      this.subRows.push({ selectable: time, refresh: () => time.setValue(minutes(racerProfiles(this.settings())[id].roundSec)), change: changeTime, activate: () => changeTime(1), bump: d => time.bump(d) });
      const rename = new MenuButton(this, x, rowY(), colW, 60, 'Rename', color, 44, false);
      panel.add(rename);
      this.subRows.push({ selectable: rename, activate: () => this.openRename(id) });
      const del = new MenuButton(this, x, rowY(), colW, 60, 'Delete', color, 44, false);
      panel.add(del);
      this.subRows.push({ selectable: del, activate: () => this.openDelete(id) });
    });
    const back = new MenuButton(this, GAME_WIDTH / 2, 935, 600, ROW_H, 'Back', color, 44, false);
    panel.add(back);
    this.subRows.push({ selectable: back, activate: () => this.closeSub() });
    this.cursor = Math.min(cursor, this.subRows.length - 1);
    services.audio.sfx('menuSelect');
    this.refreshRows();
  }

  private openRename(id: RacerProfileId): void {
    this.closeModal();
    const color = hexNum(PLAYER_COLORS[0]);
    const c = this.add.container(0, 0).setDepth(DEPTH + 1);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1329));
    const picker = new LetterPicker(this, GAME_WIDTH / 2, 20, {
      title: `RENAME ${racerName(this.settings(), id).toUpperCase()}`,
      initial: racerName(this.settings(), id).toUpperCase(),
      keyboardTyping: false, // the keyboard is also the nav device here
      color,
    });
    c.add(picker);
    const msg = bigText(this, GAME_WIDTH / 2, 1030, '', 40, MENU.yellow);
    c.add(msg);
    this.modal = { container: c, picker, msg, id };
  }

  private openDelete(id: RacerProfileId): void {
    this.closeModal();
    const color = hexNum(PLAYER_COLORS[0]);
    const c = this.add.container(0, 0).setDepth(DEPTH + 1);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1329));
    c.add(bigText(this, GAME_WIDTH / 2, 330, `Delete ${racerName(this.settings(), id).toUpperCase()}?`, 72, MENU.yellow, { font: FONT_HEAD }));
    c.add(bigText(this, GAME_WIDTH / 2, 430, 'Their unlocks are lost, and the name is removed from every game.', 52, MENU.white));
    const yes = new MenuButton(this, GAME_WIDTH / 2, 600, 600, 80, 'Yes, delete', color, 52, false);
    const no = new MenuButton(this, GAME_WIDTH / 2, 710, 600, 80, 'No', color, 52, false);
    c.add([yes, no]);
    const rows: Row[] = [
      { selectable: yes, activate: () => this.deleteRacerNow(id) },
      { selectable: no, activate: () => this.closeModal() },
    ];
    this.modal = { container: c, rows, cursor: 1, id };
    this.refreshModal();
  }

  private refreshModal(): void {
    const m = this.modal;
    if (!m?.rows) return;
    const color = hexNum(PLAYER_COLORS[0]);
    m.rows.forEach((r, i) => r.selectable.setSelected(i === m.cursor, color));
  }

  private closeModal(): void {
    this.modal?.container.destroy();
    this.modal = undefined;
  }

  private deleteRacerNow(id: RacerProfileId): void {
    const s = this.settings();
    const players = s.players.map(p => (p.profile === id ? { ...p, profile: undefined } : p)) as Settings['players'];
    this.patchSettings({ ...deleteRacer(s, id), players });
    deleteRacerProgress(id);
    this.closeModal();
    this.showProfiles(this.profilePage, 0);
  }

  /** Returns true while a modal (rename picker / delete confirm) swallows input. */
  private updateModal(inp: ReturnType<typeof services.input.any>): boolean {
    const m = this.modal;
    if (!m) return false;
    if (m.picker) {
      const r = m.picker.handle(inp);
      if (r === 'cancel') this.closeModal();
      else if (r === 'done') {
        const name = validRacerName(m.picker.value);
        const s = this.settings();
        const taken = name && racerIds(s).some(o => o !== m.id && racerName(s, o).toLowerCase() === name.toLowerCase());
        if (!name) m.msg?.setText('Use letters only.');
        else if (taken) { m.msg?.setText(`${name.toUpperCase()} is already taken.`); services.audio.sfx('menuMove'); }
        else {
          renameRacer(m.id, name);
          this.closeModal();
          this.showProfiles(this.profilePage, this.cursor);
        }
      }
      return true;
    }
    if (inp.back) { this.closeModal(); return true; }
    if (inp.navY && m.rows) {
      m.cursor = Phaser.Math.Wrap((m.cursor ?? 0) + inp.navY, 0, m.rows.length);
      services.audio.sfx('menuMove');
      this.refreshModal();
    }
    if (inp.confirm && m.rows) m.rows[m.cursor ?? 0].activate?.();
    return true;
  }

  private showContent(cursor = 0): void {
    const panel = this.openSub('RACER UNLOCKS', 'Auto = earned in play    Open / Locked = admin override', 'Up / Down to move    Left / Right to change    Back to Admin Settings');
    const cx = GAME_WIDTH / 2;
    const opts = { width: 1180, height: 56, fontSize: 40, valueX: 285, arrowSpan: 245 };
    const page = CONTENT_PAGES[this.contentPage];
    const ids = racerIds(this.settings());
    this.contentRacer = clampPage(this.contentRacer, ids.length);
    const racer = ids[this.contentRacer];
    if (racer === undefined) {
      panel.add(bigText(this, cx, 300, 'No profiles yet. Make one in Setup.', 52, MENU.white));
      const back = new MenuButton(this, cx, 935, 600, ROW_H, 'Back', hexNum(PLAYER_COLORS[0]), 44, false);
      panel.add(back);
      this.subRows.push({ selectable: back, activate: () => this.closeSub() });
      this.cursor = 0;
      this.refreshRows();
      return;
    }
    const racerRow = new OptionRow(this, cx, 219, 'Racer', opts);
    panel.add(racerRow);
    racerRow.setValue(racerName(this.settings(), racer));
    const cycleRacer = (dir: 1 | -1) => {
      this.contentRacer = Phaser.Math.Wrap(this.contentRacer + dir, 0, racerIds(this.settings()).length);
      this.showContent(0);
    };
    this.subRows.push({ selectable: racerRow, change: cycleRacer, activate: () => cycleRacer(1) });
    const category = new OptionRow(this, cx, 289, 'Category', opts);
    panel.add(category);
    category.setValue(page.name);
    const cyclePage = (dir: 1 | -1) => {
      this.contentPage = Phaser.Math.Wrap(this.contentPage + dir, 0, CONTENT_PAGES.length);
      this.showContent(1);
    };
    this.subRows.push({ selectable: category, change: cyclePage, activate: () => cyclePage(1) });
    const buddies = new Set(Object.values(WORLD_REWARDS).map(w => w.buddy as Content));
    page.ids.forEach((id, i) => {
      const label = isRaceMap(id) ? MAP_LABEL[id] : buddies.has(id) ? `${collectibleName(id)} (buddy)` : collectibleName(id);
      const row = new OptionRow(this, cx, 359 + i * 70, label, opts);
      panel.add(row);
      const refresh = () => {
        const p = loadRacerProgress(racer);
        const override = p.overrides[id];
        row.setValue(override === undefined ? (earned(p, id) ? 'Auto (Open)' : 'Auto (Locked)') : override ? 'Open' : 'Locked');
      };
      const change = (dir: 1 | -1) => {
        const index = CONTENT_OVERRIDES.indexOf(loadRacerProgress(racer).overrides[id]);
        setRacerOverride(racer, id, CONTENT_OVERRIDES[Phaser.Math.Wrap(index + dir, 0, CONTENT_OVERRIDES.length)]);
      };
      this.subRows.push({ selectable: row, refresh, change, activate: () => { change(1); this.refreshRows(); }, bump: d => row.bump(d) });
    });
    this.cursor = cursor;
    services.audio.sfx('menuSelect');
    this.refreshRows();
  }

  /** Perf spike page: pick a map and 2 / 4 views, then A starts src/scenes/dev/FourViewPerf.ts (Back there returns to the title). */
  private showPerf(cursor = 0): void {
    const panel = this.openSub('PERFORMANCE TEST', 'Runs a 30 s auto-driven race and shows the FPS on screen', 'Up / Down move    Left / Right change    A starts    Back to Admin Settings');
    const opts = { width: 1180, height: 56, fontSize: 40, valueX: 285, arrowSpan: 245 };
    const cx = GAME_WIDTH / 2;
    const mapRow = new OptionRow(this, cx, 289, 'Map', opts);
    const viewsRow = new OptionRow(this, cx, 359, 'Views', opts);
    panel.add(mapRow); panel.add(viewsRow);
    const changeMap = (d: 1 | -1) => { this.perfMap = RACE_MAPS[Phaser.Math.Wrap(RACE_MAPS.indexOf(this.perfMap) + d, 0, RACE_MAPS.length)]; };
    const changeViews = () => { this.perfViews = this.perfViews === 4 ? 2 : 4; };
    this.subRows.push({ selectable: mapRow, change: changeMap, activate: () => changeMap(1), refresh: () => mapRow.setValue(MAP_LABEL[this.perfMap]), bump: d => mapRow.bump(d) });
    this.subRows.push({ selectable: viewsRow, change: changeViews, activate: changeViews, refresh: () => viewsRow.setValue(`${this.perfViews} views`), bump: d => viewsRow.bump(d) });
    const start = new MenuButton(this, cx, 459, 820, ROW_H, 'Start test', hexNum(PLAYER_COLORS[0]), 44, false);
    panel.add(start);
    this.subRows.push({ selectable: start, activate: () => this.startPerf() });
    this.cursor = cursor;
    this.refreshRows();
  }

  private startPerf(): void {
    const keep = this.scene.key;
    const running = this.scene.manager.getScenes(true).map((s) => s.scene.key).filter((k) => k !== keep);
    for (const key of this.paused) { try { this.scene.resume(key); } catch { /* gone */ } }
    this.paused = [];
    this.isOpen = false;
    this.closeSub();
    this.panel.setVisible(false);
    for (const key of running) { try { this.scene.stop(key); } catch { /* ignore */ } }
    this.scene.run('FourViewPerf', { map: this.perfMap, views: this.perfViews });
  }

  private closeSub(): void {
    this.subPanel?.destroy();
    this.subPanel = undefined;
    this.subRows = [];
    this.panel.setVisible(true);
    this.cursor = this.adminCursor;
    this.refreshRows();
  }

  // ───────────────────────── settings helpers ─────────────────────────
  private settings(): Settings {
    return (this.registry.get(REG.settings) as Settings | undefined) ?? loadSettings();
  }

  private patchSettings(patch: Partial<Settings>): void {
    const next = { ...this.settings(), ...patch };
    saveSettings(next);
    this.registry.set(REG.settings, next);
    services.audio.setVolumes(next.musicVolume, next.sfxVolume);
  }

  private resetAll(): void {
    resetTuning();
    const d = DEFAULT_SETTINGS;
    this.patchSettings({
      ...developerModeSettings(false),
      musicVolume: d.musicVolume, sfxVolume: d.sfxVolume,
      challengeIntervalSec: d.challengeIntervalSec,
      questionStyle: d.questionStyle,
    });
    services.audio.sfx('menuSelect');
    this.refreshRows();
  }

  private refreshRows(): void {
    const color = hexNum(PLAYER_COLORS[0]);
    (this.subPanel ? this.subRows : this.rows).forEach((r, i) => {
      r.refresh?.();
      r.selectable.setSelected(i === this.cursor, color);
    });
  }

  // ───────────────────────── open / close ─────────────────────────
  private toggle(): void {
    const now = performance.now();
    if (now - this.lastToggle < DEBOUNCE_MS) return;
    this.lastToggle = now;
    if (this.isOpen) this.close(); else this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.paused = [];
    for (const s of this.scene.manager.getScenes(true)) {
      const key = s.scene.key;
      if (key === this.scene.key) continue;
      this.paused.push(key);
      this.scene.pause(key);
    }
    this.cursor = 0;
    this.panel.setVisible(true);
    this.readout.setVisible(false);
    this.inputReadout.setVisible(false);
    this.scene.bringToTop();
    this.refreshRows();
  }

  private close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.lastToggle = performance.now();
    this.closeModal();
    if (this.subPanel) this.closeSub();
    this.panel.setVisible(false);
    for (const key of this.paused) {
      try { this.scene.resume(key); } catch { /* scene may be gone */ }
    }
    this.paused = [];
  }

  // ───────────────────────── frame ─────────────────────────
  update(time: number): void {
    if ((window as Window & { __familySyncDialogOpen?: boolean }).__familySyncDialogOpen) return;
    this.frame++;
    if (this.isOpen) {
      services.input.poll();
      this.updateOpen();
    } else {
      const inp = services.input.any();
      if (inp.pause && inp.brake >= COMBO_THRESHOLD && inp.throttle >= COMBO_THRESHOLD) this.toggle();
      if (getTuning().debugReadout) this.updateReadout(time);
      else if (this.readout.visible) { this.readout.setVisible(false); this.inputReadout.setVisible(false); }
    }
    if (this.frame % 30 === 0) this.scene.bringToTop();
  }

  private updateOpen(): void {
    const inp = services.input.any();
    if (this.updateModal(inp)) return;
    if (inp.back && this.subPanel) { this.closeSub(); return; }
    if (inp.pause || inp.back) { this.toggle(); return; }
    const rows = this.subPanel ? this.subRows : this.rows;
    if (inp.navY) {
      const n = Phaser.Math.Wrap(this.cursor + inp.navY, 0, rows.length);
      if (n !== this.cursor) { this.cursor = n; services.audio.sfx('menuMove'); this.refreshRows(); }
    }
    const row = rows[this.cursor];
    if (inp.navX && row?.change) {
      row.change(inp.navX > 0 ? 1 : -1);
      services.audio.sfx('menuMove');
      this.refreshRows();
      row.bump?.(inp.navX);
    }
    if (inp.confirm && row) {
      if (row.activate) row.activate();
      else if (row.change) { services.audio.sfx('menuSelect'); this.close(); }
    }
  }

  private updateReadout(time: number): void {
    if (!this.readout.visible) { this.readout.setVisible(true); this.inputReadout.setVisible(true); }
    if (time - this.readoutAt < 250) return;
    this.readoutAt = time;
    const a = audioDiagnostics();
    const ms = (s: number): string => (s * 1000).toFixed(0);
    this.readout.setText([
      `FPS ${this.game.loop.actualFps.toFixed(0)}  audio ${a.state}  clock ${a.clockRatio.toFixed(2)}x  stalls ${a.stalls}`,
      `lat ${ms(a.baseLatency)}/${ms(a.outputLatency)}ms  ahead ${a.lookAhead}s  sfx ${a.activeSfx}  eng ${a.engineMode}`,
      a.audioMode === 'files'
        ? `mode files  sfx ${a.filesSfx}/${a.filesSfxTotal}  music ${a.filesMusic}/${a.filesMusicTotal}${a.rendering ? '  RENDERING' : ''}`
        : `mode ${a.audioMode === 'prerendered' ? 'pre' : 'live'}  sfxReady ${a.sfxReady}/${a.sfxTotal}  music cached ${a.musicCached}/${a.musicTotal}${a.rendering ? '  RENDERING' : ''}`,
    ]);
    this.inputReadout.setText(this.inputLines());
  }

  /** Raw pad buttons/axes and last keys, e.g. `p0 Xbox b[0,7] L.00 R.85 x.00 y.00`. */
  private inputLines(): string[] {
    const f = (v: number): string => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2).replace(/^0/, '');
    const lines: string[] = [];
    try {
      for (const g of Array.from(navigator.getGamepads?.() ?? [])) {
        if (!g || !g.connected) continue;
        const pressed = g.buttons.flatMap((b, i) => (b.pressed ? [i] : []));
        const id = g.id.replace(/\(.*$/, '').trim().slice(0, 24);
        lines.push(`p${g.index} ${id} b[${pressed.join(',')}] L${f(g.buttons[6]?.value ?? 0)} R${f(g.buttons[7]?.value ?? 0)} x${f(g.axes[0] ?? 0)} y${f(g.axes[1] ?? 0)}`);
      }
    } catch { /* ignore */ }
    if (!lines.length) lines.push('no gamepads');
    const now = performance.now();
    const keys = this.recentKeys.map((k) => `${k.code} ${Math.min(99, (now - k.at) / 1000).toFixed(1)}s`);
    lines.push(keys.length ? `keys ${keys.join(' | ')}` : 'keys -');
    return lines;
  }
}
