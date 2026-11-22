import { describe, expect, it } from 'vitest';
import { CHALLENGE } from '../config/gameConfig';
import { wrongRevealSecFor } from './reveal';

describe('wrongRevealSecFor', () => {
  it('holds JBQ answers longer than the others', () => {
    expect(wrongRevealSecFor('jbq')).toBe(CHALLENGE.jbqWrongRevealSec);
    expect(wrongRevealSecFor('math')).toBe(CHALLENGE.wrongRevealSec);
    expect(wrongRevealSecFor('picToWord')).toBe(CHALLENGE.wrongRevealSec);
    expect(CHALLENGE.jbqWrongRevealSec).toBeGreaterThan(CHALLENGE.wrongRevealSec);
  });
});
