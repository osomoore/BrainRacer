/** Racer presets (Abe / Gideon / Helen): pure helpers shared by Setup and Admin Settings. */
import { DEFAULT_PLAYER_RACERS, DEFAULT_RACER_PROFILES } from '../config/gameConfig';
import type { Difficulty, PlayerSettings, QuestionType, QuestionTypes, RacerProfile, RacerProfileId, Settings } from './types';

export const RACER_PROFILE_IDS: readonly RacerProfileId[] = ['abe', 'gideon', 'helen', 'daddy'];
export const RACER_PROFILE_NAME: Record<RacerProfileId, string> = { abe: 'Abe', gideon: 'Gideon', helen: 'Helen', daddy: 'Daddy' };
const DIFFS: readonly Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];
const TYPES: readonly QuestionType[] = ['addition', 'multiplication', 'spelling'];

export function isRacerProfileId(v: unknown): v is RacerProfileId {
  return RACER_PROFILE_IDS.includes(v as RacerProfileId);
}

function normalizeProfile(raw: unknown, fallback: RacerProfile): RacerProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RacerProfile>;
  const difficulty = DIFFS.includes(r.difficulty as Difficulty) ? r.difficulty as Difficulty : fallback.difficulty;
  const q = (r.questionTypes && typeof r.questionTypes === 'object' ? r.questionTypes : undefined) as Partial<QuestionTypes> | undefined;
  const questionTypes = q
    ? Object.fromEntries(TYPES.map(t => [t, q[t] === true])) as QuestionTypes
    : { ...fallback.questionTypes };
  return { difficulty, questionTypes: TYPES.some(t => questionTypes[t]) ? questionTypes : { ...fallback.questionTypes } };
}

/** All three profiles, with saved edits applied over the defaults (always at least one question type on). */
export function racerProfiles(settings: Pick<Settings, 'racerProfiles'>): Record<RacerProfileId, RacerProfile> {
  const saved = settings.racerProfiles ?? {};
  return Object.fromEntries(RACER_PROFILE_IDS.map(id => [id, normalizeProfile(saved[id], DEFAULT_RACER_PROFILES[id])])) as Record<RacerProfileId, RacerProfile>;
}

/** The player's chosen racer, or the slot default. */
export function playerRacer(player: Pick<PlayerSettings, 'profile'> | undefined, slot: number): RacerProfileId {
  return isRacerProfileId(player?.profile) ? player.profile : DEFAULT_PLAYER_RACERS[slot] ?? DEFAULT_PLAYER_RACERS[0];
}

/** Copies the racer's difficulty and question types onto the player (the values ChallengeSystem reads). */
export function applyRacerProfile<P extends PlayerSettings>(player: P, slot: number, settings: Pick<Settings, 'racerProfiles'>): P & { profile: RacerProfileId; questionTypes: QuestionTypes } {
  const profile = playerRacer(player, slot);
  const r = racerProfiles(settings)[profile];
  return { ...player, profile, difficulty: r.difficulty, questionTypes: { ...r.questionTypes } };
}

/** Returns a settings patch that replaces one profile (normalized). */
export function withRacerProfile(settings: Pick<Settings, 'racerProfiles'>, id: RacerProfileId, profile: RacerProfile): Pick<Settings, 'racerProfiles'> {
  return { racerProfiles: { ...racerProfiles(settings), [id]: normalizeProfile(profile, DEFAULT_RACER_PROFILES[id]) } };
}
