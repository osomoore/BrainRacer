/**
 * Shared CONTRACTS for BrainRacer. Phaser-free. Owned by the orchestrator:
 * sub-agents must NOT edit this file — propose a diff in your final report instead.
 *
 * Conventions:
 *  - World units are pixels. Tile coordinates are integers (tx, ty); pixel = tile * TILE_SIZE.
 *  - Angles are radians; angle 0 faces +x (east); positive is clockwise (Phaser screen coords, +y down).
 *  - All sprites/textures are drawn FACING +x at angle 0.
 */

import type { UnlockGuide, UnlockVehicle } from '../config/collectibles';

// ───────────────────────── basics ─────────────────────────
export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type PlayerId = 0 | 1;
/** easyPlus sits between easy and normal (sums into the teens). */
export type Difficulty = 'easy' | 'easyPlus' | 'normal' | 'hard';
export type StarterCar = 'dino' | 'kart';
export type CarKind = StarterCar | UnlockVehicle;
export type GuideKind = 'dino' | 'star' | UnlockGuide;
export type RaceMap = 'city' | 'industrial' | 'farm' | 'harbor' | 'underground' | 'sky' | 'forest' | 'underwater';
export type ControllerFamily = 'xbox' | 'nintendo' | 'other';
/**
 * 0 = left, 1 = top, 2 = right, 3 = bottom. The display letters depend on controller layout.
 * Drive-style challenges omit the bottom slot, which is also the gas button.
 */
export type AnswerSlot = 0 | 1 | 2 | 3;

// ───────────────────────── images / words ─────────────────────────
export interface SceneEntry {
  id: string;            // "scene_001"
  word: string;          // game word: manifest label mapped through src/data/wordAliases.json
  label: string;         // original lower-case label from manifest.csv
  file: string;          // "scenes/scene_001.png" (relative to public/)
  source: string;        // source grid filename
  row: number;
  col: number;
  /** 'A' = Community Places grid, 'B' = Places Icon grid, null = not a place-grid image. */
  placeSet: 'A' | 'B' | null;
}

export type WordCategory =
  | 'food' | 'object' | 'clothing' | 'shape' | 'animal' | 'place'
  | 'vehicle' | 'nature' | 'activity' | 'person' | 'toy';

export interface WordMeta {
  category: WordCategory;
  /** Easy-reader word (single, short, common). */
  simple: boolean;
  /** Words that must never appear together as options (symmetric). */
  confusableWith: string[];
}
export type WordMetaTable = Record<string, WordMeta>;

// ───────────────────────── challenges ─────────────────────────
export type ChallengeKind = 'picToWord' | 'math' | 'multiplication' | 'wordToPic';

export type ChallengePrompt =
  | { kind: 'image'; sceneId: string }
  | { kind: 'text'; text: string };          // a word, or a math expression like "7 + 5"

export type ChallengeOption =
  | { kind: 'text'; text: string }
  | { kind: 'image'; sceneId: string };

export interface Challenge {
  id: number;
  player: PlayerId;
  kind: ChallengeKind;
  prompt: ChallengePrompt;
  /** 3 options in drive style or 4 in the stop-and-answer diamond; index = AnswerSlot. */
  options: ChallengeOption[];
  correct: AnswerSlot;
  /** Seconds the challenge stays up (= period for this player's difficulty). */
  durationSec: number;
  /** 'place' when triggered by driving near a place building. */
  source: 'random' | 'place';
  placeWord?: string;
}

export type ChallengeResult = 'correct' | 'wrong' | 'timeout';

// ───────────────────────── input ─────────────────────────
export type InputDevice =
  | { type: 'gamepad'; index: number }
  | { type: 'keyboard'; layout: 'left' | 'right' };   // left = WASD+123, right = arrows+,./

/** Per-player input sampled once per frame. Edge fields are true only on the frame pressed. */
export interface PlayerInput {
  steer: number;          // -1 (left) .. 1 (right)
  throttle: number;       // 0..1
  brake: number;          // 0..1 (also reverse when slow)
  answer: AnswerSlot | null;  // edge
  answerDirection: AnswerSlot | null; // keyboard or D-pad button edge during a question break
  transfer: boolean;      // edge: B on pad, B or N on keyboard
  resetCar: boolean;      // edge: Y on pad, R (P1) or Y (P2) on keyboard; double-tap restores your own car
  confirm: boolean;       // edge: A / Enter / Space
  back: boolean;          // edge: B-in-menus / Backspace
  pause: boolean;         // edge: Start / Esc
  navX: -1 | 0 | 1;       // edge: menu navigation
  navY: -1 | 0 | 1;       // edge
}

