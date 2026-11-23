/** Pure layout helpers for the results screen (no Phaser): packing checklist rows into pages. */

/** Greedy packing of row heights into pages of at most `capacity` px. A row taller than a page gets a page of its own. */
export function paginate(heights: readonly number[], capacity: number): number[][] {
  const pages: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    if (cur.length > 0 && used + h > capacity) { pages.push(cur); cur = []; used = 0; }
    cur.push(i);
    used += h;
  });
  if (cur.length > 0) pages.push(cur);
  return pages.length > 0 ? pages : [[]];
}

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export interface FitInput {
  /** Candidate font sizes, largest first (the last one is the minimum, never go below it). */
  fonts: readonly number[];
  /** Measures the checklist row heights and the extras block height (new part + hint) at one font size. */
  measure(font: number): { rows: number[]; extras: number };
  /** Space for rows + extras when everything fits on one screen, and when a pager takes room at the bottom. */
  fullHeight: number;
  pagedHeight: number;
  /** Gap between the checklist and the extras block. */
  gap: number;
}

export interface FitPlan { font: number; pages: number[][] }

/** Largest font where everything fits on one page; otherwise the minimum font with the rows paged (extras on every page). */
export function fitResults(f: FitInput): FitPlan {
  for (const font of f.fonts) {
    const m = f.measure(font);
    const need = sum(m.rows) + (m.extras > 0 ? m.extras + f.gap : 0);
    if (need <= f.fullHeight) return { font, pages: [m.rows.map((_, i) => i)] };
  }
  const font = f.fonts[f.fonts.length - 1];
  const m = f.measure(font);
  const capacity = Math.max(100, f.pagedHeight - (m.extras > 0 ? m.extras + f.gap : 0));
  return { font, pages: paginate(m.rows, capacity) };
}
