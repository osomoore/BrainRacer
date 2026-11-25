import { READING_LEVELS, WORKSHOP_IDS, type PlayerSave, type WorkshopProgress } from '../../apps/workshop/core/types';
import { challengeKey } from '../../apps/workshop/logic/generator';
import { capRecentTries, mergeLearning, validLearningEntry, validLearningTry } from '../../apps/workshop/logic/learning';
import { validProfileName } from '../profiles';
import { object, profileId, stamp } from './protocol';
import { parseRacerSnapshot, type ProfileSnapshot } from './storage';

export interface ProfileRecord extends ProfileSnapshot { schema: 1; updatedAt: number; identityUpdatedAt?: number }
export interface Revision { id: string; rev: number; value: ProfileValue }
export type ProfileValue =
  | { deleted: true; updatedAt: number; mergedInto?: string }
  | { deleted: false; data: ProfileRecord };

export const identityTimeOf = (data: ProfileRecord): number => data.identityUpdatedAt ?? data.updatedAt;
export const timeOf = (value: ProfileValue): number =>
  value.deleted ? value.updatedAt : Math.max(value.data.updatedAt, identityTimeOf(value.data));

const stringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(s => typeof s === 'string');
const stringMap = (value: unknown): boolean =>
  object(value) && Object.values(value).every(s => typeof s === 'string');
const known = (choices: readonly string[], value: unknown): boolean =>
  typeof value === 'string' && choices.includes(value);

function check(value: unknown): boolean {
  if (!object(value)) return false;
  if (value.kind === 'anyOf') {
    return Array.isArray(value.options) && value.options.length >= 2 && value.options.every(
      option => Array.isArray(option) && option.length > 0 && option.every(item => object(item) && item.kind !== 'anyOf' && check(item)));
  }
  switch (value.kind) {
    case 'statMin': return typeof value.stat === 'string' && typeof value.min === 'number' && Number.isFinite(value.min);
    case 'statMax': return typeof value.stat === 'string' && typeof value.max === 'number' && Number.isFinite(value.max);
    case 'tag': case 'noTag': return typeof value.tag === 'string';
    default: return false;
  }
}

function challenge(value: unknown, id: string, workshop: string): boolean {
  return object(value) && value.id === id && value.workshop === workshop
    && typeof value.title === 'string' && stringMap(value.intro)
    && Array.isArray(value.stages) && value.stages.length > 0 && value.stages.every(stage =>
      object(stage) && typeof stage.scenario === 'string' && Array.isArray(stage.requirements)
      && stage.requirements.length > 0 && stage.requirements.every(req =>
        object(req) && typeof req.id === 'string' && stringMap(req.text)
        && object(req.hint) && typeof req.hint.aspect === 'string' && stringMap(req.hint.text)
        && Array.isArray(req.checks) && req.checks.length > 0 && req.checks.every(check)));
}

function workshopProgress(value: unknown, workshop: string): boolean {
  if (!object(value) || !object(value.challenges) || !object(value.completed) || !object(value.buddies)) return false;
  const cards = value.challenges;
  return stringMap(value.model) && stamp(value.wallet) && stringList(value.bought) && stringMap(value.overrides)
    && stringList(value.buddies.unlocked) && typeof value.buddies.selected === 'string' && stamp(value.buddies.progress)
    && Object.entries(cards).every(([id, v]) => profileId(id) && challenge(v, id, workshop))
    && stringList(value.active) && value.active.every(id => Object.hasOwn(cards, id))
    && Object.entries(value.completed).every(([id, v]) => Object.hasOwn(cards, id) && object(v)
      && stringMap(v.build) && stamp(v.wonAt) && stamp(v.payout))
    && object(value.fails) && Object.values(value.fails).every(stamp)
    && (value.learning === undefined || (object(value.learning) && Object.entries(value.learning).every(
      ([id, entry]) => profileId(id) && validLearningEntry(entry))))
    && (value.recentTries === undefined || (Array.isArray(value.recentTries) && value.recentTries.every(validLearningTry)))
    && (value.lastWin === null || stringMap(value.lastWin))
    && stamp(value.firstWins) && stamp(value.nextStarter) && stamp(value.genSeq)
    && (value.rulesVersion === undefined || stamp(value.rulesVersion))
    && (value.easy === undefined || value.easy === true)
    && (value.failHints === undefined || (object(value.failHints) && Object.values(value.failHints).every(notes =>
      Array.isArray(notes) && notes.every(note => object(note) && typeof note.req === 'string' && stringList(note.parts)))));
}

