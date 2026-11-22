import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AudioManifest } from '../src/audio/audioManifest';
import musicGains from '../src/audio/musicGains.json';
import { MUSIC_TARGET_DB } from '../src/audio/musicLoudness';
import { audioSourceHash } from './audioSourceHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'public', 'audio', 'manifest.json');

describe('shipped audio files', () => {
  it('are rendered from the current audio sources', () => {
    expect(existsSync(manifestPath), 'public/audio/manifest.json missing: run npm run audio:render').toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AudioManifest;
    expect(audioSourceHash(), 'audio sources changed: run npm run audio:render').toBe(manifest.sourceHash);
  });

  it('every manifest entry has its file', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AudioManifest;
    const entries = [...Object.values(manifest.sfx), ...Object.values(manifest.loops), manifest.engine, ...Object.values(manifest.music)];
    for (const e of entries) expect(existsSync(join(root, 'public', 'audio', e.file)), e.file).toBe(true);
  });

  it('ships all music within 1.5 dB of the target and all race tracks within 1.5 dB of each other', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AudioManifest;
    const tracks = readdirSync(join(root, 'src', 'audio', 'music', 'tracks'))
      .filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5)).sort();
    expect(Object.keys(manifest.music).sort()).toEqual(tracks);
    expect(Object.keys(musicGains).sort()).toEqual(tracks);
    const levels = [];
    for (const [name, entry] of Object.entries(manifest.music)) {
      expect(Math.abs(entry.meanDb - MUSIC_TARGET_DB), name).toBeLessThanOrEqual(1.5);
      expect(entry.peakDb, name).toBeLessThanOrEqual(-1);
      if (name !== 'title' && name !== 'results') levels.push(entry.meanDb);
    }
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(1.5);
  });
});
