/**
 * Engine API contract (orchestrator-owned). Implemented by apps/workshop/logic (pure, Phaser-free) and
 * exported there as `export const engine: WorkshopEngine`. Screens and the shell only call these.
 *
 * Determinism: every function is a pure function of its arguments (seeds come from WorkshopProgress.genSeq),
 * except `now` timestamps passed in by the caller.
 */
import type { BuddyKind } from '../../../shared/buddies/catalog';
import type {
  AspectId, Challenge, ChallengeId, ComputedModel, Model, PlayerSave, ReadingLevel, RunResult, VariantId,
  VariantOverride, WorkshopCatalog, WorkshopId, WorkshopProgress,
} from './types';

export interface WinOutcome {
  progress: WorkshopProgress;
  firstWin: boolean;
  /** Currency deposited for this win (0 when the win was rejected). */
  payout: number;
  /** Challenges that newly appeared on the board. */
  newChallenges: ChallengeId[];
  unlockedBuddy?: BuddyKind;
}

export interface ShopOffer {
  variant: VariantId;
  price: number;
  affordable: boolean;
}

export interface PurchaseOutcome {
  progress: WorkshopProgress;
  status: 'bought' | 'unaffordable' | 'unavailable';
  /** Offered price, or 0 when the variant was unavailable. */
  price: number;
}

export interface WorkshopEngine {
  catalog(id: WorkshopId): WorkshopCatalog;

  // --- models
  computeModel(id: WorkshopId, model: Model): ComputedModel;
  defaultModel(id: WorkshopId): Model;
  /** Variants the player may use now: first starters + bought + 'open' overrides - 'locked' overrides (an aspect never ends up empty). */
  available(id: WorkshopId, progress: WorkshopProgress): Set<VariantId>;
  /** Variants of one aspect available to the player, in catalog order. */
  availableFor(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId): VariantId[];
  /** Replaces unavailable parts with the aspect's first available variant. */
  sanitizeModel(id: WorkshopId, progress: WorkshopProgress, model: Model): Model;
  setPart(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId, variant: VariantId): WorkshopProgress;
  setBuddy(progress: WorkshopProgress, buddy: BuddyKind): WorkshopProgress;

  // --- shop
  shopOffers(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId): ShopOffer[];
  /** Buy a listed variant and refresh the board. Installing the part is a separate action. */
  purchase(id: WorkshopId, progress: WorkshopProgress, aspect: AspectId, variant: VariantId): PurchaseOutcome;

  // --- runs
  evaluate(id: WorkshopId, model: Model, challenge: Challenge): RunResult;
  /** Hint text after WS_RULES.hintAfterFails failed attempts, else null. Points at the first failed requirement's aspect. */
  hint(progress: WorkshopProgress, challenge: Challenge, result: RunResult, reading: ReadingLevel): string | null;

  // --- progression (all return a NEW progress object; callers commit it)
  newProgress(id: WorkshopId, buddySeed?: number): WorkshopProgress;
  /** Rechecks affordability, preserving valid active cards and filling empty slots. */
  refreshBoard(id: WorkshopId, progress: WorkshopProgress): WorkshopProgress;
  recordFail(id: WorkshopId, progress: WorkshopProgress, challengeId: ChallengeId): WorkshopProgress;
  recordWin(id: WorkshopId, progress: WorkshopProgress, challengeId: ChallengeId, model: Model, now: number): WinOutcome;
  /** Throw away the unfinished active challenges and generate new ones (admin "Regenerate"). */
  regenerate(id: WorkshopId, progress: WorkshopProgress): WorkshopProgress;
  setOverride(id: WorkshopId, progress: WorkshopProgress, variant: VariantId, value: VariantOverride | 'auto'): WorkshopProgress;

  // --- admin mode sandbox (never saved)
  /** Every variant open, the player's current model, `count` challenges spread over all tiers. */
  adminSandbox(id: WorkshopId, progress: WorkshopProgress, seed: number, count: number): WorkshopProgress;

  /** Add the testing grant to one workshop wallet and recheck its board. */
  grantCurrency(id: WorkshopId, progress: WorkshopProgress): WorkshopProgress;

  // --- saves
  newPlayerSave(reading: ReadingLevel, buddySeed?: number): PlayerSave;
  /** Reset both workshops, preserving the profile's reading level. */
  resetPlayer(save: PlayerSave): PlayerSave;
  /** Validates/repairs a loaded save (unknown ids dropped, missing fields defaulted). */
  normalizeSave(raw: unknown): PlayerSave | null;
  /** Progress for a workshop, created + board refreshed when missing. */
  progressOf(save: PlayerSave, id: WorkshopId): WorkshopProgress;
}
