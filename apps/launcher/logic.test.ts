import { describe, expect, it } from 'vitest';
import { moveSelection, shouldForward } from './logic';

describe('launcher logic', () => {
  it('moves and clamps', () => {
    expect(moveSelection(0, 'right', 2)).toBe(1);
    expect(moveSelection(1, 'right', 2)).toBe(1);
    expect(moveSelection(1, 'left', 2)).toBe(0);
    expect(moveSelection(0, 'left', 2)).toBe(0);
    expect(moveSelection(0, 'up', 2)).toBe(0);
    expect(moveSelection(5, 'confirm', 2)).toBe(1);
  });
  it('forwards only when there is a query', () => {
    expect(shouldForward('')).toBe(false);
    expect(shouldForward('?')).toBe(false);
    expect(shouldForward('?race=1&seed=3')).toBe(true);
  });
});
