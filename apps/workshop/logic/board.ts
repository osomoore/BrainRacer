/** Board and progression: refill, wins, fails, hints, regenerate, overrides. All functions return new objects. */
import { WS_RULES } from '../config';
import type { PurchaseOutcome, WinOutcome } from '../core/engineApi';
import type {
  Challenge, ChallengeId, Model, ReadingLevel, RunResult, VariantId, VariantOverride, WorkshopCatalog, WorkshopProgress,
} from '../core/types';
import { availableFor, sanitizeModel } from './available';
import { affordability } from './affordability';
import { challengeKey, generateChallenge } from './generator';
import { computeModel, defaultModel, allPass } from './stats';
import { currencyStarters } from './starters';
import { shopOffers } from './shop';
import { practiceChallenge } from './practice';
import { flatChecks, hashSeed } from './util';

export function newProgress(cat: WorkshopCatalog): WorkshopProgress {
  return {
    model: defaultModel(cat), wallet: WS_RULES.startWallet, bought: [], overrides: {}, challenges: {}, active: [], completed: {}, fails: {},
    lastWin: null, nextStarter: 0, firstWins: 0, genSeq: 1,
  };
}

export function copyProgress(p: WorkshopProgress): WorkshopProgress {
  return {
    ...p,
    model: { ...p.model },
    bought: [...p.bought],
    overrides: { ...p.overrides },
    challenges: { ...p.challenges },
    active: [...p.active],
    completed: { ...p.completed },
    fails: { ...p.fails },
    lastWin: p.lastWin ? { ...p.lastWin } : null,
  };
}

export function tierOf(firstWins: number): number {
  return Math.min(WS_RULES.maxTier, Math.floor(firstWins / WS_RULES.winsPerTier));
}

/** Most recently bought variant that is still available. */
export function newestVariant(p: WorkshopProgress, avail: ReadonlySet<VariantId>): VariantId | null {
  for (let i = p.bought.length - 1; i >= 0; i--) if (avail.has(p.bought[i])) return p.bought[i];
  return null;
}

/** Existing cards may already be solved by the current build: the player is allowed to test it. */
export function refreshBoard(cat: WorkshopCatalog, p0: WorkshopProgress): WorkshopProgress {
  const p = copyProgress(p0);
  const budget = affordability(cat, p);
  const current = computeModel(cat, p.model);
  const last = p.lastWin && computeModel(cat, p.lastWin);
  const usedKeys = new Set(Object.values(p.challenges).map(challengeKey));
  const wonKeys = new Set(Object.keys(p.completed).flatMap((id) =>
    p.challenges[id] ? [challengeKey(p.challenges[id])] : []));
  const activeKeys = new Set<string>();
  const costs = new Map<ChallengeId, number>();
  const size = WS_RULES.boardSize;

  for (const id of p.active) {
    const challenge = p.challenges[id];
    if (!challenge || p.completed[id]) continue;
    const key = challengeKey(challenge);
    if (activeKeys.has(key) || wonKeys.has(key)) continue;
    const solution = budget.solve(flatChecks(challenge));
    if (solution) {
      activeKeys.add(key);
      costs.set(id, solution.cost);
    }
    if (costs.size === size) break;
  }

  const starters = currencyStarters(cat);
  const nextCard = (kind: 'owned' | 'purchase'): Challenge | null => {
    const acceptsCost = (cost: number): boolean => kind === 'owned' ? cost === 0 : cost > 0;
    if (kind === 'purchase') {
      for (const challenge of starters.slice(p.nextStarter)) {
        const key = challengeKey(challenge);
        const checks = flatChecks(challenge);
        if (usedKeys.has(key) || allPass(checks, current) || (last && allPass(checks, last))) continue;
        const solution = budget.solve(checks);
        if (solution?.cost !== WS_RULES.basePrice) continue;
        costs.set(challenge.id, solution.cost);
        p.nextStarter = starters.indexOf(challenge) + 1;
        return challenge;
      }
      if (p.wallet < WS_RULES.basePrice || budget.pool.size === budget.owned.size) return null;
    }

    if (kind === 'owned' && budget.owned.size === cat.aspects.length) return null;
    const id = `${cat.id}-g${p.genSeq}`;
    const seed = hashSeed(id);
    const avoidScenarios = new Set([...costs.keys()].map((key) => p.challenges[key].stages[0].scenario));
    const opts = {
      tier: tierOf(p.firstWins), avail: kind === 'owned' ? budget.owned : budget.pool,
      current: p.model, lastWin: p.lastWin, minChanged: WS_RULES.minChangedAspects,
      newest: newestVariant(p, budget.owned), usedKeys, avoidScenarios,
      attempts: WS_RULES.genAttempts, strictCurrent: true,
      accepts: (checks: Parameters<typeof budget.solve>[0]) => {
        const solution = budget.solve(checks);
        return solution !== null && acceptsCost(solution.cost);
      },
    };
    // Tier sampling is the usual path. Deterministic search covers exhausted tiers and tight wallets.
    const next = generateChallenge(cat, id, 'generated', seed, opts)
      ?? generateChallenge(cat, id, 'generated', seed, { ...opts, fallback: true });
    if (!next) return null;
    p.genSeq++;
    costs.set(id, budget.solve(flatChecks(next.challenge))!.cost);
    return next.challenge;
  };

  const add = (c: Challenge): void => {
    p.challenges[c.id] = c;
    usedKeys.add(challengeKey(c));
  };
  const countOwned = (): number => [...costs.values()].filter((cost) => cost === 0).length;

  if (countOwned() === 0) {
    const toReplace = costs.size === size ? [...costs.keys()].at(-1) : undefined;
    const owned = nextCard('owned');
    if (owned) {
      if (toReplace) costs.delete(toReplace);
      add(owned);
    }
  }
  while (costs.size < size) {
    const authored = nextCard('purchase') ?? nextCard('owned');
    if (authored) { add(authored); continue; }
    const id = cat.id + '-g' + p.genSeq;
    const practice = practiceChallenge(cat, id, hashSeed(id), tierOf(p.firstWins), budget.owned, p.model, p.lastWin, usedKeys);
    if (!practice) break;
    p.genSeq++;
    costs.set(id, 0);
    add(practice);
  }

  p.active = [...costs.keys()];
  const retained = new Set(p.active);
  const inactive = Object.keys(p.challenges).filter((id) => !p.completed[id] && !retained.has(id));
  // Keep removed cards for deduplication and draw new cards when a wallet or override changes.
  for (const id of inactive.slice(0, Math.max(0, inactive.length + p.active.length - WS_RULES.maxSavedChallenges))) {
    delete p.challenges[id];
    delete p.fails[id];
  }
  return p;
}

