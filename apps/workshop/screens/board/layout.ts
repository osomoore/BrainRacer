/** Pure board-screen layout (wide: cards on top, one big detail panel; tall: challenge tabs on top, then a tall detail panel). */
import { WS_ROOM, WS_UI } from '../../config';
import { paneSize, type LayoutKind } from '../room/layout';

export interface BoxC { x: number; y: number; w: number; h: number }

export interface BoardLayout {
  kind: LayoutKind;
  size: { w: number; h: number };
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
  /** Pager for text pages (rare overflow only). */
  textPager: { x: number; y: number; gap: number };
  /** Height taken from the text area when the text pager is shown (0 when the pager sits in free space). */
  pagerReserve: number;
  title: { x: number; y: number; size: number; maxW: number };
  compactCards: boolean;
}

const PER_PAGE = 3;
/** Extra tab height (narrow layout) so a two-line title and the reward footer both fit. */
const TAB_FOOTER_EXTRA = 50;

/** Wallet badge (WS_WALLET, centre y 80) ends near y 121; the narrow tabs start below it. */
const BADGE_CLEAR = 134;

export function boardLayout(kind: LayoutKind, admin: boolean): BoardLayout {
  const size = paneSize(kind);
  if (kind === 'wide') {
    // The wallet badge (WS_WALLET) owns the top-left corner, so the cards start to its right; the panel spans the full width below.
    const rx = 300;
    const rw = size.w - rx - 30;
    const cw = (rw - 60) / 3;
    // Admin Mode: the shell's ADMIN MODE badge sits at the top center, so the cards start lower and a bit shorter.
    const ch = admin ? 170 : 190;
    const top = admin ? 74 : 30;
    const cards = [0, 1, 2].map((i) => ({ x: rx + cw / 2 + i * (cw + 30), y: top + ch / 2, w: cw, h: ch }));
    const panelTop = admin ? 370 : 250;
    const panelBottom = size.h - 30;
    const panelL = 30;
    const panel = { x: (panelL + size.w - 30) / 2, y: (panelTop + panelBottom) / 2, w: size.w - 60, h: panelBottom - panelTop };
    const btnH = 130;
    const btnY = panelBottom - 20 - btnH / 2;
    return {
      kind, size,
      cards, perPage: PER_PAGE,
      pager: { x: rx + rw / 2 - 250, y: 305, gap: 130 },
      newBtn: { x: rx + rw - 230, y: 305, w: 440, h: WS_UI.tapMin },
      back: { x: panelL + 40 + 115, y: btnY, w: 230, h: btnH },
      panel,
      testBtn: { x: panel.x + panel.w / 2 - 40 - 210, y: btnY, w: 420, h: btnH },
      // Full width and height above the button row (the wide cards already show the title).
      textArea: { x: panelL + 40, y: panelTop + 30, w: panel.w - 80, h: btnY - btnH / 2 - 20 - (panelTop + 30) },
      // Rare overflow: the pager sits in the free middle of the button row (no text height reserved).
      textPager: { x: panel.x, y: btnY, gap: 100 },
      pagerReserve: 0,
      title: { x: panelL + 40, y: panelTop + 62, size: 64, maxW: panel.w - 80 },
      compactCards: false,
    };
  }
  // Narrow pane: one view. Challenge tabs at the top (below the wallet badge), then a tall detail panel, then a bottom
  // row with Back, "Test it!" and (Admin Mode, more than one page) the card pager.
  const tabTop0 = BADGE_CLEAR + 6;
  const newBtn = { x: size.w / 2, y: tabTop0 + WS_UI.tapMin / 2, w: 700, h: WS_UI.tapMin };
  const tabTop = admin ? newBtn.y + WS_UI.tapMin / 2 + 10 : tabTop0;
  // Room under the tab title for the reward footer pill (see boardScreen addFooter): titles keep two lines.
  const tabH = WS_UI.tapMin + TAB_FOOTER_EXTRA;
  const gapX = 10;
  const tabW = (size.w - 60 - 2 * gapX) / 3;
  const cards = [0, 1, 2].map((i) => ({ x: 30 + tabW / 2 + i * (tabW + gapX), y: tabTop + tabH / 2, w: tabW, h: tabH }));
  const panelTop = tabTop + tabH + 15;
  const panelBottom = size.h - 135;
  const rowY = size.h - 62;
  const textTop = panelTop + 72;
  return {
    kind, size,
    cards, perPage: PER_PAGE,
    pager: { x: 770, y: rowY, gap: 50 },
    newBtn,
    back: { x: 125, y: rowY, w: 200, h: WS_UI.tapMin },
    panel: { x: size.w / 2, y: (panelTop + panelBottom) / 2, w: size.w - 40, h: panelBottom - panelTop },
    testBtn: { x: 405, y: rowY, w: 340, h: WS_UI.tapMin },
    textArea: { x: 50, y: textTop, w: size.w - 100, h: panelBottom - 20 - textTop },
    textPager: { x: size.w / 2, y: panelBottom - 20 - WS_UI.tapMin / 2, gap: 150 },
    pagerReserve: WS_UI.tapMin + 20,
    title: { x: 50, y: panelTop + 38, size: 56, maxW: size.w - 100 },
    compactCards: false,
  };
}

export const detailFonts = (kind: LayoutKind): readonly number[] => (kind === 'wide' ? WS_ROOM.detailFontsWide : WS_ROOM.detailFontsTall);
