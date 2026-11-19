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
import type { AnswerSlot, Challenge, PlayerId } from '../core/types';
import { BreakScheduler, type BreakEvent } from '../challenge/BreakScheduler';
import { ChallengeFactory } from '../challenge/ChallengeFactory';
import { ChallengeGenerator } from '../challenge/ChallengeGenerator';
import { ChallengeScheduler, type SchedulerEvent } from '../challenge/ChallengeScheduler';

const RNG_SALT = 0xb1;
type Dir = 'up' | 'left' | 'right' | 'down';
const DIRS: Dir[] = ['up', 'left', 'right', 'down'];
const DIR_SLOT: Record<Dir, AnswerSlot> = { left: 0, up: 1, right: 2, down: 3 };

export class ChallengeSystem implements GameSystem {
  readonly name = 'challenge';
  private schedulers: ChallengeScheduler[] = [];
  private breaks: BreakScheduler | null = null;
  private nPlayers = 1;
  /** Indices of places each player is currently near (to fire once per entry). */
  private near: Set<number>[] = [];
  private guard: number[] = [];
  /** Per player: a direction only counts as an answer once it was released after the break began. */
  private armed: Record<Dir, boolean>[] = [];
  private pause = false;

  init(ctx: RaceContext): void {
    const rng: Rng = ctx.rng.fork(RNG_SALT);
    this.pause = (ctx.settings.questionStyle ?? 'pause') === 'pause';
    const players = ctx.settings.players;
    this.nPlayers = players.length;
    const mode = ctx.settings.challengeMode ?? 'words';
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
    this.armed = players.map(() => ({ up: false, left: false, right: false, down: false }));
    ctx.questionBreak = false;
    // Test hook: lets e2e read the current question's correct slot.
    (globalThis as { __challenge?: unknown }).__challenge = {
      current: (p: number): Challenge | null => this.breaks?.current(p as PlayerId) ?? this.schedulers[p]?.current ?? null,
      phase: () => this.breaks?.phase ?? 'drive',
      state: (p: number) => this.breaks?.playerState(p as PlayerId) ?? null,
    };
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
    this.handle(br.update(now, dt), ctx);
    if (br.phase === 'asking') {
      for (let i = 0; i < this.nPlayers; i++) {
        const p = i as PlayerId;
        this.guard[p] = Math.max(0, this.guard[p] - dt);
        const slot = this.readAnswer(p);
        if (slot !== null && this.guard[p] <= 0) this.handle(br.answer(p, slot), ctx);
      }
    }
    ctx.questionBreak = br.active;
  }

  /** Face buttons, plus directions as the diamond (up Y, left X, right B, down A). */
  private readAnswer(p: PlayerId): AnswerSlot | null {
    const inp = services.input.get(p);
    const held: Record<Dir, boolean> = {
      up: inp.throttle > 0.3, down: inp.brake > 0.3, left: inp.steer < -0.3, right: inp.steer > 0.3,
    };
    const armed = this.armed[p];
    for (const d of DIRS) if (!held[d]) armed[d] = true;
    if (inp.answer !== null) return inp.answer;
    const dir: Dir | null = inp.navY === -1 ? 'up' : inp.navY === 1 ? 'down' : inp.navX === -1 ? 'left' : inp.navX === 1 ? 'right' : null;
    if (!dir) return null;
    // A direction held since before the break (driving) must be released once before it can answer.
    if (!armed[dir]) return null;
    armed[dir] = false;
    return DIR_SLOT[dir];
  }

  private handle(events: BreakEvent[], ctx: RaceContext): void {
    for (const e of events) {
      switch (e.type) {
        case 'breakStart':
          ctx.questionBreak = true;
          this.armed.forEach((a) => { a.up = a.left = a.right = a.down = false; });
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
