import { describe, expect, it } from 'vitest';
import { HANDOFF_MAX_AGE_MS, takeHandoff, writeHandoff, type HandoffStorage } from './handoff';

function mem(): HandoffStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}
const players = [
  { profileId: 'p1', device: { kind: 'kb', layout: 1 } as const, workshop: 'car' as const },
  { profileId: 'p2', device: { kind: 'pad', index: 0 } as const, workshop: 'dino' as const },
];

describe('handoff', () => {
  it('returns players in order once, then consumes', () => {
    const s = mem();
    writeHandoff({ to: 'world', players }, 1000, [s]);
    expect(takeHandoff('world', 2000, [s])?.players).toEqual(players);
    expect(takeHandoff('world', 2000, [s])).toBeNull();
  });
  it('ignores stale entries and removes them', () => {
    const s = mem();
    writeHandoff({ to: 'workshop', players }, 0, [s]);
    expect(takeHandoff('workshop', HANDOFF_MAX_AGE_MS + 1, [s])).toBeNull();
    expect(s.data.size).toBe(0);
  });
  it('leaves an entry for the other app alone', () => {
    const s = mem();
    writeHandoff({ to: 'workshop', players }, 0, [s]);
    expect(takeHandoff('world', 10, [s])).toBeNull();
    expect(takeHandoff('workshop', 10, [s])?.players).toHaveLength(2);
  });
  it('drops invalid players and survives garbage', () => {
    const s = mem();
    s.setItem('brainracer.handoff.v1', '{nope');
    expect(takeHandoff('world', 0, [s])).toBeNull();
    writeHandoff({ to: 'world', players: [{ profileId: '', device: { kind: 'touch' } }, { profileId: 'a', device: { kind: 'touch' } }] }, 0, [s]);
    expect(takeHandoff('world', 1, [s])?.players).toEqual([{ profileId: 'a', device: { kind: 'touch' } }]);
  });
  it('falls back to the next store when the first throws', () => {
    const bad: HandoffStorage = { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const s = mem();
    writeHandoff({ to: 'world', players }, 0, [bad, s]);
    expect(takeHandoff('world', 1, [bad, s])?.players).toHaveLength(2);
  });
  it('writes nothing for an empty player list', () => {
    const s = mem();
    writeHandoff({ to: 'world', players: [] }, 0, [s]);
    expect(s.data.size).toBe(0);
  });
});
