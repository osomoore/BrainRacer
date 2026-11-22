/** Greedy simulated player: solves one active challenge at a time with minimal changes until everything is unlocked. */
import type { ChallengeId, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { available } from './available';
import { newProgress, newestVariant, recordWin, refreshBoard, tierOf } from './board';
import { evaluate } from './evaluate';
import { solve } from './solver';
import { flatChecks } from './util';

export interface SimOptions {
  /** Step budget (wins). */
  maxSteps?: number;
}

export interface SimReport {
  steps: number;
  firstWins: number;
  allUnlocked: boolean;
  tierReached: number;
  /** Human-readable stall descriptions (empty when the run went smoothly). */
  stalls: string[];
  /** Share of challenges (while a newest variant existed) that could not be solved without it. */
  newestRequiredRate: number;
  averageChanged: number;
  /** Solutions that did not actually pass evaluate() (must be 0). */
  mismatches: number;
  progress: WorkshopProgress;
}

export function simulate(cat: WorkshopCatalog, opts: SimOptions = {}): SimReport {
  const maxSteps = opts.maxSteps ?? 400;
  let p = refreshBoard(cat, newProgress(cat));
  const stalls: string[] = [];
  let steps = 0;
  let newestCases = 0;
  let newestNeeded = 0;
  let changedSum = 0;
  let mismatches = 0;
  const target = cat.unlockOrder.length;

  while (steps < maxSteps && p.earned.length < target) {
    const id: ChallengeId | undefined = p.active.find((a) => !p.completed[a]);
    if (!id) { stalls.push(`step ${steps}: no unfinished challenge on the board (active ${p.active.length})`); break; }
    const ch = p.challenges[id];
    const avail = available(cat, p);
    const checks = flatChecks(ch);
    const sol = solve(cat, checks, avail, { ref: p.model });
    if (!sol) { stalls.push(`step ${steps}: ${id} is not solvable with the available parts`); break; }
    const newest = newestVariant(p, avail);
    if (newest) {
      newestCases++;
      const without = new Set([...avail].filter((v) => v !== newest));
      if (solve(cat, checks, without, { stopAtFirst: true }) === null) newestNeeded++;
    }
    changedSum += sol.cost;
    if (!evaluate(cat, sol.build, ch).passed) mismatches++;
    const out = recordWin(cat, p, id, sol.build, steps + 1);
    p = { ...out.progress, model: sol.build };
    steps++;
  }
  if (p.earned.length < target && !stalls.length) stalls.push(`step budget ${maxSteps} used up before every variant was unlocked`);
  return {
    steps, firstWins: p.firstWins, allUnlocked: p.earned.length >= target, tierReached: tierOf(p.firstWins), stalls,
    newestRequiredRate: newestCases ? newestNeeded / newestCases : 0,
    averageChanged: steps ? changedSum / steps : 0, mismatches, progress: p,
  };
}
