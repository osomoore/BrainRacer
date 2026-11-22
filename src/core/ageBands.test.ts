import { describe, expect, it } from 'vitest';
import { NEW_RACER } from '../config/gameConfig';
import { AGE_BANDS, bandDifficulty, bandRoundSec, difficultyBand } from './ageBands';

describe('age bands', () => {
  it('maps bands to difficulty and back', () => {
    expect(AGE_BANDS.map(bandDifficulty)).toEqual(['easy', 'easyPlus', 'normal', 'hard']);
    for (const b of AGE_BANDS) expect(difficultyBand(bandDifficulty(b))).toBe(b);
  });
  it('only 10+ gets the short race', () => {
    expect(AGE_BANDS.map(bandRoundSec)).toEqual([NEW_RACER.roundSecUnder10, NEW_RACER.roundSecUnder10, NEW_RACER.roundSecUnder10, NEW_RACER.roundSecOver10]);
  });
});
