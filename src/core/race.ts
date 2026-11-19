/**
 * Runtime (Phaser-side) contracts shared by RaceScene, entities, systems, camera and HUD.
 * Orchestrator-owned. Sub-agents implement these interfaces; they must not change them.
 */
import type Phaser from 'phaser';
import type { EventBus, GoalState } from './events';
import type { Rng } from './rng';
import type { CameraLayout, CarKind, PlayerId, Rect, Settings, Vec2, VehicleSpec, WorldData } from './types';

/** Stored on every Matter body as `body.plugin.owner` so collision handlers can classify hits. */
export type BodyOwner =
  | { kind: 'player'; player: PlayerId; car: IPlayerCar }
  | { kind: 'npc'; npc: INpcVehicle }
  | { kind: 'building'; buildingId: number }
  | { kind: 'prop'; prop: Phaser.GameObjects.GameObject }
  | { kind: 'boundary' }
  | { kind: 'dino' };

export function ownerOf(body: MatterJS.BodyType | undefined | null): BodyOwner | null {
  if (!body) return null;
  const b = (body.parent ?? body) as MatterJS.BodyType & { plugin?: { owner?: BodyOwner } };
  return b.plugin?.owner ?? null;
}

/** Common surface of anything that drives (players, traffic, trucks, police). */
export interface IVehicle {
  readonly spec: VehicleSpec;
  readonly body: MatterJS.BodyType;
  readonly x: number;
  readonly y: number;
  /** Facing angle (radians, 0 = +x). */
  readonly angle: number;
  readonly velocity: Vec2;
  /** Signed speed along facing (px/s); negative when reversing. */
  readonly forwardSpeed: number;
  /** Add an instantaneous velocity change (px/s) plus optional angular velocity (rad/s). */
  applyImpulse(dvx: number, dvy: number, spin?: number): void;
}

export interface IPlayerCar extends IVehicle {
  readonly player: PlayerId;
  readonly kind: CarKind;
  /** Root display object (position/rotation follow the body). */
  readonly view: Phaser.GameObjects.Container;
  /** |forwardSpeed| / current max speed, 0..1+ */
  readonly speedFrac: number;
  readonly airborne: boolean;
  readonly turbo: boolean;
  readonly ghost: boolean;
  /** Turbo multiplies max speed & accel (values from REWARDS). */
  setTurbo(on: boolean): void;
  /** Ghost: no collisions with npcs (still collides with buildings); semi-transparent. */
  setGhost(on: boolean): void;
  /** Airborne: no collisions at all, sprite scaled up, shadow offset. Controlled by JumpSystem. */
  setAirborne(on: boolean): void;
  /** Temporarily cap max speed by `mult` for `sec` seconds (police bump). */
  slow(mult: number, sec: number): void;
  /** Disable/enable player control (countdown, pause). */
  setControlEnabled(on: boolean): void;
}

export interface INpcVehicle extends IVehicle {
  readonly npcKind: 'traffic' | 'truck' | 'police';
  readonly view: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  /** True once removed from the world. */
  readonly destroyed: boolean;
  /** Comic flatten + remove (dino stomp). */
  squash(): void;
  destroy(): void;
}

export interface ICameraRig {
  layout(): CameraLayout;
  /** World-space rectangle currently visible to `player`'s view. */
  worldView(player: PlayerId): Rect;
  /** Shake the camera(s) showing `player` (null = all). intensity ~0.002..0.02. */
  shake(player: PlayerId | null, intensity: number, ms: number): void;
  /** Shake cameras near a world point, falling off with distance (radius px). */
  shakeAt(x: number, y: number, radius: number, intensity: number, ms: number): void;
}

export interface DinoState {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  /** Collision radius (px) used for avoidance checks by other systems. */
  radius: number;
}

export interface RaceContext {
  scene: Phaser.Scene;
  bus: EventBus;
  world: WorldData;
  settings: Settings;
  rng: Rng;
  players: IPlayerCar[];
  /** Live NPC vehicles. Traffic and police systems add/remove their own. */
  npcs: Set<INpcVehicle>;
  /** Current goal (owned/mutated by GoalSystem). */
  goal: GoalState | null;
  /** Owned/mutated by DinoSystem. */
  dino: DinoState;
  camera: ICameraRig;
  /** Seconds since GO (excludes paused time). */
  elapsedSec: number;
  roundLengthSec: number;
  paused: boolean;
}

/** Every gameplay system implements this; RaceScene calls init once, update every frame (not while paused). */
export interface GameSystem {
  readonly name: string;
  init(ctx: RaceContext): void;
  update(dtSec: number, ctx: RaceContext): void;
  destroy(): void;
}
