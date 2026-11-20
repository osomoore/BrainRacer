import Phaser from 'phaser';
import { getTuning, resetTuning, setTuning, type DeviceTuning, type GasMode } from '../config/deviceTuning';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { audioDiagnostics } from '../audio';
import { BUILD_ID } from '../buildInfo';
import { developerModeSettings } from '../core/progression';
import { services } from '../core/services';
import { loadSettings, saveSettings } from '../core/settings';
import type { Settings } from '../core/types';
import { faceButton } from '../input/buttonPrompts';
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
    c.add(bigText(this, GAME_WIDTH / 2, 72, 'ADVANCED SETTINGS', 72, MENU.yellow, { font: FONT_HEAD, stroke: 10 }));
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
        const label = family && faceButton(family, 'bottom').label;
        return mode === 'a' && label ? `${label} button` : GAS_LABEL[mode];
      }, (d) => {
        const gas: DeviceTuning['gas'] = [...getTuning().gas];
        gas[p] = cycle(GAS_MODES, gas[p], d);
        setTuning({ gas });
      });
    }
    header(0, 710, 'DISPLAY');
    option(0, rowY(8), 'Frame-rate cap*', () => `${getTuning().fpsCap} fps`,
      (d) => setTuning({ fpsCap: cycle(FPS, getTuning().fpsCap, d) }));
    option(0, rowY(9), 'Debug readout', () => onOff(getTuning().debugReadout),
      () => setTuning({ debugReadout: !getTuning().debugReadout }));
    option(0, rowY(10), 'Developer Mode', () => onOff(this.settings().developerMode === true),
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
    action(1, rowY(10), 'Close', () => this.close());

    c.add(bigText(this, COL_X[0] - ROW_W / 2 + 8, 987, '* Takes effect after reload', 40, MENU.dim, { origin: [0, 0.5], shadow: false }));
    c.add(bigText(this, GAME_WIDTH / 2, 1040, '↑ ↓ Move       ← → Change       Bottom button / Space / Enter accepts', 40, MENU.dim, { stroke: 6, shadow: false }));
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
    this.rows.forEach((r, i) => {
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
    if (inp.pause || inp.back) { this.toggle(); return; }
    if (inp.navY) {
      const n = Phaser.Math.Wrap(this.cursor + inp.navY, 0, this.rows.length);
      if (n !== this.cursor) { this.cursor = n; services.audio.sfx('menuMove'); this.refreshRows(); }
    }
    const row = this.rows[this.cursor];
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
        const id = g.id.replace(/\(.*$/, '').trim().slice(0, 6);
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
