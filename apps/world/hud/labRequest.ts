import type { CardEvent } from './cards';

type PlayerIndex = 0 | 1;
export type LabRequest = { requester: PlayerIndex; offered: boolean } | null;
type LabEvent =
  | { type: 'request' | 'ready'; player: PlayerIndex }
  | { type: 'answer'; player: PlayerIndex; input: CardEvent };

export function stepLabRequest(state: LabRequest, event: LabEvent): {
  state: LabRequest; action?: { requester: PlayerIndex; approved: boolean };
} {
  if (!state) {
    return { state: event.type === 'request' ? { requester: event.player, offered: false } : null };
  }
  if (event.player === state.requester || event.type === 'request') return { state };
  if (event.type === 'ready') return { state: { ...state, offered: true } };
  if (event.type !== 'answer' || !state.offered) return { state };

  const { input } = event;
  const yes = (input.type === 'press' && input.button === 'a') || (input.type === 'tap' && input.target === 'yes');
  const no = (input.type === 'press' && input.button === 'b') || (input.type === 'tap' && input.target === 'no');
  if (yes || no) return { state: null, action: { requester: state.requester, approved: yes } };
  return { state };
}
