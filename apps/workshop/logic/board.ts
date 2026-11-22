/** Board and progression: refill, wins, fails, hints, regenerate, overrides. All functions return new objects. */
import { WS_RULES } from '../config';
import type { WinOutcome } from '../core/engineApi';
import type {
  Challenge, ChallengeId, Model, ReadingLevel, RunResult, VariantId, VariantOverride, WorkshopCatalog, WorkshopProgress,
} from '../core/types';
import { available, availableFor, sanitizeModel } from './available';
import { challengeKey, generateChallenge } from './generator';
import { solvable } from './solver';
import { computeModel, defaultModel, allPass } from './stats';
import { starterChallenge } from './starters';
import { flatChecks, hashSeed } from './util';

export function newProgress(cat: WorkshopCatalog): WorkshopProgress {
  return {
    model: defaultModel(cat), earned: [], overrides: {}, challenges: {}, active: [], completed: {}, fails: {},
    lastWin: null, nextStarter: 0, firstWins: 0, genSeq: 1,
  };
}

export function copyProgress(p: WorkshopProgress): WorkshopProgress {
  return {
    ...p,
    model: { ...p.model },
    earned: [...p.earned],
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

/** Most recently earned variant that is still available. */
export function newestVariant(p: WorkshopProgress, avail: ReadonlySet<VariantId>): VariantId | null {
  for (let i = p.earned.length - 1; i >= 0; i--) if (avail.has(p.earned[i])) return p.earned[i];
  return null;
}

function isSolved(cat: WorkshopCatalog, p: WorkshopProgress, c: Challenge): boolean {
  const checks = flatChecks(c);
  if (p.lastWin && allPass(checks, computeModel(cat, p.lastWin))) return true;
  return allPass(checks, computeModel(cat, p.model));
}

/**
 * Fills the board. `replaceFillers`: completed challenges currently on the board are treated as free slots
 * (after a win / regenerate we try to put new challenges there); otherwise they stay (idempotent refresh).
 */
function refill(cat: WorkshopCatalog, p0: WorkshopProgress, replaceFillers: boolean, forgetActive: ReadonlySet<ChallengeId> = new Set()): WorkshopProgress {
  const p = copyProgress(p0);
  const size = WS_RULES.boardSize;
  const avail = available(cat, p);
  const drop = (id: ChallengeId): void => { delete p.challenges[id]; delete p.fails[id]; };

  // 1. keep valid active challenges in their slots
  const slots: (ChallengeId | null)[] = [];
  const seen = new Set<ChallengeId>();
  for (const id of p.active) {
    const c = p.challenges[id];
    if (!c || seen.has(id)) { slots.push(null); continue; }
    seen.add(id);
    const done = !!p.completed[id];
    if (forgetActive.has(id) || !solvable(cat, flatChecks(c), avail)) {
      if (!done) drop(id);
      slots.push(null);
    } else if (done && replaceFillers) slots.push(null);
    else slots.push(id);
  }
  if (slots.length > size) {
    for (const id of slots.splice(size)) if (id && !p.completed[id]) drop(id);
  }
  while (slots.length < size) slots.push(null);

  // 2. fill free slots: starters first, then generated
  const usedKeys = new Set(Object.values(p.challenges).map(challengeKey));
  const avoid = new Set<string>();
  for (const id of slots) if (id) avoid.add(p.challenges[id].stages[0].scenario);
  const newest = newestVariant(p, avail);
  const attemptsOk = { ok: true };
  for (let i = 0; i < size && attemptsOk.ok; i++) {
    if (slots[i]) continue;
    const next = nextStarter(cat, p, avail);
    if (next) {
      p.challenges[next.id] = next;
      slots[i] = next.id;
      avoid.add(next.stages[0].scenario);
      usedKeys.add(challengeKey(next));
      continue;
    }
    const seq = p.genSeq;
    const id = `${cat.id}-g${seq}`;
    const gen = generateChallenge(cat, id, 'generated', hashSeed(`${cat.id}:${seq}`), {
      tier: tierOf(p.firstWins), avail, current: p.model, lastWin: p.lastWin, minChanged: WS_RULES.minChangedAspects,
      newest, usedKeys, avoidScenarios: avoid, attempts: WS_RULES.genAttempts, strictCurrent: true,
    });
    if (!gen) { attemptsOk.ok = false; break; }
    p.genSeq = seq + 1;
    p.challenges[id] = gen.challenge;
    slots[i] = id;
    avoid.add(gen.challenge.stages[0].scenario);
    usedKeys.add(challengeKey(gen.challenge));
  }

  // 3. fill what is left with completed challenges, most recent wins first
  const inBoard = new Set(slots.filter((s): s is ChallengeId => !!s));
  const fillers = Object.keys(p.completed)
    .filter((id) => p.challenges[id] && !inBoard.has(id) && solvable(cat, flatChecks(p.challenges[id]), avail))
    .sort((a, b) => p.completed[b].lastWinAt - p.completed[a].lastWinAt || (a < b ? -1 : 1));
  for (let i = 0; i < size; i++) {
    if (!slots[i] && fillers.length) slots[i] = fillers.shift()!;
  }
  p.active = slots.filter((s): s is ChallengeId => !!s);

  // 4. cap saved challenges (oldest completed first; never active, never starters)
  const ids = Object.keys(p.challenges);
  if (ids.length > WS_RULES.maxSavedChallenges) {
    const act = new Set(p.active);
    const removable = ids
      .filter((id) => !act.has(id) && p.challenges[id].source !== 'starter')
      .sort((a, b) => (p.completed[a]?.lastWinAt ?? 0) - (p.completed[b]?.lastWinAt ?? 0));
    let excess = ids.length - WS_RULES.maxSavedChallenges;
    for (const id of removable) {
      if (excess <= 0) break;
      drop(id);
      delete p.completed[id];
      excess--;
    }
  }

  // 5. next starter index (smallest never-offered starter; length when all were offered or given up)
  if (p.nextStarter < cat.starters.length) {
    const k = cat.starters.findIndex((s) => !p.challenges[s.id]);
    p.nextStarter = k < 0 ? cat.starters.length : k;
  }
  return p;
}

/** The next starter to offer: in order, skipping (deferring) ones the last win / current model already solve. */
function nextStarter(cat: WorkshopCatalog, p: WorkshopProgress, avail: ReadonlySet<VariantId>): Challenge | null {
  if (p.nextStarter >= cat.starters.length) return null;
  const options: Challenge[] = [];
  for (const spec of cat.starters) {
    if (p.challenges[spec.id]) continue;
    const c = starterChallenge(cat, spec);
    if (solvable(cat, flatChecks(c), avail)) options.push(c);
  }
  if (!options.length) return null;
  return options.find((c) => !isSolved(cat, p, c)) ?? options[0];
}

export function refreshBoard(cat: WorkshopCatalog, p: WorkshopProgress): WorkshopProgress {
  return refill(cat, p, false);
}

export function recordFail(p: WorkshopProgress, challengeId: ChallengeId): WorkshopProgress {
  const q = copyProgress(p);
  q.fails[challengeId] = (q.fails[challengeId] ?? 0) + 1;
  return q;
}

export function recordWin(cat: WorkshopCatalog, p: WorkshopProgress, challengeId: ChallengeId, model: Model, now: number): WinOutcome {
  if (!p.challenges[challengeId]) return { progress: copyProgress(p), firstWin: false, unlocked: [], newChallenges: [] };
  const q = copyProgress(p);
  const prev = q.completed[challengeId];
  const firstWin = !prev;
  const unlocked: VariantId[] = [];
  if (firstWin) {
    const avail = available(cat, q);
    const next = cat.unlockOrder.find((v) => !avail.has(v) && !q.earned.includes(v));
    if (next) { q.earned.push(next); unlocked.push(next); }
    q.firstWins++;
  }
  q.completed[challengeId] = { build: { ...model }, wins: (prev?.wins ?? 0) + 1, firstWinAt: prev?.firstWinAt ?? now, lastWinAt: now };
  q.lastWin = { ...model };
  delete q.fails[challengeId];
  const before = new Set(q.active);
  const progress = refill(cat, q, true);
  return { progress, firstWin, unlocked, newChallenges: progress.active.filter((id) => !before.has(id)) };
}

export function regenerate(cat: WorkshopCatalog, p: WorkshopProgress): WorkshopProgress {
  const forget = new Set(p.active.filter((id) => !p.completed[id]));
  const droppedStarter = [...forget].some((id) => p.challenges[id]?.source === 'starter');
  const q = refill(cat, { ...p, nextStarter: droppedStarter ? cat.starters.length : p.nextStarter }, true, forget);
  return q;
}

export function setOverride(cat: WorkshopCatalog, p: WorkshopProgress, variant: VariantId, value: VariantOverride | 'auto'): WorkshopProgress {
  const q = copyProgress(p);
  if (value === 'auto') delete q.overrides[variant]; else q.overrides[variant] = value;
  q.model = sanitizeModel(cat, q, q.model);
  return refill(cat, q, false);
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
