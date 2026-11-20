import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS } from '../config/collectibles';
import { availableLoadouts, developerModeSettings, drawUnlock, nextMap, parseUnlocks, RACE_MAPS, selectedLoadout } from './progression';
import { Rng } from './rng';
import type { PlayerSettings } from './types';

describe('map progression', () => {
  it('picks each other map and never repeats the map that finished', () => {
    for (const current of RACE_MAPS) {
      const rng = new Rng(31);
      const maps = new Set(Array.from({ length: 80 }, () => nextMap(current, rng)));
      expect(maps).toEqual(new Set(RACE_MAPS.filter(map => map !== current)));
    }
  });

  it('keeps valid unlock IDs and draws items once from the catalog', () => {
    expect(UNLOCK_VEHICLE_IDS).toHaveLength(20);
    expect(UNLOCK_GUIDE_IDS).toHaveLength(5);
    expect(parseUnlocks(['motorbike', null, 'motorbike', 'missing', 'owl'])).toEqual(['motorbike', 'owl']);
    const rng = new Rng(5);
    const locked = COLLECTIBLES.at(-1)!;
    expect(drawUnlock(COLLECTIBLES.slice(0, -1), rng)).toBe(locked);
    expect(drawUnlock(COLLECTIBLES, rng)).toBeUndefined();
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
