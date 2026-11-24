/**
 * Adventure Workshop data contracts (orchestrator-owned; propose changes, don't edit in a package).
 *
 * Pure data, no Phaser. Everything here must be JSON-serialisable where it is saved
 * (Model, Challenge, PlayerSave). See docs/WORKSHOP.md for the design.
 */

import type { BuddyKind } from '../../../shared/buddies/catalog';

export type WorkshopId = 'race' | 'dino';
export const WORKSHOP_IDS: readonly WorkshopId[] = ['race', 'dino'];

export type ReadingLevel = 'easy' | 'medium' | 'hard';
export const READING_LEVELS: readonly ReadingLevel[] = ['easy', 'medium', 'hard'];
export const READING_LABEL: Record<ReadingLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The same sentence written for each reading level. */
export type Leveled = Record<ReadingLevel, string>;
export type LeveledPhrases = Readonly<Record<ReadingLevel, readonly string[]>>;

/** Aspect id inside one workshop, e.g. 'wheels', 'teeth'. */
export type AspectId = string;
/** Variant id, unique inside one workshop, always `<aspect>.<name>`, e.g. 'wheels.mud'. */
export type VariantId = string;
/** Stat id inside one workshop, e.g. 'speed', 'reach'. */
export type StatId = string;
/** Scenario id inside one workshop, e.g. 'mud', 'tallTree'. */
export type ScenarioId = string;
/** Facet id: `<scenario>.<name>`, e.g. 'mud.grip'. */
export type FacetId = string;
export type ChallengeId = string;

/** Which camera a run stage uses. Side is the default whenever every requirement in the stage can be shown from the side. */
export type View = 'side' | 'top';

// ---------------------------------------------------------------------------------------------
// Catalog (static content, one per workshop)
// ---------------------------------------------------------------------------------------------

export interface StatDef {
  id: StatId;
  /** Grown-up label for admin/debug screens. Kids never see stat numbers. */
  label: string;
  /** Value before any variant is added. */
  base: number;
  /** Computed stats are clamped to [min, max]. */
  min: number;
  max: number;
}

export interface Variant {
  id: VariantId;
  aspect: AspectId;
  /** Kid-facing name shown in the station menu and the model view, e.g. "Mud Tires". Short (<= 16 chars). */
  name: string;
  /** Additive stat changes (may be negative: tradeoffs). */
  stats: Readonly<Partial<Record<StatId, number>>>;
  /**
   * Plain facts checked by requirements, e.g. 'color:green', 'bright', 'pose:stand', 'canFloat'.
   * A model's tags are the union of its variants' tags.
   */
  tags: readonly string[];
  /** One-line grown-up note on what it is for (docs/admin only). */
  note: string;
}

export interface AspectDef {
  id: AspectId;
  /** Station sign, e.g. "Wheels". */
  label: string;
  /** The default owned variant and the first variant sold at this station. */
  starters: readonly [VariantId, VariantId];
  /** True when the part can be seen in the top-down view (paint, size, wheels...). Teeth: false. */
  visibleFromTop: boolean;
}

/**
 * A requirement template inside a scenario. `levels` lists the difficulty settings the generator may
 * use; `check(level)` turns one into concrete checks. Text comes from the phrase bank (see PhraseBank).
 */
export interface FacetDef {
  id: FacetId;
  /** Difficulty settings the generator may pick (e.g. mud depth 1..3). Starters use explicit levels. */
  levels: readonly number[];
  /** All checks must pass for the requirement to be satisfied. Use an any-of check for alternative fixes. */
  check(level: number): Check[];
  /** The aspect a hint points at (the most natural fix). */
  hintAspect: AspectId;
  /** Views this facet can be shown in. Most: ['side'] or ['side', 'top']. */
  views: readonly View[];
  /** Earliest generator tier this facet may appear in (0 = from the start). */
  minTier: number;
}

/** A stage type with its own scene and animation (mud field, low bridge, tall tree...). */
export interface ScenarioDef {
  id: ScenarioId;
  /** Grown-up name for admin/debug. */
  label: string;
  /** Requirement templates that can appear in this scenario. A stage uses 1..n of them. */
  facets: readonly FacetDef[];
  /** Earliest generator tier this scenario may appear in. */
  minTier: number;
}

