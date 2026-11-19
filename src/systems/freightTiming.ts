import { FREIGHT } from '../config/gameConfig';
import type { FreightCrossing, FreightRoute, Vec2 } from '../core/types';

function wrap(distance: number, length: number): number {
  return ((distance % length) + length) % length;
}

export function measureCircuit(route: FreightRoute) {
  let length = 0;
  const segments = route.points.map((a, i) => {
    const b = route.points[(i + 1) % route.points.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const size = Math.hypot(dx, dy);
    const start = length;
    length += size;
    return { a, start, end: length, dx: dx / size, dy: dy / size };
  });
  function sample(distance: number): Vec2 {
    const along = wrap(distance, length);
    const segment = segments.find(({ end }) => along < end)!;
    return {
      x: segment.a.x + segment.dx * (along - segment.start),
      y: segment.a.y + segment.dy * (along - segment.start),
    };
  }
  const crossings = route.crossings.map(({ center, width }: FreightCrossing) => {
    for (const { a, start, end, dx, dy } of segments) {
      const x = center.x - a.x, y = center.y - a.y;
      const along = x * dx + y * dy;
      if (along >= 0 && along <= end - start && Math.abs(x * dy - y * dx) < 0.01) {
        return { center, width, dx, dy, start: start + along - width / 2 };
      }
    }
    throw new Error('Freight crossing center must lie on the circuit');
  });
  return { length, sample, crossings };
}

export type RailCircuit = ReturnType<typeof measureCircuit>;
export type MeasuredCrossing = RailCircuit['crossings'][number];

export function freightFrontAt(circuit: RailCircuit, elapsed: number): number {
  return circuit.crossings[0].start + (elapsed - FREIGHT.firstWarningSec - FREIGHT.warningLeadSec) * FREIGHT.speed;
}

export function crossingFrame(circuit: RailCircuit, crossing: MeasuredCrossing, front: number, trainLength: number) {
  const lead = FREIGHT.warningLeadSec * FREIGHT.speed;
  const phase = wrap(front - crossing.start + lead, circuit.length);
  const clearance = lead + crossing.width + trainLength;
  return {
    warningFlash: phase < clearance + FREIGHT.warningTailSec * FREIGHT.speed
      ? Math.floor(phase / (FREIGHT.flashStepSec * FREIGHT.speed)) : -1,
    occupied: phase >= lead && phase < clearance,
  };
}

/** Orient each rigid carriage between its two wheelsets as they round a bend. */
export function carriagePose(circuit: RailCircuit, center: number, wheelbase: number) {
  const back = circuit.sample(center - wheelbase / 2);
  const front = circuit.sample(center + wheelbase / 2);
  return { x: (back.x + front.x) / 2, y: (back.y + front.y) / 2, angle: Math.atan2(front.y - back.y, front.x - back.x) };
}
