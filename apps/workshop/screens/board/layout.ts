/** Pure board-screen layout (wide: composed model + challenge detail; tall: one view with model, challenge tabs and detail). */
import { WS_ROOM, WS_UI } from '../../config';
import { paneSize, type LayoutKind } from '../room/layout';

export interface BoxC { x: number; y: number; w: number; h: number }

export interface BoardLayout {
  kind: LayoutKind;
  size: { w: number; h: number };
  /** Backing panel of the model/part preview. */
  modelPanel?: BoxC;
  model: { x: number; groundY: number; maxW: number; maxH: number };
  /** Composed rig and the highlighted-part name label shown with challenge detail. */
  partPreview: { x: number; y: number; maxW: number; maxH: number; labelX: number; labelY: number; labelW: number };
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
      partPreview: { x: 330, y: 345, maxW: 580, maxH: 290, labelX: 330, labelY: 440, labelW: 440 },
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
  // Narrow pane: one view. Vehicle + part walk on top, three challenge tabs, the selected challenge's text below,
  // and a bottom row with Back, "Test it!" and (Admin Mode, more than one page) the card pager.
  const mt = 10;
  const mh = admin ? 310 : 370;
  const ground = admin ? 225 : 270;
  const maxH = admin ? 150 : 200;
  const labelY = admin ? 280 : 335;
  const newBtn = { x: size.w / 2, y: mt + mh + 10 + WS_UI.tapMin / 2, w: 700, h: WS_UI.tapMin };
  const tabTop = admin ? newBtn.y + WS_UI.tapMin / 2 + 10 : mt + mh + 15;
  const tabH = WS_UI.tapMin;
  const gapX = 10;
  const tabW = (size.w - 60 - 2 * gapX) / 3;
  const cards = [0, 1, 2].map((i) => ({ x: 30 + tabW / 2 + i * (tabW + gapX), y: tabTop + tabH / 2, w: tabW, h: tabH }));
  const panelTop = tabTop + tabH + 15;
  const panelBottom = size.h - 135;
  const rowY = size.h - 62;
  const textPagerY = panelBottom - 50;
  const textTop = panelTop + 100;
  return {
    kind, size,
    model: { x: size.w / 2, groundY: ground, maxW: 420, maxH },
    modelPanel: { x: size.w / 2, y: mt + mh / 2, w: size.w - 20, h: mh },
    partPreview: { x: size.w / 2, y: ground, maxW: 420, maxH, labelX: size.w / 2, labelY, labelW: 480 },
    cards, perPage: PER_PAGE,
    pager: { x: 770, y: rowY, gap: 50 },
    newBtn,
    back: { x: 125, y: rowY, w: 200, h: WS_UI.tapMin },
    panel: { x: size.w / 2, y: (panelTop + panelBottom) / 2, w: size.w - 40, h: panelBottom - panelTop },
    testBtn: { x: 405, y: rowY, w: 340, h: WS_UI.tapMin },
    textArea: { x: 50, y: textTop, w: size.w - 100, h: textPagerY - 45 - textTop },
    textPager: { x: size.w / 2, y: textPagerY, gap: 150 },
    title: { x: 50, y: panelTop + 50, size: 56, maxW: size.w - 100 },
    compactCards: false,
  };
}

export const detailFonts = (kind: LayoutKind): readonly number[] => (kind === 'wide' ? WS_ROOM.detailFontsWide : WS_ROOM.detailFontsTall);
