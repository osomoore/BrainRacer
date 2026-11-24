import type { RigAnim } from '../../core/runtime';

export type BuddyReaction = 'follow' | 'lead' | 'push' | 'search' | 'celebrate' | 'shrug';

export interface BuddyCues {
  leading: boolean;
  searching: boolean;
  slowed: boolean;
  anim?: RigAnim;
  passed: boolean;
  ended: boolean;
}

export function buddyReaction(cues: BuddyCues): BuddyReaction {
  if (cues.ended) return cues.passed ? 'celebrate' : 'shrug';
  if (!cues.passed && cues.anim === 'dizzy') return 'shrug';
  if (cues.passed && cues.anim === 'celebrate') return 'celebrate';
  if (cues.searching) return 'search';
  if (cues.anim === 'spinWheels' || cues.slowed) return 'push';
  return cues.leading ? 'lead' : 'follow';
}
