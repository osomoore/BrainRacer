import { describe, expect, it } from 'vitest';
import type { CardEvent } from './cards';
import { stepLabRequest, type LabRequest } from './labRequest';

const request = (player: 0 | 1) => stepLabRequest(null, { type: 'request', player }).state;
const ready = (state: LabRequest, player: 0 | 1) => stepLabRequest(state, { type: 'ready', player }).state;
const answer = (state: LabRequest, player: 0 | 1, input: CardEvent) =>
  stepLabRequest(state, { type: 'answer', player, input });
const yes = { type: 'press', button: 'a' } as const;

describe('two-player Lab confirmation', () => {
  it('keeps the first request and ignores answers until the other view is ready', () => {
    const pending = request(0);
    expect(pending).toEqual({ requester: 0, offered: false });
    expect(stepLabRequest(pending, { type: 'request', player: 1 }).state).toBe(pending);
    expect(ready(pending, 0)).toBe(pending);
    expect(answer(pending, 1, yes)).toEqual({ state: pending });
    expect(ready(pending, 1)).toEqual({ requester: 0, offered: true });
  });

  it.each([
    [0, 1, yes, true],
    [1, 0, { type: 'tap', target: 'yes' }, true],
    [1, 0, { type: 'press', button: 'b' }, false],
    [0, 1, { type: 'tap', target: 'no' }, false],
  ] as const)('resolves a request from %i only with a yes/no from %i', (requester, other, input, approved) => {
    const offered = ready(request(requester), other);
    expect(answer(offered, requester, input)).toEqual({ state: offered });
    expect(answer(offered, other, { type: 'press', button: 'y' })).toEqual({ state: offered });
    expect(answer(offered, other, input)).toEqual({ state: null, action: { requester, approved } });
    expect(answer(null, other, input)).toEqual({ state: null });
  });
});
