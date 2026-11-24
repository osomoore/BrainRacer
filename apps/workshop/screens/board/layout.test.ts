import { describe, expect, it } from 'vitest';
import { WS_PARTVIEW, WS_UI } from '../../config';
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
      const p = L.partPreview;
      expect(p.labelX - p.labelW / 2).toBeGreaterThanOrEqual(0);
      expect(p.labelX + p.labelW / 2).toBeLessThanOrEqual(L.size.w);
      // the zoom viewport ends above the label, and both arrows sit inside the pane without covering the viewport
      expect(p.view.y + p.view.h / 2).toBeLessThan(p.labelY - 29);
      const half = WS_PARTVIEW.arrowSize / 2;
      for (const a of [p.arrows.prev, p.arrows.next]) {
        expect(a.x - half).toBeGreaterThanOrEqual(0);
        expect(a.x + half).toBeLessThanOrEqual(L.size.w);
        expect(a.x + half <= p.view.x - p.view.w / 2 || a.x - half >= p.view.x + p.view.w / 2).toBe(true);
      }
    });
    it(`${kind}${admin ? ' admin' : ''}: text area is inside the panel and above the buttons`, () => {
      const t = L.textArea;
      expect(t.x).toBeGreaterThanOrEqual(L.panel.x - L.panel.w / 2);
      expect(t.x + t.w).toBeLessThanOrEqual(L.panel.x + L.panel.w / 2 + 1);
      if (kind === 'wide') expect(t.y + t.h).toBeLessThanOrEqual(L.testBtn.y - L.testBtn.h / 2);
      else expect(t.y + t.h).toBeLessThanOrEqual(L.textPager.y);
      expect(t.h).toBeGreaterThan(kind === 'wide' ? 300 : 150);
      if (kind === 'tall') expect(L.title.y + L.title.size / 2).toBeLessThan(t.y);
      if (kind === 'tall') expect(L.panel.y + L.panel.h / 2).toBeLessThanOrEqual(L.back.y - L.back.h / 2);
    });
  }
  it('wide: left column and the right region never overlap', () => {
    for (const admin of [false, true]) {
      const L = boardLayout('wide', admin);
      for (const c of L.cards) expect(rectsOverlap(c, L.panel)).toBe(false);
      if (admin) expect(rectsOverlap(L.newBtn, L.panel)).toBe(false);
      expect(L.model.x + L.model.maxW / 2).toBeLessThan(L.panel.x - L.panel.w / 2);
    }
  });
  it('tall: one view; preview, newBtn, tabs, panel and bottom row stack without overlap', () => {
    for (const admin of [false, true]) {
      const L = boardLayout('tall', admin);
      const p = L.partPreview;
      const tabTop = L.cards[0].y - L.cards[0].h / 2;
      expect(p.labelY).toBeLessThan(tabTop);
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
