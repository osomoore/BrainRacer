/**
 * Lightweight in-race profiling (orchestrator-owned contract). Phaser-free.
 *
 * Off by default: every call is a single boolean check, so leaving the hooks in costs nothing.
 * Turned on by the admin "Perf overlay" setting (DeviceTuning.perfHud); RaceScene sets `enabled`.
 *
 * RaceScene times: 'cars' (player car updates), each system by name ('sys:<name>'), 'physics' (Matter step),
 * 'render' (whole Phaser render), and the full frame. The HUD overlay reads snapshot() a few times a second.
 */

const WINDOW = 120; // frames kept for averages / 1% low

const MAX_RACE_FRAME_MS = 2000; // longer gaps are pauses, not frames
const MAX_RACE_FRAMES = 200_000; // memory cap (~55 min at 60 fps)

interface Section { total: number; frames: number; start: number }

class PerfProbe {
  enabled = false;
  private sections = new Map<string, Section>();
  private frameMs: number[] = [];
  private lastFrameAt = 0;
  private worstWindow: WorstWindow | null = null;
  private raceMs: number[] = [];

  /** Call once at the start of each game frame. */
  frame(nowMs: number): void {
    if (!this.enabled) return;
    if (this.lastFrameAt > 0) {
      const dt = nowMs - this.lastFrameAt;
      this.frameMs.push(dt);
      if (this.frameMs.length > WINDOW) this.frameMs.shift();
      if (dt < MAX_RACE_FRAME_MS && this.raceMs.length < MAX_RACE_FRAMES) this.raceMs.push(dt); // skip pause gaps
    }
    this.lastFrameAt = nowMs;
  }

  begin(name: string): void {
    if (!this.enabled) return;
    let s = this.sections.get(name);
    if (!s) { s = { total: 0, frames: 0, start: 0 }; this.sections.set(name, s); }
    s.start = performance.now();
  }

  end(name: string): void {
    if (!this.enabled) return;
    const s = this.sections.get(name);
    if (!s || s.start === 0) return;
    s.total += performance.now() - s.start;
    s.frames++;
    s.start = 0;
  }

  /** Averages over the recent window; sections sorted by cost, ms per frame. */
  snapshot(): PerfSnapshot {
    const f = this.frameMs;
    const avgMs = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
    const sorted = [...f].sort((a, b) => b - a);
    const worst = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 100)));
    const lowMs = worst.length ? worst.reduce((a, b) => a + b, 0) / worst.length : 0;
    const sections = [...this.sections.entries()]
      .map(([name, s]) => ({ name, ms: s.total / Math.max(1, s.frames) }))
      .sort((a, b) => b.ms - a.ms);
    return { fps: avgMs ? 1000 / avgMs : 0, lowFps: lowMs ? 1000 / lowMs : 0, frameMs: avgMs, sections };
  }

  /** Start a fresh window (call after reading a snapshot, e.g. every ~2 s, and on race start). */
  reset(): void {
    this.sections.clear();
    this.frameMs = [];
    this.lastFrameAt = 0;
  }

  /**
   * Close the current ~1 s window: returns its snapshot, remembers it if it is the worst of the race
   * (lowest FPS; ties go to the higher frame ms), then starts a fresh window. Empty windows (no frames,
   * e.g. while paused) are never recorded.
   */
  closeWindow(elapsedSec: number): PerfSnapshot {
    const snap = this.snapshot();
    const hadFrames = this.frameMs.length > 0;
    this.reset();
    if (hadFrames) {
      const w = this.worstWindow;
      if (!w || snap.fps < w.snap.fps || (snap.fps === w.snap.fps && snap.frameMs > w.snap.frameMs)) {
        this.worstWindow = { atSec: elapsedSec, snap };
      }
    }
    return snap;
  }

  /** The worst closed window this race, or null if none yet. */
  get worst(): WorstWindow | null { return this.worstWindow; }

  /** Race-wide average FPS and 1% low over every recorded frame (frames = 0 when nothing recorded). */
  raceStats(): RaceStats {
    const f = this.raceMs;
    if (!f.length) return { fps: 0, lowFps: 0, frames: 0 };
    let sum = 0;
    for (const v of f) sum += v;
    const sorted = [...f].sort((a, b) => b - a);
    const worst = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 100)));
    const lowMs = worst.reduce((a, b) => a + b, 0) / worst.length;
    return { fps: 1000 / (sum / f.length), lowFps: 1000 / lowMs, frames: f.length };
  }

  /** Clear the window AND all race-wide records (call at race start). */
  resetRace(): void {
    this.reset();
    this.worstWindow = null;
    this.raceMs = [];
  }
}

export interface WorstWindow {
  /** Race time (seconds) at which the window closed. */
  atSec: number;
  snap: PerfSnapshot;
}

export interface RaceStats {
  fps: number;
  lowFps: number;
  frames: number;
}

export interface PerfSnapshot {
  fps: number;
  /** FPS of the worst 1% of frames in the window. */
  lowFps: number;
  frameMs: number;
  sections: { name: string; ms: number }[];
}

export const perfProbe = new PerfProbe();
