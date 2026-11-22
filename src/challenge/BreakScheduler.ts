/**
 * Pause-style question breaks (pure; time injected). One shared team timer: after `intervalSec` of
 * driving a break starts for ALL players at once. Each player answers until correct (a wrong answer
 * gives a fresh question after a short beat plus the answer-reveal time). When everyone is correct a short "GO" beat runs, then
 * the break ends and the timer restarts.
 */
import type { AnswerSlot, Challenge, PlayerId } from '../core/types';

export type BreakPhase = 'driving' | 'asking' | 'resuming';
export type PlayerBreakState = 'asking' | 'retry' | 'done';

export type BreakEvent =
  | { type: 'breakStart' }
  | { type: 'shown'; challenge: Challenge }
  | { type: 'resolved'; challenge: Challenge; result: 'correct' | 'wrong'; chosen: AnswerSlot }
  | { type: 'resume' }       // everyone correct: GO beat starts
  | { type: 'breakEnd' };

export interface BreakOptions {
  players: number;
  firstAtSec: number;
  intervalSec: number;
  goSec: number;
  wrongRetrySec: number;
  /** After a wrong answer the HUD shows the correct answer for this long; the next question waits for wrongRetrySec + wrongRevealSec. */
  wrongRevealSec: number;
  placeCooldownSec: number;
  make: (player: PlayerId, placeWord: string | null) => Challenge;
}

export class BreakScheduler {
  private _phase: BreakPhase = 'driving';
  private nextAt: number;
  private goLeft = 0;
  private cur: (Challenge | null)[];
  private st: PlayerBreakState[];
  private retryLeft: number[];
  private pending: (string | null)[];
  private lastPlaceAt: Map<string, number>[];

  constructor(private readonly o: BreakOptions) {
    this.nextAt = o.firstAtSec;
    this.cur = Array.from({ length: o.players }, () => null);
    this.st = Array.from({ length: o.players }, () => 'asking' as PlayerBreakState);
    this.retryLeft = Array.from({ length: o.players }, () => 0);
    this.pending = Array.from({ length: o.players }, () => null);
    this.lastPlaceAt = Array.from({ length: o.players }, () => new Map());
  }

  get phase(): BreakPhase { return this._phase; }
  get active(): boolean { return this._phase !== 'driving'; }
  current(p: PlayerId): Challenge | null { return this.cur[p] ?? null; }
  playerState(p: PlayerId): PlayerBreakState { return this.st[p] ?? 'done'; }
  /** Driving seconds until the next break (0 during a break). */
  untilBreak(now: number): number { return this._phase === 'driving' ? Math.max(0, this.nextAt - now) : 0; }

  /** Remember the last place a player passed; used as their first question at the next break. */
  notifyPlace(p: PlayerId, word: string): void {
    if (p < this.pending.length) this.pending[p] = word;
  }

  /** `now` = driving seconds (frozen during a break); `dt` = real frame seconds. */
  update(now: number, dt: number): BreakEvent[] {
    const ev: BreakEvent[] = [];
    if (this._phase === 'driving') {
      if (now >= this.nextAt) this.startBreak(now, ev);
    } else if (this._phase === 'asking') {
      for (let p = 0; p < this.cur.length; p++) {
        if (this.st[p] !== 'retry') continue;
        this.retryLeft[p] -= dt;
        if (this.retryLeft[p] <= 0) this.ask(p as PlayerId, null, ev);
      }
    } else {
      this.goLeft -= dt;
      if (this.goLeft <= 0) {
        this._phase = 'driving';
        this.nextAt = now + this.o.intervalSec;
        this.cur = this.cur.map(() => null);
        ev.push({ type: 'breakEnd' });
      }
    }
    return ev;
  }

  answer(p: PlayerId, slot: AnswerSlot): BreakEvent[] {
    const ev: BreakEvent[] = [];
    const c = this.cur[p];
    if (this._phase !== 'asking' || this.st[p] !== 'asking' || !c) return ev;
    if (slot === c.correct) {
      this.st[p] = 'done';
      ev.push({ type: 'resolved', challenge: c, result: 'correct', chosen: slot });
      if (this.st.every((s) => s === 'done')) {
        this._phase = 'resuming';
        this.goLeft = this.o.goSec;
        ev.push({ type: 'resume' });
      }
    } else {
      this.st[p] = 'retry';
      this.retryLeft[p] = this.o.wrongRetrySec + this.o.wrongRevealSec;
      ev.push({ type: 'resolved', challenge: c, result: 'wrong', chosen: slot });
    }
    return ev;
  }

  private startBreak(now: number, ev: BreakEvent[]): void {
    this._phase = 'asking';
    ev.push({ type: 'breakStart' });
    for (let p = 0; p < this.cur.length; p++) {
      let word = this.pending[p];
      this.pending[p] = null;
      if (word) {
        const last = this.lastPlaceAt[p].get(word);
        if (last !== undefined && now - last < this.o.placeCooldownSec) word = null;
        else this.lastPlaceAt[p].set(word, now);
      }
      this.ask(p as PlayerId, word, ev);
    }
  }

  private ask(p: PlayerId, placeWord: string | null, ev: BreakEvent[]): void {
    const challenge = this.o.make(p, placeWord);
    this.cur[p] = challenge;
    this.st[p] = 'asking';
    ev.push({ type: 'shown', challenge });
  }
}
