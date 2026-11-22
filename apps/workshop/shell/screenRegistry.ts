/**
 * Screens auto-register: any `apps/workshop/screens/<id>Screen.ts` with a default-exported ScreenFactory.
 * An id without a module gets the placeholder screen ("<id> coming soon" + Back).
 */
import type { Screen, ScreenFactory } from '../core/runtime';
import { placeholderScreen } from './placeholderScreen';

const mods = import.meta.glob<{ default: ScreenFactory }>('../screens/*Screen.ts', { eager: true });

const registry = new Map<string, ScreenFactory>();
for (const [path, mod] of Object.entries(mods)) {
  const id = /\/([^/]+)Screen\.ts$/.exec(path)?.[1];
  if (id && typeof mod.default === 'function') registry.set(id, mod.default);
}

export function hasScreen(id: string): boolean { return registry.has(id); }

export function screenIds(): string[] { return [...registry.keys()]; }

export function createScreen(id: string): Screen {
  const f = registry.get(id);
  return f ? f() : placeholderScreen(id);
}
