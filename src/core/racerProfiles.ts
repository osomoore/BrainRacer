/** Racer presets (built-ins + custom racers made in Setup): pure helpers shared by Setup and Admin Settings. */
import { DEFAULT_PLAYER_RACERS, DEFAULT_RACER_PROFILES, NEW_RACER, NEW_RACER_DEFAULTS } from '../config/gameConfig';
import type { BuiltinRacerId, Difficulty, PlayerSettings, QuestionType, QuestionTypes, RacerProfile, RacerProfileId, Settings } from './types';

export const BUILTIN_RACER_IDS: readonly BuiltinRacerId[] = ['abe', 'gideon', 'helen', 'daddy'];
/** Alias of BUILTIN_RACER_IDS (older call sites). */
export const RACER_PROFILE_IDS = BUILTIN_RACER_IDS;
export const RACER_PROFILE_NAME: Record<BuiltinRacerId, string> = { abe: 'Abe', gideon: 'Gideon', helen: 'Helen', daddy: 'Daddy' };
const DIFFS: readonly Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];
const TYPES: readonly QuestionType[] = ['addition', 'multiplication', 'spelling'];
const CUSTOM_ID = /^u\d+$/;

type Src = Pick<Settings, 'racerProfiles' | 'customRacers'>;
type Patch = Pick<Settings, 'racerProfiles' | 'customRacers'>;

export function isBuiltinRacerId(v: unknown): v is BuiltinRacerId {
  return BUILTIN_RACER_IDS.includes(v as BuiltinRacerId);
}

/** Normalized name (trimmed, single spaces, letters/spaces only, max length) or undefined if empty/invalid. */
export function validRacerName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  const n = name.replace(/\s+/g, ' ').trim().slice(0, NEW_RACER.nameMaxLen).trim();
  return n && NEW_RACER.nameChars.test(n) ? n : undefined;
}

function normalizeProfile(raw: unknown, fallback: RacerProfile): RacerProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RacerProfile>;
  const difficulty = DIFFS.includes(r.difficulty as Difficulty) ? r.difficulty as Difficulty : fallback.difficulty;
  const q = (r.questionTypes && typeof r.questionTypes === 'object' ? r.questionTypes : undefined) as Partial<QuestionTypes> | undefined;
  const questionTypes = q
    ? Object.fromEntries(TYPES.map(t => [t, q[t] === true])) as QuestionTypes
    : { ...fallback.questionTypes };
  const roundSec = typeof r.roundSec === 'number' && Number.isFinite(r.roundSec) && r.roundSec >= 30 && r.roundSec <= 3600
    ? Math.round(r.roundSec) : fallback.roundSec;
  const out: RacerProfile = { difficulty, questionTypes: TYPES.some(t => questionTypes[t]) ? questionTypes : { ...fallback.questionTypes }, roundSec };
  const name = validRacerName(r.name);
  if (name) out.name = name;
  return out;
}

const fallbackFor = (id: RacerProfileId): RacerProfile => isBuiltinRacerId(id) ? DEFAULT_RACER_PROFILES[id] : NEW_RACER_DEFAULTS;

/** Built-ins first, then valid custom racers (deduped, in creation order). */
export function racerIds(settings: Src): RacerProfileId[] {
  const saved = settings.racerProfiles ?? {};
  const custom: RacerProfileId[] = [];
  for (const id of Array.isArray(settings.customRacers) ? settings.customRacers : []) {
    if (typeof id === 'string' && CUSTOM_ID.test(id) && !custom.includes(id) && validRacerName(saved[id]?.name)) custom.push(id);
  }
  return [...BUILTIN_RACER_IDS, ...custom];
}

/** Built-in id, or (with settings) an existing racer; without settings any well-formed custom id ('u3'). */
export function isRacerProfileId(v: unknown, settings?: Src): v is RacerProfileId {
  if (isBuiltinRacerId(v)) return true;
  if (typeof v !== 'string') return false;
  return settings ? racerIds(settings).includes(v as RacerProfileId) : CUSTOM_ID.test(v);
}

export function racerName(settings: Src, id: RacerProfileId): string {
  return validRacerName(settings.racerProfiles?.[id]?.name) ?? (isBuiltinRacerId(id) ? RACER_PROFILE_NAME[id] : 'Racer');
}

