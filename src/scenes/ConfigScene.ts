import Phaser from 'phaser';
import { getTuning, resetTuning, setTuning, type DeviceTuning, type GasMode } from '../config/deviceTuning';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { audioDiagnostics } from '../audio';
import { BUILD_ID } from '../buildInfo';
import { collectibleName, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS } from '../config/collectibles';
import { contentOverride, developerModeSettings, loadUnlocks, availableMaps, MAP_LABEL, RACE_MAPS, setContentOverride } from '../core/progression';
import { RACER_PROFILE_IDS, RACER_PROFILE_NAME, racerProfiles, withRacerProfile } from '../core/racerProfiles';
import { services } from '../core/services';
import { isRaceMap, loadSettings, saveSettings } from '../core/settings';
import type { Difficulty, QuestionType, Settings } from '../core/types';
import { faceButton, xboxFaceLetter } from '../input/buttonPrompts';
import { MenuButton } from '../ui/menu/MenuButton';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, FONT_HEAD, hexNum, MENU, type Selectable } from '../ui/menu/style';
import { REG, SCENE } from './keys';

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
const ROW_STEP = 71;

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
const ROUND_SEC = [60, 120, 180, 300, 480, 600];
const EVERY_SEC = [5, 8, 10, 15, 20, 30];
const CONTENT_ROWS = 9;
function contentPages<T extends string>(name: string, ids: readonly T[]) {
  const total = Math.ceil(ids.length / CONTENT_ROWS);
  return Array.from({ length: total }, (_, i) => ({
    name: total > 1 ? `${name} ${i + 1} / ${total}` : name,
    ids: ids.slice(i * CONTENT_ROWS, (i + 1) * CONTENT_ROWS),
  }));
}
const CONTENT_PAGES = [
  ...contentPages('Worlds', RACE_MAPS.filter(map => map !== 'city')),
  ...contentPages('Cars', UNLOCK_VEHICLE_IDS),
  ...contentPages('Companions', UNLOCK_GUIDE_IDS),
];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy ★', easyPlus: 'Easy+ ★½', normal: 'Normal ★★', hard: 'Hard ★★★' };
const PROFILE_TYPES: readonly { type: QuestionType; label: string }[] = [
  { type: 'addition', label: 'Addition' },
  { type: 'multiplication', label: 'Multiplication' },
  { type: 'spelling', label: 'Spelling' },
];
const CONTENT_OVERRIDES = [undefined, true, false] as const;

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
  private adminCursor = 0;
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
    this.scene.bringToTop();
  }

  // ───────────────────────── panel ─────────────────────────
  private buildPanel(): void {
    const c = this.add.container(0, 0).setDepth(DEPTH);
    this.panel = c;
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1329));
    c.add(bigText(this, GAME_WIDTH / 2, 72, 'ADMIN SETTINGS', 72, MENU.yellow, { font: FONT_HEAD, stroke: 10 }));
    c.add(bigText(this, 30, 30, `Build ${BUILD_ID}`, 32, MENU.dim, { origin: [0, 0], bold: false, shadow: false, stroke: 4 }));
    const color = hexNum(PLAYER_COLORS[0]);
    const opts = { width: ROW_W, height: ROW_H, fontSize: 40, valueX: 205, arrowSpan: 169 };

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
    const action = (col: number, y: number, label: string, fn: () => void): void => {
      const b = new MenuButton(this, COL_X[col], y, ROW_W, ROW_H, label, color, 44, false);
      c.add(b);
      this.rows.push({ selectable: b, activate: fn });
    };
    const cycle = <T,>(list: readonly T[], v: T, dir: 1 | -1): T => list[Phaser.Math.Wrap(list.indexOf(v) + dir, 0, list.length)];
    const cycleNum = (list: readonly number[], v: number, dir: 1 | -1): number => {
      let idx = 0;
      list.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(list[idx] - v)) idx = i; });
      return list[Phaser.Math.Wrap(idx + dir, 0, list.length)];
    };
    const onOff = (b: boolean): string => (b ? 'On' : 'Off');
    const vol = (key: 'musicVolume' | 'sfxVolume') => (dir: 1 | -1): void => {
      const v = Math.min(1, Math.max(0, Math.round((this.settings()[key] + dir * 0.1) * 10) / 10));
      this.patchSettings({ [key]: v });
    };

    const rowY = (i: number) => FIRST_ROW + i * ROW_STEP;
    header(0, 155, 'NEXT RACE');
    option(0, rowY(0), 'Answer mode', () => this.settings().questionStyle === 'drive' ? 'While Driving' : 'Stop & Answer',
      () => this.patchSettings({ questionStyle: this.settings().questionStyle === 'drive' ? 'pause' : 'drive' }));
    option(0, rowY(1), 'Round length', () => `${Math.round(this.settings().roundLengthSec / 60)} min`,
      (d) => this.patchSettings({ roundLengthSec: cycleNum(ROUND_SEC, this.settings().roundLengthSec, d) }));
    option(0, rowY(2), 'Question interval', () => `${this.settings().challengeIntervalSec} s`,
      (d) => this.patchSettings({ challengeIntervalSec: cycleNum(EVERY_SEC, this.settings().challengeIntervalSec, d) }));
    option(0, rowY(3), 'Traffic', () => TRAFFIC_LABEL[getTuning().traffic],
      (d) => setTuning({ traffic: cycle(TRAFFIC_LEVELS, getTuning().traffic, d) }));

    header(0, 500, 'GAMEPAD');
    for (const p of [0, 1] as const) {
      option(0, rowY(5 + p), `P${p + 1} gas`, () => {
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
    header(0, 710, 'DISPLAY   (* needs reload)');
    option(0, rowY(8), 'Frame-rate cap*', () => `${getTuning().fpsCap} fps`,
      (d) => setTuning({ fpsCap: cycle(FPS, getTuning().fpsCap, d) }));
    option(0, rowY(9), 'Debug readout', () => onOff(getTuning().debugReadout),
      () => setTuning({ debugReadout: !getTuning().debugReadout }));
    option(0, rowY(10), 'Admin Mode', () => onOff(this.settings().developerMode === true),
      () => this.patchSettings(developerModeSettings(this.settings().developerMode !== true)));

    header(1, 155, 'AUDIO');
    option(1, rowY(0), 'Music volume', () => `${Math.round(this.settings().musicVolume * 100)}%`, vol('musicVolume'));
    option(1, rowY(1), 'Sound FX volume', () => `${Math.round(this.settings().sfxVolume * 100)}%`, vol('sfxVolume'));
    option(1, rowY(2), 'Audio mode', () => AUDIO_MODE_LABEL[getTuning().audioMode],
      (d) => setTuning({ audioMode: cycle(AUDIO_MODE, getTuning().audioMode, d) }));
    option(1, rowY(3), 'Engine sound', () => ENGINE_LABEL[getTuning().engineSound],
      (d) => setTuning({ engineSound: cycle(ENGINE, getTuning().engineSound, d) }));
    option(1, rowY(4), 'Audio buffer*', () => LATENCY_LABEL[getTuning().audioLatency],
      (d) => setTuning({ audioLatency: cycle(LATENCY, getTuning().audioLatency, d) }));
    option(1, rowY(5), 'Schedule ahead', () => `${getTuning().lookAheadSec} s`,
      (d) => setTuning({ lookAheadSec: cycle(AHEAD, getTuning().lookAheadSec, d) }));
    option(1, rowY(6), 'Compressor', () => onOff(getTuning().compressor),
      () => setTuning({ compressor: !getTuning().compressor }));
    header(1, 710, 'ACTIONS');
    action(1, rowY(8), 'Reload game', () => { try { location.reload(); } catch { /* ignore */ } });
    action(1, rowY(9), 'Reset to defaults', () => this.resetAll());
    action(1, rowY(10), 'Content Locks', () => {
      this.adminCursor = this.cursor;
      this.showContent();
    });
    action(1, 987, 'Racer Profiles', () => {
      this.adminCursor = this.cursor;
      this.showProfiles();
    });
    action(0, 987, 'Close', () => this.close());

    c.add(bigText(this, GAME_WIDTH / 2, 1040, '↑ ↓ Move       ← → Change       Bottom button / Space / Enter accepts', 40, MENU.dim, { stroke: 6, shadow: false }));
  }

  /** Replaces the main panel with a fresh full-screen sub-page (Content Locks, Racer Profiles). */
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

  private showProfiles(): void {
    const panel = this.openSub('RACER PROFILES', '', 'Up / Down move    Left / Right change    Back to Admin Settings');
    const color = hexNum(PLAYER_COLORS[0]);
    const colW = 580;
    const xs = [360, 960, 1560];
    const opts = { width: colW, height: 56, fontSize: 40, valueX: 130, arrowSpan: 105 };
    const save = (id: typeof RACER_PROFILE_IDS[number], mutate: (p: ReturnType<typeof racerProfiles>[typeof id]) => void): void => {
      const cur = racerProfiles(this.settings())[id];
      const next = { difficulty: cur.difficulty, questionTypes: { ...cur.questionTypes } };
      mutate(next);
      this.patchSettings(withRacerProfile(this.settings(), id, next));
    };
    // Rows are pushed column by column so Up/Down walks one racer at a time.
    RACER_PROFILE_IDS.forEach((id, col) => {
      const x = xs[col];
      panel.add(bigText(this, x, 200, RACER_PROFILE_NAME[id].toUpperCase(), 56, MENU.yellow, { font: FONT_HEAD }));
      const rowOpts = { ...opts, width: colW };
      const diff = new OptionRow(this, x, 290, 'Level', { ...rowOpts, valueX: 115, arrowSpan: 150 });
      panel.add(diff);
      const changeDiff = (dir: 1 | -1) => save(id, p => { p.difficulty = DIFFICULTIES[Phaser.Math.Wrap(DIFFICULTIES.indexOf(p.difficulty) + dir, 0, DIFFICULTIES.length)]; });
      this.subRows.push({ selectable: diff, refresh: () => diff.setValue(DIFFICULTY_LABEL[racerProfiles(this.settings())[id].difficulty]), change: changeDiff, activate: () => changeDiff(1), bump: d => diff.bump(d) });
      PROFILE_TYPES.forEach(({ type, label }, i) => {
        const row = new OptionRow(this, x, 380 + i * 90, label, { ...rowOpts, valueX: 150, arrowSpan: 105 });
        panel.add(row);
        // Ignore the toggle that would turn off the last remaining question type.
        const toggle = () => save(id, p => {
          const on = !p.questionTypes[type];
          if (!on && PROFILE_TYPES.filter(t => p.questionTypes[t.type]).length <= 1) return;
          p.questionTypes[type] = on;
        });
        this.subRows.push({ selectable: row, refresh: () => row.setValue(racerProfiles(this.settings())[id].questionTypes[type] ? 'On' : 'Off'), change: toggle, activate: toggle, bump: d => row.bump(d) });
      });
    });
    const back = new MenuButton(this, GAME_WIDTH / 2, 900, 600, ROW_H, 'Back', color, 44, false);
    panel.add(back);
    this.subRows.push({ selectable: back, activate: () => this.closeSub() });
    this.cursor = 0;
    services.audio.sfx('menuSelect');
    this.refreshRows();
  }

  private showContent(): void {
    const panel = this.openSub('CONTENT LOCKS', 'Normal player access', 'Up / Down to move    Left / Right to change    Back to Admin Settings');
    const cx = GAME_WIDTH / 2;
    const opts = { width: 1180, height: 56, fontSize: 40, valueX: 285, arrowSpan: 245 };
    const page = CONTENT_PAGES[this.contentPage];
    const category = new OptionRow(this, cx, 219, 'Category', opts);
    panel.add(category);
    category.setValue(page.name);
    const cyclePage = (dir: 1 | -1) => {
      this.contentPage = Phaser.Math.Wrap(this.contentPage + dir, 0, CONTENT_PAGES.length);
      this.showContent();
    };
    this.subRows.push({ selectable: category, change: cyclePage, activate: () => cyclePage(1) });
    const unlocked = loadUnlocks();
    page.ids.forEach((id, i) => {
      const label = isRaceMap(id) ? MAP_LABEL[id] : collectibleName(id);
      const row = new OptionRow(this, cx, 290 + i * 70, label, opts);
      panel.add(row);
      const refresh = () => {
        const override = contentOverride(id);
        const open = isRaceMap(id) ? availableMaps(false).includes(id) : unlocked.includes(id);
        row.setValue(override === undefined ? (open ? 'Auto (Open)' : 'Auto (Locked)') : override ? 'Open' : 'Locked');
      };
      const change = (dir: 1 | -1) => {
        const index = CONTENT_OVERRIDES.indexOf(contentOverride(id));
        setContentOverride(id, CONTENT_OVERRIDES[Phaser.Math.Wrap(index + dir, 0, CONTENT_OVERRIDES.length)]);
      };
      this.subRows.push({ selectable: row, refresh, change, activate: () => { change(1); this.refreshRows(); } });
    });
    this.cursor = 0;
    services.audio.sfx('menuSelect');
    this.refreshRows();
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
      racerProfiles: undefined,
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
    if (this.subPanel) this.closeSub();
    this.panel.setVisible(false);
    for (const key of this.paused) {
      try { this.scene.resume(key); } catch { /* scene may be gone */ }
    }
    this.paused = [];
  }

  // ───────────────────────── frame ─────────────────────────
  update(time: number): void {
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
