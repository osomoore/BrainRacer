import { Rng } from '../../workshop/core/rng';
import type { BiomeId, HexCoord, ItemId, Quest, QuestGiverSpot, Traits } from '../core/types';
import { meets } from '../logic/rules';
import { questText, type QuestTextDetails } from './text';

export function questId(giverId: string, date: number): string {
  return `${giverId}#${date}`;
}

type NearbyItem = { item: ItemId; biome: BiomeId };

export function questFor(
  seed: number, giver: QuestGiverSpot, giverHex: HexCoord, date: number,
  items: readonly NearbyItem[], hasPond: boolean, traits: Traits,
): Quest | undefined {
  const id = questId(giver.id, date);
  let hash = seed;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  const rng = new Rng(hash);
  const base = { id, giverId: giver.id, giverHex: { ...giverHex }, stars: 1 };
  type Offer = { quest: Omit<Quest, 'text'>; details: QuestTextDetails };
  const visits: Offer[] = [];
  const fetches: Offer[] = [];
  const deliveries: Offer[] = [];

  if (hasPond) {
    visits.push({
      quest: { ...base, kind: 'visit', item: 'duck', goal: { kind: 'target', target: 'pond' } },
      details: { kind: 'visitPond', item: 'duck', who: giver.who },
    });
    deliveries.push({
      quest: { ...base, kind: 'deliver', item: 'duck', goal: { kind: 'target', target: 'pond' } },
      details: { kind: 'deliver', item: 'duck', who: giver.who },
    });
  }
  for (const { item, biome } of items) {
    visits.push({
      quest: { ...base, kind: 'visit', item, goal: { kind: 'target', target: 'item' } },
      details: { kind: 'visitItem', item, who: giver.who },
    });
    const needs = item === 'cactusFlower' ? [{ trait: 'reach', min: 2 }] as const : [];
    if (!meets(needs, traits)) continue;
    fetches.push({
      quest: { ...base, kind: 'fetch', item, fromBiome: biome, goal: { kind: 'giver' }, needs: [...needs] },
      details: { kind: 'fetch', item, fromBiome: biome, who: giver.who },
    });
  }
  const available = [visits, fetches, deliveries].filter(offers => offers.length > 0);
  if (!available.length) return;
  const { quest, details } = rng.pick(rng.pick(available));
  return { ...quest, text: questText(rng, details) };
}
