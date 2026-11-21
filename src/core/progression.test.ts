import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, WORLD_GUIDES, WORLD_VEHICLES } from '../config/collectibles';
import { QUEUED_MAPS } from '../config/queuedMaps';
import { availableLoadouts, availableMaps, awardMapCompletion, BUDDY_EVERY_REWARDS, developerModeSettings, drawUnlock, loadUnlocks, nextMap, parseUnlocks, RACE_MAPS, selectedLoadout, setContentOverride } from './progression';
import { Rng } from './rng';
import type { PlayerSettings, RaceMap } from './types';

describe('map progression', () => {
  beforeEach(() => {
    const store = new Map([['brainracer.content.v1', '{}'], ['brainracer.unlocks.v1', '["owl"]']]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts on City and unlocks successors after three completed objectives', () => {
    const rng = new Rng(31);
    expect(availableMaps(false)).toEqual(['city']);
    expect(awardMapCompletion('city', 2, false, rng)).toEqual({});
    expect(awardMapCompletion('industrial', 3, false, rng)).toEqual({});
    expect(awardMapCompletion('city', 3, true, rng)).toEqual({});
    expect(loadUnlocks()).toEqual(['owl']);
    expect(nextMap('city', false)).toBe('city');
    expect(awardMapCompletion('city', 3, false, rng)).toMatchObject({ world: 'industrial' });
    expect(nextMap('city', false)).toBe('industrial');
    expect(awardMapCompletion('city', 3, false, rng).world).toBeUndefined();
    expect(awardMapCompletion('industrial', 3, false, rng).world).toBe('harbor');
    expect(availableMaps(true)).toEqual(RACE_MAPS);
  });

  it('applies persistent admin overrides without erasing earned progress', () => {
    setContentOverride('industrial', false);
    setContentOverride('harbor', true);
    setContentOverride('owl', false);
    setContentOverride('bombBuddy', true);
    const result = awardMapCompletion('city', 3, false, new Rng(10));
    expect(result.world).toBeUndefined();
    expect(result.rewardPool).not.toContain('bombBuddy');
    expect(availableMaps(false)).toEqual(['city', 'harbor']);
    expect(availableLoadouts(loadUnlocks(), false).guides).toEqual(['dino', 'star', 'bombBuddy']);
    expect(availableLoadouts(loadUnlocks(), true).guides).toContain('owl');
    setContentOverride('industrial', undefined);
    setContentOverride('owl', undefined);
    expect(availableMaps(false)).toEqual(['city', 'industrial', 'harbor']);
    expect(availableLoadouts(loadUnlocks(), false).guides).toContain('owl');
  });

  it('guarantees a companion at least every three completion rewards', () => {
    const store = new Map([['brainracer.content.v1', '{}'], ['brainracer.unlocks.v1', JSON.stringify([UNLOCK_VEHICLE_IDS[0]])]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value) });
    for (let seed = 0; seed < COLLECTIBLES.length; seed++) awardMapCompletion('city', 3, false, new Rng(seed));
    const order = loadUnlocks();
    let run = 0;
    for (const id of order) {
      run = (UNLOCK_GUIDE_IDS as readonly string[]).includes(id) ? 0 : run + 1;
      // only while companions remain locked can the guarantee hold
      if (UNLOCK_GUIDE_IDS.some(g => !order.slice(0, order.indexOf(id) + 1).includes(g))) expect(run).toBeLessThan(BUDDY_EVERY_REWARDS);
    }
    expect(UNLOCK_GUIDE_IDS.every(g => order.includes(g))).toBe(true);
  });

  it('keeps valid unlock IDs and draws items once from the catalog', () => {
    expect(UNLOCK_VEHICLE_IDS).toHaveLength(59);
    expect(UNLOCK_GUIDE_IDS).toHaveLength(16);
    expect(parseUnlocks(['motorbike', null, 'motorbike', 'missing', 'owl'])).toEqual(['motorbike', 'owl']);
    expect(parseUnlocks(['comet', 'bombBuddy'])).toEqual(['bombBuddy']);
    const rng = new Rng(5);
    const locked = COLLECTIBLES.at(-1)!;
    expect(drawUnlock(COLLECTIBLES.slice(0, -1), rng)).toBe(locked);
    expect(drawUnlock(COLLECTIBLES, rng)).toBeUndefined();
  });

  it('includes the themed cars and companions in the shared reward pool', () => {
    for (const map of QUEUED_MAPS) expect(WORLD_VEHICLES[map]).toHaveLength(3);
    expect(WORLD_GUIDES).toHaveLength(11);
    for (const item of [...Object.values(WORLD_VEHICLES).flat(), ...WORLD_GUIDES]) {
      expect(drawUnlock(COLLECTIBLES.filter(id => id !== item), new Rng(2))).toBe(item);
    }
  });

  it('extends the campaign from Underwater through the eight new worlds', () => {
    const rng = new Rng(419);
    setContentOverride('underwater', true);
    let previous: RaceMap = 'underwater';
    for (const map of QUEUED_MAPS) {
      expect(awardMapCompletion(previous, 3, false, rng).world).toBe(map);
      expect(nextMap(previous, false)).toBe(map);
      previous = map;
    }
    expect(awardMapCompletion(previous, 3, false, rng).world).toBeUndefined();
  });

  it('uses a separate checkout of each loadout and restores the player-mode time', () => {
    const player: PlayerSettings = {
      device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal',
      car: 'pickup', guide: 'star', devCar: 'motorbike', devGuide: 'owl',
    };
    expect(selectedLoadout(player, 0, false, availableLoadouts(['pickup'], false))).toEqual({ car: 'pickup', guide: 'star' });
    expect(selectedLoadout(player, 0, true, availableLoadouts([], true))).toEqual({ car: 'motorbike', guide: 'owl' });
    expect(selectedLoadout(player, 0, false, availableLoadouts([], false))).toEqual({ car: 'dino', guide: 'star' });
    expect(developerModeSettings(true)).toEqual({ developerMode: true, roundLengthSec: 60 });
    expect(developerModeSettings(false)).toEqual({ developerMode: false, roundLengthSec: 300 });
  });
});
