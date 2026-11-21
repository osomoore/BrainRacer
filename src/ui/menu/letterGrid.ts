/** Pure logic for the on-screen letter picker (Phaser-free). */
export type KeyKind = 'letter' | 'space' | 'delete' | 'done';
export interface PickerKey { kind: KeyKind; label: string; row: number; col: number; span: number }

export const LETTER_COLS = 7;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Rows of keys: A-Z in `cols` columns, then a bottom row SPACE / DELETE / DONE (each spanning several columns). */
export function buildKeys(cols = LETTER_COLS): PickerKey[][] {
  const rows: PickerKey[][] = [];
  for (let i = 0; i < LETTERS.length; i += cols) {
    const r = rows.length;
    rows.push([...LETTERS.slice(i, i + cols)].map((ch, c) => ({ kind: 'letter' as const, label: ch, row: r, col: c, span: 1 })));
  }
  const r = rows.length;
  const s = Math.floor(cols / 3);
  rows.push([
    { kind: 'space', label: 'SPACE', row: r, col: 0, span: s },
    { kind: 'delete', label: '⌫', row: r, col: s, span: s },
    { kind: 'done', label: 'DONE', row: r, col: 2 * s, span: cols - 2 * s },
  ]);
  return rows;
}

const wrap = (n: number, m: number) => ((n % m) + m) % m;

/** Move the cursor (row, index in row) with wrapping. Vertical moves keep the horizontal center as best as possible. */
export function moveCursor(rows: PickerKey[][], pos: { row: number; idx: number }, dx: number, dy: number): { row: number; idx: number } {
  if (dy) {
    const cur = rows[pos.row][pos.idx];
    const center = cur.col + (cur.span - 1) / 2;
    const row = wrap(pos.row + Math.sign(dy), rows.length);
    let best = 0, bd = Infinity;
    rows[row].forEach((k, i) => {
      const d = Math.abs(k.col + (k.span - 1) / 2 - center);
      if (d < bd) { bd = d; best = i; }
    });
    return { row, idx: best };
  }
  if (dx) return { row: pos.row, idx: wrap(pos.idx + Math.sign(dx), rows[pos.row].length) };
  return pos;
}

export function appendChar(value: string, ch: string, maxLen: number): string {
  if (value.length >= maxLen) return value;
  if (ch === ' ' && (value.length === 0 || value.endsWith(' '))) return value; // no leading / double spaces
  return value + ch;
}

export function deleteLast(value: string): string { return value.slice(0, -1); }

export function isValidName(value: string): boolean { return value.trim().length > 0; }
