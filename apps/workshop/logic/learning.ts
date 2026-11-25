import { WS_RULES } from '../config';
import { WORKSHOP_IDS, type Challenge, type ChallengeLearning, type Model, type PlayerSave, type RunResult,
  type WorkshopProgress, type WorkshopTry } from '../core/types';

const idCodes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function isLearningChallenge(challenge: Challenge): boolean {
  return challenge.source !== 'admin' && !challenge.stages.some(stage => stage.scenario === 'practice');
}

/** Normal sNrM IDs take one character each. Preserve any other saved ID verbatim. */
function encodeFailures(run: RunResult): string {
  const ids = run.requirements.filter(req => req.reached && !req.passed).map(req => req.id);
  let packed = '';
  for (const id of ids) {
    const match = /^s([0-7])r([0-7])$/.exec(id);
    if (!match) return `~${JSON.stringify(ids)}`;
    packed += idCodes[Number(match[1]) * 8 + Number(match[2])];
  }
  return packed;
}

function extendedIds(value: string): string[] | undefined {
  try {
    const ids: unknown = JSON.parse(value.slice(1));
    if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) return ids;
  } catch { /* An invalid learning field is handled by the save reader. */ }
  return undefined;
}

export function failedRequirementIds(packed: string): string[] {
  if (packed.startsWith('~')) return extendedIds(packed) ?? [];
  return Array.from(packed, code => {
    const index = idCodes.indexOf(code);
    return `s${Math.floor(index / 8)}r${index % 8}`;
  });
}

/** Add a live result after the board has accepted it, preserving the pre-run build. */
export function recordLearningTry(save: PlayerSave, challenge: Challenge, run: RunResult,
  build: Model, at: number, hintShown: boolean): PlayerSave {
  const workshop = challenge.workshop;
  const progress = save.workshops[workshop];
  if (!progress || !isLearningChallenge(challenge)) return save;
  const previous = progress.learning?.[challenge.id];
  if (previous?.wonAt !== undefined) return save;
  const failedChecks = encodeFailures(run);
  const entry: ChallengeLearning = {
    tries: (previous?.tries ?? 0) + 1,
    firstTryAt: Math.min(previous?.firstTryAt ?? at, at),
    hintShown: (previous?.hintShown ?? false) || (!run.passed && hintShown),
    failedChecks: [...(previous?.failedChecks ?? []), failedChecks],
    ...(run.passed ? { wonAt: at } : {}),
  };
  return capRecentTries({ ...save, workshops: { ...save.workshops, [workshop]: {
    ...progress,
    learning: { ...progress.learning, [challenge.id]: entry },
    recentTries: [...(progress.recentTries ?? []), { at, challengeId: challenge.id, pass: run.passed, failedChecks, build: { ...build } }],
  } } });
}

const byTime = (a: WorkshopTry, b: WorkshopTry): number => a.at - b.at
  || (a.challengeId < b.challengeId ? -1 : a.challengeId === b.challengeId ? 0 : 1);
const tryKey = (attempt: WorkshopTry): string => `${attempt.at}:${attempt.challengeId}`;

/** Each room keeps its own share of the player's total recent window. */
export function capRecentTries(save: PlayerSave): PlayerSave {
  const attempts = WORKSHOP_IDS.flatMap(workshop =>
    (save.workshops[workshop]?.recentTries ?? []).map(attempt => ({ workshop, attempt })));
  if (attempts.length <= WS_RULES.recentTriesPerPlayer) return save;
  const kept = attempts.sort((a, b) => byTime(a.attempt, b.attempt)).slice(-WS_RULES.recentTriesPerPlayer);
  const workshops = { ...save.workshops };
  for (const workshop of WORKSHOP_IDS) {
    const progress = workshops[workshop];
    if (progress?.recentTries?.length) workshops[workshop] = { ...progress,
      recentTries: kept.filter(item => item.workshop === workshop).map(item => item.attempt),
    };
  }
  return { ...save, workshops };
}

function mergeEntry(a: ChallengeLearning, b: ChallengeLearning): ChallengeLearning {
  const tries = Math.max(a.tries, b.tries);
  const firstTryAt = Math.min(a.firstTryAt, b.firstTryAt);
  const wonAt = a.wonAt === undefined ? b.wonAt : b.wonAt === undefined ? a.wonAt : Math.min(a.wonAt, b.wonAt);
  const detail = a.failedChecks.length > b.failedChecks.length
    || (a.failedChecks.length === b.failedChecks.length && b.wonAt === undefined && a.wonAt !== undefined) ? a : b;
  return { tries, firstTryAt, hintShown: a.hintShown || b.hintShown, failedChecks: detail.failedChecks, wonAt };
}

export function mergeLearning(older: WorkshopProgress, newer: WorkshopProgress,
  aliases: ReadonlyMap<string, string>): Pick<WorkshopProgress, 'learning' | 'recentTries'> {
  const merged: Pick<WorkshopProgress, 'learning' | 'recentTries'> = {};
  if (older.learning || newer.learning) {
    const learning = { ...newer.learning };
    for (const [id, entry] of Object.entries(older.learning ?? {})) {
      const target = aliases.get(id) ?? id;
      learning[target] = Object.hasOwn(learning, target) ? mergeEntry(entry, learning[target]) : entry;
    }
    merged.learning = learning;
  }
  if (older.recentTries || newer.recentTries) {
    const byKey = new Map<string, WorkshopTry>();
    for (const attempt of older.recentTries ?? []) {
      const challengeId = aliases.get(attempt.challengeId) ?? attempt.challengeId;
      const mapped = challengeId === attempt.challengeId ? attempt : { ...attempt, challengeId };
      byKey.set(tryKey(mapped), mapped);
    }
    for (const attempt of newer.recentTries ?? []) byKey.set(tryKey(attempt), attempt);
    merged.recentTries = [...byKey.values()].sort(byTime);
  }
  return merged;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const stamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const validLearningId = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9_-]+$/.test(value) && !Object.hasOwn(Object.prototype, value);
const failureList = (value: unknown): value is string => typeof value === 'string'
  && (/^[A-Za-z0-9_-]*$/.test(value) || (value.startsWith('~') && extendedIds(value) !== undefined));

export function validLearningEntry(value: unknown): value is ChallengeLearning {
  return object(value) && stamp(value.tries) && value.tries > 0 && stamp(value.firstTryAt)
    && (value.wonAt === undefined || (stamp(value.wonAt) && value.wonAt >= value.firstTryAt))
    && typeof value.hintShown === 'boolean' && Array.isArray(value.failedChecks)
    && value.failedChecks.length <= value.tries && value.failedChecks.every(failureList);
}

export function validLearningTry(value: unknown): value is WorkshopTry {
  return object(value) && stamp(value.at) && validLearningId(value.challengeId) && typeof value.pass === 'boolean'
    && failureList(value.failedChecks) && object(value.build) && Object.values(value.build).every(part => typeof part === 'string');
}
