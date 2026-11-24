/**
 * Pure (Phaser-free) reward shown on a board card: the wallet amount finishing the challenge adds.
 * Mirrors the payout in logic/board.ts `recordWin` (one payout per requirement, all stages).
 */
import { WS_RULES, WS_UI } from '../../config';
import type { Challenge } from '../../core/types';

export type Measure = (text: string, size: number) => number;

/** Coins the player is paid for winning this challenge (same sum as recordWin's `payout`). */
export function challengeReward(c: Pick<Challenge, 'stages'>): number {
  return c.stages.reduce((sum, stage) => sum + stage.requirements.length, 0) * WS_RULES.payoutPerRequirement;
}

/** Card text for a reward, e.g. "+2". */
export function rewardLabel(amount: number): string {
  return `+${amount}`;
}

/** Width of the reward text at the minimum projector font size (bold). */
export function rewardTextWidth(amount: number, measure: Measure): number {
  return Math.ceil(measure(rewardLabel(amount), WS_UI.minFont));
}

/** Width of the stage-count text at the minimum projector font size (bold). */
export function stageTextWidth(text: string, measure: Measure): number {
  return Math.ceil(measure(text, WS_UI.minFont));
}
