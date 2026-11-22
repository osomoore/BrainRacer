/**
 * Racer settings helpers shared by Setup and Admin Settings. Who exists and what they are called lives in the
 * shared profile store (shared/profiles.ts); Brain Racer only keeps per-profile game settings
 * (`Settings.racerProfiles`, keyed by the shared profile id).
 */
import { NEW_RACER, NEW_RACER_DEFAULTS } from '../config/gameConfig';
import { normalizeJbq, normalizeQuestionTypes } from '../config/questionsPolicy';
import { createProfile, deleteProfile, getProfile, listProfiles, renameProfile, validProfileName } from '../../shared/profiles';
import type { Difficulty, JbqSettings, PlayerSettings, QuestionTypes, RacerProfile, RacerProfileId, Settings } from './types';

const DIFFS: readonly Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];

type Src = Pick<Settings, 'racerProfiles'>;

/** Alias of the shared rule so Brain Racer call sites read naturally. */
export const validRacerName = validProfileName;

function normalizeProfile(raw: unknown, fallback: RacerProfile): RacerProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RacerProfile>;
  const difficulty = DIFFS.includes(r.difficulty as Difficulty) ? r.difficulty as Difficulty : fallback.difficulty;
  const q = r.questionTypes && typeof r.questionTypes === 'object' ? r.questionTypes as unknown as Record<string, unknown> : undefined;
  // A saved selection with nothing on (or garbage) falls back to the defaults, not to a legacy preset.
  const picked = !!q && Object.values(q).some(v => v === true);
  const questionTypes = picked ? normalizeQuestionTypes(q) : { ...fallback.questionTypes };
  const roundSec = typeof r.roundSec === 'number' && Number.isFinite(r.roundSec) && r.roundSec >= 30 && r.roundSec <= 3600
    ? Math.round(r.roundSec) : fallback.roundSec;
  return { difficulty, questionTypes, roundSec, jbq: normalizeJbq(r.jbq, fallback.jbq) };
}

/** Existing profile ids in creation order (from the shared store). */
export function racerIds(_settings?: Src): RacerProfileId[] {
  return listProfiles().map(p => p.id);
}

export function isRacerProfileId(v: unknown): v is RacerProfileId {
  return typeof v === 'string' && !!getProfile(v);
}

/** Display name from the shared profile; 'Racer' for an unknown or missing id. */
export function racerName(_settings: Src | undefined, id: RacerProfileId | undefined): string {
  return getProfile(id)?.name ?? 'Racer';
}

/** Settings for every existing profile; saved edits applied over the new-profile defaults. */
export function racerProfiles(settings: Src): Record<RacerProfileId, RacerProfile> {
  const saved = settings.racerProfiles ?? {};
  return Object.fromEntries(racerIds().map(id => [id, normalizeProfile(saved[id], NEW_RACER_DEFAULTS)]));
}

/** Settings for one racer (new-profile defaults when there is no racer, e.g. a quick race on a fresh device). */
export function racerSettingsOf(settings: Src, id: RacerProfileId | undefined): RacerProfile {
  return normalizeProfile(id === undefined ? undefined : settings.racerProfiles?.[id], NEW_RACER_DEFAULTS);
}

/**
 * The player's racer: their saved choice if that profile still exists, else the profile at this slot's position
 * (profile 1 for slot 1, ...), else none (the player makes one in Setup; quick races run as an unnamed racer).
 */
export function playerRacer(player: Pick<PlayerSettings, 'profile'> | undefined, slot: number, _settings?: Src): RacerProfileId | undefined {
  const p = player?.profile;
  if (isRacerProfileId(p)) return p;
  return listProfiles()[slot]?.id;
}

/** Copies the racer's difficulty and question types onto the player (the values ChallengeSystem reads). */
export function applyRacerProfile<P extends PlayerSettings>(player: P, slot: number, settings: Src): P & { questionTypes: QuestionTypes; jbq: JbqSettings } {
  const profile = playerRacer(player, slot, settings);
  const r = racerSettingsOf(settings, profile);
  return { ...player, profile, difficulty: r.difficulty, questionTypes: { ...r.questionTypes }, jbq: { ...r.jbq } };
}

/** Returns a settings patch that replaces one profile's game settings (normalized). */
export function withRacerProfile(settings: Src, id: RacerProfileId, profile: RacerProfile): Pick<Settings, 'racerProfiles'> {
  return { racerProfiles: { ...racerProfiles(settings), [id]: normalizeProfile(profile, NEW_RACER_DEFAULTS) } };
}

/** Race length for a team: the longest time among the players' racers. */
export function teamRoundSec(players: readonly Pick<PlayerSettings, 'profile'>[], settings: Src): number {
  return Math.max(...players.map((p, i) => racerSettingsOf(settings, playerRacer(p, i, settings)).roundSec));
}

export interface NewRacerInput { name: string; under10: boolean; difficulty: Difficulty; questionTypes: QuestionTypes; jbq?: JbqSettings }

/** Creates a shared profile plus its game settings. Returns its id and the settings patch to save (null: invalid name). */
export function createRacer(settings: Src, input: NewRacerInput): { id: RacerProfileId; patch: Pick<Settings, 'racerProfiles'> } | null {
  const created = createProfile(input.name);
  if (!created) return null;
  const profile = normalizeProfile({
    difficulty: input.difficulty,
    questionTypes: input.questionTypes,
    roundSec: input.under10 ? NEW_RACER.roundSecUnder10 : NEW_RACER.roundSecOver10,
    jbq: input.jbq,
  }, NEW_RACER_DEFAULTS);
  return { id: created.id, patch: { racerProfiles: { ...racerProfiles(settings), [created.id]: profile } } };
}

/** Renames a racer in the shared store (invalid names are ignored). */
export function renameRacer(id: RacerProfileId, name: string): boolean {
  return renameProfile(id, name);
}

/** Deletes a racer from the shared store and drops their game settings. Saved progress goes via `deleteRacerProgress`. */
export function deleteRacer(settings: Src, id: RacerProfileId): Pick<Settings, 'racerProfiles'> {
  const profiles: Partial<Record<RacerProfileId, RacerProfile>> = { ...racerProfiles(settings) };
  delete profiles[id];
  deleteProfile(id);
  return { racerProfiles: profiles };
}
