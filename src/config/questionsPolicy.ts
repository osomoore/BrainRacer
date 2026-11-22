import type { JbqLevel, JbqScope, JbqSettings, QuestionTypes, Settings } from '../core/types';

/**
 * Questions are mandatory in normal play. The `?questions=off` URL override only works when
 * the app was started/built with VITE_ALLOW_QUESTIONS_OFF=1:
 *  - `npm run dev` / `npm run dev:questions` set it via .env.development / .env.questions
 *  - `play.bat --questions-off` sets it for the build
 *  - Playwright's webServer sets it (playwright.config.ts)
 * `VITE_QUESTIONS` (dev only) is the default mode used when the URL has no `questions` param.
 */
export type ChallengeSetting = Settings['challengeMode'];

const MODES: ChallengeSetting[] = ['words', 'math', 'mixed', 'off'];
const isMode = (v: unknown): v is ChallengeSetting => MODES.includes(v as ChallengeSetting);

export function questionsOffAllowed(): boolean {
  return import.meta.env.VITE_ALLOW_QUESTIONS_OFF === '1';
}

export function questionTypesForMode(mode?: ChallengeSetting): QuestionTypes {
  return {
    math: mode === 'math' || mode === 'mixed',
    reading: mode !== 'math',
    jbq: false,
  };
}

/**
 * Current shape { math, reading, jbq }. Older saves used { addition, multiplication, spelling }:
 * addition or multiplication -> math (the kind now follows the difficulty), spelling -> reading.
 * Nothing selected falls back to the legacy mode preset.
 */
export function normalizeQuestionTypes(raw: unknown, mode?: ChallengeSetting): QuestionTypes {
  if (!raw || typeof raw !== 'object') return questionTypesForMode(mode);
  const saved = raw as Record<string, unknown>;
  const legacy = !('math' in saved || 'reading' in saved || 'jbq' in saved);
  const types: QuestionTypes = legacy
    ? { math: saved.addition === true || saved.multiplication === true, reading: saved.spelling === true, jbq: false }
    : { math: saved.math === true, reading: saved.reading === true, jbq: saved.jbq === true };
  return Object.values(types).some(Boolean) ? types : questionTypesForMode(mode);
}

const JBQ_LEVELS: readonly JbqLevel[] = ['basics', 10, 20, 30];
const JBQ_SCOPES: readonly JbqScope[] = ['week', 'month', 'all'];

/** Valid JBQ settings from saved data (invalid fields fall back to `fallback`). */
export function normalizeJbq(raw: unknown, fallback: JbqSettings): JbqSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<JbqSettings>;
  return {
    points: JBQ_LEVELS.includes(r.points as JbqLevel) ? r.points as JbqLevel : fallback.points,
    scope: JBQ_SCOPES.includes(r.scope as JbqScope) ? r.scope as JbqScope : fallback.scope,
  };
}

function launchMode(urlParam: string | null | undefined, envDefault: string | null | undefined) {
  return isMode(urlParam) ? urlParam : isMode(envDefault) ? envDefault : undefined;
}

/** Pure: pick the effective mode from URL param > env default > saved setting; 'off' is coerced to 'words' unless allowed. */
export function resolveChallengeMode(
  saved: ChallengeSetting,
  urlParam: string | null | undefined,
  envDefault: string | null | undefined,
  allowOff: boolean,
): ChallengeSetting {
  const pick = launchMode(urlParam, envDefault) ?? saved;
  return pick === 'off' && !allowOff ? 'words' : pick;
}

/** Applies launch overrides to this race's settings while preserving the saved choices. */
export function resolveRaceQuestions(
  saved: Pick<Settings, 'challengeMode' | 'players'>,
  urlParam: string | null | undefined,
  envDefault: string | null | undefined,
  allowOff: boolean,
): Pick<Settings, 'challengeMode' | 'players'> {
  const override = launchMode(urlParam, envDefault);
  const challengeMode = resolveChallengeMode(saved.challengeMode, urlParam, envDefault, allowOff);
  return {
    challengeMode,
    players: saved.players.map(player => ({
      ...player,
      questionTypes: normalizeQuestionTypes(
        override && override !== 'off' ? undefined : player.questionTypes,
        challengeMode,
      ),
    })),
  };
}
