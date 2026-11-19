/** Pure score/stat math + round timer helpers (no Phaser). */
import type { ChallengeResult, PlayerStats, RoundResults } from '../core/types';

export const emptyStats = (): PlayerStats => ({ correct: 0, wrong: 0, timeouts: 0, goals: 0, points: 0 });

export function applyChallenge(s: PlayerStats, result: ChallengeResult): void {
  if (result === 'correct') { s.correct++; s.points++; }
  else if (result === 'wrong') s.wrong++;
  else s.timeouts++;
}

export function applyGoal(s: PlayerStats, points: number): void {
  s.goals++;
  s.points += points;
}

export const teamTotal = (players: PlayerStats[]) => players.reduce((a, p) => a + p.points, 0);

export function buildResults(players: PlayerStats[], goalsCompleted: number, seed: number): RoundResults {
  return { teamPoints: teamTotal(players), players: players.map((p) => ({ ...p })), goalsCompleted, seed };
}

export interface ClockEvents { tick?: number; half?: boolean; end?: boolean }

/** Pure timer state machine. */
export class RoundClock {
  private lastTick = Infinity;
  private halfDone = false;
  private endDone = false;
  constructor(private lengthSec: number) {}

  step(elapsed: number): ClockEvents {
    const out: ClockEvents = {};
    if (this.endDone) return out;
    const remaining = Math.max(0, Math.ceil(this.lengthSec - elapsed));
    if (remaining < this.lastTick) { this.lastTick = remaining; out.tick = remaining; }
    if (!this.halfDone && elapsed >= this.lengthSec / 2) { this.halfDone = true; out.half = true; }
    if (elapsed >= this.lengthSec) { this.endDone = true; out.end = true; }
    return out;
  }
}

/** Shared per-race store: ScoreSystem writes, RoundTimerSystem reads when building results. */
export const roundStore = {
  players: [] as PlayerStats[],
  goalsCompleted: 0,
  reset(n: number) {
    this.players = Array.from({ length: n }, emptyStats);
    this.goalsCompleted = 0;
  },
};

/** 1-3 stars from team points per minute. */
export function starRating(teamPoints: number, roundSec: number, thresholds: readonly [number, number]): 1 | 2 | 3 {
  const ppm = teamPoints / Math.max(1, roundSec / 60);
  return ppm >= thresholds[1] ? 3 : ppm >= thresholds[0] ? 2 : 1;
}

/** Bonus points for helping defeat the dino (no stat-type change needed). */
export function applyDino(s: PlayerStats, points: number): void { s.points += points; }
