import { describe, expect, it } from 'vitest';
import { waitForRelease } from './releaseGate';

describe('waitForRelease', () => {
  it('does not forward a held Back press after an overlay closes', () => {
    expect(waitForRelease(true, true)).toEqual({ waiting: true, ignore: true });
    expect(waitForRelease(true, false)).toEqual({ waiting: false, ignore: true });
    expect(waitForRelease(false, false)).toEqual({ waiting: false, ignore: false });
  });
});
