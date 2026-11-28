/** Shared room/station model framing, based on the largest selectable size. */
import { WS_ROOM, WS_UI } from '../config';
import type { WorkshopId } from '../core/types';
import type { LayoutKind, Rect, RoomLayout } from './room/layout';

export interface ModelDimensions { width: number; height: number }

export interface AnchoredBounds extends ModelDimensions { x: number; y: number }
export interface FitRect { x: number; y: number; width: number; height: number }

/** Cap a grounded model before its reference silhouette touches any screen rectangle. */
export function clampAnchoredFit(
  preferred: number,
  anchor: { x: number; y: number },
  bounds: AnchoredBounds,
  obstacles: readonly FitRect[],
  clearance: number = WS_ROOM.modelTopClearancePx,
): number {
  let scale = preferred;
  for (const o of obstacles) {
    const left = o.x - o.width / 2 - clearance;
    const right = o.x + o.width / 2 + clearance;
    const top = o.y - o.height / 2 - clearance;
    const bottom = o.y + o.height / 2 + clearance;
    const bx0 = anchor.x + bounds.x * preferred;
    const bx1 = anchor.x + (bounds.x + bounds.width) * preferred;
    const by0 = anchor.y + bounds.y * preferred;
    const by1 = anchor.y + (bounds.y + bounds.height) * preferred;
    if (bx1 <= left || bx0 >= right || by1 <= top || by0 >= bottom) continue;

    // Horizontal and vertical first-contact scales. The larger is where both axes can overlap.
    const xContact = anchor.x < left
      ? (left - anchor.x) / Math.max(1, bounds.x + bounds.width)
      : anchor.x > right
        ? (right - anchor.x) / Math.min(-1, bounds.x)
        : 0;
    const yContact = anchor.y < top
      ? (top - anchor.y) / Math.max(1, bounds.y + bounds.height)
      : anchor.y > bottom
        ? (bottom - anchor.y) / Math.min(-1, bounds.y)
        : 0;
    scale = Math.min(scale, Math.max(xContact, yContact));
  }
  return Math.max(0, scale);
}

/** Shared room reference framing used before a station applies its own camera focus. */
export function fitRoomModelScale(
  bounds: AnchoredBounds,
  model: { x: number; y: number; width: number; height: number },
  preferredScale: number,
  obstacles: readonly FitRect[],
  options: { topOverhang?: number; topClearance?: number; paneWidth?: number } = {},
): number {
  const clearance = options.topClearance ?? WS_ROOM.modelTopClearancePx;
  const base = Math.min(
    preferredScale,
    model.width / Math.max(1, bounds.width),
    model.height / Math.max(1, -bounds.y),
  );
  // Let the large silhouette grow from its plain fit, even when width set that fit;
  // real room hit areas and pane edges provide the final cap.
  const requested = Math.min(preferredScale, base * (1 + (options.topOverhang ?? 0)));
  const paneCapped = options.paneWidth
    ? Math.min(requested, (options.paneWidth - 2 * clearance) / Math.max(1, bounds.width))
    : requested;
  const topCapped = Math.min(paneCapped, (model.y - clearance) / Math.max(1, -bounds.y));
  return clampAnchoredFit(topCapped, { x: model.x, y: model.y }, bounds, obstacles, clearance);
}

/** Resolve the common room reference fit and the room's actual button obstacle geometry. */
export function roomReferenceFit(
  bounds: AnchoredBounds,
  layout: RoomLayout,
  kind: LayoutKind,
  workshop: WorkshopId,
  touch: boolean,
): { scale: number; width: number } {
  const buttons: Rect[] = [...layout.stations, layout.buddyStation, layout.board, layout.worldButton, layout.buddyBar];
  if (touch) buttons.push(WS_UI.roomBack);
  const width = layout.model.maxW;
  const obstacles = buttons.map((o) => ({ x: o.x, y: o.y, width: o.w, height: o.h }));
  // Feet, tails and shadows that hang a little below the floor line must not shrink the model to clear the
  // Test button below it (a huge dino's silhouette reaches ~90 px under its anchor).
  const standing = { ...bounds, height: Math.min(bounds.height, -bounds.y + WS_ROOM.modelBelowFloorPx) };
  const scale = fitRoomModelScale(standing,
    { x: layout.model.x, y: layout.model.groundY, width, height: layout.model.maxH },
    WS_ROOM.modelScale[kind], obstacles,
    { topOverhang: workshop === 'dino' ? WS_ROOM.dinoTopOverhang : 0,
      topClearance: WS_ROOM.modelTopClearancePx, paneWidth: layout.size.w });
  return { scale, width };
}
