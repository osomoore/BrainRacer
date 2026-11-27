/**
 * Game registry + navigation between the launcher and the games.
 *
 * Each game is a separate page (separate Vite entry, separate code). Pages sit next to each other
 * at the site root so relative asset paths keep working (the site may be served from a sub-path,
 * e.g. GitHub Pages `/BrainRacer/`). Navigation is a plain page load, so games never share
 * runtime state: only `shared/storage.ts` data carries over.
 */
import { readShared, writeShared } from './storage';

export type GameId = 'racer' | 'workshop' | 'world';

export interface GameInfo {
  id: GameId;
  /** Shown on the launcher tile. */
  title: string;
  /** Page file, relative to the site root. */
  page: string;
  /** False = launcher shows the tile but marks it "Coming soon" (still openable). */
  ready: boolean;
  /** True = launcher shows a "BETA" ribbon (public test, progress may be lost). */
  beta?: true;
}

export const GAMES: readonly GameInfo[] = [
  { id: 'racer', title: 'Brain Racer', page: 'racer.html', ready: true },
  { id: 'workshop', title: 'Adventure Workshop', page: 'workshop.html', ready: true, beta: true },
  { id: 'world', title: 'Adventure World', page: 'world.html', ready: true, beta: true },
];

/** Launcher page, relative to the site root. */
export const HUB_PAGE = './';

const LAST_GAME_KEY = 'lastGame';

export function gameInfo(id: GameId): GameInfo {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown game ${id}`);
  return g;
}

/** The game picked most recently (the launcher pre-selects it). */
export function lastGame(): GameId | null {
  const id = readShared<string | null>(LAST_GAME_KEY, null);
  return GAMES.some((g) => g.id === id) ? (id as GameId) : null;
}

export function setLastGame(id: GameId): void { writeShared(LAST_GAME_KEY, id); }

/** URL of a game page, relative to the current page (all pages share one directory). */
export function gameUrl(id: GameId, search = ''): string {
  return gameInfo(id).page + search;
}

/** Load a game (records it as the last game). */
export function goToGame(id: GameId, search = ''): void {
  setLastGame(id);
  location.assign(gameUrl(id, search));
}

/** Go back to the launcher. */
export function goToHub(): void {
  location.assign(HUB_PAGE);
}
