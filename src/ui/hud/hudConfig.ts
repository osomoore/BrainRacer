/** HUD tunables (package I). */
export const HUD = {
  margin: 20,
  scoreboard: { w: 400, h: 250, top: 10, clearHalf: 220 },
  timerWarnSec: 30,
  timerBar: { h: 22, sideMargin: 40, bottomMargin: 36, flashSec: 1 },
  panel: {
    showSec: 0.6,          // large + shaking + glowing at the top
    shrinkSec: 0.3,        // then shrinks to the docked size
    shakePx: 16,
    bigMaxFrac: 0.38,      // big panel (incl. tag) stays within this fraction of the view height
    dockFrac: 0.85,        // docked scale = big scale * this (capped at 1)
    resultHoldSec: 0.7,    // show correct/wrong before fading
    fadeSec: 0.35,
    timeoutFadeSec: 0.4,
    wrongHintDelaySec: 0.3,
    maxBigScale: 1.7,
    dockTop: 12,
  },
  goal: { edgeMargin: 70, onScreenMargin: 90, magnetScale: 1.5, magnetColor: 0xffd43b, arrowScale: 1.3 },
  goalBannerSec: 3,
  popupSec: 1.4,
  colors: { navy: 0x14213d, card: 0xffffff, green: 0x2ecc40, gray: 0xaab2bd, red: 0xff3b30, gold: 0xffd43b },
} as const;
