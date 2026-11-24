/** Simulated player: solves affordable challenges and spends the payouts at the stations. */
import { WS_RULES } from '../config';
import type { WorkshopCatalog, WorkshopProgress } from '../core/types';
import { affordability } from './affordability';
import { available } from './available';
import { newProgress, purchase, newestVariant, recordWin, refreshBoard, tierOf } from './board';
import { evaluate } from './evaluate';
import { priceOf, shopOffers } from './shop';
import { solve } from './solver';
import { flatChecks } from './util';

export interface SimOptions {
  maxSteps?: number;
  seed?: number;
}

export interface SimReport {
  steps: number;
  firstWins: number;
  allUnlocked: boolean;
  tierReached: number;
  stalls: string[];
  newestRequiredRate: number;
  averageChanged: number;
  mismatches: number;
  progress: WorkshopProgress;
}

export function simulate(cat: WorkshopCatalog, opts: SimOptions = {}): SimReport {
  const maxSteps = opts.maxSteps ?? 400;
  let p = refreshBoard(cat, { ...newProgress(cat), genSeq: opts.seed ?? 1 });
  const stalls: string[] = [];
  let steps = 0;
  let newestCases = 0;
  let newestNeeded = 0;
  let changedSum = 0;
  let mismatches = 0;
  const target = cat.variants.length - cat.aspects.length;
  const remainingCost = (): number => cat.variants
    .filter((v) => !p.bought.includes(v.id) && !cat.aspects.some((a) => a.starters[0] === v.id))
    .reduce((sum, v) => sum + priceOf(cat, v.id), 0);

  while (steps < maxSteps && p.bought.length < target) {
    if (p.wallet >= remainingCost()) {
      for (const aspect of cat.aspects) {
        for (let offer = shopOffers(cat, p, aspect.id)[0]; offer; offer = shopOffers(cat, p, aspect.id)[0]) {
          p = purchase(cat, p, aspect.id, offer.variant).progress;
        }
      }
      break;
    }
    if (p.active.length !== WS_RULES.boardSize) {
      stalls.push('step ' + steps + ': board only has ' + p.active.length + ' cards');
      break;
    }
    // Exercise the shop when possible, then prefer a ready card that still needs a build change.
    const budget = affordability(cat, p);
    const playable = p.active.flatMap((id) => {
      const challenge = p.challenges[id];
      const solution = budget.solve(flatChecks(challenge));
      return solution ? [{ challenge, solution }] : [];
    });
    const choice = playable.find(({ solution }) => solution.cost > 0)
      ?? playable.find(({ challenge }) => !evaluate(cat, p.model, challenge).passed)
      ?? playable[0];
    if (!choice) { stalls.push('step ' + steps + ': no affordable solution'); break; }
    const { challenge: ch, solution: affordable } = choice;
    const { id } = ch;
    const checks = flatChecks(ch);

    for (const [aspect, variant] of Object.entries(affordable.build)) {
      for (const part of budget.routes.get(variant)?.variants ?? []) {
        p = purchase(cat, p, aspect, part).progress;
      }
    }
    const avail = available(cat, p);
    const sol = solve(cat, checks, avail, { ref: p.model });
    if (!sol || !evaluate(cat, sol.build, ch).passed) {
      mismatches++;
      stalls.push('step ' + steps + ': invalid solution for ' + id);
      break;
    }
    const newest = newestVariant(p, avail);
    if (newest) {
      newestCases++;
      const without = new Set([...avail].filter((v) => v !== newest));
      if (!solve(cat, checks, without, { stopAtFirst: true })) newestNeeded++;
    }
    changedSum += sol.cost;
    const win = recordWin(cat, p, id, sol.build, steps + 1);
    if (!win.firstWin) { stalls.push('step ' + steps + ': win rejected for ' + id); break; }
    p = win.progress;
    steps++;
  }

  if (p.bought.length < target && !stalls.length) stalls.push('step budget used up before every variant was bought');
  return {
    steps, firstWins: p.firstWins, allUnlocked: p.bought.length === target, tierReached: tierOf(p.firstWins), stalls,
    newestRequiredRate: newestCases ? newestNeeded / newestCases : 0,
    averageChanged: steps ? changedSum / steps : 0, mismatches, progress: p,
  };
}
