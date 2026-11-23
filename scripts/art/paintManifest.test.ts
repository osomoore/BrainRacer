/**
 * Staleness guard for the painted art (like the audio guard): every painted manifest entry must still match its
 * job's spec (prompt, seed, strengths, size) and have its PNG. Unpainted jobs are fine (they fall back to the code
 * shape), so an empty or partial manifest passes. When the shape CODE changed since a PNG was painted (source hash
 * differs) the test only warns: Codex edits shapes in parallel, and `npm run art:paint` refreshes them in bulk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allArtJobs } from '../../apps/workshop/art/paint/jobs';
import type { PaintedManifest } from '../../apps/workshop/art/paint/painted';
import { artSourceHash } from './sourceHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'public', 'art', 'workshop');
const mpath = join(dir, 'manifest.json');
const manifest: PaintedManifest = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : { version: 1, entries: {} };
const jobs = new Map(allArtJobs().map((j) => [j.key, j]));

describe('painted art manifest', () => {
  it('has the expected version', () => { expect(manifest.version).toBe(1); });

  it('every painted entry has a job, a matching spec hash and a PNG', () => {
    const stale: string[] = [];
    for (const [key, e] of Object.entries(manifest.entries)) {
      const j = jobs.get(key);
      if (!j) { stale.push(`${key} (no such job: run art:paint -- --prune)`); continue; }
      if (e.specHash !== j.specHash) stale.push(`${key} (spec changed: re-run art:paint -- --only "${key}")`);
      else if (e.w !== j.w || e.h !== j.h) stale.push(`${key} (size ${e.w}x${e.h} != ${j.w}x${j.h})`);
      if (!existsSync(join(dir, e.file))) stale.push(`${key} (missing file ${e.file})`);
    }
    expect(stale, `re-run npm run art:paint for:\n${stale.join('\n')}`).toEqual([]);
  });

  it('warns when shape code changed since painting', () => {
    const now = artSourceHash();
    const old = Object.entries(manifest.entries).filter(([, e]) => e.srcHash && e.srcHash !== now).map(([k]) => k);
    if (old.length) console.warn(`art: ${old.length} painted texture(s) were painted from older shape code; run npm run art:paint to refresh (e.g. ${old[0]})`);
    expect(true).toBe(true);
  });
});
