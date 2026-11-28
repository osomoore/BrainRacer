/**
 * Adventure World contracts. ORCHESTRATOR-OWNED: do not edit in a package job; propose a diff in your report.
 * Pure data types only (no Phaser). World units are pixels; +x right, +y down; angle 0 faces +x.
 * See docs/WORLD.md for the design and package map.
 */
import type { Model, ReadingLevel, WorkshopId } from '../../workshop/core/types';

export type { Model, ReadingLevel, WorkshopId };

// ---------------------------------------------------------------------------------------------
// Hexes and biomes
// ---------------------------------------------------------------------------------------------

/** Axial hex coordinate, pointy-top layout (see gen/hex.ts). Hex (0,0) is centered on world (0,0). */
export interface HexCoord { q: number; r: number }

export const BIOME_IDS = [
  'meadow', 'mud', 'rocky', 'lake', 'darkwood', 'snow', 'desert', 'jungle', 'canyon', 'geyser',
] as const;
export type BiomeId = typeof BIOME_IDS[number];

/** What the ground is at a point. Solid kinds block movement unless a trait allows it (see logic/rules.ts). */
export type SurfaceKind =
  | 'road' | 'path' | 'bridge'
  | 'grass' | 'tallGrass' | 'sand' | 'snow' | 'ice'
  | 'mud' | 'deepMud'
  | 'rough'        // loose rocks, roots: slow without rough-terrain grip
  | 'shallow'      // wading water
  | 'deep'         // swim or float only
  | 'hotSpring'    // warm bubbly pools (geyser biome); slow, needs heat tolerance to cross quickly
  | 'cliff';       // never passable (canyon walls, rock faces): world boundary of narrow valleys

export interface SurfaceSample {
  kind: SurfaceKind;
  biome: BiomeId;
  /** 0 = daylight, 1 = pitch dark (darkwood, caves). The renderer dims the view; light traits see further. */
  dark: number;
  /** True inside a tunnel or cave roof (renderer hides the roof over the player). */
  covered: boolean;
  /** Desert exposure, from 0 at the seam to 1 in the interior. */
  heat?: number;
}

// ---------------------------------------------------------------------------------------------
// Creations and traits
// ---------------------------------------------------------------------------------------------

/** A creation the player drives in the world: a Race Shop car or a Dino Lab dino. */
export interface Creation { workshop: WorkshopId; model: Model }

/**
 * World abilities derived from a creation's Workshop stats and tags (logic/traits.ts).
 * Levels are small integers so rules stay readable: 0 = can't / poor, 1 = ok, 2 = good, 3 = great.
 */
export interface Traits {
  kind: 'car' | 'dino';
  /** Top speed on road, px/s. */
  speed: number;
  /** Acceleration, px/s^2. */
  accel: number;
  /** Turn rate, rad/s. */
  turn: number;
  mud: number;
  snow: number;
  /** Rocks, roots, rough ground (clearance, toughness, climbing). */
  rough: number;
  /** 0 none, 1 wade shallow fast, 2 swim deep, 3 float/swim fast. Deep water needs >= 2. */
  water: number;
  /** Emits light (rally lights or glow spots). */
  light: number;
  /** Raised suspension, clearance or long legs keep full speed on grass. */
  raised?: number;
  /** Can break small props on contact. */
  smash?: number;
  /** Moves pushable props faster than ordinary builds. */
  pushBumper?: number;
  /** Width class 1 (small) .. 4 (huge): narrow passages have a max width. */
  width: number;
  /** Height class 1 .. 4: tunnels and low bridges have a max height. */
  height: number;
  jump: number;
  push: number;
  reach: number;
  dig: number;
  stealth: number;
  loud: number;
  /** Heat tolerance (desert sun, hot springs). */
  heat: number;
  /** Cold tolerance (snow biome speed, icy wind). */
  cold: number;
  /** Quest items carried at once (1..3). */
  carry: number;
}
export type TraitKey = Exclude<keyof Traits, 'kind' | 'speed' | 'accel' | 'turn'>;