export function purchase(cat: WorkshopCatalog, p: WorkshopProgress, aspect: string, variant: VariantId): PurchaseOutcome {
  const offer = shopOffers(cat, p, aspect).find((item) => item.variant === variant);
  if (!offer) return { progress: p, status: 'unavailable', price: 0 };
  const { price } = offer;
  if (!offer.affordable) return { progress: p, status: 'unaffordable', price };
  const progress = refreshBoard(cat, { ...p, bought: [...p.bought, variant], wallet: p.wallet - price });
  return { progress, status: 'bought', price };
}

export function recordFail(p: WorkshopProgress, challengeId: ChallengeId): WorkshopProgress {
  const q = copyProgress(p);
  q.fails[challengeId] = (q.fails[challengeId] ?? 0) + 1;
  return q;
}

export function recordWin(cat: WorkshopCatalog, p: WorkshopProgress, challengeId: ChallengeId, model: Model, now: number): WinOutcome {
  const challenge = p.challenges[challengeId];
  const sanitized = sanitizeModel(cat, p, model);
  const validBuild = cat.aspects.every((aspect) => model[aspect.id] === sanitized[aspect.id]);
  if (!challenge || !p.active.includes(challengeId) || p.completed[challengeId] || !validBuild
    || !allPass(flatChecks(challenge), computeModel(cat, model))) {
    return { progress: p, firstWin: false, payout: 0, newChallenges: [] };
  }
  const q = copyProgress(p);
  const payout = challenge.stages.reduce((sum, stage) => sum + stage.requirements.length, 0) * WS_RULES.payoutPerRequirement;
  q.wallet += payout;
  q.firstWins++;
  q.completed[challengeId] = { build: { ...model }, wonAt: now, payout };
  q.lastWin = { ...model };
  q.model = { ...model };
  delete q.fails[challengeId];
  const progress = refreshBoard(cat, q);
  return { progress, firstWin: true, payout, newChallenges: progress.active.filter((id) => !p.active.includes(id)) };
}

export function regenerate(cat: WorkshopCatalog, p: WorkshopProgress): WorkshopProgress {
  return refreshBoard(cat, { ...p, active: [], nextStarter: currencyStarters(cat).length });
}

export function setOverride(cat: WorkshopCatalog, p: WorkshopProgress, variant: VariantId, value: VariantOverride | 'auto'): WorkshopProgress {
  const q = copyProgress(p);
  if (value === 'auto') delete q.overrides[variant]; else q.overrides[variant] = value;
  q.model = sanitizeModel(cat, q, q.model);
  return refreshBoard(cat, q);
}

export function setPart(cat: WorkshopCatalog, p: WorkshopProgress, aspect: string, variant: VariantId): WorkshopProgress {
  const q = copyProgress(p);
  if (availableFor(cat, q, aspect).includes(variant)) q.model[aspect] = variant;
  return q;
}

/** Hint after enough failed attempts; points at the first failed requirement. */
export function hint(p: WorkshopProgress, challenge: Challenge, result: RunResult, reading: ReadingLevel): string | null {
  if ((p.fails[challenge.id] ?? 0) < WS_RULES.hintAfterFails || result.passed) return null;
  const stage = result.stages[result.endStage];
  const failId = stage?.firstFail ?? result.requirements.find((r) => !r.passed)?.id;
  const req = challenge.stages.flatMap((s) => s.requirements).find((r) => r.id === failId);
  return req?.hint.text[reading] ?? null;
}
