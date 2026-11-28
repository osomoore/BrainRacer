import { describe, expect, it } from 'vitest';
import { resumeSelections } from './resume';
import { useWorkshop } from './slots';
import { normalizePlayerSave } from './save';

const profiles = new Map([['a', { id: 'a', name: 'A', createdAt: 0 }], ['b', { id: 'b', name: 'B', createdAt: 0 }]]);
const lookup = (id: string) => profiles.get(id);

describe('resumeSelections', () => {
  it('keeps order, devices and maps car to race', () => {
    const r = resumeSelections({ to: 'world', players: [
      { profileId: 'b', device: { kind: 'pad', index: 1 }, workshop: 'car' },
      { profileId: 'a', device: { kind: 'kb', layout: 1 }, workshop: 'dino' },
    ] }, lookup);
    expect(r.map((p) => [p.profile.id, p.device.kind, p.workshop])).toEqual([['b', 'pad', 'race'], ['a', 'kb', 'dino']]);
  });
  it('drops unknown profiles and duplicates, and handles null', () => {
    expect(resumeSelections(null, lookup)).toEqual([]);
    const r = resumeSelections({ to: 'world', players: [
      { profileId: 'zzz', device: { kind: 'touch' } }, { profileId: 'a', device: { kind: 'touch' } }, { profileId: 'a', device: { kind: 'kb', layout: 2 } },
    ] }, lookup);
    expect(r).toHaveLength(1);
  });
});

describe('useWorkshop', () => {
  it('switches to the matching slot or adds a live one without losing a copy', () => {
    const base = normalizePlayerSave(undefined, 'race');
    expect(useWorkshop(base, 'race')).toBe(base);
    const dino = useWorkshop(base, 'dino');
    expect(dino.using).toBe('alternate');
    expect(dino.alternate?.workshop).toBe('dino');
    expect(useWorkshop(dino, 'race').using).toBe('primary');
  });
});
