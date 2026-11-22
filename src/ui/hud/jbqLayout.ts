/**
 * Pure (Phaser-free) text-fit math for the JBQ question panel: a question card on top, then four full-width answer
 * rows (slot 0..3 top to bottom). Text is measured by the caller (callbacks), so this module is unit-testable.
 */
import { HUD } from './hudConfig';

export interface JbqFonts { answerMax: number; answerMin: number; answerHard: number; questionMax: number; questionMin: number; questionHard: number }

export interface DiamondIconGeom {
  /** Button centres relative to the icon centre, in ANSWER_POSITIONS order (left, top, right, bottom). */
  centers: [number, number][];
  big: number; small: number; ring: number;
}

/** Geometry of the mini button diamond shown on each answer row (a `size` x `size` square). */
export function diamondIconGeom(size: number): DiamondIconGeom {
  // Spread out like a pad's face buttons: the unlit ones are big enough to read the diamond shape, the lit one bigger still.
  const d = size * 0.29, big = size * 0.19, ring = size * 0.035;
  return { centers: [[-d, 0], [0, -d], [d, 0], [0, d]], big, small: size * 0.12, ring };
}

export interface JbqGeomIn { areaW: number; areaH: number; quad: boolean; badge: boolean }

export interface JbqGeom {
  areaW: number; areaH: number;
  pad: number; dividerGap: number; rowGap: number; rowPadY: number; rowPadX: number; qPadY: number;
  badgeSize: number;
  /** Row / question card widths and the wrap widths of the text inside them. */
  rowW: number; qW: number; qTextW: number; aTextW: number;
  /** Left edge (from the row's left) of the answer text (after the badge). */
  textLeft: number;
  minRowH: number;
  /** Height shared by the question card and the answer rows. */
  availH: number;
  fonts: JbqFonts;
}

export interface JbqPlan {
  fa: number; fq: number; qH: number;
  rowH: number[]; rowTop: number[];   // rowTop: from the panel's top edge
  /** True when everything fits at or above the hard font floors without cutting text. */
  ok: boolean;
  /** Per row: the text still does not fit at the floor and must be ellipsized into rowH. */
  truncate: boolean[];
}

export function jbqGeometry(i: JbqGeomIn): JbqGeom {
  const c = HUD.jbq;
  const { pad, dividerGap, rowGap, rowPadY, rowPadX, qPadY } = i.quad ? c.quadPad : c;
  const badgeSize = i.quad ? c.quadBadge : c.badge;
  const rowW = i.areaW - 2 * pad;
  const textLeft = rowPadX + (i.badge ? badgeSize + 14 : 0);
  return {
    areaW: i.areaW, areaH: i.areaH, pad, dividerGap, rowGap, rowPadY, rowPadX, qPadY, badgeSize,
    rowW, qW: rowW, qTextW: rowW - 2 * c.qSideInset, aTextW: rowW - textLeft - rowPadX, textLeft,
    minRowH: badgeSize + 8,
    availH: i.areaH - 2 * pad - dividerGap - 3 * rowGap,
    fonts: i.quad ? c.fontQuad : c.font,
  };
}

/** Largest integer in [min, max] where `fits` holds (assumes fits is monotone: true for small, false for big); min if none. */
export function largestFit(fits: (px: number) => boolean, min: number, max: number): number {
  if (!fits(min)) return min;
  let lo = min, hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Longest word-prefix of `text` (plus an ellipsis) accepted by `fits`; the text itself if it already fits. */
export function ellipsize(text: string, fits: (s: string) => boolean): string {
  if (fits(text)) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const cut = (n: number) => `${words.slice(0, n).join(' ')}…`;
  let lo = 0, hi = words.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(cut(mid))) lo = mid; else hi = mid - 1;
  }
  return cut(lo);
}

export function planJbq(
  g: JbqGeom, nRows: number, measureQ: (px: number) => number, measureA: (row: number, px: number) => number,
): JbqPlan {
  const f = g.fonts;
  const rows = Array.from({ length: nRows }, (_, i) => i);
  const needs = (fa: number) => rows.map((i) => Math.max(g.minRowH, measureA(i, fa) + 2 * g.rowPadY));
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const qNeed = (fq: number) => measureQ(fq) + 2 * g.qPadY;
  const fitsAt = (fa: number, fqLow: number) => sum(needs(fa)) + qNeed(fqLow) <= g.availH;

  // The question stays readable: answers shrink to their hard floor before the question drops below questionMin.
  let fa = f.answerMin, qLow = f.questionMin, ok = true;
  if (fitsAt(f.answerMin, f.questionMin)) {
    fa = largestFit((p) => fitsAt(p, f.questionMin), f.answerMin, f.answerMax);
  } else if (fitsAt(f.answerHard, f.questionMin)) {
    fa = largestFit((p) => fitsAt(p, f.questionMin), f.answerHard, f.answerMin);
  } else if (fitsAt(f.answerHard, f.questionHard)) {
    qLow = f.questionHard;
    fa = largestFit((p) => fitsAt(p, f.questionHard), f.answerHard, f.answerMin);
  } else {
    fa = f.answerHard; qLow = f.questionHard; ok = false;
  }

  const n = needs(fa);
  let qH: number, fq: number, rowH: number[];
  if (ok) {
    const remaining = g.availH - sum(n);
    fq = largestFit((p) => qNeed(p) <= remaining, qLow, f.questionMax);
    qH = qNeed(fq);
    const leftover = Math.max(0, remaining - qH);
    qH += leftover * HUD.jbq.questionShare;
    rowH = n.map((h) => h + (leftover * (1 - HUD.jbq.questionShare)) / nRows);
  } else {
    // Answers get cut anyway: keep the question at questionMin when it takes at most a third of the height.
    fq = qNeed(f.questionMin) <= g.availH * 0.34 ? f.questionMin : f.questionHard;
    qH = Math.min(qNeed(fq), g.availH * 0.34);
    rowH = waterFill(n, g.availH - qH, g.minRowH);
  }
  const truncate = rowH.map((h, i) => h < n[i] - 1);
  const rowTop: number[] = [];
  let y = g.pad + qH + g.dividerGap;
  for (const h of rowH) { rowTop.push(y); y += h + g.rowGap; }
  return { fa, fq, qH, rowH, rowTop, ok, truncate };
}

/** Split `total` over rows wanting `needs`: rows that need less than their fair share keep what they need, the rest share the remainder. */
export function waterFill(needs: number[], total: number, minH: number): number[] {
  const out = needs.map(() => 0);
  let open = needs.map((_, i) => i), left = total;
  while (open.length) {
    const fair = left / open.length;
    const small = open.filter((i) => needs[i] <= fair);
    if (!small.length) { for (const i of open) out[i] = Math.max(minH, fair); break; }
    for (const i of small) { out[i] = needs[i]; left -= needs[i]; }
    open = open.filter((i) => !small.includes(i));
  }
  return out;
}
