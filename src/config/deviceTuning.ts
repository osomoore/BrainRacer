/**
 * Per-device audio/performance knobs, edited from the hidden settings menu (ConfigScene).
 * Pure: no Phaser, no Tone. Persisted in localStorage (failure-tolerant). Defaults == original behaviour.
 */
export type EngineSoundMode = 'full' | 'lite' | 'sample' | 'off';
/** live: every sound is synthesised in real time; prerendered: rendered once into AudioBuffers and replayed; files: decoded from the Ogg files shipped in public/audio. */
export type AudioMode = 'live' | 'prerendered' | 'files';
export type AudioLatency = 'interactive' | 'balanced' | 'playback';

export interface DeviceTuning {
  engineSound: EngineSoundMode;
  audioMode: AudioMode;
  /** Applies after reload. */
  audioLatency: AudioLatency;
  lookAheadSec: 0.1 | 0.2 | 0.3;
  compressor: boolean;
  debugReadout: boolean;
  /** Applies after reload. */
  fpsCap: 60 | 30;
}

export const TUNING_KEY = 'brainracer.tuning.v1';

export const DEFAULT_TUNING: Readonly<DeviceTuning> = Object.freeze({
  engineSound: 'full',
  audioMode: 'live',
  audioLatency: 'interactive',
  lookAheadSec: 0.1,
  compressor: true,
  debugReadout: false,
  fpsCap: 60,
});

const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** Validate every field of an unknown value, falling back to the default per field. */
export function sanitizeTuning(raw: unknown): DeviceTuning {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TUNING;
  return {
    engineSound: pick(r.engineSound, ['full', 'lite', 'sample', 'off'] as const, d.engineSound),
    audioMode: pick(r.audioMode, ['live', 'prerendered', 'files'] as const, d.audioMode),
    audioLatency: pick(r.audioLatency, ['interactive', 'balanced', 'playback'] as const, d.audioLatency),
    lookAheadSec: pick(r.lookAheadSec, [0.1, 0.2, 0.3] as const, d.lookAheadSec),
    compressor: typeof r.compressor === 'boolean' ? r.compressor : d.compressor,
    debugReadout: typeof r.debugReadout === 'boolean' ? r.debugReadout : d.debugReadout,
    fpsCap: pick(r.fpsCap, [60, 30] as const, d.fpsCap),
  };
}

function load(): DeviceTuning {
  try {
    const raw = globalThis.localStorage?.getItem(TUNING_KEY);
    if (raw) return sanitizeTuning(JSON.parse(raw));
  } catch { /* ignore */ }
  return sanitizeTuning(null);
}

function save(t: DeviceTuning): void {
  try { globalThis.localStorage?.setItem(TUNING_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

let current: DeviceTuning | null = null;
const listeners = new Set<(t: DeviceTuning) => void>();

export function getTuning(): DeviceTuning {
  current ??= load();
  return current;
}

export function setTuning(patch: Partial<DeviceTuning>): DeviceTuning {
  current = sanitizeTuning({ ...getTuning(), ...patch });
  save(current);
  for (const fn of [...listeners]) {
    try { fn(current); } catch { /* listener errors never break settings */ }
  }
  return current;
}

export function onTuningChange(fn: (t: DeviceTuning) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function resetTuning(): DeviceTuning {
  return setTuning({ ...DEFAULT_TUNING });
}

/** Test helper: drop the in-memory cache so the next getTuning() reloads from storage. */
export function _clearTuningCache(): void { current = null; }
