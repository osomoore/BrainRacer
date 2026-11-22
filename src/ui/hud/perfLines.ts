import type { PerfSnapshot } from '../../core/perfProbe';

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
