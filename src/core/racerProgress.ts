/**
 * Per-profile progress: unlocked worlds, earned cars/buddies (in earned order) and admin overrides,
 * stored in Brain Racer's own key by shared profile id. A new profile has no entry, which means City plus the
 * starter cars and buddies only (`racerProgressOf` returns empty progress; nothing is shared between profiles).
 *
 * Completing a world (3 goals) rewards every racer in the race: the same next world, plus one car or
 * buddy from the world just played, different for each racer when possible.
 */
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, WORLD_REWARDS, worldRewards, type Collectible } from '../config/collectibles';
import { BUDDY_EVERY_REWARDS, COMPLETION_OBJECTIVES, parseUnlocks, RACE_MAPS, rewardsSinceBuddy } from './progression';
import type { Rng } from './rng';
import type { CarKind, GuideKind, RaceMap, RacerProfileId, StarterCar } from './types';

export type Content = RaceMap | Collectible;
export interface RacerProgress {
  worlds: RaceMap[];                               // earned worlds (City is always open)
  items: Collectible[];                            // earned cars/buddies, in earned order
  overrides: Partial<Record<Content, boolean>>;    // admin: true = Open, false = Locked
}
/** Saved progress by shared profile id (profiles without an entry have empty progress). */
export type AllProgress = Partial<Record<RacerProfileId, RacerProgress>>;

/** Progress for any racer; unknown/new racers get empty progress (City + starters only). */
export function racerProgressOf(all: AllProgress, id: RacerProfileId | undefined): RacerProgress {
  return (id !== undefined ? all[id] : undefined) ?? emptyProgress();
}

/** What one racer got at the end of a race. */
export interface RacerReward {
  racer?: RacerProfileId;        // undefined: no profile (quick race), nothing is saved
  world?: RaceMap;              // newly opened next world (poster)
  reward?: Collectible;         // car or buddy from the world just played
  rewardPool?: Collectible[];   // what the reward was drawn from (for the reel)
}

export const STARTER_CARS: readonly StarterCar[] = ['dino', 'kart'];
export const STARTER_GUIDES: readonly GuideKind[] = ['dino', 'star'];
export const PROGRESS_KEY = 'brainracer.racers.v1';
const KEY = PROGRESS_KEY;
const CONTENT: readonly Content[] = [...RACE_MAPS, ...COLLECTIBLES];
let volatile: AllProgress | undefined;

function emptyProgress(): RacerProgress { return { worlds: [], items: [], overrides: {} }; }

export function parseProgress(raw: unknown): RacerProgress {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof RacerProgress, unknown>>;
  const worlds = Array.isArray(r.worlds) ? RACE_MAPS.filter(m => (r.worlds as unknown[]).includes(m)) : [];
  const o = (r.overrides && typeof r.overrides === 'object' ? r.overrides : {}) as Record<string, unknown>;
  const overrides = Object.fromEntries(CONTENT.flatMap(id => typeof o[id] === 'boolean' ? [[id, o[id]]] : []));
  return { worlds, items: parseUnlocks(r.items), overrides };
}

function hasStorage(): boolean {
  try { return !!globalThis.localStorage; } catch { return false; }
}

function readJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

export function loadAllProgress(): AllProgress {
  const saved = readJson(KEY);
  if (saved && typeof saved === 'object') {
    const s = saved as Record<string, unknown>;
    return Object.fromEntries(Object.keys(s).map(id => [id, parseProgress(s[id])]));
  }
  if (volatile && !hasStorage()) return structuredClone(volatile);
  return {};
}

export function saveAllProgress(all: AllProgress): void {
  volatile = structuredClone(all);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(all)); } catch { /* session-only fallback */ }
}

export function loadRacerProgress(id: RacerProfileId): RacerProgress {
  return racerProgressOf(loadAllProgress(), id);
}

/** Removes a deleted profile's saved progress. */
export function deleteRacerProgress(id: RacerProfileId): void {
  const all = loadAllProgress();
  if (!(id in all)) return;
  delete all[id];
  saveAllProgress(all);
}

export function updateRacerProgress(id: RacerProfileId, fn: (p: RacerProgress) => RacerProgress): RacerProgress {
  const all = loadAllProgress();
  const next = parseProgress(fn(racerProgressOf(all, id)));
  all[id] = next;
  saveAllProgress(all);
  return next;
}

/** Admin override for one racer: true = Open, false = Locked, undefined = Auto (earned). */
export function setRacerOverride(id: RacerProfileId, content: Content, value: boolean | undefined): void {
  updateRacerProgress(id, p => {
    const overrides = { ...p.overrides };
    if (value === undefined) delete overrides[content]; else overrides[content] = value;
    return { ...p, overrides };
  });
}

// ───────── pure queries ─────────

/** Earned or opened by the admin, ignoring a Locked override (used for "Auto (Open/Locked)" labels). */
export function earned(p: RacerProgress, content: Content): boolean {
  return content === 'city' || (p.worlds as readonly Content[]).includes(content) || (p.items as readonly Content[]).includes(content);
}

