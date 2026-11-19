/**
 * System registry. Every module `src/systems/*System.ts` is loaded automatically; each exported
 * class whose prototype has `init` and `update` (i.e. implements GameSystem) and has a no-arg
 * constructor is instantiated once per race. Packages add systems by adding a file. No shared
 * list to edit.
 *
 * Order: ascending static `order` (default 100), then file name. Lower runs earlier each frame.
 * Suggested: input-driven/gameplay 50, collisions 60, default 100, scoring/UI feeders 150.
 */
import type { GameSystem } from '../core/race';

type SystemCtor = (new () => GameSystem) & { order?: number };

const modules = import.meta.glob<Record<string, unknown>>('./*System.ts', { eager: true });

function isSystemCtor(v: unknown): v is SystemCtor {
  return typeof v === 'function' && !!v.prototype && typeof v.prototype.init === 'function' && typeof v.prototype.update === 'function';
}

export function createSystems(): GameSystem[] {
  const found: { ctor: SystemCtor; file: string }[] = [];
  for (const [file, mod] of Object.entries(modules)) {
    for (const value of new Set(Object.values(mod))) {
      if (isSystemCtor(value)) found.push({ ctor: value, file });
    }
  }
  found.sort((a, b) => (a.ctor.order ?? 100) - (b.ctor.order ?? 100) || a.file.localeCompare(b.file));
  return found.map(({ ctor }) => new ctor());
}
