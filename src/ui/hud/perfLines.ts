import type { PerfSnapshot, RaceStats, WorstWindow } from '../../core/perfProbe';

/** Format a perf snapshot as the overlay's text lines (pure; unit-tested). */
export function perfLines(snap: PerfSnapshot, rows: number): string[] {
  const lines = [
    `FPS ${snap.fps.toFixed(0)}  low ${snap.lowFps.toFixed(0)}`,
    `frame ${snap.frameMs.toFixed(1)} ms`,
  ];
  for (const s of snap.sections.slice(0, rows)) {
    const name = s.name.startsWith('sys:') ? s.name.slice(4) : s.name;
    lines.push(`${name.slice(0, 12).padEnd(12)} ${s.ms.toFixed(2).padStart(5)}`);
  }
  return lines;
}

const sectionName = (n: string): string => (n.startsWith('sys:') ? n.slice(4) : n);

/** m:ss for a race time in seconds. */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "WORST @ 1:23 — 12 FPS (low 8)" */
export function worstHeader(w: WorstWindow): string {
  return `WORST @ ${clockText(w.atSec)} — ${w.snap.fps.toFixed(0)} FPS (low ${w.snap.lowFps.toFixed(0)})`;
}

/** Top `n` sections of the worst window, ms per frame. */
export function worstRows(w: WorstWindow, n: number, pad = 12): string[] {
  return w.snap.sections.slice(0, n).map(s => `${sectionName(s.name).slice(0, pad).padEnd(pad)} ${s.ms.toFixed(1).padStart(5)} ms`);
}

/** Lines for the pause / results "Performance" box (empty when nothing was recorded). */
export function perfBoxLines(stats: RaceStats, worst: WorstWindow | null, rows = 5): string[] {
  if (!stats.frames) return [];
  const lines = ['PERFORMANCE', `Average ${stats.fps.toFixed(0)} FPS`, `1% low  ${stats.lowFps.toFixed(0)} FPS`];
  if (worst) {
    lines.push(`Worst @ ${clockText(worst.atSec)}`, `${worst.snap.fps.toFixed(0)} FPS (low ${worst.snap.lowFps.toFixed(0)})`);
    lines.push(...worstRows(worst, rows, 9));
  }
  return lines;
}
