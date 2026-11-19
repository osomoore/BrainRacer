/** Runs one ChallengeScheduler per player; forwards events to the bus and plays sfx. No scoring here. */
import { CHALLENGE } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { GameSystem, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId } from '../core/types';
import { ChallengeGenerator } from '../challenge/ChallengeGenerator';
import { ChallengeScheduler, type SchedulerEvent } from '../challenge/ChallengeScheduler';

const RNG_SALT = 0xb1;

export class ChallengeSystem implements GameSystem {
  readonly name = 'challenge';
  private schedulers: ChallengeScheduler[] = [];
  /** Indices of places each player is currently near (to fire once per entry). */
  private near: Set<number>[] = [];

  init(ctx: RaceContext): void {
    const rng: Rng = ctx.rng.fork(RNG_SALT);
    this.schedulers = ctx.settings.players.map((p, i) => new ChallengeScheduler({
      player: i as PlayerId,
      difficulty: p.difficulty,
      intervalSec: ctx.settings.challengeIntervalSec,
      generator: new ChallengeGenerator(rng.fork(i * 2 + 1)),
      rng: rng.fork(i * 2 + 2),
      startDelaySec: CHALLENGE.firstChallengeDelaySec,
    }));
    this.near = this.schedulers.map(() => new Set<number>());
  }

  update(_dt: number, ctx: RaceContext): void {
    const now = ctx.elapsedSec;
    this.schedulers.forEach((sched, i) => {
      const player = i as PlayerId;
      const events = sched.update(now);
      const slot = services.input.get(player).answer;
      if (slot !== null) events.push(...sched.answer(slot, now));
      events.push(...this.checkPlaces(player, sched, ctx, now));
      this.forward(events, player, ctx);
    });
  }

  destroy(): void {
    this.schedulers = [];
    this.near = [];
  }

  private checkPlaces(player: PlayerId, sched: ChallengeScheduler, ctx: RaceContext, now: number): SchedulerEvent[] {
    const car = ctx.players[player];
    if (!car) return [];
    const events: SchedulerEvent[] = [];
    const r2 = CHALLENGE.placeTriggerRadius ** 2;
    const inside = this.near[player];
    ctx.world.places.forEach((place, idx) => {
      const dx = car.x - place.sign.x;
      const dy = car.y - place.sign.y;
      if (dx * dx + dy * dy > r2) { inside.delete(idx); return; }
      if (inside.has(idx)) return;
      inside.add(idx);
      ctx.bus.emit('place:near', { player, word: place.word });
      events.push(...sched.notifyPlace(place.word, now));
    });
    return events;
  }

  private forward(events: SchedulerEvent[], player: PlayerId, ctx: RaceContext): void {
    for (const e of events) {
      if (e.type === 'shown') {
        ctx.bus.emit('challenge:shown', { challenge: e.challenge });
      } else {
        ctx.bus.emit('challenge:resolved', { challenge: e.challenge, result: e.result, chosen: e.chosen });
        services.audio.sfx(e.result, { pan: this.pan(player) });
      }
    }
  }

  private pan(player: PlayerId): number {
    if (this.schedulers.length < 2) return 0;
    return player === 0 ? -CHALLENGE.teamPan : CHALLENGE.teamPan;
  }
}
