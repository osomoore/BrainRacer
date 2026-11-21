import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, WORLD_GUIDES, WORLD_VEHICLES } from '../config/collectibles';
import { QUEUED_MAPS } from '../config/queuedMaps';
import { developerModeSettings, parseUnlocks, rewardsSinceBuddy, selectedLoadout } from './progression';
import type { PlayerSettings } from './types';

describe('progression helpers', () => {
  it('keeps valid unlock IDs', () => {
    expect(UNLOCK_VEHICLE_IDS).toHaveLength(59);
    expect(UNLOCK_GUIDE_IDS).toHaveLength(16);
    expect(parseUnlocks(['motorbike', null, 'motorbike', 'missing', 'owl'])).toEqual(['motorbike', 'owl']);
    expect(parseUnlocks(['comet', 'bombBuddy'])).toEqual(['bombBuddy']);
  });

  it('counts rewards since the last companion', () => {
    expect(rewardsSinceBuddy(['motorbike', 'owl'])).toBe(0);
    expect(rewardsSinceBuddy(['owl', 'motorbike', 'pickup'])).toBe(2);
  });

  it('includes the themed cars and companions in the reward catalog', () => {
    for (const map of QUEUED_MAPS) expect(WORLD_VEHICLES[map]).toHaveLength(3);
    expect(WORLD_GUIDES).toHaveLength(11);
    for (const item of [...Object.values(WORLD_VEHICLES).flat(), ...WORLD_GUIDES]) expect(COLLECTIBLES).toContain(item);
  });

  it('uses a separate checkout of each loadout and restores the player-mode time', () => {
    const player: PlayerSettings = {
      device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal',
      car: 'pickup', guide: 'star', devCar: 'motorbike', devGuide: 'owl',
    };
    const starters = { cars: ['dino', 'kart'] as const, guides: ['dino', 'star'] as const };
    expect(selectedLoadout(player, 0, false, { cars: ['dino', 'kart', 'pickup'], guides: starters.guides })).toEqual({ car: 'pickup', guide: 'star' });
    expect(selectedLoadout(player, 0, true, { cars: ['dino', 'motorbike'], guides: ['dino', 'owl'] })).toEqual({ car: 'motorbike', guide: 'owl' });
    expect(selectedLoadout(player, 0, false, starters)).toEqual({ car: 'dino', guide: 'star' });
    expect(developerModeSettings(true)).toEqual({ developerMode: true, roundLengthSec: 60 });
    expect(developerModeSettings(false)).toEqual({ developerMode: false, roundLengthSec: 300 });
  });
});
