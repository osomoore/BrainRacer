import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AudioManifest } from '../src/audio/audioManifest';
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
});
