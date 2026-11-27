import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addStars, claim, loadPlayerSave, normalizePlayerSave, readingOf, savePlayerSave } from './save';
import { defaultSlots, resolveSlot, swapSlots, takeCopy } from './slots';
import { hashWorldCode, worldSeed } from './seed';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key), clear: () => values.clear() };
};
const storage = memoryStorage();
beforeEach(() => { storage.clear(); vi.stubGlobal('localStorage', storage); });
afterEach(() => vi.unstubAllGlobals());

describe('world saves', () => {
  it('repairs junk and caps claimed ids', () => {
    const save = normalizePlayerSave({ version: 99, stars: -5, claimed: Array.from({ length: 510 }, (_, i) => String(i)),
      quests: [null, { carrying: false, quest: { id: 'partial' } }] });
    expect(save.stars).toBe(0);
    expect(save.claimed).toHaveLength(500);
    expect(save.claimed[0]).toBe('10');
    expect(save.quests).toEqual([]);
  });
  it('creates and persists saves and only awards a claim once', () => {
    expect(loadPlayerSave('kid').stars).toBe(0);
    addStars('kid', 3);
    expect(loadPlayerSave('kid').stars).toBe(3);
    savePlayerSave('kid', { ...loadPlayerSave('kid'), stars: 8 });
    claim('kid', '1,2:a0', 3);
    claim('kid', '1,2:a0', 3);
    expect(loadPlayerSave('kid')).toMatchObject({ stars: 11, claimed: ['1,2:a0'] });
  });
  it('reads Workshop reading level with Easy fallback', () => {
    storage.setItem('workshop.players.v1', JSON.stringify({ a: { version: 2, reading: 'hard', workshops: {} } }));
    expect(readingOf('a')).toBe('hard');
    expect(readingOf('missing')).toBe('easy');
  });
});

describe('world slots', () => {
  it('starts with live race and dino slots and swaps the active slot', () => {
    const save = { version: 1 as const, stars: 0, ...defaultSlots('dino'), claimed: [], quests: [], questSeq: {} };
    expect(save.primary).toEqual({ source: 'live', workshop: 'dino' });
    expect(swapSlots(save).using).toBe('alternate');
  });
  it('resolves missing live builds to defaults and freezes a copy', () => {
    const save = { version: 1 as const, stars: 0, ...defaultSlots(), claimed: [], quests: [], questSeq: {} };
    const creation = resolveSlot('absent', save.primary);
    expect(creation.model).toHaveProperty('wheels');
    expect(takeCopy('absent', save).primary).toMatchObject({ source: 'copy', workshop: 'race' });
  });
  it('follows Workshop edits in a live slot and keeps the frozen build', () => {
    const save = loadPlayerSave('builder');
    const storeModel = (wheels: string) => storage.setItem('workshop.players.v1', JSON.stringify({
      builder: { version: 2, reading: 'easy', lastWorkshop: 'race', workshops: { race: { model: { wheels } } } },
    }));
    storeModel('wheels.mud');
    const copy = takeCopy('builder', save);
    storeModel('wheels.road');
    expect(resolveSlot('builder', save.primary).model.wheels).toBe('wheels.road');
    expect(resolveSlot('builder', copy.primary).model.wheels).toBe('wheels.mud');
  });
});

describe('world seed', () => {
  it('uses the family code across devices and honors the URL override first', () => {
    const family = { code: 'ONE-TWO-THREE-FOUR' };
    storage.setItem('hub.familySync.v1', JSON.stringify(family));
    storage.setItem('hub.worldSeed.v1', '1');
    const seed = worldSeed();
    storage.setItem('hub.worldSeed.v1', '2');
    expect(worldSeed()).toBe(seed);
    expect(seed).toBe(hashWorldCode(' one-two-three-four '));
    vi.stubGlobal('location', { search: '?seed=42' });
    expect(worldSeed()).toBe(42);
  });
  it('persists one seed on the device', () => {
    vi.stubGlobal('location', { search: '' });
    const first = worldSeed();
    expect(worldSeed()).toBe(first);
    expect(storage.getItem('hub.worldSeed.v1')).toBe(String(first));
  });
});