// ───────────────────────── settings / results ─────────────────────────
export interface PlayerSettings {
  device: InputDevice;
  difficulty: Difficulty;
  questionTypes?: QuestionTypes;
  car: CarKind;
  guide?: GuideKind;
  devCar?: CarKind;
  devGuide?: GuideKind;
}

export type QuestionType = 'addition' | 'multiplication' | 'spelling';
export type QuestionTypes = Record<QuestionType, boolean>;

/** Legacy question presets, also accepted as launch overrides. */
export type ChallengeMode = 'words' | 'math' | 'mixed';

/** pause = world freezes for questions until answered right (default); drive = answer while driving. */
export type QuestionStyle = 'pause' | 'drive';

export interface Settings {
  map: RaceMap;
  players: PlayerSettings[];      // length 1 or 2; index = PlayerId
  challengeMode: ChallengeMode | 'off';   // legacy fallback and race-wide dev off switch
  questionStyle: QuestionStyle;   // default 'pause'
  challengeIntervalSec: number;   // pause style: seconds of driving between question breaks (default 10); drive style: base period
  roundLengthSec: number;         // default 300
  goalPointsPerCar: number;       // default 3
  seed: number;                   // 0 = random each race
  musicVolume: number;            // 0..1
  sfxVolume: number;              // 0..1
  developerMode?: boolean;
}

export interface PlayerStats {
  correct: number;
  wrong: number;
  timeouts: number;
  goals: number;          // goals this player reached
  points: number;         // correct + goal points
}

export interface RoundResults {
  teamPoints: number;
  players: PlayerStats[];
  goalsCompleted: number;
  seed: number;
}

// ───────────────────────── world ─────────────────────────
export enum Tile {
  Water = 0,
  Grass = 1,
  Road = 2,
  Sidewalk = 3,
  Building = 4,   // footprint under a building (solid)
  Park = 5,
  Plaza = 6,
  Dirt = 7,
  Corn = 8,       // farm: corn field; drivable but slow, stalks flatten under cars
  Mud = 9,        // farm: mud puddle; drivable, slow, splashes
}

/** Road connectivity bitmask per tile (for picking road texture variants). */
export const ROAD_N = 1, ROAD_E = 2, ROAD_S = 4, ROAD_W = 8;

export interface BuildingLot {
  id: number;
  /** Tile-space rectangle. */
  tx: number; ty: number; tw: number; th: number;
  style: number;          // 0..5 roof style
  placeWord?: string;     // set if this is a place building
}

export interface PlaceSite {
  word: string;           // one of PLACE_WORDS
  buildingId: number;
  /** Pixel position of the rooftop sign (center of building). */
  sign: Vec2;
  /** Pixel position on the nearest road in front of the building (goal center candidate). */
  front: Vec2;
}

export interface Ramp {
  x: number; y: number;   // pixel center
  angle: number;          // direction of travel up the ramp
  w: number; h: number;   // pixel size (w along travel)
}

export type PropKind = 'tree' | 'lamp' | 'hydrant' | 'bench' | 'cone' | 'parkedCar' | 'bush';
export interface Prop { kind: PropKind; x: number; y: number; angle: number }

/**
 * Directed lane graph for AI driving (right-hand traffic). Each node is a point in a lane's
 * center line; `next` lists node ids reachable from it. Junction nodes have >1 next.
 */
export interface LaneNode { id: number; x: number; y: number; next: number[] }
export interface LaneGraph { nodes: LaneNode[] }

export type IndustrialDecorationKind =
  | 'bridge' | 'factoryBay' | 'gantry' | 'loadingYard' | 'waterTower'
  | 'containerStack' | 'pallets' | 'barrels' | 'fuelTank' | 'conveyor' | 'smokeStack'
  | 'lampPost' | 'parkedTruck' | 'forklift' | 'pipes' | 'fence' | 'roofLights';
/** Pixel center and footprint. Width is along the decoration's local +x axis. */
export interface IndustrialDecoration extends Vec2 {
  kind: IndustrialDecorationKind;
  w: number;
  h: number;
  angle: number;
}

