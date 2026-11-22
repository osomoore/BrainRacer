/** JBQ study scope: which question numbers (Q#) a racer is studying on a given date. Pure; the date is passed in. */
import type { JbqPoints, JbqScope } from '../core/types';
import { JBQ_SCHEDULE, type JbqRange, type JbqScheduleRow } from '../data/jbqSchedule';

export interface JbqRangeInfo { from: number; to: number; label: string }

export const JBQ_LEVEL_RANGE: Record<JbqPoints, JbqRange> = { 10: [1, 288], 20: [289, 480], 30: [481, 576] };

const rangeOf = (r: JbqScheduleRow, points: JbqPoints): JbqRange => points === 10 ? r.r10 : points === 20 ? r.r20 : r.r30;
const info = (r: JbqRange): JbqRangeInfo => ({ from: r[0], to: r[1], label: `Q${r[0]}–${r[1]}` });

/** Local calendar date as "YYYY-MM-DD" (the caller supplies the Date, e.g. `new Date()`). */
export function localDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Index of the latest schedule row dated on/before `date` (the first row when the date is earlier; -1 after the last row). */
function weekIndex(date: string): number {
  if (date > JBQ_SCHEDULE[JBQ_SCHEDULE.length - 1].date) return -1;
  let idx = 0;
  JBQ_SCHEDULE.forEach((r, i) => { if (r.date <= date) idx = i; });
  return idx;
}

/** Range for a scope on a date. week = this week's row (review/meet weeks give the review range); month = the next review/meet row; all = whole level. After the schedule ends, week and month are the whole level. */
export function jbqRange(points: JbqPoints, scope: JbqScope, date: string): JbqRangeInfo {
  const all = info(JBQ_LEVEL_RANGE[points]);
  if (scope === 'all') return all;
  if (scope === 'week') {
    const i = weekIndex(date);
    return i < 0 ? all : info(rangeOf(JBQ_SCHEDULE[i], points));
  }
  const next = JBQ_SCHEDULE.find((r) => r.date >= date && r.kind !== 'week');
  return next ? info(rangeOf(next, points)) : all;
}

/** Weekly study chunks ('week' rows, deduped) in schedule order. */
export function weeklyChunks(points: JbqPoints): JbqRange[] {
  const out: JbqRange[] = [];
  for (const r of JBQ_SCHEDULE) {
    if (r.kind !== 'week') continue;
    const c = rangeOf(r, points);
    if (!out.some((o) => o[0] === c[0] && o[1] === c[1])) out.push(c);
  }
  return out;
}

/** Chunks scheduled before this date's week, most recent first (the ones that may be added back into the pool). */
export function previousChunks(points: JbqPoints, date: string): JbqRange[] {
  const chunks = weeklyChunks(points);
  const i = weekIndex(date);
  if (i < 0) return [...chunks].reverse();
  const cur = JBQ_SCHEDULE.slice(0, i + 1).reverse().find((r) => r.kind === 'week');
  if (!cur) return [];
  const at = chunks.findIndex((c) => c[0] === rangeOf(cur, points)[0]);
  return chunks.slice(0, Math.max(0, at)).reverse();
}