export function hasContent(p: RacerProgress, content: Content): boolean {
  if (content === 'city') return true;
  return p.overrides[content] ?? earned(p, content);
}

export function racerMaps(p: RacerProgress, admin: boolean): readonly RaceMap[] {
  return admin ? RACE_MAPS : RACE_MAPS.filter(m => hasContent(p, m));
}

/** Worlds the team can pick: any world one of the racers has. */
export function teamMaps(team: readonly RacerProgress[], admin: boolean): readonly RaceMap[] {
  return admin ? RACE_MAPS : RACE_MAPS.filter(m => team.some(p => hasContent(p, m)));
}

export function teamPlayableMap(requested: RaceMap, team: readonly RacerProgress[], admin: boolean): RaceMap {
  return teamMaps(team, admin).includes(requested) ? requested : 'city';
}

/** Advance in campaign order if the team can play the successor, otherwise replay this world. */
export function teamNextMap(current: RaceMap, team: readonly RacerProgress[], admin: boolean): RaceMap {
  const maps = teamMaps(team, admin);
  const successor = RACE_MAPS[RACE_MAPS.indexOf(current) + 1];
  return successor && maps.includes(successor) ? successor : teamPlayableMap(current, team, admin);
}

export function racerLoadouts(p: RacerProgress, admin: boolean): { cars: CarKind[]; guides: GuideKind[] } {
  const has = (id: Collectible) => admin || hasContent(p, id);
  return {
    cars: [...STARTER_CARS, ...UNLOCK_VEHICLE_IDS.filter(has)],
    guides: [...STARTER_GUIDES, ...UNLOCK_GUIDE_IDS.filter(has)],
  };
}

// ───────── end-of-race awards ─────────

/** Locked items of `map` this racer can still earn (admin-overridden items are never awarded). */
function unearnedPool(p: RacerProgress, map: RaceMap): Collectible[] {
  return worldRewards(map).filter(id => !p.items.includes(id) && p.overrides[id] === undefined);
}

export function rewardPool(p: RacerProgress, map: RaceMap): Collectible[] {
  const pool = unearnedPool(p, map);
  const buddy = WORLD_REWARDS[map].buddy;
  return pool.includes(buddy) && rewardsSinceBuddy(p.items) >= BUDDY_EVERY_REWARDS - 1 ? [buddy] : pool;
}

/**
 * Pure: rewards for every racer in a completed race. Racers with the fewest options pick first, and
 * later racers avoid items already handed out when they still have another choice.
 */
export function planAwards(
  map: RaceMap, goals: number, team: readonly { racer: RacerProfileId; progress: RacerProgress }[], admin: boolean, rng: Rng,
): { rewards: RacerReward[]; progress: Partial<AllProgress> } {
  const rewards: RacerReward[] = team.map(({ racer }) => ({ racer }));
  const progress: Partial<AllProgress> = {};
  if (admin || goals < COMPLETION_OBJECTIVES) return { rewards, progress };
  const successor = RACE_MAPS[RACE_MAPS.indexOf(map) + 1];
  const pools = team.map(t => rewardPool(t.progress, map));
  const order = team.map((_, i) => i).sort((a, b) => pools[a].length - pools[b].length || a - b);
  const taken = new Set<Collectible>();
  for (const i of order) {
    const { racer, progress: before } = team[i];
    const next: RacerProgress = { ...before, worlds: [...before.worlds], items: [...before.items] };
    for (const m of [map, successor]) {
      if (!m || m === 'city' || next.worlds.includes(m)) continue;
      if (m === successor && !hasContent(before, m) && before.overrides[m] !== false) rewards[i].world = m;
      next.worlds.push(m);
    }
    let pool = pools[i];
    const buddy = WORLD_REWARDS[map].buddy;
    if (pool.length === 1 && pool[0] === buddy && taken.has(buddy)) {
      // Both racers hit the guaranteed buddy at once: defer this one (their counter stays) if anything else is left.
      const others = unearnedPool(before, map).filter(id => id !== buddy);
      if (others.length) pool = others;
    }
    if (pool.length) {
      const fresh = pool.filter(id => !taken.has(id));
      const reward = rng.pick(fresh.length ? fresh : pool);
      taken.add(reward);
      rewards[i].reward = reward;
      rewards[i].rewardPool = pool;
      next.items.push(reward);
    }
    progress[racer] = next;
  }
  return { rewards, progress };
}

/** Loads, awards and saves. One entry per player slot, in `racers` order; slots without a profile get nothing. */
export function awardRacers(map: RaceMap, goals: number, racers: readonly (RacerProfileId | undefined)[], admin: boolean, rng: Rng): RacerReward[] {
  const all = loadAllProgress();
  const named = racers.filter((r): r is RacerProfileId => r !== undefined);
  const unique = named.filter((r, i) => named.indexOf(r) === i);
  const { rewards, progress } = planAwards(map, goals, unique.map(racer => ({ racer, progress: racerProgressOf(all, racer) })), admin, rng);
  saveAllProgress({ ...all, ...progress });
  return racers.map(r => (r === undefined ? {} : rewards.find(x => x.racer === r) ?? { racer: r }));
}
