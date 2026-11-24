/** Pure board-screen layout (wide: composed model + challenge detail; tall: challenge overview, then detail). */
import { WS_ROOM, WS_UI } from '../../config';
import { paneSize, type LayoutKind } from '../room/layout';

export interface BoxC { x: number; y: number; w: number; h: number }

export interface BoardLayout {
  kind: LayoutKind;
  size: { w: number; h: number };
  model: { x: number; groundY: number; maxW: number; maxH: number };
  /** Composed rig and interactive aspect label/arrows shown with challenge detail. */
  partPreview: { x: number; y: number; maxW: number; maxH: number; labelX: number; labelY: number; labelW: number; arrowLeftX: number; arrowRightX: number; arrowY: number; arrowW: number; arrowH: number };
  cards: BoxC[];
  /** Cards per page. */
  perPage: number;
  pager: { x: number; y: number; gap: number };
  newBtn: BoxC;
  back: BoxC;
  /** Detail panel (wide: embedded on the right; tall: the whole second view). Center-based like BoxC. */
  panel: BoxC;
  testBtn: BoxC;
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
      partPreview: { x: 330, y: 345, maxW: 580, maxH: 290, labelX: 330, labelY: 530, labelW: 440, arrowLeftX: 240, arrowRightX: 420, arrowY: 640, arrowW: 120, arrowH: 120 },
      cards, perPage: PER_PAGE,
      pager: { x: rx + rw / 2 - 250, y: 305, gap: 130 },
      newBtn: { x: rx + rw - 230, y: 305, w: 440, h: WS_UI.tapMin },
      back: { x: 150, y: 985, w: 230, h: 120 },
      panel,
      testBtn: { x: panel.x + panel.w / 2 - 40 - 210, y: btnY, w: 420, h: btnH },
      textArea: { x: panel.x - panel.w / 2 + 40, y: panel.y - panel.h / 2 + 125, w: panel.w - 80, h: panel.h - 125 - 20 - btnH - 20 },
      textPager: { x: panel.x + panel.w / 2 - 40 - 190, y: panel.y - panel.h / 2 + 62, gap: 70 },
      title: { x: panel.x - panel.w / 2 + 40, y: panel.y - panel.h / 2 + 62, size: 64, maxW: panel.w - 80 - 420 },
      compactCards: false,
    };
  }
  const ch = admin ? WS_UI.tapMin : 140;
  const cardTop = admin ? 585 : 505;
  const cardGap = admin ? 6 : 14;
  const cards = [0, 1, 2].map((i) => ({ x: size.w / 2, y: cardTop + ch / 2 + i * (ch + cardGap), w: size.w - 60, h: ch }));
  const btnH = 130;
  const panelBottom = size.h - 140;
  const btnY = panelBottom - 20 - btnH / 2;
  return {
    kind, size,
    model: { x: 215, groundY: 400, maxW: 400, maxH: 330 },
    partPreview: { x: 480, y: 343, maxW: 420, maxH: 170, labelX: 480, labelY: 425, labelW: 480, arrowLeftX: 160, arrowRightX: 800, arrowY: 425, arrowW: 120, arrowH: 120 },
    cards, perPage: PER_PAGE,
    pager: { x: size.w / 2 + 170, y: size.h - 62, gap: 80 },
    newBtn: { x: size.w / 2, y: 520, w: 700, h: WS_UI.tapMin },
    back: { x: 125, y: size.h - 62, w: 200, h: WS_UI.tapMin },
    panel: { x: size.w / 2, y: 30 + (panelBottom - 30) / 2, w: size.w - 40, h: panelBottom - 30 },
    testBtn: { x: size.w - 40 - 190, y: btnY, w: 380, h: btnH },
    textArea: { x: 50, y: 500, w: size.w - 100, h: btnY - btnH / 2 - 15 - 70 - 500 },
    textPager: { x: size.w / 2, y: btnY - btnH / 2 - 15 - 35, gap: 150 },
    title: { x: 50, y: 100, size: 56, maxW: size.w - 100 },
    compactCards: true,
  };
}

export const detailFonts = (kind: LayoutKind): readonly number[] => (kind === 'wide' ? WS_ROOM.detailFontsWide : WS_ROOM.detailFontsTall);
