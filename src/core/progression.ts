import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, type Collectible } from '../config/collectibles';
import { DEFAULT_SETTINGS, DEVELOPER_ROUND_SEC } from '../config/gameConfig';
import { Rng, randomSeed } from './rng';
import type { CarKind, GuideKind, PlayerSettings, RaceMap, Settings, StarterCar } from './types';

export const RACE_MAPS: readonly RaceMap[] = ['city', 'industrial', 'harbor', 'underground', 'farm', 'sky', 'forest', 'underwater'];
export const MAP_LABEL: Record<RaceMap, string> = {
  city: 'City', industrial: 'Factory', harbor: 'Beach', underground: 'Mine', farm: 'Farm',
  sky: 'Sky City', forest: 'Dark Forest', underwater: 'Underwater',
};
export const COMPLETION_OBJECTIVES = 3;

const PROGRESS_KEY = 'brainracer.unlocks.v1';
const ACCESS_KEY = 'brainracer.content.v1';
const STARTER_CARS: readonly StarterCar[] = ['dino', 'kart'];
const STARTER_GUIDES: readonly GuideKind[] = ['dino', 'star'];
let volatileUnlocks: Collectible[] = [];
type Content = RaceMap | Collectible;
type Override = boolean | undefined;
type Access = { worlds: RaceMap[]; overrides: Partial<Record<Content, boolean>> };
let volatileAccess: Access = { worlds: [], overrides: {} };

function loadAccess(): Access {
  try {
    const raw = globalThis.localStorage?.getItem(ACCESS_KEY);
    if (raw) {
      const access: Partial<Access> | null = JSON.parse(raw);
      return {
        worlds: RACE_MAPS.filter(map => Array.isArray(access?.worlds) && access.worlds.includes(map)),
        overrides: Object.fromEntries([...RACE_MAPS, ...COLLECTIBLES].flatMap(id => {
          const value = access?.overrides?.[id];
          return typeof value === 'boolean' ? [[id, value]] : [];
        })),
      };
    }
  } catch { /* session-only fallback */ }
  return volatileAccess;
}

function saveAccess(access: Access): void {
  volatileAccess = access;
  try { globalThis.localStorage?.setItem(ACCESS_KEY, JSON.stringify(access)); } catch { /* session-only fallback */ }
}

export function contentOverride(id: Content): Override {
  return loadAccess().overrides[id];
}

export function setContentOverride(id: Content, value: Override): void {
  const access = loadAccess();
  const overrides = { ...access.overrides };
  if (value === undefined) delete overrides[id];
  else overrides[id] = value;
  saveAccess({ ...access, overrides });
}

function mapAvailable(map: RaceMap, access: Access): boolean {
  return map === 'city' || (access.overrides[map] ?? access.worlds.includes(map));
}

export function availableMaps(admin: boolean): readonly RaceMap[] {
  if (admin) return RACE_MAPS;
  const access = loadAccess();
  return RACE_MAPS.filter(map => mapAvailable(map, access));
}

export function playableMap(requested: RaceMap, admin: boolean): RaceMap {
  return availableMaps(admin).includes(requested) ? requested : 'city';
}

/** Advance in campaign order if the successor is playable, otherwise replay this world. */
export function nextMap(current: RaceMap, admin: boolean): RaceMap {
  const maps = availableMaps(admin);
  const successor = RACE_MAPS[RACE_MAPS.indexOf(current) + 1];
  return maps.includes(successor) ? successor : playableMap(current, admin);
}

export function defaultRoundLength(developerMode: boolean): number {
  return developerMode ? DEVELOPER_ROUND_SEC : DEFAULT_SETTINGS.roundLengthSec;
}

export function developerModeSettings(developerMode: boolean): Partial<Settings> {
  return { developerMode, roundLengthSec: defaultRoundLength(developerMode) };
}

export function parseUnlocks(raw: unknown): Collectible[] {
  return Array.isArray(raw)
    ? COLLECTIBLES.filter(id => raw.includes(id) || (id === 'bombBuddy' && raw.includes('comet')))
    : [];
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

export interface CompletionUnlocks {
  world?: RaceMap;
  reward?: Collectible;
  rewardPool?: Collectible[];
}

/** Called once after the final answers have been scored. */
export function awardMapCompletion(map: RaceMap, goals: number, admin: boolean, rng: Rng): CompletionUnlocks {
  if (admin || goals < COMPLETION_OBJECTIVES) return {};
  const access = loadAccess();
  if (!mapAvailable(map, access)) return {};
  const prizes: CompletionUnlocks = {};
  const successor = RACE_MAPS[RACE_MAPS.indexOf(map) + 1];
  if (successor && !access.worlds.includes(successor)) {
    if (!mapAvailable(successor, access) && access.overrides[successor] !== false) prizes.world = successor;
    saveAccess({ ...access, worlds: [...access.worlds, successor] });
  }
  const unlocked = loadUnlocks();
  const pool = COLLECTIBLES.filter(id => !unlocked.includes(id) && access.overrides[id] === undefined);
  if (pool.length) {
    prizes.reward = rng.pick(pool);
    prizes.rewardPool = pool;
    saveUnlocks([...unlocked, prizes.reward]);
  }
  return prizes;
}

export function availableLoadouts(unlocked: readonly Collectible[], developerMode: boolean) {
  const { overrides } = loadAccess();
  const available = (id: Collectible) => developerMode || (overrides[id] ?? unlocked.includes(id));
  return {
    cars: [...STARTER_CARS, ...UNLOCK_VEHICLE_IDS.filter(available)],
    guides: [...STARTER_GUIDES, ...UNLOCK_GUIDE_IDS.filter(available)],
  };
}

export function selectedLoadout(
  player: PlayerSettings, slot: number, developerMode: boolean, available: ReturnType<typeof availableLoadouts>,
): { car: CarKind; guide: GuideKind } {
  const selectedCar = (developerMode ? player.devCar : undefined) ?? player.car;
  const car = available.cars.includes(selectedCar) ? selectedCar : STARTER_CARS[slot % STARTER_CARS.length];
  const savedGuide = (developerMode ? player.devGuide : undefined) ?? player.guide;
  const selectedGuide = (savedGuide as string | undefined) === 'comet' ? 'bombBuddy' : savedGuide;
  const guide = selectedGuide && available.guides.includes(selectedGuide) ? selectedGuide : car === 'dino' ? 'dino' : 'star';
  return { car, guide };
}
