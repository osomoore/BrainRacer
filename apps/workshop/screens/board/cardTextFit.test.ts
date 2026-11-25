import { describe, expect, it } from 'vitest';
import { WS_ROOM } from '../../config';
import type { WorkshopId } from '../../core/types';
import { engine } from '../../logic';
import { failLines, fixesOf } from '../../logic/failHints';
import { buildBlocks, planDetail, type Measure } from './cardText';
import { boardLayout, detailFonts } from './layout';

/** Deterministic and conservative: bold sans averages ~0.5 em per character, so 0.58 overestimates the width. */
const measure: Measure = (t, size) => t.length * size * 0.58;

describe('real catalogs: every challenge text fits one page (no text pager needed)', () => {
  for (const kind of ['wide', 'tall'] as const) for (const admin of [false, true]) {
    it(`${kind}${admin ? ' admin' : ''}`, () => {
      const budget = kind === 'wide' ? 0 : admin ? 0.06 : 0.03; // tall + remembered hints may rarely need the controller-friendly pager
      const L = boardLayout(kind, admin);
      const bad: string[] = [];
      let count = 0;
      for (const ws of ['race', 'dino'] as WorkshopId[]) {
        let p = engine.newProgress(ws);
        const seen = new Set<string>();
        for (let round = 0; round < 8; round++) {
          p = engine.refreshBoard(ws, p);
          for (const id of p.active) {
            const c = p.challenges[id];
            if (seen.has(id)) continue;
            seen.add(id);
            for (const level of ['starter', 'easy', 'medium', 'hard'] as const) {
              // Worst case: also show the remembered fail hints (every requirement flagged failed at this level).
              const reqs = c.stages.flatMap((st) => st.requirements);
              const notes = reqs.slice(0, 2).map((r) => ({ req: r.id, parts: fixesOf(r).sort((x, y) => y.length - x.length)[0] ?? [] }));
              const hints = failLines(engine.catalog(ws), c, notes, level);
              const plan = planDetail(buildBlocks(c, level, hints), {
                maxW: L.textArea.w, indent: 96, boxH: L.textArea.h, sizes: detailFonts(kind), lineGap: WS_ROOM.detailLineGap, blockGap: 14, measure,
              });
              count++;
              if (plan.pages.length !== 1) bad.push(`${ws} ${c.id} ${level}: ${plan.pages.length} pages`);
            }
          }
          // finish the active challenges so the next refresh deals new ones
          p = { ...p, active: [] };
        }
      }
      expect(count).toBeGreaterThan(20);
      expect(bad.length / count, bad.slice(0, 5).join('; ')).toBeLessThanOrEqual(budget);
    }, 60_000);
  }
});

describe('real catalogs: the story and requirements alone (no hints) always fit one page', () => {
  for (const kind of ['wide', 'tall'] as const) it(kind, () => {
    const L = boardLayout(kind, false);
    for (const ws of ['race', 'dino'] as WorkshopId[]) {
      let p = engine.newProgress(ws);
      for (let round = 0; round < 8; round++) {
        p = engine.refreshBoard(ws, p);
        for (const id of p.active) for (const level of ['starter', 'easy', 'medium', 'hard'] as const) {
          const plan = planDetail(buildBlocks(p.challenges[id], level), {
            maxW: L.textArea.w, indent: 96, boxH: L.textArea.h, sizes: detailFonts(kind), lineGap: WS_ROOM.detailLineGap, blockGap: 14, measure,
          });
          expect(plan.pages.length, `${ws} ${id} ${level}`).toBe(1);
        }
        p = { ...p, active: [] };
      }
    }
  }, 60_000);
});