export interface FreightCrossing {
  center: Vec2;
  /** Length of track across the road. */
  width: number;
}

export interface FreightRoute {
  /** Ordered closed centerline. The closing segment runs from the last point to the first. */
  points: Vec2[];
  crossings: FreightCrossing[];
}

export interface IndustrialLayout {
  decorations: IndustrialDecoration[];
  rail: FreightRoute;
}

// ───────────────────────── farm ─────────────────────────
export type FarmDecorationKind =
  | 'barn' | 'silo' | 'farmhouse' | 'shed' | 'windmill' | 'windTurbine'
  | 'hayBale' | 'orchardTree' | 'streamBridge' | 'pumpkinPatch' | 'cornMaze';
/** Pixel center and footprint; width along local +x. `solid` = has a physics body (decorations over BuildingLots are drawn only). */
export interface FarmDecoration extends Vec2 {
  kind: FarmDecorationKind;
  w: number;
  h: number;
  angle: number;
  solid: boolean;
  /** BuildingLot this decoration dresses (barn, farmhouse, silo … standing on a Tile.Building footprint). */
  buildingId?: number;
}

/** Solid fence segment (pixel endpoints). Gates are simply gaps between segments. */
export interface FarmFence { a: Vec2; b: Vec2 }

export type FarmAnimalKind = 'cow' | 'sheep' | 'pig' | 'horse' | 'chicken' | 'duck';
/** Pixel rectangle where a group of animals wanders (a fenced pasture, a farmyard, a pond edge). */
export interface FarmAnimalZone {
  kind: FarmAnimalKind;
  x: number; y: number; w: number; h: number;
  count: number;
  fenced: boolean;
}

export interface FarmLayout {
  decorations: FarmDecoration[];
  fences: FarmFence[];
  animalZones: FarmAnimalZone[];
  /** Direction (rad, world space, 0 = +x) shadows fall; fixed low afternoon sun. */
  shadowAngle: number;
  /** Shadow length as a multiple of an object's nominal height. */
  shadowLength: number;
}

export interface WorldData {
  industrial?: IndustrialLayout;
  farm?: FarmLayout;
  seed: number;
  widthTiles: number;
  heightTiles: number;
  tileSize: number;
  tiles: Uint8Array;        // Tile values, row-major: tiles[ty * widthTiles + tx]
  roadMask: Uint8Array;     // ROAD_* bitmask per tile (0 for non-road)
  buildings: BuildingLot[];
  places: PlaceSite[];
  ramps: Ramp[];
  props: Prop[];
  laneGraph: LaneGraph;
  playerSpawns: { x: number; y: number; angle: number }[];  // >= 2
}

// ───────────────────────── vehicles ─────────────────────────
export interface VehicleSpec {
  length: number;         // px (along facing)
  width: number;          // px
  mass: number;
  maxSpeed: number;       // px/s forward
  reverseSpeed: number;   // px/s
  accel: number;          // px/s^2
  brake: number;          // px/s^2
  turnRate: number;       // rad/s at optimal speed
  grip: number;           // 0..1 fraction of lateral velocity removed per 1/60 s
  drag: number;           // fraction of speed lost per second when coasting
}

export type RewardKind = 'turbo' | 'rainbow' | 'shockwave' | 'ghost' | 'magnet';

export type SfxName =
  | 'correct' | 'wrong' | 'timeout' | 'turbo' | 'crash' | 'crashBig' | 'skid'
  | 'siren' | 'policeBump' | 'jump' | 'land' | 'goal' | 'goalArrive'
  | 'countdown' | 'go' | 'roar' | 'stomp' | 'squash' | 'shockwave' | 'pop'
  | 'menuMove' | 'menuSelect' | 'join' | 'crossing'
  | 'moo' | 'baa' | 'oink' | 'neigh' | 'cluck' | 'quack' | 'cornRustle' | 'mudSplash';

export type MusicTrack = 'title' | 'race' | 'industrial' | 'farm' | 'underground' | 'sky' | 'forest' | 'underwater' | 'dino' | 'results';

// ───────────────────────── camera layout (published to HUD) ─────────────────────────
export type CameraMode = 'single' | 'merged' | 'split';
export interface CameraLayout {
  mode: CameraMode;
  /** Screen-space viewport rect (in 1920x1080 game coords) "belonging" to each player.
   *  In 'merged' mode these are the left/right halves of the full screen. */
  playerViews: Rect[];
}
