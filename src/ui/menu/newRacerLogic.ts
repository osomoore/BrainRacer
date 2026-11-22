/** Phaser-free helpers for the Setup "New Profile" flow. */
import type { Difficulty, QuestionTypes, RacerProfileId } from '../../core/types';

export type RacerChoice = RacerProfileId | 'new';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];

/** Racers a player can cycle through: existing racers minus the other player's (when it is a real racer), then New Profile. */
export function racerChoices(ids: readonly RacerProfileId[], other: RacerProfileId | readonly RacerProfileId[] | undefined, canNew: boolean): RacerChoice[] {
  const taken: readonly RacerProfileId[] = other === undefined ? [] : typeof other === 'string' ? [other] : other;
  const list: RacerChoice[] = ids.filter((r) => !taken.includes(r));
  if (canNew) list.push('new');
  return list;
}

/** Next/previous entry with wrap-around; an unknown current value goes to the first entry. */
export function cycleChoice<T>(list: readonly T[], cur: T, dir: 1 | -1): T {
  const i = list.indexOf(cur);
  if (i < 0) return list[0];
  return list[(i + dir + list.length) % list.length];
}

/** Flips one question type, but never turns the last one off. */
export function toggleQuestionType(q: QuestionTypes, key: keyof QuestionTypes): QuestionTypes {
  const next = { ...q, [key]: !q[key] };
  return next.addition || next.multiplication || next.spelling ? next : q;
}

export const nameTaken = (name: string, existing: readonly string[]): boolean =>
  existing.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

export const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy ★', easyPlus: 'Easy+ ★½', normal: 'Normal ★★', hard: 'Hard ★★★' };
export const DIFF_EXAMPLE: Record<Difficulty, string> = { easy: '3 + 4', easyPlus: '8 + 7', normal: '14 + 5', hard: '38 + 47' };
export const QUESTION_LABEL: Record<keyof QuestionTypes, string> = { addition: 'Addition', multiplication: 'Multiplication', spelling: 'Spelling' };