/** An ability gate on an object, obstacle or activity. All listed bounds must hold. */
export interface TraitNeed { trait: TraitKey; min?: number; max?: number }

// ---------------------------------------------------------------------------------------------
// Hex contents (generated, deterministic from world seed + coord; never saved)
// ---------------------------------------------------------------------------------------------

export interface Vec { x: number; y: number }

/** A road or path polyline in world px (smooth enough to draw as-is). */
/** `surface` = road type (W1c): paved fastest, dirt a bit slower and slippier, rocky bumpy and slow. Default paved. */
export type RoadSurface = 'paved' | 'dirt' | 'rocky';
export interface RoadPath { kind: 'road' | 'path'; points: Vec[]; width: number; surface?: RoadSurface }

/** An area of one surface kind: a closed polygon in world px. Later blobs paint over earlier ones. */
export interface TerrainBlob { kind: SurfaceKind; poly: Vec[]; dark?: number; covered?: boolean }

export type FeatureKind = 'jump' | 'bridge' | 'tunnel' | 'cave' | 'narrow';

/**
 * Environmental features. `area` is the footprint polygon. `needs` is optional: a jump with a need is a
 * gap you must jump; a bridge with `width/height` maxes is a small bridge; a narrow valley has a width max.
 * `dir` is the travel direction (radians) for jumps and bridges.
 */
export interface Feature {
  id: string;
  kind: FeatureKind;
  at: Vec;
  dir: number;
  area: Vec[];
  needs?: TraitNeed[];
  /** Bridges: the alternative way around exists (ford, detour path) so no build is fully stuck. */
  bypass?: boolean;
  /** Optional waypoint of the detour around a gated feature (for the play module's arrow sign). */
  bypassAt?: Vec;
}

/** A solid or slowing object: rocks, logs, bushes, ice blocks. Circle collider. */
export interface Obstacle {
  id: string;
  kind: string;          // art key suffix, e.g. 'boulder', 'log', 'bush', 'iceBlock', 'tree', 'cactus'
  at: Vec;
  radius: number;
  /** Optional ability requirements. Standard prop kinds can also define their own rules. */
  needs?: TraitNeed[];
  /** What happens when needs hold: 'push' moves it, 'pass' drives through, 'break' comic poof. */
  effect?: 'push' | 'pass' | 'break';
}

export const ACTIVITY_KINDS = [
  'duckParade',   // lead 1-3 ducklings to the pond (stay slow and near; car Brain Racer homage)
  'hideSeek',     // hide in matching foliage until the sniffing big dino leaves (stealth / color)
  'ringJump',     // jump a ramp through 1-3 star rings (jump / speed)
  'boulderPush',  // push 1-3 boulders onto marked spots (push)
  'fruitShake',   // reach or shake 1-3 fruit trees, fruit to the basket (reach)
  'digSpot',      // dig up 1-3 buried treasures at X marks (dig)
  'islandSwim',   // reach the star on an island in deep water (water)
  'gateDash',     // pass 3 gates in order before the timer ends (speed / handling)
  'lanternCave',  // light 1-3 lanterns in a dark cave (light, height)
  'herdSheep',    // nudge or honk/roar 1-3 sheep into a pen (loud)
] as const;
export type ActivityKind = typeof ACTIVITY_KINDS[number];

export interface ActivityTarget { at: Vec; /** e.g. pen, pond, basket, spot */ role: string }

export interface ActivitySite {
  /** Stable id: `${q},${r}:a${index}`. Claimed ids are saved so stars pay once. */
  id: string;
  kind: ActivityKind;
  at: Vec;
  /** Footprint radius in px; the runtime starts the activity when a player enters it. */
  radius: number;
  /** 1-3 objects or targets (ducks + pond, rings, boulders + spots ...). */
  targets: ActivityTarget[];
  /** Soft needs: suited builds can do it, others may try but fail with a funny, gentle result. */
  needs: TraitNeed[];
  stars: number;
}

