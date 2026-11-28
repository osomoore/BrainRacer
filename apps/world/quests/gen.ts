import { Rng } from '../../workshop/core/rng';
import type { BiomeId, HexCoord, ItemId, Quest, QuestGiverSpot, QuestTargetKind, Traits } from '../core/types';
import { meets } from '../logic/rules';
import { questText, type QuestTextDetails } from './text';

export function questId(giverId: string, date: number): string {
  return `${giverId}#${date}`;
}

type NearbyItem = { item: ItemId; biome: BiomeId };

export type QuestPlace = Exclude<QuestTargetKind, 'item'> | 'hay' | 'apple';

export function questFor(
  seed: number, giver: QuestGiverSpot, giverHex: HexCoord, date: number,
  items: readonly NearbyItem[], places: ReadonlySet<QuestPlace>, traits: Traits,
): Quest | undefined {
  const id = questId(giver.id, date);
  let hash = seed;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  const rng = new Rng(hash);
  const base = { id, giverId: giver.id, giverHex: { ...giverHex }, stars: 1 };
  type Offer = { quest: Omit<Quest, 'text'>; details: QuestTextDetails };
  const offers: Offer[] = [];
  const fetches: Offer[] = [];

  const add = (type: Quest['kind'], item: ItemId, goal: Quest['goal'], kind: Exclude<QuestTextDetails['kind'], 'fetch'>) => {
    offers.push({ quest: { ...base, kind: type, item, goal }, details: { kind, item, who: giver.who } });
  };
  const target = (kind: Quest['kind'], item: ItemId, target: QuestTargetKind, phrase: Exclude<QuestTextDetails['kind'], 'fetch'>) =>
    add(kind, item, { kind: 'target', target }, phrase);
  const farmer = giver.who === 'farmer';
  if (places.has('pond') && traits.carry > 0) target('deliver', 'duck', 'pond', 'deliver');
  if (places.has('farm') && traits.carry > 0) target('deliver', 'doggy', 'farm', 'doggy');
  if (farmer && traits.carry > 0 && places.has('cowPen') && places.has('hay')) target('fetch', 'hay', 'cowPen', 'hay');
  if (farmer && places.has('bell')) target('visit', 'bell', 'bell', 'bell');
  if (giver.who === 'owl' && places.has('bear')) target('visit', 'bear', 'bear', 'bear');
  if ((farmer || giver.who === 'goat') && places.has('pathLog')) target('visit', 'log', 'pathLog', 'pathLog');
  if (giver.who === 'turtle' && places.has('frog')) target('visit', 'frog', 'frog', 'frog');
  if (farmer && places.has('apple') && traits.carry > 0) add('fetch', 'apple', { kind: 'giver' }, 'apple');
  if (places.has('pond')) target('visit', 'duck', 'pond', 'visitPond');
  for (const { item, biome } of items) {
    const needs = item === 'cactusFlower' ? [{ trait: 'reach', min: 2 }] as const : [];
    if (traits.carry <= 0 || !meets(needs, traits)) continue;
    fetches.push({
      quest: { ...base, kind: 'fetch', item, goal: { kind: 'giver' }, needs: [...needs] },
      details: { kind: 'fetch', item, fromBiome: biome, who: giver.who },
    });
  }
  if (fetches.length) offers.push(rng.pick(fetches));
  if (!offers.length) return;
  const { quest, details } = rng.pick(offers);
  return { ...quest, text: questText(rng, details) };
}
