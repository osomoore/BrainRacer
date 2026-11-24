/** Shop offers, prices and purchases. Pure workshop progression rules. */
import { WS_RULES } from '../config';
import type { ShopOffer } from '../core/engineApi';
import type { AspectId, VariantId, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { index } from './catalogIndex';

type ShopProgress = Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides'>;

function aspectOrder(cat: WorkshopCatalog, aspect: AspectId): VariantId[] {
  const a = cat.aspects.find((item) => item.id === aspect);
  if (!a) return [];
  const variants = index(cat).variantById;
  return [a.starters[1], ...cat.unlockOrder.filter((id) => variants.get(id)?.aspect === aspect)];
}

function cost(cat: WorkshopCatalog, p: ShopProgress, aspect: AspectId): number {
  const boughtInAspect = p.bought.filter((id) => index(cat).variantById.get(id)?.aspect === aspect).length;
  return WS_RULES.basePrice + WS_RULES.priceStep * boughtInAspect;
}

/** Prices for every currently purchasable offer, regardless of wallet balance. */
export function purchaseCosts(cat: WorkshopCatalog, p: ShopProgress): Map<VariantId, number> {
  const costs = new Map<VariantId, number>();
  for (const a of cat.aspects) for (const offer of shopOffers(cat, p, a.id)) costs.set(offer.variant, offer.price);
  return costs;
}

/** Up to the next two ordinary variants at a station; admin-open parts are omitted. */
export function shopOffers(cat: WorkshopCatalog, p: ShopProgress, aspect: AspectId): ShopOffer[] {
  const ordered = aspectOrder(cat, aspect).filter((id) => !p.bought.includes(id) && p.overrides[id] !== 'open' && p.overrides[id] !== 'locked');
  const price = cost(cat, p, aspect);
  return ordered.slice(0, WS_RULES.offersPerAspect).map((variant) => ({ variant, price, affordable: p.wallet >= price }));
}
