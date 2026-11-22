/** Age bands for racer profiles. Each band maps 1:1 to a Difficulty and a default race length. */
import { NEW_RACER } from '../config/gameConfig';
import type { Difficulty } from './types';

export type AgeBand = '0-5' | '6-7' | '8-9' | '10+';
export const AGE_BANDS: readonly AgeBand[] = ['0-5', '6-7', '8-9', '10+'];
export const AGE_BAND_LABEL: Record<AgeBand, string> = { '0-5': '0–5', '6-7': '6–7', '8-9': '8–9', '10+': '10+' };
const BAND_DIFFICULTY: Record<AgeBand, Difficulty> = { '0-5': 'easy', '6-7': 'easyPlus', '8-9': 'normal', '10+': 'hard' };

export const bandDifficulty = (b: AgeBand): Difficulty => BAND_DIFFICULTY[b];
export const bandRoundSec = (b: AgeBand): number => (b === '10+' ? NEW_RACER.roundSecOver10 : NEW_RACER.roundSecUnder10);
export const difficultyBand = (d: Difficulty): AgeBand => AGE_BANDS.find((b) => BAND_DIFFICULTY[b] === d) ?? '0-5';