/**
 * Phrase bank for one facet. Each entry has several ways to say the requirement at each reading
 * level, so generated challenges don't repeat. Placeholders: none for now; `level` picks the
 * entry for the facet difficulty (index = position of the level in FacetDef.levels, clamped).
 */
export interface FacetPhrases {
  facet: FacetId;
  /**
   * [levelIndex] -> reading level -> alternative sentences (>= 2 each). Alternative i at every reading level is one
   * row: a challenge shows easy[i], medium[i] and hard[i] together, so each row says the same fix.
   */
  requirement: ReadonlyArray<Readonly<Record<ReadingLevel, readonly string[]>>>;
  /** [levelIndex] -> card title naming the problem at that level, used when the stage has only this requirement. */
  title?: readonly string[];
  /** Hint sentences (point at the aspect, never give the full answer). >= 2 each. */
  hint: Readonly<Record<ReadingLevel, readonly string[]>>;
  /** Target vocabulary words this facet's sentences use (for the coverage report). */
  vocab?: readonly string[];
}

/** Titles and stage-joining words for one scenario. */
export interface ScenarioPhrases {
  scenario: ScenarioId;
  /**
   * Stage title for a stage with two or more requirements (one entry; it must fit every facet of the scenario).
   * A stage with one requirement uses that facet's level title (FacetPhrases.title) instead.
   */
  title: readonly string[];
  /** Short scene-setting sentence shown above the requirements. >= 2 per level. */
  intro: Readonly<Record<ReadingLevel, readonly string[]>>;
}

export interface WorkshopCatalog {
  id: WorkshopId;
  title: string;
  stats: readonly StatDef[];
  /** In station order around the room (clockwise from top-left). Exactly 10. */
  aspects: readonly AspectDef[];
  variants: readonly Variant[];
  scenarios: readonly ScenarioDef[];
  facetPhrases: readonly FacetPhrases[];
  scenarioPhrases: readonly ScenarioPhrases[];
  cleverWinPhrases?: LeveledPhrases;
  /**
   * Approved short words for parts in guidelines, besides the variant names themselves (lower case), e.g.
   * { wings: ['move.fly'] }. validateCatalog uses them to check that every guideline names a part that helps.
   */
  partAliases?: Readonly<Record<string, readonly VariantId[]>>;
  /** Shop order after the second starter (every non-starter variant exactly once). */
  unlockOrder: readonly VariantId[];
  /** The fixed first challenges (shown first, in order; 3 offered at a time). */
  starters: readonly StarterSpec[];
}

export interface StarterSpec {
  id: ChallengeId;
  stages: ReadonlyArray<{ scenario: ScenarioId; facets: ReadonlyArray<{ facet: FacetId; level: number }> }>;
}

// ---------------------------------------------------------------------------------------------
// Models and requirements
// ---------------------------------------------------------------------------------------------

/** The player's build: one variant per aspect. */
export type Model = Record<AspectId, VariantId>;

export type BasicCheck =
  | { kind: 'statMin'; stat: StatId; min: number }
  | { kind: 'statMax'; stat: StatId; max: number }
  | { kind: 'tag'; tag: string }
  | { kind: 'noTag'; tag: string };

/** A check can also pass when one complete option passes. The enclosing checks still all apply. */
export type Check = BasicCheck | { kind: 'anyOf'; options: ReadonlyArray<readonly BasicCheck[]> };

export interface ComputedModel {
  stats: Record<StatId, number>;
  tags: ReadonlySet<string>;
}

/** A concrete requirement inside a saved challenge (fully resolved: survives content edits). */
export interface Requirement {
  /** Unique inside the challenge, e.g. 's0r1'. */
  id: string;
  facet: FacetId;
  level: number;
  /** A conjunction of checks, with any-of checks kept as one choice among complete options. */
  checks: Check[];
  /** Each option is a complete named fix. Parts within an option must all be installed. */
  namedFixes?: readonly (readonly VariantId[])[];
  text: Leveled;
  hint: { aspect: AspectId; text: Leveled };
}

