/** Board and progression: refill, wins, fails, hints, regenerate, overrides. All functions return new objects. */
import { CHALLENGE_RULES_VERSION, WS_RULES } from '../config';
import type { PurchaseOutcome, WinOutcome } from '../core/engineApi';
import type {
  Challenge, ChallengeId, FacetDef, FailNote, Model, ReadingLevel, RunResult, VariantId, VariantOverride, WorkshopCatalog, WorkshopProgress,
} from '../core/types';
import { easyFlag, isHiddenAspect, visibleAspectIds } from './aspects';
import { availableFor, sanitizeModel } from './available';
import { affordability, BOARD_CATEGORIES, boardCategory, type BoardCategory } from './affordability';
import { challengeKey, generateChallenge } from './generator';
import { index } from './catalogIndex';
import { catalogFixes } from './text';
import { computeModel, defaultModel, allPass } from './stats';
import { currencyStarters } from './starters';
import { shopOffers } from './shop';
import { practiceChallenge } from './practice';
import { flatChecks, hashSeed } from './util';
import { advanceBuddies, normalizeBuddies, startingBuddy } from './buddies';
import { readingText } from './wording';
import { evaluate } from './evaluate';

/** A fresh workshop; `buddySeed` (the profile's seed) picks the starting buddy. */
export function newProgress(cat: WorkshopCatalog, buddySeed?: number, reading?: ReadingLevel): WorkshopProgress {
  return {
    ...easyFlag(reading),
    model: defaultModel(cat), wallet: WS_RULES.startWallet, bought: [], overrides: {}, challenges: {}, active: [], completed: {}, fails: {}, failHints: {},
    lastWin: null, nextStarter: 0, firstWins: 0, genSeq: 1, rulesVersion: CHALLENGE_RULES_VERSION,
    buddies: normalizeBuddies(undefined, buddySeed === undefined ? undefined : startingBuddy(buddySeed)),
  };
}

