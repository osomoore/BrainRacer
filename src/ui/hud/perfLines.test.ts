import { describe, expect, it } from 'vitest';
import { clockText, perfBoxLines, worstHeader, worstRows } from './perfLines';

const worst = { atSec: 83, snap: { fps: 12, lowFps: 8, frameMs: 83, sections: [{ name: 'render', ms: 40 }, { name: 'sys:Traffic', ms: 12.34 }] } };

describe('perfLines helpers', () => {
  it('formats the worst header and rows', () => {
    expect(clockText(83)).toBe("1:23");
    expect(worstHeader(worst)).toBe('WORST @ 1:23 — 12 FPS (low 8)');
    expect(worstRows(worst, 3)).toHaveLength(2);
    expect(worstRows(worst, 3)[1]).toContain('Traffic');
  });
  it('builds the performance box only when frames were recorded', () => {
    expect(perfBoxLines({ fps: 0, lowFps: 0, frames: 0 }, null)).toEqual([]);
    expect(perfBoxLines({ fps: 55, lowFps: 30, frames: 100 }, worst, 5)).toHaveLength(5 + 2);
  });
});
