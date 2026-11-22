import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WS_MUSIC_NAMES, WS_SFX_NAMES, WS_STING_NAMES, wsAudioKey, type WsAudioManifest } from '../apps/workshop/audio/manifest';
import { workshopAudioSourceHash } from './workshopAudioHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'audio', 'workshop');
const manifestPath = join(dir, 'manifest.json');

function load(): WsAudioManifest {
  expect(existsSync(manifestPath), 'public/audio/workshop/manifest.json missing: run npm run audio:workshop').toBe(true);
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as WsAudioManifest;
}

describe('shipped workshop audio files', () => {
  it('are rendered from the current synthesis sources', () => {
    expect(workshopAudioSourceHash(), 'workshop audio sources changed: run npm run audio:workshop').toBe(load().sourceHash);
  });

  it('cover every music, sting and sfx name, each with its file', () => {
    const m = load();
    const keys = [
      ...WS_MUSIC_NAMES.map((n) => wsAudioKey('music', n)),
      ...WS_STING_NAMES.map((n) => wsAudioKey('sting', n)),
      ...WS_SFX_NAMES.map((n) => wsAudioKey('sfx', n)),
    ];
    for (const k of keys) {
      expect(m.files[k], k).toBeDefined();
      expect(existsSync(join(dir, m.files[k].file)), m.files[k].file).toBe(true);
    }
    expect(Object.keys(m.files).length).toBe(keys.length);
  });

  it('music loops are 30-60 s', () => {
    const m = load();
    for (const n of WS_MUSIC_NAMES) {
      const e = m.files[wsAudioKey('music', n)];
      expect(e.seconds, n).toBeGreaterThanOrEqual(30);
      expect(e.seconds, n).toBeLessThanOrEqual(60);
      expect(e.loop).toBe(true);
    }
  });
});
