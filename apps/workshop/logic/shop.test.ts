import { describe, expect, it } from 'vitest';
import { WS_RULES } from '../config';
import { CATALOGS } from '../content';
import { newProgress, purchase } from './board';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import { priceOf, purchaseRoutes, shopOffers } from './shop';

const rich = () => ({ ...newProgress(C), wallet: 100 });

describe('fixed shop prices', () => {
  it('prices each purchasable variant by its place in its aspect shop order: 2, 3, 6', () => {
    expect(WS_RULES.basePrice).toBe(2);
    expect(WS_RULES.priceStep).toBe(3);
    expect(priceOf(C, 'wheels.mud')).toBe(2);
    expect(priceOf(C, 'wheels.racing')).toBe(3);
    expect(priceOf(C, 'wheels.snow')).toBe(6);
  });

  it('keeps a free owned starter at 0', () => {
    expect(priceOf(C, 'wheels.road')).toBe(0);
  });

  it('shows the next two unowned variants with their fixed prices', () => {
    const p = rich();
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.map((o) => [o.variant, o.price])).toEqual([['wheels.mud', 2], ['wheels.racing', 3]]);
  });

  it('includes the cheapest prerequisite purchases in a hidden variant’s route', () => {
    const p = newProgress(C);
    expect(purchaseRoutes(C, p).get('wheels.snow')).toEqual({
      variants: ['wheels.mud', 'wheels.snow'], cost: 8,
    });
    const bought = purchase(C, p, 'wheels', 'wheels.mud').progress;
    expect(purchaseRoutes(C, bought).get('wheels.snow')).toEqual({
      variants: ['wheels.snow'], cost: 6,
    });
  });

  it('skips bought variants without re-pricing the rest', () => {
    const before = Object.fromEntries(C.variants.map((v) => [v.id, priceOf(C, v.id)]));
    let p = rich();
    p = purchase(C, p, 'wheels', 'wheels.mud').progress;
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.map((o) => [o.variant, o.price])).toEqual([['wheels.racing', 3], ['wheels.snow', 6]]);
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
    const p = { ...newProgress(C), wallet: 2 };
    const offers = shopOffers(C, p, 'wheels');
    expect(offers.find((o) => o.variant === 'wheels.mud')).toMatchObject({ price: 2, affordable: true });
    expect(offers.find((o) => o.variant === 'wheels.racing')).toMatchObject({ price: 3, affordable: false });
  });
});

describe('Starter/Easy shop prices in the shipped catalogs', () => {
  it.each([
    ['race', 'springs', 'springs.lifted'], ['race', 'body', 'body.sports'],
    ['dino', 'claws', 'claws.digging'], ['dino', 'tail', 'tail.heavy'],
  ] as const)('raises %s %s prices to 6, 8, 10 ... only in Starter/Easy', (workshop, aspect, variant) => {
    const cat = CATALOGS[workshop];
    const easy = newProgress(cat, undefined, 'easy');
    const starter = newProgress(cat, undefined, 'starter');
    const medium = newProgress(cat, undefined, 'medium');
    const normalPrice = priceOf(cat, variant);
    expect(normalPrice).toBeGreaterThan(0); // legacy two-argument pricing stays normal
    const order = [cat.aspects.find((item) => item.id === aspect)!.starters[1],
      ...cat.unlockOrder.filter((id) => cat.variants.find((v) => v.id === id)?.aspect === aspect)];
    const starterPrice = WS_RULES.starterPriceStart + WS_RULES.starterPriceStep * order.indexOf(variant);
    expect(priceOf(cat, variant, easy)).toBe(starterPrice);
    expect(priceOf(cat, variant, starter)).toBe(starterPrice);
    expect(priceOf(cat, variant, medium)).toBe(normalPrice);
    const prior = order.slice(0, order.indexOf(variant)).filter((id) => id !== order[0]);
    const readyEasy = { ...easy, bought: prior };
    const readyStarter = { ...starter, bought: prior };
    const readyMedium = { ...medium, bought: prior };
    expect(shopOffers(cat, readyEasy, aspect).find((offer) => offer.variant === variant)?.price).toBe(starterPrice);
    expect(shopOffers(cat, readyStarter, aspect).find((offer) => offer.variant === variant)?.price).toBe(starterPrice);
    expect(shopOffers(cat, readyEasy, aspect).find((offer) => offer.variant === variant)?.affordable).toBe(false);
    expect(purchase(cat, readyEasy, aspect, variant).status).toBe('unaffordable');
    const exactWallet = { ...readyStarter, wallet: starterPrice };
    expect(purchase(cat, exactWallet, aspect, variant)).toMatchObject({ status: 'bought', progress: { wallet: 0 } });
    expect(purchaseRoutes(cat, easy).get(variant)?.cost).toBeGreaterThanOrEqual(starterPrice);
    expect(shopOffers(cat, readyMedium, aspect).find((offer) => offer.variant === variant)?.price).toBe(normalPrice);
  });

  it('leaves every other aspect at its normal price during Starter/Easy', () => {
    for (const workshop of ['race', 'dino'] as const) {
      const cat = CATALOGS[workshop];
      const easy = newProgress(cat, undefined, 'easy');
      const normalAspect = workshop === 'race' ? 'wheels' : 'color';
      const variant = cat.unlockOrder.find((id) => cat.variants.find((v) => v.id === id)?.aspect === normalAspect)!;
      expect(priceOf(cat, variant, easy)).toBe(3);
      const starter = cat.aspects.find((item) => item.id === normalAspect)!.starters[1];
      expect(shopOffers(cat, { ...easy, bought: [starter] }, normalAspect).find((offer) => offer.variant === variant)?.price).toBe(3);
    }
  });
});
