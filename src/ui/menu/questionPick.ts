/** Phaser-free rules for the Join screen's QUESTIONS rows (Math / Reading / JBQ chips, JBQ points and scope). */
import type { JbqPoints, JbqScope, JbqSettings, QuestionTypes } from '../../core/types';
import { jbqRange, jbqToday } from '../../challenge/jbqScope';
import { toggleQuestionType } from './newRacerLogic';

export const ROW_RACER = 0, ROW_CAR = 1, ROW_GUIDE = 2, ROW_QUESTIONS = 3, ROW_POINTS = 4, ROW_SCOPE = 5;

export const CHIP_KEYS = ['math', 'reading', 'jbq'] as const satisfies readonly (keyof QuestionTypes)[];
export const CHIP_LABEL: Record<(typeof CHIP_KEYS)[number], string> = { math: 'Math', reading: 'Reading', jbq: 'JBQ' };

export const JBQ_POINTS: readonly JbqPoints[] = [10, 20, 30];
export const JBQ_SCOPES: readonly JbqScope[] = ['week', 'month', 'all'];
const SCOPE_LABEL: Record<JbqScope, string> = { week: 'Week', month: 'Month', all: 'All' };

/** Rows in navigation order (top to bottom); the JBQ rows only exist while JBQ is on. */
export function rowOrder(jbqOn: boolean): number[] {
  return jbqOn
    ? [ROW_RACER, ROW_QUESTIONS, ROW_POINTS, ROW_SCOPE, ROW_CAR, ROW_GUIDE]
    : [ROW_RACER, ROW_QUESTIONS, ROW_CAR, ROW_GUIDE];
}

/** Next row up/down (wraps), skipping hidden rows. A cursor on a hidden row counts as the Questions row. */
export function moveRow(cur: number, dir: 1 | -1, jbqOn: boolean): number {
  const order = rowOrder(jbqOn);
  const i = order.indexOf(cur);
  const from = i < 0 ? order.indexOf(ROW_QUESTIONS) : i;
  return order[(from + dir + order.length) % order.length];
}

/** A cursor that sits on a hidden JBQ row (JBQ was just turned off) goes back to the Questions row. */
export const visibleRow = (cur: number, jbqOn: boolean): number => (rowOrder(jbqOn).includes(cur) ? cur : ROW_QUESTIONS);

/** Left/right moves the focused chip (wraps). */
export const moveChip = (chip: number, dir: 1 | -1): number => (chip + dir + CHIP_KEYS.length) % CHIP_KEYS.length;

/** Toggles chip `chip`; the last chip that is on can't be turned off (unchanged object returned). */
export const toggleChip = (types: QuestionTypes, chip: number): QuestionTypes => toggleQuestionType(types, CHIP_KEYS[chip]);

function cycle<T>(list: readonly T[], v: T, dir: 1 | -1): T {
  const i = list.indexOf(v);
  return list[((i < 0 ? 0 : i) + dir + list.length) % list.length];
}
export const cyclePoints = (p: JbqPoints, dir: 1 | -1): JbqPoints => cycle(JBQ_POINTS, p, dir);
export const cycleScope = (s: JbqScope, dir: 1 | -1): JbqScope => cycle(JBQ_SCOPES, s, dir);

export const jbqPointsLabel = (points: JbqPoints): string => `${points} pts`;

/**
 * Text of the scope row. One place to change: later this can show the actual question range
 * (e.g. "Week · Q145–168") for the chosen points level.
 */
/** Scope plus the question numbers it covers on `date`, e.g. "Week 145–168". */
export function jbqScopeLabel(points: JbqPoints, scope: JbqScope, date: string = jbqToday()): string {
  const r = jbqRange(points, scope, date);
  return `${SCOPE_LABEL[scope]} ${r.from}–${r.to}`;
}

/** Applies one left/right change on a JBQ row. */
export function changeJbq(j: JbqSettings, row: number, dir: 1 | -1): JbqSettings {
  if (row === ROW_POINTS) return { ...j, points: cyclePoints(j.points, dir) };
  if (row === ROW_SCOPE) return { ...j, scope: cycleScope(j.scope, dir) };
  return j;
}
