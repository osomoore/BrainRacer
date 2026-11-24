/** Per-pane results hand-off for the payout and hint. */
import type { VariantId } from '../../core/types';

export interface RunOutcome {
  unlocked: VariantId[];
  payout: number;
  hint: string | null;
  firstWin: boolean;
}

const byPane = new Map<number, RunOutcome>();

export const setOutcome = (pane: number, o: RunOutcome): void => { byPane.set(pane, o); };
export const getOutcome = (pane: number): RunOutcome => byPane.get(pane) ?? { unlocked: [], payout: 0, hint: null, firstWin: false };
