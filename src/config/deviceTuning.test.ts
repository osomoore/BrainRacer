import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _clearTuningCache, DEFAULT_TUNING, getTuning, onTuningChange, resetTuning, scaledCount, sanitizeTuning, setTuning, TUNING_KEY } from './deviceTuning';

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

  it('loads the default tuning on a fresh device', () => {
    expect(getTuning()).toEqual({ engineSound: 'sample', engineLevel: 75, audioMode: 'files', audioLatency: 'interactive', lookAheadSec: 0.1, compressor: true, debugReadout: false, fpsCap: 60, traffic: 'normal', gas: ['a', 'a', 'a', 'a'], perfHud: false });
  });
  it('invalid stored values fall back per field', () => {
    store.m.set(TUNING_KEY, JSON.stringify({ engineSound: 'loud', engineLevel: 200, lookAheadSec: 0.2, compressor: 'yes', fpsCap: 45, debugReadout: true }));
    expect(getTuning()).toEqual({ ...DEFAULT_TUNING, lookAheadSec: 0.2, debugReadout: true });
    expect(sanitizeTuning('garbage')).toEqual(DEFAULT_TUNING);
    store.m.set(TUNING_KEY, '{not json');
    _clearTuningCache();
    expect(getTuning()).toEqual(DEFAULT_TUNING);
  });
  it('audioMode and sample engine validate', () => {
    expect(sanitizeTuning({ audioMode: 'prerendered', engineSound: 'sample' })).toEqual({ ...DEFAULT_TUNING, audioMode: 'prerendered', engineSound: 'sample' });
    expect(sanitizeTuning({ audioMode: 'files' }).audioMode).toBe('files');
    expect(sanitizeTuning({ audioMode: 'turbo' }).audioMode).toBe('files');
  });
  it('patch saves and notifies; unsubscribe works', () => {
    const fn = vi.fn();
    const off = onTuningChange(fn);
    setTuning({ engineSound: 'lite', engineLevel: 50, fpsCap: 30 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getTuning().engineSound).toBe('lite');
    expect(JSON.parse(store.m.get(TUNING_KEY)!).fpsCap).toBe(30);
    _clearTuningCache();
    expect(getTuning().engineLevel).toBe(50);
    off();
    setTuning({ compressor: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('reset restores defaults', () => {
    setTuning({ engineSound: 'off', engineLevel: 25, audioLatency: 'playback' });
    expect(resetTuning()).toEqual(DEFAULT_TUNING);
    expect(getTuning()).toEqual(DEFAULT_TUNING);
  });
});

describe('traffic and gas', () => {
  it('scaledCount rounds up, never below 1 for positive counts', () => {
    expect(scaledCount(40, 'normal')).toBe(40);
    expect(scaledCount(25, 'reduced')).toBe(13);
    expect(scaledCount(40, 'minimal')).toBe(10);
    expect(scaledCount(2, 'minimal')).toBe(1);
    expect(scaledCount(1, 'minimal')).toBe(1);
    expect(scaledCount(0, 'minimal')).toBe(0);
  });
  it('validates traffic and per-player gas', () => {
    expect(sanitizeTuning({ traffic: 'minimal', gas: ['auto', 'trigger', 'a', 'a'] })).toMatchObject({ traffic: 'minimal', gas: ['auto', 'trigger', 'a', 'a'] });
    expect(sanitizeTuning({ traffic: 'lots', gas: ['x', 'auto'] })).toMatchObject({ traffic: 'normal', gas: ['a', 'auto', 'a', 'a'] });
    expect(sanitizeTuning({ gas: 'auto' }).gas).toEqual(['a', 'a', 'a', 'a']);
  });
});
