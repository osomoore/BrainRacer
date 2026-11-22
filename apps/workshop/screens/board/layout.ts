/** Pure board-screen layout (wide: model + labels left, card tabs + detail panel right; tall: overview, detail is a second view). */
import { WS_ROOM } from '../../config';
import type { Model } from '../../core/types';
import { paneSize, type LayoutKind } from '../room/layout';

export interface BoxC { x: number; y: number; w: number; h: number }

export interface BoardLayout {
  kind: LayoutKind;
  size: { w: number; h: number };
  model: { x: number; groundY: number; maxW: number; maxH: number };
  labels: { x: number; y0: number; rowH: number; size: number; col1: number; w: number };
  cards: BoxC[];
  /** Cards per page. */
  perPage: number;
  pager: { x: number; y: number; gap: number };
  newBtn: BoxC;
  back: BoxC;
  /** Detail panel (wide: embedded on the right; tall: the whole second view). Center-based like BoxC. */
  panel: BoxC;
  testBtn: BoxC;
  loadBtn: BoxC;
  /** Text area inside the panel: top-left origin and size. */
  textArea: { x: number; y: number; w: number; h: number };
  /** Pager for text pages (inside the panel, bottom center). */
  textPager: { x: number; y: number; gap: number };
  title: { x: number; y: number; size: number; maxW: number };
  compactCards: boolean;
}

const PER_PAGE = 3;

export function boardLayout(kind: LayoutKind, admin: boolean): BoardLayout {
  const size = paneSize(kind);
  if (kind === 'wide') {
    const rx = 660;
    const rw = size.w - rx - 30;
    const cw = (rw - 60) / 3;
    // Admin Mode: the shell's ADMIN MODE badge sits at the top center, so the cards start lower and a bit shorter.
    const ch = admin ? 170 : 190;
    const top = admin ? 74 : 30;
    const cards = [0, 1, 2].map((i) => ({ x: rx + cw / 2 + i * (cw + 30), y: top + ch / 2, w: cw, h: ch }));
    const panelTop = admin ? 370 : 250;
    const panelBottom = size.h - 30;
    const panel = { x: rx + rw / 2, y: (panelTop + panelBottom) / 2, w: rw, h: panelBottom - panelTop };
    const btnH = 130;
    const btnY = panelBottom - 20 - btnH / 2;
    return {
      kind, size,
      model: { x: 330, groundY: 345, maxW: 580, maxH: 290 },
      labels: { x: 40, y0: 390, rowH: 52, size: 40, col1: 215, w: 580 },
      cards, perPage: PER_PAGE,
      pager: { x: rx + rw / 2 - 250, y: 305, gap: 130 },
      newBtn: { x: rx + rw - 230, y: 305, w: 440, h: 100 },
      back: { x: 150, y: 985, w: 230, h: 120 },
      panel,
      testBtn: { x: panel.x + panel.w / 2 - 40 - 210, y: btnY, w: 420, h: btnH },
      loadBtn: { x: panel.x - panel.w / 2 + 40 + 250, y: btnY, w: 500, h: 110 },
      textArea: { x: panel.x - panel.w / 2 + 40, y: panel.y - panel.h / 2 + 125, w: panel.w - 80, h: panel.h - 125 - 20 - btnH - 20 },
      textPager: { x: panel.x + panel.w / 2 - 40 - 190, y: panel.y - panel.h / 2 + 62, gap: 70 },
      title: { x: panel.x - panel.w / 2 + 40, y: panel.y - panel.h / 2 + 62, size: 64, maxW: panel.w - 80 - 420 },
      compactCards: false,
    };
  }
  const ch = admin ? 110 : 140;
  const cardTop = admin ? 590 : 505;
  const cards = [0, 1, 2].map((i) => ({ x: size.w / 2, y: cardTop + ch / 2 + i * (ch + 14), w: size.w - 60, h: ch }));
  const btnH = 130;
  const panelBottom = size.h - 140;
  const btnY = panelBottom - 20 - btnH / 2;
  return {
    kind, size,
    model: { x: 215, groundY: 400, maxW: 400, maxH: 330 },
    labels: { x: 425, y0: 30, rowH: 43, size: 40, col1: 190, w: 520 },
    cards, perPage: PER_PAGE,
    pager: { x: size.w / 2 + 120, y: size.h - 65, gap: 80 },
    newBtn: { x: size.w / 2, y: 525, w: 700, h: 100 },
    back: { x: 125, y: size.h - 65, w: 200, h: 110 },
    panel: { x: size.w / 2, y: 30 + (panelBottom - 30) / 2, w: size.w - 40, h: panelBottom - 30 },
    testBtn: { x: size.w - 40 - 190, y: btnY, w: 380, h: btnH },
    loadBtn: { x: 40 + 215, y: btnY, w: 430, h: 110 },
    textArea: { x: 50, y: 175, w: size.w - 100, h: btnY - btnH / 2 - 15 - 70 - 175 },
    textPager: { x: size.w / 2, y: btnY - btnH / 2 - 15 - 35, gap: 150 },
    title: { x: 50, y: 100, size: 56, maxW: size.w - 100 },
    compactCards: true,
  };
}

/** Variant labels shown read-only next to the model: [aspect label, variant name] in station order. */
export function labelRows(aspects: readonly { id: string; label: string }[], variants: readonly { id: string; name: string }[], model: Model): [string, string][] {
  return aspects.map((a) => [a.label, variants.find((v) => v.id === model[a.id])?.name ?? model[a.id] ?? '']);
}

export const detailFonts = (kind: LayoutKind): readonly number[] => (kind === 'wide' ? WS_ROOM.detailFontsWide : WS_ROOM.detailFontsTall);
