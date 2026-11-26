/** Shop offers, prices and purchases. Pure workshop progression rules. */
import { WS_RULES, WS_STARTER_PRICE_ASPECTS } from '../config';
import type { ShopOffer } from '../core/engineApi';
import type { AspectId, VariantId, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { visibleAspectIds } from './aspects';
import { index } from './catalogIndex';

type ShopProgress = Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides' | 'easy'>;

function aspectOrder(cat: WorkshopCatalog, aspect: AspectId): VariantId[] {
  const a = cat.aspects.find((item) => item.id === aspect);
  if (!a) return [];
  const variants = index(cat).variantById;
  return [a.starters[1], ...cat.unlockOrder.filter((id) => variants.get(id)?.aspect === aspect)];
}

/** Fixed price of a variant: basePrice for index 0, then priceStep x index (2, 3, 6, 9, 12 ...). Owned starters are free (0). */
export function priceOf(cat: WorkshopCatalog, variant: VariantId, progress?: Pick<WorkshopProgress, 'easy'>): number {
  const aspect = index(cat).variantById.get(variant)?.aspect;
  if (!aspect) return 0;
  const i = aspectOrder(cat, aspect).indexOf(variant);
  if (i < 0) return 0;
  const starterAspects = WS_STARTER_PRICE_ASPECTS[cat.id] ?? [];
  if (progress?.easy && starterAspects.includes(aspect)) return WS_RULES.starterPriceStart + WS_RULES.starterPriceStep * i;
  return i === 0 ? WS_RULES.basePrice : WS_RULES.priceStep * i;
}

function unownedOrder(cat: WorkshopCatalog, p: ShopProgress, aspect: AspectId): VariantId[] {
  return aspectOrder(cat, aspect).filter((id) => !p.bought.includes(id) && p.overrides[id] !== 'open' && p.overrides[id] !== 'locked');
}

/** Cheapest purchases that reveal and buy each unowned variant, including later offers. */
export function purchaseRoutes(cat: WorkshopCatalog, p: ShopProgress) {
  const routes = new Map<VariantId, { variants: VariantId[]; cost: number }>();
  for (const id of visibleAspectIds(cat, p)) {
    const ordered = unownedOrder(cat, p, id);
    const prices = ordered.map((variant) => priceOf(cat, variant, p));
    let revealCost = 0;
    ordered.forEach((variant, i) => {
      const count = Math.max(0, i - WS_RULES.offersPerAspect + 1);
      if (count) revealCost += prices[count - 1];
      routes.set(variant, { variants: [...ordered.slice(0, count), variant], cost: revealCost + prices[i] });
    });
  }
  return routes;
}

/** Up to the next two ordinary variants at a station; admin-open parts are omitted. */
export function shopOffers(cat: WorkshopCatalog, p: ShopProgress, aspect: AspectId): ShopOffer[] {
  if (!visibleAspectIds(cat, p).includes(aspect)) return [];
  const ordered = unownedOrder(cat, p, aspect);
  return ordered.slice(0, WS_RULES.offersPerAspect).map((variant) => {
    const price = priceOf(cat, variant, p);
    return { variant, price, affordable: p.wallet >= price };
  });
}
