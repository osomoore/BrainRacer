/**
 * Challenges for both question styles; forwards events to the bus and plays sfx. No scoring here.
 *  - 'drive': one ChallengeScheduler per player (continuous, timer bar, answered while driving).
 *  - 'pause': one shared BreakScheduler; a break freezes the world (RaceScene runs only this system
 *    while ctx.questionBreak is true) until every player has answered correctly.
 */
import { CHALLENGE } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { GameSystem, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { Challenge, PlayerId } from '../core/types';
import { BreakScheduler, type BreakEvent } from '../challenge/BreakScheduler';
import { ChallengeFactory } from '../challenge/ChallengeFactory';
import { ChallengeGenerator } from '../challenge/ChallengeGenerator';
import { ChallengeScheduler, type SchedulerEvent } from '../challenge/ChallengeScheduler';

const RNG_SALT = 0xb1;

export class ChallengeSystem implements GameSystem {
  readonly name = 'challenge';
  private schedulers: ChallengeScheduler[] = [];
  private breaks: BreakScheduler | null = null;
  private nPlayers = 1;
  /** Indices of places each player is currently near (to fire once per entry). */
  private near: Set<number>[] = [];
  private guard: number[] = [];
  private pause = false;

  init(ctx: RaceContext): void {
    ctx.questionBreak = false;
    // Test hook: lets e2e read the current question's correct slot.
    (globalThis as { __challenge?: unknown }).__challenge = {
      current: (p: number): Challenge | null => this.breaks?.current(p as PlayerId) ?? this.schedulers[p]?.current ?? null,
      phase: () => this.breaks?.phase ?? 'drive',
      state: (p: number) => this.breaks?.playerState(p as PlayerId) ?? null,
    };
    const mode = ctx.settings.challengeMode ?? 'words';
    if (mode === 'off') return;

    const rng: Rng = ctx.rng.fork(RNG_SALT);
    this.pause = (ctx.settings.questionStyle ?? 'pause') === 'pause';
    const players = ctx.settings.players;
    this.nPlayers = players.length;
    if (this.pause) {
      const factories = players.map((p, i) => new ChallengeFactory({
        player: i as PlayerId, difficulty: p.difficulty, generator: new ChallengeGenerator(rng.fork(i * 2 + 1)),
        rng: rng.fork(i * 2 + 2), mode, optionCount: CHALLENGE.pauseOptions as 3 | 4,
      }));
      this.breaks = new BreakScheduler({
        players: players.length,
        firstAtSec: CHALLENGE.firstBreakSec,
        intervalSec: ctx.settings.challengeIntervalSec,
        goSec: CHALLENGE.breakGoSec,
        wrongRetrySec: CHALLENGE.wrongRetrySec,
        placeCooldownSec: CHALLENGE.placeCooldownSec,
        make: (p, place) => factories[p].make(place),
      });
    } else {
      this.schedulers = players.map((p, i) => new ChallengeScheduler({
        player: i as PlayerId,
        difficulty: p.difficulty,
        intervalSec: ctx.settings.challengeIntervalSec,
        generator: new ChallengeGenerator(rng.fork(i * 2 + 1)),
        rng: rng.fork(i * 2 + 2),
        startDelaySec: CHALLENGE.firstChallengeDelaySec,
        mode,
      }));
    }
    this.near = players.map(() => new Set<number>());
    this.guard = players.map(() => 0);
  }

  update(dt: number, ctx: RaceContext): void {
    const now = ctx.elapsedSec;
    if (this.pause && this.breaks) { this.updateBreaks(dt, ctx, now, this.breaks); return; }
    this.schedulers.forEach((sched, i) => {
      const player = i as PlayerId;
      const events = sched.update(now);
      const slot = services.input.get(player).answer;
      if (slot !== null && slot < 3) events.push(...sched.answer(slot, now));   // A is the gas in drive style
      for (const word of this.enteredPlaces(player, ctx)) events.push(...sched.notifyPlace(word, now));
      this.forward(events, player, ctx);
    });
  }

  destroy(): void {
    this.schedulers = [];
    this.breaks = null;
    this.near = [];
    delete (globalThis as { __challenge?: unknown }).__challenge;
  }

  // ───────────────────────── pause style ─────────────────────────
  private updateBreaks(dt: number, ctx: RaceContext, now: number, br: BreakScheduler): void {
    if (!br.active) {
      for (let i = 0; i < this.nPlayers; i++) {
        for (const word of this.enteredPlaces(i as PlayerId, ctx)) br.notifyPlace(i as PlayerId, word);
      }
    }
    for (let i = 0; i < this.nPlayers; i++) this.guard[i] = Math.max(0, this.guard[i] - dt);
    this.handle(br.update(now, dt), ctx);
    if (br.phase === 'asking') {
      for (let i = 0; i < this.nPlayers; i++) {
        const p = i as PlayerId;
        const inp = services.input.get(p);
        const slot = inp.answer ?? inp.answerDirection;
        if (slot !== null && this.guard[p] <= 0) this.handle(br.answer(p, slot), ctx);
      }
    }
    ctx.questionBreak = br.active;
  }

  private handle(events: BreakEvent[], ctx: RaceContext): void {
    for (const e of events) {
      switch (e.type) {
        case 'breakStart':
          ctx.questionBreak = true;
          break;
        case 'shown':
          this.guard[e.challenge.player] = CHALLENGE.answerGuardSec;
          ctx.bus.emit('challenge:shown', { challenge: e.challenge });
          break;
        case 'resolved':
          ctx.bus.emit('challenge:resolved', { challenge: e.challenge, result: e.result, chosen: e.chosen });
          services.audio.sfx(e.result, { pan: this.pan(e.challenge.player) });
          break;
        case 'resume':
          ctx.bus.emit('ui:banner', { text: 'GO!', color: '#7CFC00', durationSec: CHALLENGE.breakGoSec });
          services.audio.sfx('go');
          break;
        case 'breakEnd':
          ctx.questionBreak = false;
          break;
      }
    }
  }

  // ───────────────────────── shared ─────────────────────────
  /** Words of places the player newly came near this frame. */
  private enteredPlaces(player: PlayerId, ctx: RaceContext): string[] {
    const car = ctx.players[player];
    if (!car) return [];
    const out: string[] = [];
    const r2 = CHALLENGE.placeTriggerRadius ** 2;
    const inside = this.near[player];
    ctx.world.places.forEach((place, idx) => {
      const dx = car.x - place.sign.x;
      const dy = car.y - place.sign.y;
      if (dx * dx + dy * dy > r2) { inside.delete(idx); return; }
      if (inside.has(idx)) return;
      inside.add(idx);
      ctx.bus.emit('place:near', { player, word: place.word });
      out.push(place.word);
    });
    return out;
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
    if (this.nPlayers < 2) return 0;
    return player === 0 ? -CHALLENGE.teamPan : CHALLENGE.teamPan;
  }
}
