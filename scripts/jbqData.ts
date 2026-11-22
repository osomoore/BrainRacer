/** Builds src/data/jbq.json from data/jbq/Junior_Bible_Quiz_2016_MASTER_fixed.csv:  npm run jbq:data */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface JbqRow { id: number; points: 10 | 20 | 30; type: string; q: string; a: string; ref?: string; verse?: string }

/** Minimal RFC-4180 CSV parser (quotes, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** "Acts 2:4 All of them..." -> ref + verse. Handles "1 John 4:8", "Psalm 119:105", "John 3:16-17", "Galatians 5:22,23". */
const REF_RE = /^((?:[1-3] )?[A-Z][a-z]+(?: of [A-Z][a-z]+)?) (\d+:\d+(?:[-,]\d+)*)\s+(\S[\s\S]*)$/;
export function splitRef(answer: string): { ref: string; verse: string } | null {
  const m = REF_RE.exec(answer.trim());
  return m ? { ref: `${m[1]} ${m[2]}`, verse: m[3].trim() } : null;
}

export function pointsFor(id: number): 10 | 20 | 30 { return id <= 288 ? 10 : id <= 480 ? 20 : 30; }

export function buildRows(csv: string): JbqRow[] {
  return parseCsv(csv).slice(1).filter((r) => r.length >= 5 && r[0].trim() !== '').map((r) => {
    const id = Number(r[0]);
    const split = splitRef(r[4]);
    const base: JbqRow = { id, points: pointsFor(id), type: r[2].trim(), q: r[3].trim(), a: r[4].trim() };
    return split ? { ...base, ref: split.ref, verse: split.verse } : base;
  });
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const rows = buildRows(readFileSync(resolve(here, '../data/jbq/Junior_Bible_Quiz_2016_MASTER_fixed.csv'), 'utf8'));
  writeFileSync(resolve(here, '../src/data/jbq.json'), JSON.stringify(rows, null, 1) + '\n', 'utf8');
  console.log(`wrote ${rows.length} JBQ questions`);
}
