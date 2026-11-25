import { describe, expect, it } from 'vitest';
import { WS_UI } from '../../config';
import { rectsOverlap } from '../room/layout';
import { boardLayout } from './layout';

describe('boardLayout', () => {
  for (const kind of ['wide', 'tall'] as const) for (const admin of [false, true]) {
    const L = boardLayout(kind, admin);
    it(`${kind}${admin ? ' admin' : ''}: three cards, tappable, inside the pane`, () => {
      expect(L.cards).toHaveLength(3);
      for (const b of [...L.cards, L.back, L.testBtn, L.newBtn]) {
        expect(Math.min(b.w, b.h)).toBeGreaterThanOrEqual(WS_UI.tapMin);
        expect(b.x - b.w / 2).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w / 2).toBeLessThanOrEqual(L.size.w);
        expect(b.y - b.h / 2).toBeGreaterThanOrEqual(0);
        expect(b.y + b.h / 2).toBeLessThanOrEqual(L.size.h);
      }
    });
    it(`${kind}${admin ? ' admin' : ''}: text area is inside the panel and above the buttons`, () => {
      const t = L.textArea;
      expect(t.x).toBeGreaterThanOrEqual(L.panel.x - L.panel.w / 2);
      expect(t.x + t.w).toBeLessThanOrEqual(L.panel.x + L.panel.w / 2 + 1);
      if (kind === 'wide') expect(t.y + t.h).toBeLessThanOrEqual(L.testBtn.y - L.testBtn.h / 2);
      else expect(t.y + t.h).toBeLessThanOrEqual(L.panel.y + L.panel.h / 2);
      // With the pager shown the text area shrinks by pagerReserve and still keeps room, and the pager sits under the text.
      expect(t.h - L.pagerReserve).toBeGreaterThan(kind === 'wide' ? 400 : admin ? 150 : 300);
      expect(L.textPager.y - 60).toBeGreaterThanOrEqual(t.y + t.h - L.pagerReserve);
      if (kind === 'tall') expect(L.title.y + L.title.size / 2).toBeLessThan(t.y);
      if (kind === 'tall') expect(L.panel.y + L.panel.h / 2).toBeLessThanOrEqual(L.back.y - L.back.h / 2);
    });
  }
  it('wide: cards and the full-width panel never overlap; the wallet corner stays free', () => {
    for (const admin of [false, true]) {
      const L = boardLayout('wide', admin);
      for (const c of L.cards) { expect(rectsOverlap(c, L.panel)).toBe(false); expect(c.x - c.w / 2).toBeGreaterThanOrEqual(250); }
      if (admin) expect(rectsOverlap(L.newBtn, L.panel)).toBe(false);
      for (const b of [L.back, L.testBtn]) expect(b.y + b.h / 2).toBeLessThanOrEqual(L.panel.y + L.panel.h / 2);
    }
  });
  it('tall: one view; newBtn, tabs, panel and bottom row stack without overlap', () => {
    for (const admin of [false, true]) {
      const L = boardLayout('tall', admin);
      const tabTop = L.cards[0].y - L.cards[0].h / 2;
      expect(tabTop).toBeGreaterThanOrEqual(134);
      for (const c of L.cards) expect(rectsOverlap(c, L.panel)).toBe(false);
      for (const c of L.cards) expect(c.x - c.w / 2).toBeGreaterThanOrEqual(0);
      expect(L.cards[2].x + L.cards[2].w / 2).toBeLessThanOrEqual(L.size.w);
      for (const b of [L.back, L.testBtn]) expect(rectsOverlap(b, L.panel)).toBe(false);
      expect(rectsOverlap(L.back, L.testBtn)).toBe(false);
      expect(L.testBtn.x + L.testBtn.w / 2).toBeLessThan(L.pager.x - L.pager.gap - 120);
      if (admin) {
        expect(rectsOverlap(L.newBtn, L.cards[0])).toBe(false);
        expect(L.newBtn.y + L.newBtn.h / 2).toBeLessThanOrEqual(tabTop);
      }
    }
  });
});
