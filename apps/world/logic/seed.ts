import { readShared, writeShared } from '../../../shared/storage';

const KEY = 'worldSeed.v1';

/** Stable unsigned 32-bit hash (FNV-1a). */
export function hashWorldCode(code: string): number {
  let hash = 0x811c9dc5;
  for (const char of code.trim().toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function familyCode(): string | undefined {
  try {
    const raw = globalThis.localStorage?.getItem('hub.familySync.v1');
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const code = (parsed as { code?: unknown }).code;
    return typeof code === 'string' && code.trim() ? code : undefined;
  } catch { return undefined; }
}

/** Family members share a world; otherwise the device gets one persistent random seed. */
export function worldSeed(): number {
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const override = params.get('seed');
  if (override !== null && /^-?\d+$/.test(override) && Number.isSafeInteger(Number(override))) return Number(override) >>> 0;
  const code = familyCode();
  if (code) return hashWorldCode(code);
  let seed = readShared<number | null>(KEY, null);
  if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    seed = (globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now()) >>> 0;
    writeShared(KEY, seed);
  }
  return seed >>> 0;
}
