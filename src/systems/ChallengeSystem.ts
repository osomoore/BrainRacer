/**
 * Challenges for both question styles; forwards events to the bus and plays sfx. No scoring here.
 *  - 'drive' (DEPRECATED, unused: questions are always Stop & Answer; kept compiling): one ChallengeScheduler per player (continuous, timer bar, answered while driving).
 *  - 'pause': one shared BreakScheduler; a break freezes the world (RaceScene runs only this system
 *    while ctx.questionBreak is true) until every player has answered correctly.
 */
import { CHALLENGE, NEW_RACER } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { GameSystem, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { Challenge, PlayerId } from '../core/types';
import { BreakScheduler, type BreakEvent } from '../challenge/BreakScheduler';
import { ChallengeFactory } from '../challenge/ChallengeFactory';
import { wrongRevealSecFor } from '../challenge/reveal';
import { ChallengeGenerator } from '../challenge/ChallengeGenerator';
import { ChallengeScheduler, type SchedulerEvent } from '../challenge/ChallengeScheduler';
import { JbqProgressStore } from '../challenge/jbqProgress';
import { jbqToday } from '../challenge/jbqScope';
import { raceQuestionTypes } from '../challenge/jbqRules';

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
  /** Results have been finalized. */
  private ended = false;
  private offRoundEnd: (() => void) | null = null;
  private offResolved: (() => void) | null = null;
  /** One progress store per player (quick-race players without a profile keep theirs in memory only). */
  private jbqStores: JbqProgressStore[] = [];
  private profiles: (string | undefined)[] = [];

  init(ctx: RaceContext): void {
    ctx.questionBreak = false;
    this.ended = false;
    this.offRoundEnd = ctx.bus.on('round:end', () => { this.ended = true; ctx.questionBreak = false; });
    // Test hook: lets e2e read the current question's correct slot.
    (globalThis as { __challenge?: unknown }).__challenge = {
      current: (p: number): Challenge | null => this.breaks?.current(p as PlayerId) ?? this.schedulers[p]?.current ?? null,
      phase: () => this.breaks?.phase ?? 'drive',
      state: (p: number) => this.breaks?.playerState(p as PlayerId) ?? null,
    };
    this.offResolved?.();
    this.offResolved = ctx.bus.on('challenge:resolved', (e) => {
      const id = e.challenge.jbq?.id;
      if (e.result === 'correct' && id !== undefined) this.jbqStores[e.challenge.player]?.recordCorrect(this.profiles[e.challenge.player], id);
    });
    const mode = ctx.settings.challengeMode ?? 'words';
    if (mode === 'off') return;

    const rng: Rng = ctx.rng.fork(RNG_SALT);
    this.pause = true;   // JBQ is Stop & Answer; While Driving is deprecated (ctx.settings.questionStyle is ignored)
    const players = ctx.settings.players;
    const today = jbqToday();
    this.profiles = players.map((p) => p.profile);
    this.jbqStores = players.map(() => new JbqProgressStore());
    this.nPlayers = players.length;
    if (this.pause) {
      const factories = players.map((p, i) => new ChallengeFactory({
        player: i as PlayerId, difficulty: p.difficulty, generator: new ChallengeGenerator(rng.fork(i * 2 + 1)),
        rng: rng.fork(i * 2 + 2), mode, questionTypes: p.questionTypes && raceQuestionTypes(p.questionTypes, p.jbq ?? NEW_RACER.defaultJbq, players.length), optionCount: CHALLENGE.pauseOptions as 3 | 4,
        jbq: p.jbq ?? NEW_RACER.defaultJbq, today, jbqCount: (id) => this.jbqStores[i].count(p.profile, id),
      }));
      this.breaks = new BreakScheduler({
        players: players.length,
        firstAtSec: CHALLENGE.firstBreakSec,
        intervalSec: ctx.settings.challengeIntervalSec,
        goSec: CHALLENGE.breakGoSec,
        wrongRetrySec: CHALLENGE.wrongRetrySec,
        wrongRevealSec: (c) => wrongRevealSecFor(c.kind),
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
        questionTypes: p.questionTypes,
      }));
    }
    this.near = players.map(() => new Set<number>());
    this.guard = players.map(() => 0);
  }

  update(dt: number, ctx: RaceContext): void {
    if (this.ended) { ctx.questionBreak = false; return; }
    const now = ctx.elapsedSec;
    if (this.pause && this.breaks) {
      if (!ctx.timeExpired || this.breaks.active) this.updateBreaks(dt, ctx, now, this.breaks);
      ctx.pendingQuestions = this.breaks.active;
      return;
    }
    this.schedulers.forEach((sched, i) => {
      const player = i as PlayerId;
      const events = ctx.timeExpired ? [] : sched.update(now);
      const slot = services.input.get(player).answer;
      if (slot !== null && slot < 3) events.push(...sched.answer(slot, now, ctx.timeExpired));
      if (!ctx.timeExpired) {
        for (const word of this.enteredPlaces(player, ctx)) events.push(...sched.notifyPlace(word, now));
      }
      this.forward(events, player, ctx);
    });
    ctx.pendingQuestions = this.schedulers.some(sched => sched.state === 'active');
  }

  destroy(): void {
    this.offRoundEnd?.();
    this.offRoundEnd = null;
    this.offResolved?.();
    this.offResolved = null;
    this.jbqStores = [];
    this.profiles = [];
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
          if (ctx.timeExpired) break;
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
    return player % 2 === 0 ? -CHALLENGE.teamPan : CHALLENGE.teamPan;
  }
}