function workshopSave(value: unknown): value is PlayerSave | null {
  return value === null || (object(value) && value.version === 2 && known(READING_LEVELS, value.reading)
    && (value.lastWorkshop === undefined || known(WORKSHOP_IDS, value.lastWorkshop))
    && (value.buddySeed === undefined || (typeof value.buddySeed === 'number' && Number.isSafeInteger(value.buddySeed)))
    && object(value.workshops) && Object.entries(value.workshops).every(([id, progress]) =>
      known(WORKSHOP_IDS, id) && workshopProgress(progress, id)));
}

export function readRevision(value: unknown): Revision | undefined {
  if (!object(value) || !profileId(value.id) || !stamp(value.rev) || !value.rev || !stamp(value.updatedAt)
    || (value.deleted !== undefined && typeof value.deleted !== 'boolean')) return undefined;
  const { id, rev, data } = value;
  // A PUT tombstone can carry the original device edit time. Other deletions use the server time.
  const deletedAt = object(data) && data.schema === 1 && data.deleted === true && stamp(data.updatedAt)
    ? data.updatedAt : undefined;
  if (value.deleted === true || (value.deleted === undefined && deletedAt !== undefined)) {
    const mergedInto = deletedAt !== undefined && object(data) && profileId(data.mergedInto) && data.mergedInto !== id
      ? data.mergedInto : undefined;
    return { id, rev, value: { deleted: true, updatedAt: deletedAt ?? value.updatedAt, mergedInto } };
  }
  if (!object(data) || data.schema !== 1 || !stamp(data.updatedAt) || !object(data.profile)
    || (data.identityUpdatedAt !== undefined && !stamp(data.identityUpdatedAt))
    || data.profile.id !== id || !stamp(data.profile.createdAt) || !workshopSave(data.workshop)) return undefined;
  const name = validProfileName(data.profile.name);
  const racer = parseRacerSnapshot(data.racer);
  if (!name || name !== data.profile.name || !racer) return undefined;
  return { id, rev, value: { deleted: false, data: {
    schema: 1, profile: { id, name, createdAt: data.profile.createdAt }, racer,
    workshop: data.workshop && capRecentTries(data.workshop), updatedAt: data.updatedAt, identityUpdatedAt: data.identityUpdatedAt,
  } } };
}

function union<T>(older: T[], newer: T[]): T[] { return [...new Set([...older, ...newer])]; }

function mergeProgress(older: WorkshopProgress, newer: WorkshopProgress): WorkshopProgress {
  const challenges = { ...newer.challenges };
  const completed = { ...newer.completed };
  const aliases = new Map<string, string>();
  const attempted = new Set(older.recentTries?.map(attempt => attempt.challengeId));
  for (const [id, card] of Object.entries(older.challenges)) {
    const win = older.completed[id];
    if (!win && !older.learning?.[id] && !attempted.has(id)) continue;
    const key = challengeKey(card);
    const baseId = id.replace(/-history-\d+-\d+-\d+$/, '');
    const base = challenges[baseId];
    // Offline generation can reuse the same sequence ID for different cards.
    // Keep the newer card at its board position and give the older win a stable history ID.
    const history = `${baseId}-history-${textHash(key).replaceAll(':', '-')}`;
    const target = (base && challengeKey(base) !== key) || Object.hasOwn(challenges, history) ? history : baseId;
    if (id !== target) aliases.set(id, target);
    if (win && (!Object.hasOwn(completed, target) || win.wonAt > completed[target].wonAt)) {
      completed[target] = win;
      challenges[target] ??= { ...card, id: target };
    }
  }
  return {
    ...newer,
    ...mergeLearning(older, newer, aliases),
    bought: union(older.bought, newer.bought),
    buddies: { ...newer.buddies, unlocked: union(older.buddies.unlocked, newer.buddies.unlocked) },
    challenges, completed, active: newer.active.filter(id => !Object.hasOwn(completed, id)),
    firstWins: Math.max(Object.keys(completed).length, older.firstWins, newer.firstWins),
    nextStarter: Math.max(older.nextStarter, newer.nextStarter),
    genSeq: Math.max(older.genSeq, newer.genSeq),
  };
}

