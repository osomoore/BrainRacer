import type { SceneEntry } from '../src/core/types';

/** Source grids whose 25 icons are the place words (same words, two art styles). */
export const PLACE_SET_A = 'Colorful Community Places Grid.png';
export const PLACE_SET_B = 'Colorful Places Icon Grid.png';

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseManifest(csv: string): SceneEntry[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`manifest.csv missing column ${name}`);
    return i;
  };
  const [iId, iWord, iSrc, iRow, iCol] = ['id', 'word', 'source', 'row', 'column'].map(idx);
  return lines.slice(1).map((line) => {
    const f = parseLine(line);
    const source = f[iSrc].trim();
    return {
      id: f[iId].trim(),
      word: f[iWord].trim().toLowerCase(),
      file: `scenes/${f[iId].trim()}.png`,
      source,
      row: Number(f[iRow]),
      col: Number(f[iCol]),
      placeSet: source === PLACE_SET_A ? 'A' : source === PLACE_SET_B ? 'B' : null,
    };
  });
}
