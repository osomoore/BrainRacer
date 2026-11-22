/**
 * Run-scene contracts (orchestrator-owned). A test run plays a challenge's stages in order; each stage is
 * acted out by the ScenarioPlayer for its scenario. Pass/fail is ALREADY decided (RunResult from the engine);
 * players only act it out. Players live in `run/race/<scenarioId>.ts` and `run/dino/<scenarioId>.ts`
 * (default export: ScenarioPlayer) and are found by glob; a missing one falls back to a generic player.
 */
import type Phaser from 'phaser';
import type { ModelRig, WorkshopAudio } from '../core/runtime';
import type { Rng } from '../core/rng';
import type {
  ComputedModel, Model, RequirementResult, ScenarioId, Stage, StageResult, WorkshopId,
} from '../core/types';

export interface StageContext {
  readonly scene: Phaser.Scene;
  /** Everything the player creates goes in here (the runner destroys it after the stage). */
  readonly layer: Phaser.GameObjects.Container;
  /** Visible area in layer coordinates: (0,0)-(w,h). 1920x1080 or 960x1080 (split screen). */
  readonly size: { w: number; h: number };
  /** Ground line y for side view (the rig stands on it). */
  readonly groundY: number;
  readonly workshop: WorkshopId;
  readonly model: Model;
  readonly computed: ComputedModel;
  readonly stage: Stage;
  readonly stageIndex: number;
  readonly stageCount: number;
  /** This stage's outcome: passed, and firstFail (requirement id) that drives the failure gag. */
  readonly result: StageResult;
  /** Results of this stage's requirements (all reached). */
  readonly requirements: readonly RequirementResult[];
  /** Built by the runner for stage.view, already added to `layer`, positioned at the stage start. */
  readonly rig: ModelRig;
  readonly audio: WorkshopAudio;
  /** Seeded from challenge seed + stage index. Cosmetic variety only. */
  readonly rng: Rng;
  /** Resolves after ms (scene-time based, respects pause). */
  wait(ms: number): Promise<void>;
  /** Promise wrapper around scene.tweens.add. */
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>;
}

export interface ScenarioPlayer {
  readonly workshop: WorkshopId;
  readonly scenario: ScenarioId;
  /**
   * Acts out the stage in ~WS_RUN.stageSec seconds. Success: the model clears the obstacle and exits/finishes
   * happily. Failure: a funny, clearly readable gag tied to `result.firstFail`'s facet, held ~1.5 s at the end.
   * Resolve when done. Must not leave timers/tweens running after resolving (except on objects in `layer`).
   */
  play(ctx: StageContext): Promise<void>;
}
