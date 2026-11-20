import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _clearTuningCache, DEFAULT_TUNING, getTuning, onTuningChange, resetTuning, sanitizeTuning, setTuning, TUNING_KEY } from './deviceTuning';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
}

describe('deviceTuning', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    _clearTuningCache();
  });

  it('defaults reproduce current behaviour', () => {
    expect(getTuning()).toEqual({ engineSound: 'full', audioMode: 'live', audioLatency: 'interactive', lookAheadSec: 0.1, compressor: true, debugReadout: false, fpsCap: 60 });
  });
  it('invalid stored values fall back per field', () => {
    store.m.set(TUNING_KEY, JSON.stringify({ engineSound: 'loud', lookAheadSec: 0.2, compressor: 'yes', fpsCap: 45, debugReadout: true }));
    expect(getTuning()).toEqual({ ...DEFAULT_TUNING, lookAheadSec: 0.2, debugReadout: true });
    expect(sanitizeTuning('garbage')).toEqual(DEFAULT_TUNING);
    store.m.set(TUNING_KEY, '{not json');
    _clearTuningCache();
    expect(getTuning()).toEqual(DEFAULT_TUNING);
  });
  it('audioMode and sample engine validate', () => {
    expect(sanitizeTuning({ audioMode: 'prerendered', engineSound: 'sample' })).toEqual({ ...DEFAULT_TUNING, audioMode: 'prerendered', engineSound: 'sample' });
    expect(sanitizeTuning({ audioMode: 'turbo' }).audioMode).toBe('live');
  });
  it('patch saves and notifies; unsubscribe works', () => {
    const fn = vi.fn();
    const off = onTuningChange(fn);
    setTuning({ engineSound: 'lite', fpsCap: 30 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getTuning().engineSound).toBe('lite');
    expect(JSON.parse(store.m.get(TUNING_KEY)!).fpsCap).toBe(30);
    off();
    setTuning({ compressor: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('reset restores defaults', () => {
    setTuning({ engineSound: 'off', audioLatency: 'playback' });
    expect(resetTuning()).toEqual(DEFAULT_TUNING);
    expect(getTuning()).toEqual(DEFAULT_TUNING);
  });
});
