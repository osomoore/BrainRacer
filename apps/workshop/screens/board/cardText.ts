/**
 * Pure (Phaser-free) challenge text layout: which sentences to show at a reading level, word-wrapping with an
 * injected measure function, and picking the largest font size that fits the box (else paginating at the smallest).
 */
import type { Challenge, ReadingLevel } from '../../core/types';

export interface TextBlock {
  kind: 'intro' | 'req';
  text: string;
  /** 0-based stage index for a requirement. */
  stage: number;
}

/** Intro sentence followed by every requirement sentence (all stages, in order) at the reading level. */
export function buildBlocks(c: Challenge, level: ReadingLevel): TextBlock[] {
  const out: TextBlock[] = [];
  if (c.intro[level]) out.push({ kind: 'intro', text: c.intro[level], stage: 0 });
  c.stages.forEach((st, si) => st.requirements.forEach((r) => out.push({ kind: 'req', text: r.text[level], stage: si })));
  return out;
}

export type Measure = (text: string, size: number) => number;

/** Greedy word wrap; a single word wider than the line stays on its own line. */
export function wrapLines(text: string, maxW: number, size: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next, size) > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export interface PlacedBlock { block: TextBlock; lines: string[]; y: number; h: number }
export interface DetailPlan { size: number; pages: PlacedBlock[][]; overflow: boolean }

export interface PlanOpts {
  /** Text width for an intro line; requirements are narrower by `indent`. */
  maxW: number;
  indent: number;
  boxH: number;
  /** Font sizes to try, largest first. */
  sizes: readonly number[];
  lineGap: number;
  blockGap: number;
  measure: Measure;
}

function layoutAt(blocks: readonly TextBlock[], size: number, o: PlanOpts): PlacedBlock[] {
  return blocks.map((b) => {
    const lines = wrapLines(b.text, b.kind === 'req' ? o.maxW - o.indent : o.maxW, size, o.measure);
    return { block: b, lines, y: 0, h: Math.ceil(lines.length * size * o.lineGap) };
  });
}

function stack(items: PlacedBlock[], gap: number): number {
  let y = 0;
  for (const it of items) { it.y = y; y += it.h + gap; }
  return Math.max(0, y - gap);
}

/** Largest size whose whole text fits `boxH` on one page; otherwise the smallest size split into pages by block. */
export function planDetail(blocks: readonly TextBlock[], o: PlanOpts): DetailPlan {
  for (const size of o.sizes) {
    const items = layoutAt(blocks, size, o);
    if (stack(items, o.blockGap) <= o.boxH) return { size, pages: [items], overflow: false };
  }
  const size = o.sizes[o.sizes.length - 1];
  const items = layoutAt(blocks, size, o);
  const pages: PlacedBlock[][] = [];
  let page: PlacedBlock[] = [];
  let used = 0;
  for (const it of items) {
    const need = it.h + (page.length ? o.blockGap : 0);
    if (page.length && used + need > o.boxH) { pages.push(page); page = []; used = 0; }
    used += it.h + (page.length ? o.blockGap : 0);
    page.push(it);
  }
  if (page.length) pages.push(page);
  pages.forEach((p) => stack(p, o.blockGap));
  return { size, pages, overflow: pages.some((p) => p.some((b) => b.h > o.boxH)) };
}
