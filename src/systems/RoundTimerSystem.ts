/** Round clock: tick / half / end events; builds RoundResults at the end. */
import type { GameSystem, RaceContext } from '../core/race';
import { RoundClock, buildResults, roundStore } from './roundStats';

export class RoundTimerSystem implements GameSystem {
  static order = 10;
  readonly name = 'roundTimer';
  private clock = new RoundClock(300);

  init(ctx: RaceContext): void {
    this.clock = new RoundClock(ctx.roundLengthSec);
  }

  update(_dt: number, ctx: RaceContext): void {
    const ev = this.clock.step(ctx.elapsedSec);
    if (ev.tick !== undefined) ctx.bus.emit('round:tick', { remainingSec: ev.tick });
    if (ev.half) ctx.bus.emit('round:half', {});
    if (ev.end) {
      ctx.bus.emit('round:end', { results: buildResults(roundStore.players, roundStore.goalsCompleted, ctx.world.seed) });
    }
  }

  destroy(): void {}
}
