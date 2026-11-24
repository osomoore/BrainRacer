import { describe, expect, it } from 'vitest';
import { WS_RULES } from '../../config';
import type { Challenge } from '../../core/types';
import { challengeReward, rewardLabel, rewardTextWidth, stageTextWidth } from './reward';

const stage = (n: number) => ({ requirements: Array.from({ length: n }, () => ({})) }) as unknown as Challenge['stages'][number];

describe('challengeReward', () => {
  it('pays payoutPerRequirement per requirement across all stages', () => {
    const c = { stages: [stage(2), stage(3)] } as unknown as Challenge;
    expect(challengeReward(c)).toBe(5 * WS_RULES.payoutPerRequirement);
  });
  it('a single-stage, single-requirement challenge pays one payout unit', () => {
    expect(challengeReward({ stages: [stage(1)] } as unknown as Challenge)).toBe(WS_RULES.payoutPerRequirement);
  });
});

describe('reward text', () => {
  it('formats as +N', () => {
    expect(rewardLabel(2)).toBe('+2');
    expect(rewardLabel(12)).toBe('+12');
  });
  it('measures at the minimum projector font size', () => {
    const seen: number[] = [];
    const measure = (text: string, size: number) => { seen.push(size); return text.length * size * 0.6; };
    expect(rewardTextWidth(2, measure)).toBe(Math.ceil(2 * 40 * 0.6)); // "+2" is 2 chars at 40 px
    expect(stageTextWidth('3 stages', measure)).toBe(Math.ceil(8 * 40 * 0.6));
    expect(seen.every((s) => s >= 40)).toBe(true);
  });
});
