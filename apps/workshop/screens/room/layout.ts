/** Pure (Phaser-free) room layout: where the ten station signs, the challenge board, the model and the walking stand points are. */
import { WS_ROOM, STAGE } from '../../config';

export type LayoutKind = 'wide' | 'tall';

/** Center-based rectangle. */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

export interface StationSlot extends Rect { aspect: string; stand: Point }
export interface RoomLayout {
  size: { w: number; h: number };
  stations: StationSlot[];
  board: Rect & { stand: Point };
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
  const sign = WS_ROOM.signSize[kind];
  const slots: Point[] = [];
  if (kind === 'wide') {
    const top = 110, ys = [225, 430, 635, 840];
    const lx = 190, rx = size.w - 190;
    // clockwise from the top: two on the top wall, four down the right side, four up the left side
    slots.push({ x: 760, y: top }, { x: 1160, y: top });
    for (const y of ys) slots.push({ x: rx, y });
    for (const y of [...ys].reverse()) slots.push({ x: lx, y });
  } else {
    const lx = 125, rx = size.w - 125;
    for (let i = 0; i < 5; i++) { const y = 100 + i * 175; slots.push({ x: lx, y }, { x: rx, y }); }
  }
  const stations: StationSlot[] = aspects.map((aspect, i) => {
    const p = slots[i] ?? { x: size.w / 2, y: size.h / 2 };
    const fromTop = kind === 'wide' && i < 2;
    const toCenter = p.x < size.w / 2 ? 1 : -1;
    const stand = fromTop
      ? { x: p.x, y: p.y + sign.h / 2 + 90 }
      : { x: p.x + toCenter * (sign.w / 2 + 70), y: p.y + 45 };
    return { aspect, x: p.x, y: p.y, w: sign.w, h: sign.h, stand };
  });
  if (kind === 'wide') {
    const board = { x: size.w / 2, y: 950, w: 620, h: 190 };
    return {
      size, stations,
      board: { ...board, stand: { x: board.x - board.w / 2 - 70, y: 905 } },
      model: { x: size.w / 2, groundY: 820, maxW: 900, maxH: 560 },
      floorY: 713,
    };
  }
  const board = { x: size.w / 2, y: 975, w: 700, h: 170 };
  return {
    size, stations,
    board: { ...board, stand: { x: size.w / 2, y: 880 } },
    model: { x: size.w / 2, groundY: 770, maxW: 440, maxH: 520 },
    floorY: 713,
  };
}

/** Where the character stands when the room opens. */
export function standOf(layout: RoomLayout, from: string | undefined): Point {
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
