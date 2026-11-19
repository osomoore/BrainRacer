import { CAMERA } from '../../config/gameConfig';
import type { Rect } from '../../core/types';

/** HUD tunables (package I). */
export const HUD = {
  margin: 20,
  scoreboard: { w: 400, h: 250, top: 10, clearHalf: 220 },
  timerWarnSec: 30,
  timerBar: { h: 26, bottomMargin: 26, flashSec: 1, gap: 14 },
  panel: {
    showSec: 0.6,          // large + shaking + glowing at the top
    shrinkSec: 0.3,        // then shrinks to the docked size
    shakePx: 16,
    dockFrac: 0.95,        // docked scale = big scale * this (capped at 1)
    resultHoldSec: 0.7,    // show correct/wrong before fading
    fadeSec: 0.35,
    timeoutFadeSec: 0.4,
    wrongHintDelaySec: 0.3,
    maxBigScale: 1.7,
    carGap: 60,            // px between the car's screen spot and the panel's top edge
    maxW: 920,             // widest the panel/timer get (single mode is centered, not stretched)
    tagH: 62,              // room for the 'Look!' tag, drawn over the gap above the panel
  },
  goal: { edgeMargin: 70, onScreenMargin: 90, magnetScale: 1.5, magnetColor: 0xffd43b, arrowScale: 1.3 },
  goalBannerSec: 3,
  popupSec: 1.4,
  colors: { navy: 0x14213d, card: 0xffffff, green: 0x2ecc40, gray: 0xaab2bd, red: 0xff3b30, gold: 0xffd43b },
} as const;

/** Screen y of the car in a player's view (the camera keeps it at CAMERA.carScreenY). */
export function carScreenPos(view: Rect): { x: number; y: number } {
  return { x: view.x + view.w / 2, y: view.y + view.h * CAMERA.carScreenY };
}

/** Free region under the car for the challenge panel (above the timer bar), centered on the car. */
export function challengeRegion(view: Rect): Rect {
  const car = carScreenPos(view);
  const w = Math.min(HUD.panel.maxW, view.w - 2 * HUD.margin);
  const top = car.y + HUD.panel.carGap;
  const bottom = view.y + view.h - HUD.timerBar.bottomMargin - HUD.timerBar.h - HUD.timerBar.gap;
  return { x: car.x - w / 2, y: top, w, h: Math.max(100, bottom - top) };
}
