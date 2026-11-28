import { describe, expect, it } from 'vitest';
import { normalizePlayerSave } from '../logic/save';
import { buddyOffer, buyBuddy, chooseBuddy, ownedBuddies } from './ownership';

const spot = { id: '-1,2:buddy', at: { x: 9, y: 10 } };

describe('World buddy purchases', () => {
  it('keeps a stable offer per profile and charges each kid once', () => {
    const first = normalizePlayerSave({ stars: 20 });
    const second = normalizePlayerSave({ stars: 10 });
    const one = buddyOffer(29, spot, 'world-quick-1', first)!;
    const two = buddyOffer(29, spot, 'world-quick-2', second)!;
    expect(one).toBeDefined();
    expect(two).toBeDefined();
    expect(one).not.toBe(two);
    expect(buddyOffer(29, spot, 'world-quick-1', normalizePlayerSave(null))).toBe(one);
    expect(buyBuddy(29, spot, 'world-quick-1', first)).toBe('bought');
    expect(buyBuddy(29, spot, 'world-quick-1', first)).toBe('claimed');
    expect(buddyOffer(29, spot, 'world-quick-1', first)).toBeUndefined();
    expect(buddyOffer(30, spot, 'world-quick-1', first)).toBeDefined();
    expect(second.stars).toBe(10);
    expect(buyBuddy(29, spot, 'world-quick-2', second)).toBe('bought');
    expect(first.stars).toBe(10);
    expect(second.stars).toBe(0);
    expect(ownedBuddies(first)).toEqual([one]);
    expect(ownedBuddies(second)).toEqual([two]);
  });

  it('leaves the offer and the balance intact when short', () => {
    const save = normalizePlayerSave({ stars: 9 });
    expect(buyBuddy(29, spot, 'kid', save)).toBe('short');
    expect(buddyOffer(29, spot, 'kid', save)).toBeDefined();
    expect(save.stars).toBe(9);
    expect(save.buddies).toBeUndefined();
  });

  it('loads a saved choice, lists each owned kind once, and validates None', () => {
    const save = normalizePlayerSave({ stars: 7, buddies: {
      purchases: { '29:1,2:buddy': 'star', '29:-1,2:buddy': 'star', '29:2,2:buddy': 'missing', bad: 'dino' },
      following: 'dino',
    } });
    expect(ownedBuddies(save)).toEqual(['star']);
    expect(save.buddies?.following).toBeUndefined();
    expect(chooseBuddy(save, 'dino')).toBe(false);
    expect(chooseBuddy(save, 'star')).toBe(true);
    const reloaded = normalizePlayerSave(JSON.parse(JSON.stringify(save)));
    expect(reloaded.stars).toBe(7);
    expect(reloaded.buddies?.following).toBe('star');
    expect(Object.keys(reloaded.buddies!.purchases)).toHaveLength(2);
    expect(chooseBuddy(reloaded, undefined)).toBe(true);
    expect(reloaded.buddies?.following).toBeUndefined();
  });
});
