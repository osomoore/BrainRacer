import { notifyProfileChanged } from '../../shared/sync/changes';
import { resolveProfileId } from '../../shared/profiles';

/**
 * Per-racer JBQ progress: how many times each question was answered correctly.
 * Stored under `brainracer.jbq.v1` as { [profileId]: { [questionId]: correctCount } } (question ids are unique across levels).
 * Every storage access is guarded; without storage (or without a profile id, e.g. a quick race) it stays in memory.
 */
export const JBQ_PROGRESS_KEY = 'brainracer.jbq.v1';

export type JbqCounts = Record<string, number>;
export type JbqProgressAll = Record<string, JbqCounts>;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Keeps only valid { profile: { id: positive integer count } } entries. */
export function parseJbqProgress(raw: unknown): JbqProgressAll {
  const out: JbqProgressAll = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [profile, counts] of Object.entries(raw as Record<string, unknown>)) {
    if (!counts || typeof counts !== 'object') continue;
    const clean: JbqCounts = {};
    for (const [id, n] of Object.entries(counts as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) clean[id] = Math.floor(n);
    }
    out[profile] = clean;
  }
  return out;
}

export const bumpCount = (counts: JbqCounts, id: number): JbqCounts => ({ ...counts, [id]: (counts[id] ?? 0) + 1 });

function defaultStorage(): StorageLike | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export class JbqProgressStore {
  private volatile: JbqProgressAll = {};
  private anon: JbqCounts = {};

  constructor(private readonly storage: () => StorageLike | undefined = defaultStorage) {}

  private load(): JbqProgressAll {
    try {
      const raw = this.storage()?.getItem(JBQ_PROGRESS_KEY);
      if (raw) return parseJbqProgress(JSON.parse(raw));
    } catch { /* fall back to memory */ }
    return this.volatile;
  }

  /** Correct-answer count for one question (0 if unknown). Racers without a profile id are in-memory only. */
  count(profile: string | undefined, id: number): number {
    profile = resolveProfileId(profile);
    if (profile === undefined) return this.anon[id] ?? 0;
    return this.load()[profile]?.[id] ?? 0;
  }

  /** Counts one more correct answer and saves. */
  recordCorrect(profile: string | undefined, id: number): void {
    profile = resolveProfileId(profile);
    if (profile === undefined) { this.anon = bumpCount(this.anon, id); return; }
    const all = this.load();
    const next: JbqProgressAll = { ...all, [profile]: bumpCount(all[profile] ?? {}, id) };
    this.volatile = next;
    try { this.storage()?.setItem(JBQ_PROGRESS_KEY, JSON.stringify(next)); } catch { /* session-only */ }
    notifyProfileChanged(profile);
  }
}
