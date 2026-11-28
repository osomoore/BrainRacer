import { describe, expect, it } from 'vitest';
import { ACTIVITY_KINDS, ITEM_IDS } from '../core/types';
import { interactionDisplayName, itemDisplayName } from './interactionNames';

describe('interaction names', () => {
  it('uses the same readable item names for the pulse and the carry chip', () => {
    for (const id of ITEM_IDS) {
      const name = itemDisplayName(id);
      expect(name).toMatch(/^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/);
      expect(interactionDisplayName({ kind: 'item', id })).toBe(name);
    }
    expect(itemDisplayName('egg')).toBe('Egg');
    expect(itemDisplayName('pinecone')).toBe('Pine Cone');
  });

  it('names props and givers without exposing internal ids', () => {
    expect(interactionDisplayName({ kind: 'obstacle', id: 'iceBlock' })).toBe('Ice Block');
    expect(interactionDisplayName({ kind: 'obstacle', id: 'appleTree' })).toBe('Apple Tree');
    expect(interactionDisplayName({ kind: 'errand', id: 'cowPen' })).toBe('Cow Pen');
    expect(interactionDisplayName({ kind: 'errand', id: 'bear' })).toBe('Sleepy Bear');
    expect(interactionDisplayName({ kind: 'giver', id: 'farmer' })).toBe('Farmer');
    expect(interactionDisplayName({ kind: 'giver', id: 'constructor' })).toBe('Friend');
  });

  it('gives each activity a distinct readable name', () => {
    const names = ACTIVITY_KINDS.map(id => interactionDisplayName({ kind: 'activity', id }));
    expect(names.every(name => /^[A-Z][a-z]+(?: [a-zA-Z][a-z]+)+$/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(ACTIVITY_KINDS.length);
  });
});