export function copyProgress(p: WorkshopProgress): WorkshopProgress {
  return {
    ...p,
    model: { ...p.model },
    buddies: { ...p.buddies, unlocked: [...p.buddies.unlocked] },
    bought: [...p.bought],
    overrides: { ...p.overrides },
    challenges: { ...p.challenges },
    active: [...p.active],
    completed: { ...p.completed },
    fails: { ...p.fails },
    ...(p.failHints ? { failHints: { ...p.failHints } } : {}),
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

type BoardBudget = ReturnType<typeof affordability>;

function categoryOf(challenge: Challenge, budget: BoardBudget, wallet: number): BoardCategory {
  return boardCategory(budget.solve(flatChecks(challenge))?.cost ?? Infinity, wallet);
}

/** Assign missing colors before sorting so legacy cards keep their saved slot's color. */
export function sortBoard(p: WorkshopProgress, budget: BoardBudget): void {
  const usedColors = new Set(p.active.map((id) => p.challenges[id].boardColor));
  p.active.forEach((id, slot) => {
    const challenge = p.challenges[id];
    if (challenge.boardColor !== undefined) return;
    let color = slot;
    while (usedColors.has(color)) color = (color + 1) % WS_RULES.boardSize;
    usedColors.add(color);
    p.challenges[id] = { ...challenge, boardColor: color };
  });
  const categories = p.active.map((id) => ({
    id, rank: BOARD_CATEGORIES.indexOf(categoryOf(p.challenges[id], budget, p.wallet)),
  }));
  p.active = categories.sort((a, b) => a.rank - b.rank).map(({ id }) => id);
}

/** Retain unfinished cards and fill only the vacancies. */
export function refreshBoard(cat: WorkshopCatalog, p0: WorkshopProgress): WorkshopProgress {
  const p = copyProgress(p0);
  const budget = affordability(cat, p);
  const usedKeys = new Set(Object.values(p.challenges).map(challengeKey));
  const activeKeys = new Set(Object.keys(p.completed).flatMap((id) =>
    p.challenges[id] ? [challengeKey(p.challenges[id])] : []));
  p.active = p.active.filter((id) => {
    const challenge = p.challenges[id];
    if (!challenge || p.completed[id]) return false;
    const key = challengeKey(challenge);
    if (activeKeys.has(key)) return false;
    activeKeys.add(key);
    return true;
  }).slice(0, WS_RULES.boardSize);

  sortBoard(p, budget);
  if (p.active.length < WS_RULES.boardSize) {
    fillBoard(cat, p, budget, usedKeys);
    sortBoard(p, budget);
  }
  const retained = new Set(p.active);
  const inactive = Object.keys(p.challenges).filter((id) => !p.completed[id] && !retained.has(id));
  // Retain a bounded history of unfinished cards for deduplication.
  for (const id of inactive.slice(0, Math.max(0, inactive.length + p.active.length - WS_RULES.maxSavedChallenges))) {
    delete p.challenges[id];
    delete p.fails[id];
    if (p.failHints) delete p.failHints[id];
  }
  return p;
}

function fillBoard(cat: WorkshopCatalog, p: WorkshopProgress, budget: BoardBudget, usedKeys: Set<string>): void {
  const current = computeModel(cat, p.model);
  const last = p.lastWin && computeModel(cat, p.lastWin);
  const starters = currencyStarters(cat, p.easy);
  const shown = new Set(visibleAspectIds(cat, p));
  const variantAspect = (id: VariantId) => index(cat).variantById.get(id)?.aspect ?? '';
  const fixShown = (fixes: readonly (readonly VariantId[])[] | undefined) =>
    !fixes?.length || fixes.some((fix) => fix.every((id) => shown.has(variantAspect(id))));
  // Easy: deal only requirements whose listed fixes include one made from shown stations, so the story,
  // fail lines and hints can always point at a part the kid can reach.
  const facetOk = p.easy ? (facet: FacetDef, level: number) => fixShown(catalogFixes(cat, facet, level)) : undefined;
  const namesShown = (c: Challenge) => !p.easy || c.stages.every((st) => st.requirements.every((r) => fixShown(r.namedFixes)));
  const occupied = new Set(p.active.map((id) => categoryOf(p.challenges[id], budget, p.wallet)));
  const exhausted = new Set<BoardCategory>();

  const draw = (category: BoardCategory): Challenge | null => {
    if (category === 'affordable') {
      for (let i = p.nextStarter; i < starters.length; i++) {
        const challenge = starters[i];
        const checks = flatChecks(challenge);
        if (!namesShown(challenge) || usedKeys.has(challengeKey(challenge)) || allPass(checks, current) || (last && allPass(checks, last))) continue;
        if (budget.solve(checks)?.cost !== WS_RULES.basePrice) continue;
        p.nextStarter = i + 1;
        return challenge;
      }
      if (budget.pool.size === budget.owned.size) return null;
    }
    if (category === 'future' && budget.futurePool.size === budget.owned.size) return null;

    const id = `${cat.id}-g${p.genSeq}`;
    const seed = hashSeed(id);
    const tier = tierOf(p.firstWins);
    const avoidScenarios = new Set(p.active.map((key) => p.challenges[key].stages[0].scenario));
    const opts = {
      tier, avail: category === 'ready' ? budget.owned : category === 'affordable' ? budget.pool : budget.futurePool,
      current: p.model, lastWin: p.lastWin, minChanged: WS_RULES.minChangedAspects,
      newest: newestVariant(p, budget.owned), usedKeys, avoidScenarios,
      attempts: WS_RULES.genAttempts, strictCurrent: true, facetOk,
      accepts: (checks: Parameters<typeof budget.solve>[0]) => {
        const solution = category === 'future' ? budget.cheapest(checks) : budget.solve(checks);
        return solution !== null && boardCategory(solution.cost, p.wallet) === category;
      },
    };
    // The first owned build is the current build, so allow it when no other ready card exists.
    const onlyCurrent = category === 'ready' && budget.owned.size === cat.aspects.length;
    let challenge = onlyCurrent ? undefined : (generateChallenge(cat, id, 'generated', seed, opts)
      ?? generateChallenge(cat, id, 'generated', seed, { ...opts, fallback: true }))?.challenge;
    if (!challenge && category === 'ready') {
      challenge = practiceChallenge(cat, id, seed, tier, budget.owned, p.model, p.lastWin, usedKeys, false, shown)
        ?? generateChallenge(cat, id, 'generated', seed, { ...opts, fallback: true, strictCurrent: false })?.challenge
        ?? practiceChallenge(cat, id, seed, tier, budget.owned, p.model, p.lastWin, usedKeys, true, shown)
        ?? undefined;
    }
    if (challenge) p.genSeq++;
    return challenge ?? null;
  };

  while (p.active.length < WS_RULES.boardSize) {
    const candidates = BOARD_CATEGORIES.filter((category) => !occupied.has(category));
    candidates.push(...BOARD_CATEGORIES.filter((category) => occupied.has(category)));
    const category = candidates.find((kind) => {
      if (exhausted.has(kind)) return false;
      const challenge = draw(kind);
      if (!challenge) {
        exhausted.add(kind);
        return false;
      }
      p.challenges[challenge.id] = challenge;
      p.active.push(challenge.id);
      usedKeys.add(challengeKey(challenge));
      occupied.add(kind);
      return true;
    });
    if (!category) break;
  }
}

export function purchase(cat: WorkshopCatalog, p: WorkshopProgress, aspect: string, variant: VariantId): PurchaseOutcome {
  const offer = shopOffers(cat, p, aspect).find((item) => item.variant === variant);
  if (!offer) return { progress: p, status: 'unavailable', price: 0 };
  const { price } = offer;
  if (!offer.affordable) return { progress: p, status: 'unaffordable', price };
  const progress = copyProgress(p);
  progress.bought.push(variant);
  progress.wallet -= price;
  sortBoard(progress, affordability(cat, progress));
  return { progress, status: 'bought', price };
}

/** Count a failed attempt; `notes` (direct hints from logic/failHints) replace the remembered ones when given. */
export function recordFail(p: WorkshopProgress, challengeId: ChallengeId, notes: readonly FailNote[] = []): WorkshopProgress {
  const q = copyProgress(p);
  q.fails[challengeId] = (q.fails[challengeId] ?? 0) + 1;
  if (notes.length) q.failHints = { ...q.failHints, [challengeId]: notes.map((n) => ({ req: n.req, parts: [...n.parts] })) };
  return q;
}

export function recordWin(cat: WorkshopCatalog, p: WorkshopProgress, challengeId: ChallengeId, model: Model, now: number): WinOutcome {
  const challenge = p.challenges[challengeId];
  const sanitized = sanitizeModel(cat, p, model);
  const validBuild = cat.aspects.every((aspect) => model[aspect.id] === sanitized[aspect.id]);
  const result = challenge && validBuild && evaluate(cat, model, challenge);
  if (!p.active.includes(challengeId) || p.completed[challengeId] || !result || !result.passed) {
    return { progress: p, firstWin: false, payout: 0, newChallenges: [] };
  }
  const q = copyProgress(p);
  const payout = challenge.stages.reduce((sum, stage) => sum + stage.requirements.length, 0) * WS_RULES.payoutPerRequirement;
  q.wallet += payout;
  q.firstWins++;
  q.completed[challengeId] = { build: { ...model }, wonAt: now, payout };
  q.lastWin = { ...model };
  q.model = { ...model };
  const { buddies, unlockedBuddy } = advanceBuddies(q.buddies, challenge.seed, result.cleverWin);
  q.buddies = buddies;
  delete q.fails[challengeId];
  if (q.failHints) delete q.failHints[challengeId];
  const progress = refreshBoard(cat, q);
  return { progress, firstWin: true, payout, newChallenges: progress.active.filter((id) => !p.active.includes(id)), unlockedBuddy };
}

export function regenerate(cat: WorkshopCatalog, p: WorkshopProgress): WorkshopProgress {
  return refreshBoard(cat, { ...p, active: [], nextStarter: currencyStarters(cat, p.easy).length });
}

export function setOverride(cat: WorkshopCatalog, p: WorkshopProgress, variant: VariantId, value: VariantOverride | 'auto'): WorkshopProgress {
  const q = copyProgress(p);
  if (value === 'auto') delete q.overrides[variant]; else q.overrides[variant] = value;
  q.model = sanitizeModel(cat, q, q.model);
  const budget = affordability(cat, q);
  q.active = q.active.filter((id) => budget.cheapest(flatChecks(q.challenges[id])));
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
  // A hint that points at a station Easy has hidden would name a part the kid cannot reach.
  if (req && isHiddenAspect(challenge.workshop, p, req.hint.aspect)) return null;
  return req ? readingText(req.hint.text, reading) : null;
}
