import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../content';
import { WORKSHOP_IDS } from '../../core/types';
import { engine } from '../../logic';
import { cardStatuses } from './cardStatus';

describe.each(WORKSHOP_IDS)('card status badges: %s', (id) => {
  it('a fresh board shows owned, buyable and locked in board order (Ready, Affordable, Future)', () => {
    const p = engine.refreshBoard(id, engine.newProgress(id));
    const s = cardStatuses(CATALOGS[id], p);
    expect(p.active.map((cid) => s.of(p.challenges[cid]))).toEqual(['owned', 'buyable', 'locked']);
  });
  it('with no coins, nothing that needs a purchase is buyable', () => {
    const p = { ...engine.refreshBoard(id, engine.newProgress(id)), wallet: 0 };
    const s = cardStatuses(CATALOGS[id], p);
    expect(p.active.map((cid) => s.of(p.challenges[cid]))).toEqual(['owned', 'locked', 'locked']);
  });
});
