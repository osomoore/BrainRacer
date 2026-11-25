/** Per-pane results hand-off for the payout and hint. */
export interface RunOutcome {
  payout: number;
  hint: string | null;
  failLines: string[];
}

const byPane = new Map<number, RunOutcome>();

export const setOutcome = (pane: number, o: RunOutcome): void => { byPane.set(pane, o); };
export const getOutcome = (pane: number): RunOutcome => byPane.get(pane) ?? { payout: 0, hint: null, failLines: [] };
