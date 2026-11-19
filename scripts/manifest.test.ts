import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest';

describe('parseManifest', () => {
  it('parses quoted csv with BOM', () => {
    const rows = parseManifest('﻿"id","word","source","row","column"\r\n"scene_001","Beach Ball","Colorful Places Icon Grid.png","1","2"\r\n');
    expect(rows).toEqual([{ id: 'scene_001', word: 'beach ball', label: 'beach ball', file: 'scenes/scene_001.png', source: 'Colorful Places Icon Grid.png', row: 1, col: 2, placeSet: 'B' }]);
  });
  it('applies aliases', () => {
    const rows = parseManifest('"id","word","source","row","column"\n"s1","Rain Cloud","x.png","1","1"\n', { 'rain cloud': 'cloud' });
    expect(rows[0]).toMatchObject({ word: 'cloud', label: 'rain cloud' });
  });
  it('real manifest has 250 unique ids', () => {
    const rows = parseManifest(readFileSync('images/scenes/manifest.csv', 'utf8'));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.length).toBe(250);
    expect(rows.every((r) => r.word.length > 0)).toBe(true);
  });
});
