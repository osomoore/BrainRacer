import { FREIGHT } from '../config/gameConfig';

/** Position in rail-space where 0 is the route start. */
export function freightFrameAt(elapsed: number, crossingStart: number, crossingWidth: number, trainLength: number) {
  const phase = (elapsed - FREIGHT.firstWarningSec) % FREIGHT.periodSec;
  const arrival = FREIGHT.warningLeadSec;
  const departure = arrival + (crossingWidth + trainLength) / FREIGHT.speed;
  const warning = phase >= 0 && phase < departure + FREIGHT.warningTailSec;
  return {
    front: crossingStart + (phase - arrival) * FREIGHT.speed,
    warningFlash: warning ? Math.floor(phase / FREIGHT.flashStepSec) : -1,
    occupied: phase >= arrival && phase < departure,
  };
}
