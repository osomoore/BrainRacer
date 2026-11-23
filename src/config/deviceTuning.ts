/**
 * Per-device audio/performance knobs, edited from the hidden settings menu (ConfigScene).
 * Pure: no Phaser, no Tone. Persisted in localStorage (failure-tolerant). Defaults == original behaviour.
 */
export type EngineSoundMode = 'full' | 'lite' | 'sample' | 'off';
export const ENGINE_LEVELS = [25, 50, 75, 100] as const;
/** live: every sound is synthesised in real time; prerendered: rendered once into AudioBuffers and replayed; files: decoded from the Ogg files shipped in public/audio. */
export type AudioMode = 'live' | 'prerendered' | 'files';
export type AudioLatency = 'interactive' | 'balanced' | 'playback';

/** Ambient NPC traffic density (applies to the next race). */
export type TrafficLevel = 'normal' | 'reduced' | 'minimal';
/** How a gamepad produces throttle: A button (or trigger), trigger only, or automatic. */
export type GasMode = 'a' | 'trigger' | 'auto';
const GAS_MODES: readonly GasMode[] = ['a', 'trigger', 'auto'];

export interface DeviceTuning {
  engineSound: EngineSoundMode;
  engineLevel: typeof ENGINE_LEVELS[number];
  audioMode: AudioMode;
  /** Applies after reload. */
  audioLatency: AudioLatency;
  lookAheadSec: 0.1 | 0.2 | 0.3;
  compressor: boolean;
  debugReadout: boolean;
  /** Applies after reload. */
  fpsCap: 60 | 30;
  /** Applies to the next race. */
  traffic: TrafficLevel;
  /** Per player slot (P1..P4); gamepads only. */
  gas: [GasMode, GasMode, GasMode, GasMode];
  /** Admin: in-race FPS + per-system timing overlay (src/core/perfProbe.ts). Off = zero cost. */
  perfHud: boolean;
}

export const TUNING_KEY = 'brainracer.tuning.v1';

export const DEFAULT_TUNING: Readonly<DeviceTuning> = Object.freeze({
  engineSound: 'sample',
  engineLevel: 75,
  audioMode: 'files',
  audioLatency: 'interactive',
  lookAheadSec: 0.1,
  compressor: true,
  debugReadout: false,
  fpsCap: 60,
  traffic: 'normal',
  gas: ['a', 'a', 'a', 'a'] as [GasMode, GasMode, GasMode, GasMode],
  perfHud: false,
});

const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** Validate every field of an unknown value, falling back to the default per field. */
export function sanitizeTuning(raw: unknown): DeviceTuning {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TUNING;
  const gasArr: unknown[] = Array.isArray(r.gas) ? r.gas : [];
  return {
    engineSound: pick(r.engineSound, ['full', 'lite', 'sample', 'off'] as const, d.engineSound),
    engineLevel: pick(r.engineLevel, ENGINE_LEVELS, d.engineLevel),
    audioMode: pick(r.audioMode, ['live', 'prerendered', 'files'] as const, d.audioMode),
    audioLatency: pick(r.audioLatency, ['interactive', 'balanced', 'playback'] as const, d.audioLatency),
    lookAheadSec: pick(r.lookAheadSec, [0.1, 0.2, 0.3] as const, d.lookAheadSec),
    compressor: typeof r.compressor === 'boolean' ? r.compressor : d.compressor,
    debugReadout: typeof r.debugReadout === 'boolean' ? r.debugReadout : d.debugReadout,
    fpsCap: pick(r.fpsCap, [60, 30] as const, d.fpsCap),
    traffic: pick(r.traffic, ['normal', 'reduced', 'minimal'] as const, d.traffic),
    gas: [0, 1, 2, 3].map((i) => pick(gasArr[i], GAS_MODES, d.gas[i])) as DeviceTuning['gas'],
    perfHud: typeof r.perfHud === 'boolean' ? r.perfHud : d.perfHud,
  };
}

const TRAFFIC_SCALE: Record<TrafficLevel, number> = { normal: 1, reduced: 0.5, minimal: 0.25 };

/** Scale an ambient NPC count by the traffic level (rounds up; a positive count never drops below 1). */
export function scaledCount(n: number, traffic: TrafficLevel): number {
  if (n <= 0) return 0;
  return Math.max(1, Math.ceil(n * TRAFFIC_SCALE[traffic] - 1e-9));
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