export interface Stage {
  scenario: ScenarioId;
  view: View;
  /** Facet levels by facet id (what the scene uses to size the mud, bridge, tree...). */
  params: Record<FacetId, number>;
  requirements: Requirement[];
}

export interface Challenge {
  id: ChallengeId;
  /** Palette index assigned when offered. Older version-2 saves infer it from the saved slot. */
  boardColor?: number;
  workshop: WorkshopId;
  title: string;
  intro: Leveled;
  stages: Stage[];
  /** 0 for starters; grows with the player's wins. */
  tier: number;
  source: 'starter' | 'generated' | 'admin';
  /** Generator seed + version (debug/repro only; the saved challenge is the truth). */
  seed: number;
  genVersion: number;
}

// ---------------------------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------------------------

export interface RequirementResult {
  id: string;
  passed: boolean;
  route: 'named' | 'stat' | 'check' | null;
  /** False for requirements in stages after the failing stage (still evaluated and shown). */
  reached: boolean;
}

export interface StageResult {
  index: number;
  passed: boolean;
  reached: boolean;
  /** First failing requirement in this stage (drives the failure animation), if any. */
  firstFail?: string;
}

export interface RunResult {
  passed: boolean;
  cleverWin: boolean;
  /** Index of the stage where the run ended (last stage if passed). */
  endStage: number;
  stages: StageResult[];
  requirements: RequirementResult[];
}

// ---------------------------------------------------------------------------------------------
// Saves (localStorage `workshop.players.v1`: Record<profileId, PlayerSave>; `workshop.device.v1`: DeviceSave)
// ---------------------------------------------------------------------------------------------

export type VariantOverride = 'open' | 'locked';

export interface CompletedInfo {
  build: Model;
  wonAt: number;
  payout: number;
}

export interface WorkshopBuddies {
  unlocked: BuddyKind[];
  selected: BuddyKind;
  /** Points toward the next buddy. Stays full once the collection is complete. */
  progress: number;
}

export interface WorkshopProgress {
  /** Current build (saved on every change). */
  model: Model;
  /** Balance of coins (Race Shop) or Bio Juice (Dino Lab). */
  wallet: number;
  buddies: WorkshopBuddies;
  /** Variants actually bought. The first starter for each aspect is implicitly owned. */
  bought: VariantId[];
  /** Admin overrides per variant (Auto = absent). */
  overrides: Record<VariantId, VariantOverride>;
  /** Every challenge this player has been offered and not dropped (active, retained unfinished, and all successes). */
  challenges: Record<ChallengeId, Challenge>;
  /** The three offered challenges, in board order. */
  active: ChallengeId[];
  completed: Record<ChallengeId, CompletedInfo>;
  /** Failed attempts per challenge (hint after WS_RULES.hintAfterFails). Reset on a win. */
  fails: Record<ChallengeId, number>;
  /** Build that won most recently (new challenges must not be solvable with it). */
  lastWin: Model | null;
  /** Next starter index; == starters.length once all starters were offered. */
  nextStarter: number;
  /** Total first-time wins (drives the generator tier). */
  firstWins: number;
  /** Generator counter (seed source; never reused). */
  genSeq: number;
  /** CHALLENGE_RULES_VERSION the open cards were dealt under; a mismatch on load re-deals them. */
  rulesVersion?: number;
}

export interface PlayerSave {
  version: 2;
  reading: ReadingLevel;
  workshops: Partial<Record<WorkshopId, WorkshopProgress>>;
  /** Workshop picked last (pre-selected on the picker). */
  lastWorkshop?: WorkshopId;
  /** Seed (from the profile id) that picks the starting buddy of a new workshop. Absent on older saves: the dino. */
  buddySeed?: number;
}

export interface DeviceSave {
  version: 1;
  /** Admin Mode: every part open, 10 sandbox challenges, nothing saved to players. Device-wide. */
  adminMode: boolean;
}
