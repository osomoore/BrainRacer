/** How long the correct answer stays up after a wrong answer (pure; shared by BreakScheduler setup and the HUD). */
import { CHALLENGE } from '../config/gameConfig';
import type { ChallengeKind } from '../core/types';

export function wrongRevealSecFor(kind: ChallengeKind): number {
  return kind === 'jbq' ? CHALLENGE.jbqWrongRevealSec : CHALLENGE.wrongRevealSec;
}
