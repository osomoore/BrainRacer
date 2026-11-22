/** Input tunables (kept local to package A; the orchestrator may fold these into gameConfig). */
export const INPUT_CFG = {
  stickDeadzone: 0.18,
  navThreshold: 0.5,
  navRepeatDelaySec: 0.4,
  navRepeatIntervalSec: 0.15,
} as const;

/** Touch (on-screen controls) tunables. Sizes are % of the viewport height. */
export const TOUCH_CFG = {
  steerBtnVh: 26,
  brakeBtnVh: 20,
  smallBtnVh: 13,
  padBtnVh: 17,
  actionBtnVh: 22,
  edgeMarginVh: 4,
  /** A pad (controller) that was used more recently than touch hides the overlay. */
  alpha: 0.7,
} as const;
