/**
 * Junior Bible Quiz study schedule (dates are "week of", local calendar dates: Nov-Dec 2026, Jan-Mar 2027).
 * Ranges are inclusive question numbers (Q#) per point level. 10s = Q1-288, 20s = Q289-480, 30s = Q481-576.
 */
export type JbqRange = readonly [from: number, to: number];
export type JbqWeekKind = 'week' | 'review' | 'meet';
export interface JbqScheduleRow { date: string; kind: JbqWeekKind; r10: JbqRange; r20: JbqRange; r30: JbqRange }

const row = (date: string, kind: JbqWeekKind, r10: JbqRange, r20: JbqRange, r30: JbqRange): JbqScheduleRow => ({ date, kind, r10, r20, r30 });

export const JBQ_SCHEDULE: readonly JbqScheduleRow[] = [
  row('2026-11-01', 'week',   [217, 288], [433, 480], [553, 576]),
  row('2026-11-07', 'meet',   [217, 288], [433, 480], [553, 576]),   // MEET 1
  row('2026-11-08', 'week',   [193, 216], [417, 432], [545, 552]),
  row('2026-11-15', 'week',   [169, 192], [401, 416], [537, 544]),
  row('2026-11-22', 'week',   [145, 168], [385, 400], [529, 536]),
  row('2026-11-29', 'review', [145, 288], [385, 480], [529, 576]),
  row('2026-12-05', 'meet',   [145, 288], [385, 480], [529, 576]),   // MEET 2
  row('2026-12-06', 'week',   [133, 144], [377, 384], [525, 528]),
  row('2026-12-13', 'week',   [121, 132], [369, 376], [521, 524]),
  row('2026-12-20', 'week',   [109, 120], [361, 368], [517, 520]),
  row('2026-12-27', 'review', [109, 288], [361, 480], [517, 576]),
  row('2027-01-03', 'week',   [97, 108],  [353, 360], [513, 516]),
  row('2027-01-10', 'week',   [85, 96],   [345, 352], [509, 512]),
  row('2027-01-17', 'week',   [73, 84],   [337, 344], [505, 508]),
  row('2027-01-24', 'review', [73, 288],  [337, 480], [505, 576]),
  row('2027-01-31', 'review', [73, 288],  [337, 480], [505, 576]),
  row('2027-02-06', 'meet',   [73, 288],  [337, 480], [505, 576]),   // MEET 3
  row('2027-02-07', 'week',   [49, 72],   [321, 336], [497, 504]),
  row('2027-02-14', 'week',   [25, 48],   [305, 320], [489, 496]),
  row('2027-02-21', 'week',   [1, 24],    [289, 304], [481, 488]),
  row('2027-02-28', 'review', [1, 288],   [289, 480], [481, 576]),
  row('2027-03-06', 'meet',   [1, 288],   [289, 480], [481, 576]),   // MEET 4
];
