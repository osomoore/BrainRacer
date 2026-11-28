import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addStars, claim, loadPlayerSave, normalizePlayerSave, readingOf, savePlayerSave } from './save';
import { activeCreation, swapCreation } from './slots';
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

describe('world creations', () => {
  it('starts with the last Workshop and swaps in both directions', () => {
    const save = normalizePlayerSave(undefined, 'dino');
    expect(save.using).toBe('dino');
    expect(swapCreation(save.using)).toBe('race');
    expect(swapCreation('race')).toBe('dino');
  });
  it('uses the default builds when no Workshop save exists', () => {
    expect(activeCreation('absent', normalizePlayerSave(null)).model).toHaveProperty('wheels');
    expect(activeCreation('absent', normalizePlayerSave(null, 'dino')).model).toHaveProperty('legs');
  });
  it('loads the live build even when the old slot held a copy', () => {
    const storeModel = (wheels: string) => storage.setItem('workshop.players.v1', JSON.stringify({
      builder: { version: 2, reading: 'easy', lastWorkshop: 'race', workshops: { race: { model: { wheels } } } },
    }));
    storage.setItem('world.players.v1', JSON.stringify({ builder: {
      version: 1, using: 'alternate', primary: { source: 'live', workshop: 'dino' },
      alternate: { source: 'copy', workshop: 'race', model: { wheels: 'wheels.mud' } },
      stars: 4, claimed: ['a'], questSeq: { owl: 2 }, last: { x: 10, y: 20, angle: 0 },
    } }));
    storeModel('wheels.road');
    const save = loadPlayerSave('builder');
    expect(save).toEqual({ version: 1, using: 'race', stars: 4, claimed: ['a'], quests: [], questSeq: { owl: 2 },
      last: { x: 10, y: 20, angle: 0 } });
    expect(JSON.parse(storage.getItem('world.players.v1')!).builder).toEqual(save);
    expect(activeCreation('builder', save).model.wheels).toBe('wheels.road');
    storeModel('wheels.mud');
    expect(activeCreation('builder', save).model.wheels).toBe('wheels.mud');
  });
  it('handles a missing alternate and saves the current live selection across loads', () => {
    expect(normalizePlayerSave({ using: 'alternate', primary: { source: 'live', workshop: 'dino' }, alternate: null }).using).toBe('dino');
    const save = savePlayerSave('driver', { ...loadPlayerSave('driver'), using: 'dino' });
    expect(loadPlayerSave('driver')).toEqual(save);
    expect(activeCreation('driver', save).workshop).toBe('dino');
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
