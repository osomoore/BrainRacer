/**
 * Adventure World runtime contract (Phaser side). ORCHESTRATOR-OWNED: propose diffs in your report.
 *
 * One `World` scene hosts the shared world; each player has a camera (heading-up). Gameplay is split into
 * modules that auto-register: any `apps/world/{render,play,activities,hud}/**\/*Module.ts` whose default export is
 * a `WorldModuleClass`. The host creates them in ascending `order`, calls `init(ctx)`, then `update(dt)` every
 * frame in order. Modules talk only through `ctx.bus` and the shared `ctx` state, never by importing each other.
 */
import type Phaser from 'phaser';
import type { MoveState } from '../logic/move';
import type {
  ActivitySite, BiomeId, Creation, HexCoord, HexPlan, ItemId, Obstacle, Quest, ReadingLevel, SurfaceSample, Traits,
  Vec, WorldPlayerSave,
} from './types';

/** Per-frame analog input for one player (from shared/input, already mapped by the host). */
export interface PlayerControls {
  /** Stick / WASD, -1..1 (screen-relative: up = forward for the heading-up camera). */
  x: number;
  y: number;
  throttle: number;
  brake: number;
  /** Edge-triggered buttons this frame (docs/WORLD_JOBS.md "Button map"): A = interact / accept, B = special / back,
   *  X = swap creation, Y = go to the Lab (Workshop), menu = pause card (Go Home, Quests, Resume). */
  pressed: { a: boolean; b: boolean; x: boolean; y: boolean; menu: boolean };
}

export type WorldSpecial = 'horn' | 'roar' | 'rocket' | 'wings' | 'winch';

export interface WorldPlayer {
  index: 0 | 1;
  profileId: string;
  name: string;
  reading: ReadingLevel;
  /** Live save object; mutate through ctx.save(player) helpers so it is persisted. */
  save: WorldPlayerSave;
  creation: Creation;
  traits: Traits;
  /** Kinematic state (logic/move.ts). Owned by the play module; others read it. */
  move: MoveState;
  /** Current B action in free play and the end time of a grounded flap, if any. */
  special?: WorldSpecial;
  flapUntil?: number;
  /** Hex the player is in (updated by the host each frame; 'player:hex' fires on change). */
  hex: HexCoord;
  surface: SurfaceSample;
  /** The player's sprite container (render module creates and replaces it on swap). */
  sprite?: Phaser.GameObjects.Container;
  camera: Phaser.Cameras.Scene2D.Camera;
  controls: PlayerControls;
  /** Carried quest items (for drawing above the creation). */
  carrying: ItemId[];
  /** True while an activity or dialog holds this player's controls (movement ignores input). */
  busy: boolean;
}

/** Live (mutable) per-session state of a hex's objects: moved boulders, popped bushes, taken items. Not saved. */
export interface HexLive {
  plan: HexPlan;
  /** Current obstacle positions/states by obstacle id (pushed boulders move, broken ones are removed). */
  obstacles: Map<string, Obstacle & { gone?: boolean }>;
  /** Item spot ids already picked up this session. */
  takenItems: Set<string>;
}

export interface WorldEvents {
  'player:honk': { player: WorldPlayer };
  'player:hex': { player: WorldPlayer; from: HexCoord; to: HexCoord; biome: BiomeId };
  'player:swap': { player: WorldPlayer; creation: Creation };
  'player:respawn': { player: WorldPlayer; at: Vec };
  'obstacle:effect': { player: WorldPlayer; hex: HexCoord; obstacle: Obstacle; effect: 'push' | 'pass' | 'break' };
  'stars:award': { player: WorldPlayer; stars: number; at: Vec; reason: 'activity' | 'quest' | 'treasure' };
  'activity:start': { player: WorldPlayer; site: ActivitySite };
  'activity:end': { player: WorldPlayer; site: ActivitySite; success: boolean };
  'quest:accept': { player: WorldPlayer; quest: Quest };
  'quest:pickup': { player: WorldPlayer; quest: Quest };
  'quest:complete': { player: WorldPlayer; quest: Quest };
  'home:enter': { player: WorldPlayer; homeId: string };
  'home:leave': { player: WorldPlayer; homeId: string };
  /** Ask the host to open the Workshop (saves everyone's `last` first). */
  'nav:workshop': { player: WorldPlayer };
  /** Banner text for one player's view (reading-level text, no word popups). */
  'ui:banner': { player: WorldPlayer; text: string; seconds?: number };
  /** Numbers-only popup ("+3") at a world point. */
  'ui:popup': { text: string; at: Vec; player?: WorldPlayer };
}

