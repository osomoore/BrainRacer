/**
 * Engine API contract (orchestrator-owned). Implemented by apps/workshop/logic (pure, Phaser-free) and
 * exported there as `export const engine: WorkshopEngine`. Screens and the shell only call these.
 *
 * Determinism: every function is a pure function of its arguments (seeds come from WorkshopProgress.genSeq),
 * except `now` timestamps passed in by the caller.
 */
import type {
  AspectId, Challenge, ChallengeId, ComputedModel, Model, PlayerSave, ReadingLevel, RunResult, VariantId,
  VariantOverride, WorkshopCatalog, WorkshopId, WorkshopProgress,
} from './types';

export interface WinOutcome {
  progress: WorkshopProgress;
  firstWin: boolean;
  /** Variants unlocked by this win (empty on replays / when the unlock list is used up). */
  unlocked: VariantId[];
  /** Challenges that newly appeared on the board. */
  newChallenges: ChallengeId[];
}

export interface WorkshopEngine {
  catalog(id: WorkshopId): WorkshopCatalog;

  // --- models
  computeModel(id: WorkshopId, model: Model): ComputedModel;
  defaultModel(id: WorkshopId): Model;
  /** Variants the player may use now: starters + earned + 'open' overrides - 'locked' overrides (an aspect never ends up empty). */
  available(id: WorkshopId, progress: WorkshopProgress): Set<VariantId>;
  /** Variants of one aspect available to the player, in catalog order. */
  availableFor(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId): VariantId[];
  /** Replaces unavailable parts with the aspect's first available variant. */
  sanitizeModel(id: WorkshopId, progress: WorkshopProgress, model: Model): Model;
  setPart(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId, variant: VariantId): WorkshopProgress;

  // --- runs
  evaluate(id: WorkshopId, model: Model, challenge: Challenge): RunResult;
  /** Hint text after WS_RULES.hintAfterFails failed attempts, else null. Points at the first failed requirement's aspect. */
  hint(progress: WorkshopProgress, challenge: Challenge, result: RunResult, reading: ReadingLevel): string | null;

  // --- progression (all return a NEW progress object; callers commit it)
  newProgress(id: WorkshopId): WorkshopProgress;
  /** Fills the board to 3 active challenges, drops unsolvable ones after override changes. Idempotent. */
  refreshBoard(id: WorkshopId, progress: WorkshopProgress): WorkshopProgress;
  recordFail(id: WorkshopId, progress: WorkshopProgress, challengeId: ChallengeId): WorkshopProgress;
  recordWin(id: WorkshopId, progress: WorkshopProgress, challengeId: ChallengeId, model: Model, now: number): WinOutcome;
  /** Throw away the unfinished active challenges and generate new ones (admin "Regenerate"). */
  regenerate(id: WorkshopId, progress: WorkshopProgress): WorkshopProgress;
  setOverride(id: WorkshopId, progress: WorkshopProgress, variant: VariantId, value: VariantOverride | 'auto'): WorkshopProgress;

  // --- admin mode sandbox (never saved)
  /** Every variant open, the player's current model, `count` challenges spread over all tiers. */
  adminSandbox(id: WorkshopId, progress: WorkshopProgress, seed: number, count: number): WorkshopProgress;

  // --- saves
  newPlayerSave(reading: ReadingLevel): PlayerSave;
  /** Validates/repairs a loaded save (unknown ids dropped, missing fields defaulted). */
  normalizeSave(raw: unknown): PlayerSave | null;
  /** Progress for a workshop, created + board refreshed when missing. */
  progressOf(save: PlayerSave, id: WorkshopId): WorkshopProgress;
}
