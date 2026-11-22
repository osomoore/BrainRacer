/** Race-time JBQ rules (pure). The saved profile is never changed; these only shape one race. */
import type { JbqSettings, QuestionTypes } from '../core/types';
import { jbqAllowed } from './jbqScope';

/** Question types a player actually gets in a race with `playerCount` players. JBQ drops out when its level isn't allowed; if nothing is left, Math + Reading. */
export function raceQuestionTypes(types: QuestionTypes, jbq: JbqSettings, playerCount: number): QuestionTypes {
  if (!types.jbq || jbqAllowed(jbq.points, playerCount)) return types;
  const next = { ...types, jbq: false };
  return next.math || next.reading ? next : { math: true, reading: true, jbq: false };
}
