import { describe, expect, it } from 'vitest';
import { applyKey, firstRow, moveRow, scrollTop, type AdminRow, type ListState } from './adminModel';

const opts = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
let ran = 0;
const rows: AdminRow[] = [
  { kind: 'section', label: 'S' },
  { kind: 'value', label: 'v', options: opts, value: 'b', set: () => {} },
  { kind: 'note', label: 'n' },
  { kind: 'action', label: 'go', run: () => { ran++; } },
];
const st = (o: Partial<ListState> = {}): ListState => ({ focus: 1, editing: false, draft: 0, ...o });

describe('moveRow', () => {
  it('skips sections and notes and wraps', () => {
    expect(firstRow(rows)).toBe(1);
    expect(moveRow(rows, 1, 1)).toBe(3);
    expect(moveRow(rows, 3, 1)).toBe(1);
    expect(moveRow(rows, 1, -1)).toBe(3);
  });
});

describe('applyKey', () => {
  it('left / right do nothing unless editing', () => {
    expect(applyKey(rows, st(), 'right').state).toEqual(st());
  });
  it('confirm starts editing on the current option, left / right cycle, confirm commits', () => {
    let r = applyKey(rows, st(), 'confirm');
    expect(r.state).toEqual(st({ editing: true, draft: 1 }));
    r = applyKey(rows, r.state, 'right');
    expect(r.state.draft).toBe(2);
    r = applyKey(rows, r.state, 'right');
    expect(r.state.draft).toBe(0);
    r = applyKey(rows, r.state, 'confirm');
    expect(r.commit).toEqual({ row: 1, id: 'a' });
    expect(r.state.editing).toBe(false);
  });
  it('up / down are ignored while editing; back cancels the edit without leaving', () => {
    const e = st({ editing: true, draft: 1 });
    expect(applyKey(rows, e, 'down').state).toEqual(e);
    const r = applyKey(rows, e, 'back');
    expect(r.leave).toBe(false);
    expect(r.state.editing).toBe(false);
    expect(r.commit).toBeUndefined();
  });
  it('back outside editing leaves, confirm on an action runs it', () => {
    expect(applyKey(rows, st(), 'back').leave).toBe(true);
    expect(applyKey(rows, st({ focus: 3 }), 'confirm').run).toBe(3);
    expect(ran).toBe(0);
  });
});

describe('scrollTop', () => {
  it('keeps the focus in the window', () => {
    expect(scrollTop(0, 0, 5, 20)).toBe(0);
    expect(scrollTop(7, 0, 5, 20)).toBe(3);
    expect(scrollTop(2, 3, 5, 20)).toBe(2);
    expect(scrollTop(19, 0, 5, 20)).toBe(15);
  });
});
