/**
 * Pure model of the grown-up admin list (no Phaser, tested).
 * One column of rows. Up / down moves in visual order over the focusable rows (sections and notes are skipped).
 * A on a value row starts editing, left / right change the value ONLY while editing, A again finishes, B cancels.
 */
export interface AdminOption { id: string; label: string }

export type AdminRow =
  | { kind: 'section'; label: string }
  | { kind: 'note'; label: string }
  | { kind: 'action'; label: string; run: () => void; tag?: string }
  | { kind: 'value'; label: string; options: readonly AdminOption[]; value: string; set: (id: string) => void; tag?: string };

export const focusable = (r: AdminRow | undefined): boolean => !!r && (r.kind === 'action' || r.kind === 'value');

/** Next focusable row index in visual order (wraps), or `current` when there is none. */
export function moveRow(rows: readonly AdminRow[], current: number, dir: 1 | -1): number {
  const n = rows.length;
  for (let step = 1; step <= n; step++) {
    const i = (((current + dir * step) % n) + n) % n;
    if (focusable(rows[i])) return i;
  }
  return current;
}

export function firstRow(rows: readonly AdminRow[]): number {
  return Math.max(0, rows.findIndex(focusable));
}

/** Option index of `value` (0 when unknown). */
export function optionIndex(options: readonly AdminOption[], value: string): number {
  return Math.max(0, options.findIndex((o) => o.id === value));
}

/** Cycles an option index with wrap. */
export function cycleOption(count: number, index: number, dir: 1 | -1): number {
  return (((index + dir) % count) + count) % count;
}

/** Keeps `focus` inside the window of `visible` rows starting at `top`; returns the new top. */
export function scrollTop(focus: number, top: number, visible: number, total: number): number {
  let t = top;
  if (focus < t) t = focus;
  if (focus >= t + visible) t = focus - visible + 1;
  return Math.max(0, Math.min(t, Math.max(0, total - visible)));
}

export interface ListState { focus: number; editing: boolean; draft: number }

export type ListKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/**
 * Applies one key. Returns the new state plus `leave` (B outside editing = go back / close) and `commit`
 * ({row, optionId} when a value edit finished with A).
 */
export function applyKey(rows: readonly AdminRow[], s: ListState, key: ListKey): { state: ListState; leave: boolean; commit?: { row: number; id: string }; run?: number } {
  const row = rows[s.focus];
  if (s.editing && row?.kind === 'value') {
    if (key === 'left' || key === 'right') return { state: { ...s, draft: cycleOption(row.options.length, s.draft, key === 'left' ? -1 : 1) }, leave: false };
    if (key === 'confirm') return { state: { ...s, editing: false }, leave: false, commit: { row: s.focus, id: row.options[s.draft].id } };
    if (key === 'back') return { state: { ...s, editing: false }, leave: false };
    return { state: s, leave: false }; // up / down ignored while editing
  }
  if (key === 'up' || key === 'down') return { state: { ...s, focus: moveRow(rows, s.focus, key === 'up' ? -1 : 1) }, leave: false };
  if (key === 'back') return { state: s, leave: true };
  if (key === 'confirm') {
    if (row?.kind === 'value') return { state: { ...s, editing: true, draft: optionIndex(row.options, row.value) }, leave: false };
    if (row?.kind === 'action') return { state: s, leave: false, run: s.focus };
  }
  return { state: s, leave: false }; // left / right do nothing unless editing
}
