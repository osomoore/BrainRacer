/** Pure (Phaser-free) room layout: where the ten station signs, the challenge board, the model and the walking stand points are. */
import { WS_BUDDIES, WS_ROOM, WS_UI, STAGE } from '../../config';

export type LayoutKind = 'wide' | 'tall';

/** Center-based rectangle. */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

export interface StationSlot extends Rect { aspect: string; stand: Point }
export interface RoomLayout {
  size: { w: number; h: number };
  stations: StationSlot[];
  buddyStation: Rect & { stand: Point };
  buddyBar: Rect;
  worldButton: Rect;
  buddy: Point & { size: number };
  board: Rect & { stand: Point };
  characterHome: Point;
  /** Model stands at (x, groundY); it must fit inside maxW x maxH above the ground. */
  model: { x: number; groundY: number; maxW: number; maxH: number };
  /** Top of the floor band (the wall ends here). */
  floorY: number;
}

export function paneSize(kind: LayoutKind): { w: number; h: number } {
  return { w: kind === 'wide' ? STAGE.w : STAGE.w / 2, h: STAGE.h };
}

export function roomLayout(kind: LayoutKind, aspects: readonly string[]): RoomLayout {
  const size = paneSize(kind);
  const { signX, signY, buddyX, buddySize } = WS_BUDDIES.room[kind];
  const buddyStation = {
    x: signX, y: signY, w: WS_BUDDIES.signW, h: WS_BUDDIES.signH,
    stand: kind === 'wide'
      ? { x: signX, y: signY + WS_BUDDIES.signH / 2 + 90 }
      : { x: signX, y: signY - WS_BUDDIES.signH / 2 },
  };
  const { barX, barW } = WS_BUDDIES.room.wide;
  const buddyBar = kind === 'wide'
    ? { x: barX, y: WS_BUDDIES.barY, w: barW, h: WS_BUDDIES.barH }
    : WS_BUDDIES.roomStrip;
  const worldButton = {
    x: size.w - WS_UI.worldButton.inset - WS_UI.tapMin / 2,
    y: WS_UI.worldButton.y, w: WS_UI.tapMin, h: WS_UI.tapMin,
  };
  const sign = WS_ROOM.signSize[kind];
  const slots: Point[] = [];
  if (kind === 'wide') {
    const top = 110, ys = [225, 430, 635, 840];
    const lx = 190, rx = size.w - 190;
    if (aspects.length <= WS_ROOM.fewStations) {
      // Starter/Easy: three rows on each side leave a wide, clear channel for the model.
      for (const y of [225, 420, 615]) slots.push({ x: rx, y }, { x: lx, y });
    } else {
    // clockwise from the top: two on the top wall, four down the right side, four up the left side
    slots.push({ x: 760, y: top }, { x: 1160, y: top });
    for (const y of ys) slots.push({ x: rx, y });
    for (const y of [...ys].reverse()) slots.push({ x: lx, y });
    }
  } else {
    const lx = WS_ROOM.tallRoom.stationInset, rx = size.w - lx;
    // Starter/Easy: three rows on each side leave the central model, buddy, and Test clear.
    const rows = aspects.length <= WS_ROOM.fewStations ? WS_ROOM.tallRoom.starterRows : WS_ROOM.tallRoom.fullRows;
    for (const y of rows) slots.push({ x: lx, y }, { x: rx, y });
  }
  const stations: StationSlot[] = aspects.map((aspect, i) => {
    const p = slots[i] ?? { x: size.w / 2, y: size.h / 2 };
    const fromTop = kind === 'wide' && aspects.length > WS_ROOM.fewStations && i < 2;
    const toCenter = p.x < size.w / 2 ? 1 : -1;
    const stand = fromTop
      ? { x: p.x, y: p.y + sign.h / 2 + 90 }
      : { x: p.x + toCenter * (sign.w / 2 + 70), y: p.y + 45 };
    return { aspect, x: p.x, y: p.y, w: sign.w, h: sign.h, stand };
  });
  if (kind === 'wide') {
    const board = { x: size.w / 2, y: 950, w: 620, h: 190 };
    const stand = { x: board.x - board.w / 2 - 70, y: 905 };
    return {
      size, stations, buddyStation, buddyBar, worldButton, characterHome: stand,
      buddy: { x: buddyX, y: 820, size: buddySize },
      board: { ...board, stand },
      model: { x: size.w / 2, groundY: 820, maxW: 900, maxH: 560 },
      floorY: 713,
    };
  }
  const { board, characterHome, model } = WS_ROOM.tallRoom;
  return {
    size, stations, buddyStation, buddyBar, worldButton, characterHome,
    buddy: { x: buddyX, y: 770, size: buddySize },
    board: { ...board, stand: { x: board.x + board.w / 2 + 34, y: board.y } },
    model,
    floorY: 713,
  };
}

/** Where the character stands when the room opens. */
export function standOf(layout: RoomLayout, from: string | undefined): Point {
  if (layout.size.w < STAGE.w) return { ...layout.characterHome };
  if (from === 'buddies') return { ...layout.buddyStation.stand };
  const st = layout.stations.find((s) => s.aspect === from);
  return st ? { ...st.stand } : { ...layout.board.stand };
}

export function dist(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.y - a.y); }

/** Seconds to walk between two points. */
export function walkSeconds(a: Point, b: Point, speed: number = WS_ROOM.walkSpeed): number { return dist(a, b) / speed; }

/** Moves `from` toward `to` by `step` px; `arrived` when it reaches it. */
export function stepToward(from: Point, to: Point, step: number): { p: Point; arrived: boolean } {
  const d = dist(from, to);
  if (d <= step) return { p: { ...to }, arrived: true };
  const k = step / d;
  return { p: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, arrived: false };
}

export const rectsOverlap = (a: Rect, b: Rect): boolean => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
