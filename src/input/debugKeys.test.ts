import { describe, expect, it } from 'vitest';
import { DEBUG_KEYS } from '../config/gameConfig';
import { debugActionFor, debugKeysEnabled, nextCar } from './debugKeys';

describe('debugKeys', () => {
  it('is gated on ?debug=1', () => {
    expect(debugKeysEnabled('?race=1&debug=1')).toBe(true);
    expect(debugKeysEnabled('?race=1')).toBe(false);
    expect(debugKeysEnabled('?debug=0')).toBe(false);
  });
  it('maps configured keys to actions', () => {
    expect(debugActionFor(DEBUG_KEYS.cycleCar)).toBe('cycleCar');
    expect(debugActionFor(DEBUG_KEYS.boss)).toBe('boss');
    expect(debugActionFor(DEBUG_KEYS.laser)).toBe('laser');
    expect(debugActionFor('KeyW')).toBeNull();
  });
  it('cycles cars with wrap', () => {
    expect(nextCar('dino', ['dino', 'kart'])).toBe('kart');
    expect(nextCar('kart', ['dino', 'kart'])).toBe('dino');
  });
});
