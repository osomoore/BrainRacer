/**
 * Data shared between the launcher and the games (Brain Racer, Adventure Workshop, …).
 *
 * Every app runs as its own page on the same origin, so localStorage is the shared channel.
 * Shared keys live under the `hub.` prefix; each game keeps its private data under its own keys
 * (Brain Racer's existing keys are untouched). Failure-tolerant: private mode / blocked storage
 * falls back to an in-memory copy for this page only.
 *
 * Pure: no DOM besides `globalThis.localStorage`, no Phaser.
 */

export const SHARED_PREFIX = 'hub.';

const memory = new Map<string, string>();

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Read a shared value (JSON). Returns `fallback` when missing or unreadable. */
export function readShared<T>(key: string, fallback: T): T {
  const full = SHARED_PREFIX + key;
  let raw: string | null = null;
  try { raw = storage()?.getItem(full) ?? null; } catch { raw = null; }
  raw ??= memory.get(full) ?? null;
  if (raw === null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** Write a shared value (JSON). Never throws. */
export function writeShared<T>(key: string, value: T): void {
  const full = SHARED_PREFIX + key;
  const raw = JSON.stringify(value);
  memory.set(full, raw);
  try { storage()?.setItem(full, raw); } catch { /* memory fallback only */ }
}

/** Remove a shared value. Never throws. */
export function removeShared(key: string): void {
  const full = SHARED_PREFIX + key;
  memory.delete(full);
  try { storage()?.removeItem(full); } catch { /* ignore */ }
}
