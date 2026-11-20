import Phaser from 'phaser';
import { getTuning, resetTuning, setTuning, type DeviceTuning } from '../config/deviceTuning';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { audioDiagnostics } from '../audio';
import { BUILD_ID } from '../buildInfo';
import { services } from '../core/services';
import { loadSettings, saveSettings } from '../core/settings';
import type { Settings } from '../core/types';
import { MenuButton } from '../ui/menu/MenuButton';
import { OptionRow } from '../ui/menu/OptionRow';
import { bigText, FONT_HEAD, hexNum, MENU, type Selectable } from '../ui/menu/style';
import { REG, SCENE } from './keys';

/**
 * Hidden settings menu. Always running (started at boot from main.ts), invisible until opened with
 * LT+RT+Start on a gamepad or F9 on the keyboard. While open it pauses every other running scene.
 * Also hosts the optional always-on-top debug readout.
 */

const COMBO_THRESHOLD = 0.7;
const DEBOUNCE_MS = 450;
const DEPTH = 100000;
const ROW_W = 880;
const COL_X = [525, 1435];

const ENGINE: readonly DeviceTuning['engineSound'][] = ['full', 'lite', 'sample', 'off'];
const ENGINE_LABEL = { full: 'Full', lite: 'Lite', sample: 'Sample', off: 'Off' } as const;
const AUDIO_MODE: readonly DeviceTuning['audioMode'][] = ['live', 'prerendered'];
const AUDIO_MODE_LABEL = { live: 'Live', prerendered: 'Pre-render' } as const;
const LATENCY: readonly DeviceTuning['audioLatency'][] = ['interactive', 'balanced', 'playback'];
const LATENCY_LABEL = { interactive: 'Fast', balanced: 'Balanced', playback: 'Safe' } as const;
const AHEAD: readonly DeviceTuning['lookAheadSec'][] = [0.1, 0.2, 0.3];
const FPS: readonly DeviceTuning['fpsCap'][] = [60, 30];
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
    this.input.keyboard?.on('keydown-F9', () => this.toggle());
    this.scene.bringToTop();
  }

  // ───────────────────────── panel ─────────────────────────
  private buildPanel(): void {
    const c = this.add.container(0, 0).setDepth(DEPTH);
    this.panel = c;
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050a1c, 0.93));
    c.add(bigText(this, GAME_WIDTH / 2, 62, 'SETTINGS', 80, MENU.yellow, { font: FONT_HEAD, stroke: 12 }));
    c.add(bigText(this, 30, 30, `Build ${BUILD_ID}`, 32, MENU.dim, { origin: [0, 0], bold: false, shadow: false, stroke: 4 }));
    const color = hexNum(PLAYER_COLORS[0]);
    const opts = { width: ROW_W, height: 66, fontSize: 40, valueX: 300, arrowSpan: 135 };

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
      const b = new MenuButton(this, COL_X[col], y, ROW_W, 66, label, color, 44, false);
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

    const y0 = 245, step = 82;
    header(0, 175, 'AUDIO');
    option(0, y0, 'Music volume', () => `${Math.round(this.settings().musicVolume * 100)}%`, vol('musicVolume'));
    option(0, y0 + step, 'Sound FX volume', () => `${Math.round(this.settings().sfxVolume * 100)}%`, vol('sfxVolume'));
    option(0, y0 + step * 2, 'Audio mode', () => AUDIO_MODE_LABEL[getTuning().audioMode],
      (d) => setTuning({ audioMode: cycle(AUDIO_MODE, getTuning().audioMode, d) }));
    option(0, y0 + step * 3, 'Engine sound', () => ENGINE_LABEL[getTuning().engineSound],
      (d) => setTuning({ engineSound: cycle(ENGINE, getTuning().engineSound, d) }));
    option(0, y0 + step * 4, 'Audio buffer (after reload)', () => LATENCY_LABEL[getTuning().audioLatency],
      (d) => setTuning({ audioLatency: cycle(LATENCY, getTuning().audioLatency, d) }));
    option(0, y0 + step * 5, 'Schedule ahead', () => `${getTuning().lookAheadSec} s`,
      (d) => setTuning({ lookAheadSec: cycle(AHEAD, getTuning().lookAheadSec, d) }));
    option(0, y0 + step * 6, 'Compressor', () => onOff(getTuning().compressor),
      () => setTuning({ compressor: !getTuning().compressor }));
    option(0, y0 + step * 7, 'Debug readout', () => onOff(getTuning().debugReadout),
      () => setTuning({ debugReadout: !getTuning().debugReadout }));

    header(1, 175, 'DISPLAY');
    option(1, y0, 'Frame rate (after reload)', () => `${getTuning().fpsCap} fps`,
      (d) => setTuning({ fpsCap: cycle(FPS, getTuning().fpsCap, d) }));
    header(1, 380, 'GAME (next race)');
    option(1, 450, 'Round length', () => `${Math.round(this.settings().roundLengthSec / 60)} min`,
      (d) => this.patchSettings({ roundLengthSec: cycleNum(ROUND_SEC, this.settings().roundLengthSec, d) }));
    option(1, 450 + step, 'Time between questions', () => `${this.settings().challengeIntervalSec} s`,
      (d) => this.patchSettings({ challengeIntervalSec: cycleNum(EVERY_SEC, this.settings().challengeIntervalSec, d) }));
    header(1, 655, 'ACTIONS');
    action(1, 725, 'Reload game', () => { try { location.reload(); } catch { /* ignore */ } });
    action(1, 725 + step, 'Reset to defaults', () => this.resetAll());
    action(1, 725 + step * 2, 'Close', () => this.close());

    c.add(bigText(this, GAME_WIDTH / 2, 1040, 'D-pad: move / change     A: select     B or Start: close', 40, MENU.dim, { stroke: 6, shadow: false }));
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
      musicVolume: d.musicVolume, sfxVolume: d.sfxVolume,
      roundLengthSec: d.roundLengthSec, challengeIntervalSec: d.challengeIntervalSec,
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
      else if (this.readout.visible) this.readout.setVisible(false);
    }
    if (this.frame % 30 === 0) this.scene.bringToTop();
  }

  private updateOpen(): void {
    const inp = services.input.any();
    if (inp.pause || inp.back) { this.toggle(); return; }
    if (inp.navY) {
      const n = Phaser.Math.Clamp(this.cursor + inp.navY, 0, this.rows.length - 1);
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
      else if (row.change) { row.change(1); services.audio.sfx('menuMove'); this.refreshRows(); }
    }
  }

  private updateReadout(time: number): void {
    if (!this.readout.visible) this.readout.setVisible(true);
    if (time - this.readoutAt < 250) return;
    this.readoutAt = time;
    const a = audioDiagnostics();
    const ms = (s: number): string => (s * 1000).toFixed(0);
    this.readout.setText([
      `FPS ${this.game.loop.actualFps.toFixed(0)}  audio ${a.state}  clock ${a.clockRatio.toFixed(2)}x  stalls ${a.stalls}`,
      `lat ${ms(a.baseLatency)}/${ms(a.outputLatency)}ms  ahead ${a.lookAhead}s  sfx ${a.activeSfx}  eng ${a.engineMode}`,
      `mode ${a.audioMode === 'prerendered' ? 'pre' : 'live'}  sfxReady ${a.sfxReady}/${a.sfxTotal}  music cached ${a.musicCached}/${a.musicTotal}${a.rendering ? '  RENDERING' : ''}`,
    ]);
  }
}
