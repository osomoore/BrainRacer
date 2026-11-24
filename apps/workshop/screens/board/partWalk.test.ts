import { describe, expect, it } from 'vitest';
import { stepPart } from './partWalk';

describe('part walk', () => {
  it('wraps both directions through catalog parts', () => {
    const order = ['body', 'wheels', 'paint'];
    expect(stepPart('body', order, -1)).toBe('paint');
    expect(stepPart('paint', order, 1)).toBe('body');
  });

  it('starts at the directional end and handles empty orders', () => {
    expect(stepPart(undefined, ['body', 'wheels'], 1)).toBe('body');
    expect(stepPart(undefined, ['body', 'wheels'], -1)).toBe('wheels');
    expect(stepPart(undefined, [], 1)).toBeUndefined();
  });
});
