import type { Settings } from '../core/types';

/**
 * Questions are mandatory in normal play. The ability to turn them off (menu "Off" option and the
 * `?questions=off` URL param) only exists when the app was started/built with VITE_ALLOW_QUESTIONS_OFF=1:
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

/** Pure: pick the effective mode from URL param > env default > saved setting; 'off' is coerced to 'words' unless allowed. */
export function resolveChallengeMode(
  saved: ChallengeSetting,
  urlParam: string | null | undefined,
  envDefault: string | null | undefined,
  allowOff: boolean,
): ChallengeSetting {
  const pick = isMode(urlParam) ? urlParam : isMode(envDefault) ? envDefault : saved;
  return pick === 'off' && !allowOff ? 'words' : pick;
}
