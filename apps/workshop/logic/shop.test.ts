import { describe, expect, it } from 'vitest';
import { WS_RULES } from '../config';
import { newProgress, purchase } from './board';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import { priceOf, shopOffers } from './shop';

const rich = () => ({ ...newProgress(C), wallet: 100 });

describe('fixed shop prices', () => {
  it('prices each purchasable variant by its place in its aspect shop order: 2, 4, 6', () => {
    expect(WS_RULES.basePrice).toBe(2);
    expect(WS_RULES.priceStep).toBe(2);
    expect(priceOf(C, 'wheels.mud')).toBe(2);
    expect(priceOf(C, 'wheels.racing')).toBe(4);
    expect(priceOf(C, 'wheels.snow')).toBe(6);
  });

  it('keeps a free owned starter at 0', () => {
    expect(priceOf(C, 'wheels.road')).toBe(0);
  });

  it('shows the next two unowned variants with their fixed prices', () => {
    const p = rich();
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.map((o) => [o.variant, o.price])).toEqual([['wheels.mud', 2], ['wheels.racing', 4]]);
  });

  it('skips bought variants without re-pricing the rest', () => {
    const before = Object.fromEntries(C.variants.map((v) => [v.id, priceOf(C, v.id)]));
    let p = rich();
    p = purchase(C, p, 'wheels', 'wheels.mud').progress;
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.map((o) => [o.variant, o.price])).toEqual([['wheels.racing', 4], ['wheels.snow', 6]]);
    for (const v of C.variants) expect(priceOf(C, v.id)).toBe(before[v.id]);
  });

  it('never changes any price when a purchase is made in any aspect', () => {
    const before = Object.fromEntries(C.variants.map((v) => [v.id, priceOf(C, v.id)]));
    let p = rich();
    for (const offer of shopOffers(C, p, 'paint')) {
      p = purchase(C, p, 'paint', offer.variant).progress;
      for (const v of C.variants) expect(priceOf(C, v.id)).toBe(before[v.id]);
    }
    for (const o of shopOffers(C, p, 'paint')) expect(o.price).toBe(before[o.variant]);
  });

  it('marks offers affordable from the wallet balance', () => {
    const p = { ...newProgress(C), wallet: 3 };
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.find((o) => o.variant === 'wheels.mud')).toMatchObject({ price: 2, affordable: true });
    expect(offers.find((o) => o.variant === 'wheels.racing')).toMatchObject({ price: 4, affordable: false });
  });
});