export interface QuestGiverSpot { id: string; at: Vec; /** art key suffix: 'turtle', 'owl', 'goat', 'farmer' ... */ who: string }

/** A home base: start point and Workshop door. `owner` = profile id for a player's own home. */
export interface HomeBase { id: string; at: Vec; owner?: string }

export interface TreasureSpot { id: string; at: Vec; stars: number; needs: TraitNeed[] }

/** A pickup-able quest item lying in the world (rock in rocky biome, shell by the lake ...). */
export interface ItemSpot { id: string; item: ItemId; at: Vec }

export type ErrandSpotKind = 'barn' | 'cowPen' | 'hay' | 'bell' | 'bear' | 'frog' | 'doggy';
export interface ErrandSpot { id: string; kind: ErrandSpotKind; at: Vec }

/** Everything in one hex. Pure function of (world seed, coord). */
export interface HexPlan {
  coord: HexCoord;
  biome: BiomeId;
  seed: number;
  center: Vec;
  /** Edge indices 0..5 that carry a road or path to the neighbor (shared with the neighbor: symmetric). */
  links: number[];
  roads: RoadPath[];
  terrain: TerrainBlob[];
  features: Feature[];
  obstacles: Obstacle[];
  activities: ActivitySite[];
  items: ItemSpot[];
  errands?: ErrandSpot[];
  giver?: QuestGiverSpot;
  home?: HomeBase;
  treasure?: TreasureSpot;
}

// ---------------------------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------------------------

export const ITEM_IDS = [
  'rock', 'mudPie', 'shell', 'pinecone', 'snowball', 'cactusFlower', 'fern', 'crystal', 'feather', 'egg',
  'duck', 'lamb', 'doggy', 'hay', 'apple', 'bell', 'bear', 'log', 'frog',
] as const;
export type ItemId = typeof ITEM_IDS[number];

export const QUEST_TARGET_KINDS = ['item', 'pond', 'farm', 'cowPen', 'bell', 'bear', 'pathLog', 'frog'] as const;
export type QuestTargetKind = typeof QUEST_TARGET_KINDS[number];

export type QuestGoal =
  | { kind: 'giver' }                       // bring it back to the quest giver
  | { kind: 'biome'; biome: BiomeId }       // deliver into any hex of that biome (duck to a lake)
  | { kind: 'home' }                        // bring it to any home base (older quests)
  | { kind: 'target'; target: QuestTargetKind };

export interface Quest {
  /** `${giverId}#${dateKey}` for daily offers. */
  id: string;
  giverId: string;
  giverHex: HexCoord;
  kind: 'visit' | 'fetch' | 'deliver';
  item: ItemId;
  /** Where to find the item (fetch: any item spot of this biome; deliver: handed over by the giver). */
  fromBiome?: BiomeId;
  goal: QuestGoal;
  /** Part-derived abilities required to see the offer. */
  needs?: TraitNeed[];
  stars: number;
  /** Instruction text per reading level (quests/text.ts). */
  text: Record<ReadingLevel, string>;
}

export interface ActiveQuest { quest: Quest; /** item picked up / handed over */ carrying: boolean }

/** Tracked quests per reading level. */
export const QUEST_SLOTS: Record<ReadingLevel, number> = { starter: 1, easy: 2, medium: 3, hard: 4 };

// ---------------------------------------------------------------------------------------------
// Saves (localStorage `world.players.v1`: Record<profileId, WorldPlayerSave>)
// ---------------------------------------------------------------------------------------------

export interface WorldPlayerSave {
  version: 1;
  stars: number;
  /** Which live Workshop build is driven now. */
  using: WorkshopId;
  /** Claimed activity / treasure ids (stars pay once per id). Capped list, oldest dropped. */
  claimed: string[];
  quests: ActiveQuest[];
  /** Per-giver last offer date (local YYYYMMDD). Older saves hold small sequence counters. */
  questSeq: Record<string, number>;
  /** Where the player was when they left (restored when coming back, e.g. from the Workshop). */
  last?: { x: number; y: number; angle: number };
}
