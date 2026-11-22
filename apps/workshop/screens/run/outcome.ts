/** Hand-off from the run screen to the results screen (per pane): what the run unlocked and the hint, if any. */
import type { VariantId } from '../../core/types';

export interface RunOutcome {
  unlocked: VariantId[];
  hint: string | null;
  firstWin: boolean;
}

const byPane = new Map<number, RunOutcome>();

export const setOutcome = (pane: number, o: RunOutcome): void => { byPane.set(pane, o); };
export const getOutcome = (pane: number): RunOutcome => byPane.get(pane) ?? { unlocked: [], hint: null, firstWin: false };
