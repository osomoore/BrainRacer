import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, type Collectible } from '../config/collectibles';
import { DEFAULT_SETTINGS, DEVELOPER_ROUND_SEC } from '../config/gameConfig';
import { Rng, randomSeed } from './rng';
import type { CarKind, GuideKind, PlayerSettings, RaceMap, Settings, StarterCar } from './types';

export const RACE_MAPS: readonly RaceMap[] = ['city', 'industrial', 'farm', 'harbor', 'underground'];

const PROGRESS_KEY = 'brainracer.unlocks.v1';
const STARTER_CARS: readonly StarterCar[] = ['dino', 'kart'];
const STARTER_GUIDES: readonly GuideKind[] = ['dino', 'star'];
let volatileUnlocks: Collectible[] = [];

export function nextMap(current: RaceMap, rng: Rng): RaceMap {
  return rng.pick(RACE_MAPS.filter(map => map !== current));
}

export function defaultRoundLength(developerMode: boolean): number {
  return developerMode ? DEVELOPER_ROUND_SEC : DEFAULT_SETTINGS.roundLengthSec;
}

export function developerModeSettings(developerMode: boolean): Partial<Settings> {
  return { developerMode, roundLengthSec: defaultRoundLength(developerMode) };
}

export function parseUnlocks(raw: unknown): Collectible[] {
  return Array.isArray(raw) ? COLLECTIBLES.filter(id => raw.includes(id)) : [];
}

export function drawUnlock(unlocked: readonly Collectible[], rng: Rng): Collectible | undefined {
  const locked = COLLECTIBLES.filter(id => !unlocked.includes(id));
  return locked.length ? rng.pick(locked) : undefined;
}

function saveUnlocks(unlocked: Collectible[]): void {
  volatileUnlocks = unlocked;
  try { globalThis.localStorage?.setItem(PROGRESS_KEY, JSON.stringify(unlocked)); } catch { /* session-only fallback */ }
}

export function loadUnlocks(): Collectible[] {
  let unlocked = volatileUnlocks;
  try {
    const raw = globalThis.localStorage?.getItem(PROGRESS_KEY);
    if (raw) unlocked = parseUnlocks(JSON.parse(raw));
  } catch { /* session-only fallback */ }
  if (unlocked.length) return unlocked.slice();
  unlocked = [new Rng(randomSeed()).pick(COLLECTIBLES)];
  saveUnlocks(unlocked);
  return unlocked;
}

/** Called once per completed round with the mode the race actually used. */
export function awardMapCompletion(developerMode: boolean, rng: Rng): Collectible | undefined {
  if (developerMode) return undefined;
  const unlocked = loadUnlocks();
  const reward = drawUnlock(unlocked, rng);
  if (reward) saveUnlocks([...unlocked, reward]);
  return reward;
}

export function availableLoadouts(unlocked: readonly Collectible[], developerMode: boolean) {
  return {
    cars: [...STARTER_CARS, ...UNLOCK_VEHICLE_IDS.filter(id => developerMode || unlocked.includes(id))],
    guides: [...STARTER_GUIDES, ...UNLOCK_GUIDE_IDS.filter(id => developerMode || unlocked.includes(id))],
  };
}

export function selectedLoadout(
  player: PlayerSettings, slot: number, developerMode: boolean, available: ReturnType<typeof availableLoadouts>,
): { car: CarKind; guide: GuideKind } {
  const selectedCar = (developerMode ? player.devCar : undefined) ?? player.car;
  const car = available.cars.includes(selectedCar) ? selectedCar : STARTER_CARS[slot % STARTER_CARS.length];
  const selectedGuide = (developerMode ? player.devGuide : undefined) ?? player.guide;
  const guide = selectedGuide && available.guides.includes(selectedGuide) ? selectedGuide : car === 'dino' ? 'dino' : 'star';
  return { car, guide };
}
