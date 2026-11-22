/**
 * Adventure Workshop runtime contracts (orchestrator-owned): panes, screens, input, audio, model rigs.
 *
 * One Phaser game (1920x1080). Each player has one PaneScene whose main camera viewport is that
 * player's half (2P: 960x1080 side by side) or the whole stage (1P). Inside a pane, "screens"
 * (profile pick, workshop room, station menu, board, run, results...) are swapped by the pane.
 * A screen draws into the pane scene in PANE-LOCAL coordinates: (0,0) is the pane's top-left,
 * size = ctx.size. Two layouts must work: wide 1920x1080 and tall 960x1080. Text >= 40 px.
 */
import type Phaser from 'phaser';
import type { AspectId, ChallengeId, Model, PlayerSave, ReadingLevel, RunResult, View, WorkshopId } from './types';

// ------------------------------------------------------------------ input

/** Edge-triggered menu actions for ONE player (their pad or keyboard layout). Taps arrive as Phaser pointer events. */
export type PaneAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'menu';

export interface PaneInput {
  /** Actions since the last poll (call once per frame from the active screen's update). */
  poll(): PaneAction[];
  /** True when this player is on touch (mobile): show tap targets, hide button badges. */
  readonly touch: boolean;
  /** Which face-button badges to draw ('pad' = A/B badges, 'keys' = Space/Esc labels, 'none' = touch). */
  readonly prompts: 'pad' | 'keys' | 'none';
}

// ------------------------------------------------------------------ audio

export type WsMusic = 'raceShop' | 'dinoLab' | 'title';
export type WsSting = 'success' | 'fail' | 'unlock';
export type WsSfx =
  | 'click' | 'select' | 'back' | 'step' | 'whoosh' | 'pop' | 'sparkle'
  | 'engine' | 'engineRev' | 'skid' | 'splat' | 'splash' | 'spin' | 'boing' | 'thud' | 'honk' | 'crash' | 'quack'
  | 'stomp' | 'roar' | 'chomp' | 'gulp' | 'burp' | 'rustle' | 'flap' | 'sniff' | 'giggle' | 'wobble'
  | 'cheer' | 'sad';

export interface WorkshopAudio {
  /** Crossfades to a loop; null = silence. Safe to call repeatedly with the same track. */
  music(track: WsMusic | null): void;
  sfx(name: WsSfx, opts?: { volume?: number; rate?: number; pan?: number }): void;
  /** Short success/fail/unlock jingle; ducks the music while it plays. */
  sting(name: WsSting): void;
  /** Looping sfx (engine idle, wheel spin). Returns a stop function. */
  loop(name: WsSfx, opts?: { volume?: number; rate?: number }): () => void;
}

// ------------------------------------------------------------------ model rigs (art)

/**
 * Animations every rig supports (tweens on its parts; loop ones repeat until another play()).
 * Race: drive (wheels turn), spinWheels (stuck: wheels spin fast, body shakes), idle.
 * Dino: walk, run, idle, chomp (jaw), crouch, stand (rise up), flap (if wings), wag (tail).
 * Both: jump (squash/stretch up), tumble (comic roll backwards), happy (bounce), dizzy, celebrate.
 */
export type RigAnim =
  | 'idle' | 'drive' | 'spinWheels' | 'walk' | 'run' | 'jump' | 'tumble' | 'happy' | 'dizzy' | 'celebrate'
  | 'chomp' | 'crouch' | 'stand' | 'flap' | 'wag';

export interface ModelRig {
  /** Root container; origin = ground contact point under the model's middle (side) / its center (top). Faces +x. */
  readonly root: Phaser.GameObjects.Container;
  readonly view: View;
  /** Bounding size in pixels at scale 1 (after the Size aspect is applied). */
  readonly width: number;
  readonly height: number;
  /** Display objects of each aspect's part(s), for highlight/zoom. Empty for parts not visible in this view. */
  readonly parts: Readonly<Record<AspectId, readonly Phaser.GameObjects.GameObject[]>>;
  /** Local point the camera zooms to for a station (side view), per aspect. */
  focus(aspect: AspectId): { x: number; y: number; zoom: number };
  /** Named local anchor points, e.g. 'mouth', 'headTop', 'wheelFront', 'wheelRear', 'tail', 'exhaust'. */
  anchor(name: string): { x: number; y: number };
  play(anim: RigAnim): void;
  /** Swap one part in place (station preview) without rebuilding the whole rig. */
  setModel(model: Model): void;
  destroy(): void;
}

/** Implemented by apps/workshop/art (buildRig). */
export type BuildRig = (scene: Phaser.Scene, workshop: WorkshopId, model: Model, view: View) => ModelRig;

// ------------------------------------------------------------------ panes & screens

export type ScreenId =
  | 'profile'      // pick an existing profile or New
  | 'newProfile'   // name (letter grid) + reading level
  | 'reading'      // reading level for an existing profile entering the workshop the first time
  | 'pickWorkshop' // Race Shop / Dino Lab
  | 'room'         // workshop room: stations + walking character + center model area
  | 'station'      // configuration menu for one aspect
  | 'board'        // model view + challenge board (3, or 10 in Admin Mode)
  | 'run'          // test run (stages in sequence)
  | 'results';     // checklist + hint + Retry / Workshop / Other challenge

export interface ScreenData {
  aspect?: AspectId;
  challengeId?: ChallengeId;
  result?: RunResult;
  /** Room: where the character stands when the room opens (station aspect or 'center'). */
  from?: AspectId | 'center';
}

export interface PaneContext {
  readonly scene: Phaser.Scene;
  readonly index: 0 | 1;
  /** Pane size in pixels (1920x1080 or 960x1080). Screens lay out inside (0,0)-(w,h). */
  readonly size: { w: number; h: number };
  readonly layout: 'wide' | 'tall';
  readonly input: PaneInput;
  readonly audio: WorkshopAudio;
  readonly buildRig: BuildRig;
  /** Selected profile (undefined only on the profile/newProfile screens). */
  readonly profileId: string | undefined;
  readonly workshop: WorkshopId | undefined;
  /** True when the device is in Admin Mode (sandbox: nothing below is persisted). */
  readonly adminMode: boolean;
  /** Current player's save (admin mode: an in-memory sandbox copy). */
  save(): PlayerSave;
  /** Persist after a change (no-op in admin mode). */
  commit(save: PlayerSave): void;
  reading(): ReadingLevel;
  setProfile(id: string | undefined): void;
  setWorkshop(id: WorkshopId | undefined): void;
  /** Swap to another screen in this pane (destroys the current one). */
  go(screen: ScreenId, data?: ScreenData): void;
  /** Leave to the title / join screen (B on the profile screen). */
  exit(): void;
}

export interface Screen {
  /** Build display objects. Everything created must be destroyed in destroy(). */
  create(ctx: PaneContext, data: ScreenData): void;
  update(dtMs: number): void;
  destroy(): void;
}

export type ScreenFactory = () => Screen;
