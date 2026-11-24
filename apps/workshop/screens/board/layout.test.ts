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
      const p = L.partPreview;
      expect(Math.min(p.arrowW, p.arrowH)).toBeGreaterThanOrEqual(WS_UI.tapMin);
      for (const x of [p.arrowLeftX, p.arrowRightX]) {
        expect(x - p.arrowW / 2).toBeGreaterThanOrEqual(0);
        expect(x + p.arrowW / 2).toBeLessThanOrEqual(L.size.w);
      }
      expect(p.arrowY - p.arrowH / 2).toBeGreaterThanOrEqual(0);
      expect(p.arrowY + p.arrowH / 2).toBeLessThanOrEqual(L.size.h);
      expect(p.labelX - p.labelW / 2).toBeGreaterThanOrEqual(0);
      expect(p.labelX + p.labelW / 2).toBeLessThanOrEqual(L.size.w);
    });
    it(`${kind}${admin ? ' admin' : ''}: text area is inside the panel and above the buttons`, () => {
      const t = L.textArea;
      expect(t.x).toBeGreaterThanOrEqual(L.panel.x - L.panel.w / 2);
      expect(t.x + t.w).toBeLessThanOrEqual(L.panel.x + L.panel.w / 2 + 1);
      expect(t.y + t.h).toBeLessThanOrEqual(L.testBtn.y - L.testBtn.h / 2);
      expect(t.h).toBeGreaterThan(kind === 'wide' ? 300 : 180);
      if (kind === 'tall') expect(L.title.y + L.title.size / 2).toBeLessThan(L.partPreview.y - L.partPreview.maxH);
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
  it('tall: cards, back and (admin) new button do not overlap; preview label sits above cards', () => {
    for (const admin of [false, true]) {
      const L = boardLayout('tall', admin);
      const cardTop = L.cards[0].y - L.cards[0].h / 2;
      expect(L.partPreview.labelY).toBeLessThan(cardTop);
      expect(L.cards[2].y + L.cards[2].h / 2).toBeLessThanOrEqual(L.back.y - L.back.h / 2);
      if (admin) {
        expect(rectsOverlap(L.newBtn, L.cards[0])).toBe(false);
        expect(L.newBtn.y + L.newBtn.h / 2).toBeLessThanOrEqual(cardTop);
      }
    }
  });
});
