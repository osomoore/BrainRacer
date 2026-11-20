import type { QuestionTypes, Settings } from '../core/types';

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
    addition: mode === 'math' || mode === 'mixed',
    multiplication: false,
    spelling: mode !== 'math',
  };
}

export function normalizeQuestionTypes(raw: unknown, mode?: ChallengeSetting): QuestionTypes {
  if (!raw || typeof raw !== 'object') return questionTypesForMode(mode);
  const saved = raw as Partial<QuestionTypes>;
  const types = {
    addition: saved.addition === true,
    multiplication: saved.multiplication === true,
    spelling: saved.spelling === true,
  };
  return Object.values(types).some(Boolean) ? types : questionTypesForMode(mode);
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