function mergeWorkshop(older: PlayerSave | null, newer: PlayerSave | null): PlayerSave | null {
  if (!older || !newer) {
    const save = newer ?? older;
    return save && capRecentTries(save);
  }
  const workshops = { ...older.workshops, ...newer.workshops };
  for (const id of WORKSHOP_IDS) {
    const a = older.workshops[id];
    const b = newer.workshops[id];
    if (a && b) workshops[id] = mergeProgress(a, b);
  }
  return capRecentTries({ ...newer, workshops });
}

function mergeRacer(older: ProfileSnapshot['racer'], newer: ProfileSnapshot['racer']): ProfileSnapshot['racer'] {
  const racer = { ...older, ...newer };
  if (older.progress && newer.progress) {
    const progress = {
      ...newer.progress,
      worlds: union(older.progress.worlds, newer.progress.worlds),
      items: union(older.progress.items, newer.progress.items),
    };
    racer.progress = parseRacerSnapshot({ progress })!.progress;
  }
  if (older.jbq && newer.jbq) {
    racer.jbq = { ...older.jbq };
    for (const [id, n] of Object.entries(newer.jbq)) racer.jbq[id] = Math.max(n, racer.jbq[id] ?? 0);
  }
  return racer;
}

/** Equal edit times prefer the server's scalars, with deletion winning ties. */
export function mergeProfile(local: ProfileValue, remote: ProfileValue): ProfileValue {
  if (local.deleted || remote.deleted) {
    if (timeOf(local) > timeOf(remote) || (timeOf(local) === timeOf(remote) && local.deleted)) return local;
    return remote;
  }
  const [older, newer] = local.data.updatedAt > remote.data.updatedAt ? [remote.data, local.data] : [local.data, remote.data];
  const identity = identityTimeOf(local.data) > identityTimeOf(remote.data) ? local.data : remote.data;
  return { deleted: false, data: {
    ...newer, profile: identity.profile,
    identityUpdatedAt: identity.identityUpdatedAt ?? (identity.updatedAt !== newer.updatedAt ? identity.updatedAt : undefined),
    racer: mergeRacer(older.racer, newer.racer),
    workshop: mergeWorkshop(older.workshop, newer.workshop),
  } };
}

/** Stable across object insertion order and excludes sync metadata. */
export function snapshotHash(snapshot: ProfileSnapshot): string {
  return dataHash({ profile: snapshot.profile, racer: snapshot.racer, workshop: snapshot.workshop });
}

export function gameSaveHash(snapshot: ProfileSnapshot): string {
  return dataHash({ racer: snapshot.racer, workshop: snapshot.workshop });
}

function dataHash(value: object): string {
  const text = JSON.stringify(value,
    (_key, v: unknown) => object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  return textHash(text);
}

function textHash(text: string): string {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    a = Math.imul(a ^ n, 16777619);
    b = Math.imul(b, 33) ^ n;
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

export const valueHash = (value: ProfileValue): string =>
  value.deleted ? (value.mergedInto ? `merged:${value.mergedInto}` : 'deleted') : snapshotHash(value.data);
