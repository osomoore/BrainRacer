/** Input tunables (kept local to package A; the orchestrator may fold these into gameConfig). */
export const INPUT_CFG = {
  stickDeadzone: 0.18,
  navThreshold: 0.5,
  navRepeatDelaySec: 0.4,
  navRepeatIntervalSec: 0.15,
} as const;