export interface WorldBus {
  on<K extends keyof WorldEvents>(event: K, fn: (e: WorldEvents[K]) => void): () => void;
  emit<K extends keyof WorldEvents>(event: K, e: WorldEvents[K]): void;
}

/** Read access to generation (apps/world/gen/world.ts `WorldGen`) plus live object state. */
export interface WorldQuery {
  seed: number;
  plan(coord: HexCoord): HexPlan;
  live(coord: HexCoord): HexLive;
  surfaceAt(x: number, y: number): SurfaceSample;
  hexAt(x: number, y: number): HexCoord;
  hexesNear(x: number, y: number, rings: number): HexCoord[];
  /** Home hex of a profile (gen `WorldGen.homeFor`). */
  homeFor(profileId: string): HexCoord | undefined;
  /** Live obstacles + features near a point (what logic/move.ts `MoveWorld.nearbySolids` needs). */
  nearbySolids(x: number, y: number, radius: number): { obstacles: Obstacle[]; features: HexPlan['features'] };
}

export interface WorldContext {
  scene: Phaser.Scene;
  bus: WorldBus;
  world: WorldQuery;
  players: WorldPlayer[];
  /** Seconds since the scene started. */
  time: number;
  /** Show a game object only in one player's camera (2P); no-op in 1P. */
  showOnlyTo(obj: Phaser.GameObjects.GameObject, player: WorldPlayer): void;
  /** Persist a player's save now (debounced by the host). */
  save(player: WorldPlayer): void;
  /** Award stars once per claim id (activity / treasure / quest id); returns false if already claimed. */
  award(player: WorldPlayer, stars: number, claimId: string, at: Vec, reason: WorldEvents['stars:award']['reason']): boolean;
  /** Swap the player to the given creation (recomputes traits, emits 'player:swap'). */
  setCreation(player: WorldPlayer, creation: Creation): void;
  /** Smoothed camera rotation of a player view (radians); used to turn screen-relative input into world directions. */
  viewRotation(player: WorldPlayer): number;
}

export interface WorldModule {
  init(ctx: WorldContext): void;
  update(dt: number): void;
  destroy?(): void;
}

export interface WorldModuleClass {
  new (): WorldModule;
  /** Lower runs first. Host 0, input 50, play 100, activities 200, render 300, hud 400. */
  order?: number;
}

/** Depth bands (world objects); HUD lives in a separate scene. */
export const DEPTH = {
  ground: 0, roads: 1, decals: 2, objects: 10, players: 20, canopy: 30, darkness: 40, popups: 50,
} as const;

// ---------------------------------------------------------------------------------------------
// Activities: one file per kind, `apps/world/activities/kinds/<kind>.ts`, default export `ActivityKindDef`.
// The activities module (W7a) finds sites near players, offers "A to start", runs one ActivityRun per player,
// and awards stars on success via ctx.award(player, site.stars, site.id, ...).
// ---------------------------------------------------------------------------------------------

export type ActivityOutcome = 'running' | 'success' | 'fail';

export interface ActivityRun {
  /** Called every frame while running. The player keeps driving unless the run sets player.busy. */
  update(dt: number): ActivityOutcome;
  /** Remove sprites, timers and listeners. */
  destroy(): void;
}

export interface ActivityKindDef {
  kind: import('./types').ActivityKind;
  /** Draw the idle site (props, targets) when its hex comes into range; return a cleanup function. */
  decorate(ctx: WorldContext, site: ActivitySite, live: HexLive): () => void;
  start(ctx: WorldContext, site: ActivitySite, player: WorldPlayer, live: HexLive): ActivityRun;
}
