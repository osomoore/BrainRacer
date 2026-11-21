import { COLLECTIBLES, UNLOCK_GUIDE_IDS, type Collectible } from '../config/collectibles';
import { DEFAULT_SETTINGS, DEVELOPER_ROUND_SEC } from '../config/gameConfig';
import { QUEUED_MAP_LABEL, QUEUED_MAPS } from '../config/queuedMaps';
import type { CarKind, GuideKind, PlayerSettings, RaceMap, Settings, StarterCar } from './types';

export const RACE_MAPS: readonly RaceMap[] = ['city', 'industrial', 'harbor', 'underground', 'farm', 'sky', 'forest', 'underwater', ...QUEUED_MAPS];
export const MAP_LABEL: Record<RaceMap, string> = {
  city: 'City', industrial: 'Factory', harbor: 'Beach', underground: 'Mine', farm: 'Farm',
  sky: 'Sky City', forest: 'Dark Forest', underwater: 'Underwater',
  ...QUEUED_MAP_LABEL,
};
export const COMPLETION_OBJECTIVES = 3;
/** A companion (buddy) is guaranteed at least once every this many completion rewards, while any are left. */
export const BUDDY_EVERY_REWARDS = 3;

const STARTER_CARS: readonly StarterCar[] = ['dino', 'kart'];

export function defaultRoundLength(developerMode: boolean): number {
  return developerMode ? DEVELOPER_ROUND_SEC : DEFAULT_SETTINGS.roundLengthSec;
}

export function developerModeSettings(developerMode: boolean): Partial<Settings> {
  return { developerMode, roundLengthSec: defaultRoundLength(developerMode) };
}

/** Valid, de-duplicated unlock IDs in the order they were earned (legacy 'comet' = bombBuddy). */
export function parseUnlocks(raw: unknown): Collectible[] {
  if (!Array.isArray(raw)) return [];
  const out: Collectible[] = [];
  for (const v of raw) {
    const id = v === 'comet' ? 'bombBuddy' : v;
    if ((COLLECTIBLES as readonly unknown[]).includes(id) && !out.includes(id as Collectible)) out.push(id as Collectible);
  }
  return out;
}

const isGuide = (id: Collectible): boolean => (UNLOCK_GUIDE_IDS as readonly Collectible[]).includes(id);

/** Unlocks are stored in the order they were earned: count the trailing non-companion rewards. */
export function rewardsSinceBuddy(unlocked: readonly Collectible[]): number {
  let n = 0;
  for (let i = unlocked.length - 1; i >= 0 && !isGuide(unlocked[i]); i--) n++;
  return n;
}

/** What a racer may pick from (see racerProgress.racerLoadouts). */
export interface Loadouts { cars: readonly CarKind[]; guides: readonly GuideKind[] }

export function selectedLoadout(
  player: PlayerSettings, slot: number, developerMode: boolean, available: Loadouts,
): { car: CarKind; guide: GuideKind } {
  const selectedCar = (developerMode ? player.devCar : undefined) ?? player.car;
  const car = available.cars.includes(selectedCar) ? selectedCar : STARTER_CARS[slot % STARTER_CARS.length];
  const savedGuide = (developerMode ? player.devGuide : undefined) ?? player.guide;
  const selectedGuide = (savedGuide as string | undefined) === 'comet' ? 'bombBuddy' : savedGuide;
  const guide = selectedGuide && available.guides.includes(selectedGuide) ? selectedGuide : car === 'dino' ? 'dino' : 'star';
  return { car, guide };
}
