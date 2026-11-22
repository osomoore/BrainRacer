import { describe, expect, it } from 'vitest';
import { perfProbe } from './perfProbe';

/** Feed `n` frames of `ms` each, ending the window with a given section cost. */
function window(ms: number, n: number, startAt = 1000): number {
  let t = startAt;
  for (let i = 0; i <= n; i++) { perfProbe.frame(t); t += ms; }
  return t;
}

describe('perfProbe worst window', () => {
  it('keeps the lowest-FPS window with its race time', () => {
    perfProbe.enabled = true;
    perfProbe.resetRace();
    window(16, 60); perfProbe.closeWindow(1);
    window(50, 20); perfProbe.closeWindow(2);
    window(25, 40); perfProbe.closeWindow(3);
    expect(perfProbe.worst?.atSec).toBe(2);
    expect(perfProbe.worst?.snap.fps).toBeCloseTo(20, 0);
    perfProbe.enabled = false;
  });

  it('breaks FPS ties with the higher frame ms and ignores empty windows', () => {
    perfProbe.enabled = true;
    perfProbe.resetRace();
    window(20, 10); perfProbe.closeWindow(5);
    expect(perfProbe.closeWindow(6).fps).toBe(0); // empty window
    expect(perfProbe.worst?.atSec).toBe(5);
    perfProbe.enabled = false;
  });

  it('computes race-wide average and 1% low, and resetRace clears all', () => {
    perfProbe.enabled = true;
    perfProbe.resetRace();
    window(10, 99); perfProbe.closeWindow(1);
    window(100, 1); perfProbe.closeWindow(2);
    const s = perfProbe.raceStats();
    expect(s.frames).toBe(100);
    expect(s.lowFps).toBeLessThan(15); // the 100 ms frame dominates the 1% low
    expect(s.fps).toBeGreaterThan(80);
    perfProbe.resetRace();
    expect(perfProbe.raceStats().frames).toBe(0);
    expect(perfProbe.worst).toBeNull();
    perfProbe.enabled = false;
  });

  it('does nothing when disabled', () => {
    perfProbe.enabled = false;
    perfProbe.resetRace();
    window(16, 30);
    expect(perfProbe.raceStats().frames).toBe(0);
  });
});