/** Profiles for every racer (built-ins and valid custom ones), saved edits applied over the defaults. */
export function racerProfiles(settings: Src): Record<RacerProfileId, RacerProfile> {
  const saved = settings.racerProfiles ?? {};
  return Object.fromEntries(racerIds(settings).map(id => [id, normalizeProfile(saved[id], fallbackFor(id))])) as Record<RacerProfileId, RacerProfile>;
}

/** The player's chosen racer, or the slot default (also when a custom racer was deleted). */
export function playerRacer(player: Pick<PlayerSettings, 'profile'> | undefined, slot: number, settings?: Src): RacerProfileId {
  const p = player?.profile;
  return isRacerProfileId(p, settings) ? p : DEFAULT_PLAYER_RACERS[slot] ?? DEFAULT_PLAYER_RACERS[0];
}

/** Copies the racer's difficulty and question types onto the player (the values ChallengeSystem reads). */
export function applyRacerProfile<P extends PlayerSettings>(player: P, slot: number, settings: Src): P & { profile: RacerProfileId; questionTypes: QuestionTypes } {
  const profile = playerRacer(player, slot, settings);
  const r = racerProfiles(settings)[profile];
  return { ...player, profile, difficulty: r.difficulty, questionTypes: { ...r.questionTypes } };
}

/** Returns a settings patch that replaces one profile (normalized; keeps the saved name if none given). */
export function withRacerProfile(settings: Src, id: RacerProfileId, profile: RacerProfile): Pick<Settings, 'racerProfiles'> {
  const all = racerProfiles(settings);
  return { racerProfiles: { ...all, [id]: normalizeProfile({ ...profile, name: profile.name ?? all[id]?.name }, fallbackFor(id)) } };
}

/** Race length for a team: the longest time among the players' racers. */
export function teamRoundSec(players: readonly Pick<PlayerSettings, 'profile'>[], settings: Src): number {
  const profiles = racerProfiles(settings);
  return Math.max(...players.map((p, i) => profiles[playerRacer(p, i, settings)].roundSec));
}

export interface NewRacerInput { name: string; under10: boolean; difficulty: Difficulty; questionTypes: QuestionTypes }

/** Next free id: highest existing u-number + 1. */
function nextRacerId(settings: Src): RacerProfileId {
  const used = [...(settings.customRacers ?? []), ...Object.keys(settings.racerProfiles ?? {})]
    .filter(id => CUSTOM_ID.test(id)).map(id => Number(id.slice(1)));
  return `u${Math.max(0, ...used) + 1}` as RacerProfileId;
}

/** Creates a custom racer. Returns its id and the settings patch to save. */
export function createRacer(settings: Src, input: NewRacerInput): { id: RacerProfileId; patch: Patch } {
  const id = nextRacerId(settings);
  const profile = normalizeProfile({
    name: validRacerName(input.name) ?? 'Racer',
    difficulty: input.difficulty,
    questionTypes: input.questionTypes,
    roundSec: input.under10 ? NEW_RACER.roundSecUnder10 : NEW_RACER.roundSecOver10,
  }, NEW_RACER_DEFAULTS);
  return {
    id,
    patch: {
      racerProfiles: { ...racerProfiles(settings), [id]: profile },
      customRacers: [...racerIds(settings).filter(r => !isBuiltinRacerId(r)), id],
    },
  };
}

/** Renames a racer. Built-ins: empty/invalid name resets to the default name. Custom: invalid name is ignored. */
export function renameRacer(settings: Src, id: RacerProfileId, name: string): Pick<Settings, 'racerProfiles'> {
  const profiles = racerProfiles(settings);
  const cur = profiles[id];
  if (!cur) return { racerProfiles: profiles };
  const n = validRacerName(name);
  if (!n) {
    if (!isBuiltinRacerId(id)) return { racerProfiles: profiles };
    const rest: RacerProfile = { ...cur };
    delete rest.name;
    return { racerProfiles: { ...profiles, [id]: rest } };
  }
  return { racerProfiles: { ...profiles, [id]: { ...cur, name: n } } };
}

/** Deletes a custom racer (built-ins or unknown ids: empty patch). Saved progress goes via `deleteRacerProgress`. */
export function deleteRacer(settings: Src, id: RacerProfileId): Partial<Patch> {
  if (isBuiltinRacerId(id) || !racerIds(settings).includes(id)) return {};
  const profiles: Partial<Record<RacerProfileId, RacerProfile>> = { ...racerProfiles(settings) };
  delete profiles[id];
  return { racerProfiles: profiles, customRacers: racerIds(settings).filter(r => !isBuiltinRacerId(r) && r !== id) };
}
