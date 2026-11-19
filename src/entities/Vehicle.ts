import Phaser from 'phaser';
import { CAT, VEHICLE_MODEL } from '../config/gameConfig';
import type { BodyOwner, IVehicle } from '../core/race';
import type { Vec2, VehicleSpec } from '../core/types';
import { stepVehicle, type VehicleControls, type VehicleMults } from './vehicleModel';

/**
 * UNITS: Matter velocities are px per *step* (one step = 1/60 s at the default timestep), and
 * angular velocity is rad per step. Everything public on Vehicle (velocity, applyImpulse, drive)
 * is in px/s and rad/s; conversion happens only inside this file via STEP_HZ.
 */
export const STEP_HZ = 60;

export interface VehicleOptions {
  x: number;
  y: number;
  angle?: number;
  /** Matter collision category (one of CAT). */
  category: number;
  /** Matter collision mask (OR of CAT). */
  mask: number;
}

export class Vehicle implements IVehicle {
  readonly body: MatterJS.BodyType;
  readonly view: Phaser.GameObjects.Container;
  protected maxSpeedMult = 1;
  protected accelMult = 1;
  /** Sideways velocity (px/s) from the last drive() step, for skid/debug. */
  lateralSpeed = 0;
  /** Seconds of "recoil" left after a hard hit (throttle weakened, grip lowered so the car bounces/slides off). */
  protected recoil = 0;
  /** Pivot turn rate (rad/s at ~0 speed); player cars only, 0 = off. */
  protected pivotRate = 0;
  private lastSet: Vec2 | null = null;

  constructor(readonly scene: Phaser.Scene, readonly spec: VehicleSpec, opts: VehicleOptions) {
    const M = VEHICLE_MODEL;
    this.body = scene.matter.add.rectangle(opts.x, opts.y, spec.length, spec.width, {
      chamfer: { radius: M.chamfer },
      frictionAir: 0,
      friction: M.friction,
      frictionStatic: 0,
      restitution: M.restitution,
      collisionFilter: { category: opts.category, mask: opts.mask, group: 0 },
    }) as MatterJS.BodyType;
    scene.matter.body.setMass(this.body, spec.mass);
    scene.matter.body.setAngle(this.body, opts.angle ?? 0);
    this.view = scene.add.container(opts.x, opts.y);
    this.view.setRotation(opts.angle ?? 0);
  }

  setOwner(owner: BodyOwner): void {
    (this.body as MatterJS.BodyType & { plugin: { owner?: BodyOwner } }).plugin.owner = owner;
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  get angle() { return this.body.angle; }
  /** px/s */
  get velocity(): Vec2 { return { x: this.body.velocity.x * STEP_HZ, y: this.body.velocity.y * STEP_HZ }; }
  get forwardSpeed() {
    const v = this.velocity;
    return v.x * Math.cos(this.angle) + v.y * Math.sin(this.angle);
  }
  get currentMaxSpeed() { return this.spec.maxSpeed * this.maxSpeedMult; }

  /** Run the tire model for one frame and push the result into Matter. dt in seconds. */
  drive(controls: VehicleControls, dt: number): void {
    const v = this.velocity;
    // Detect a collision: Matter changed the velocity we set last frame by a large amount.
    if (this.lastSet && Math.hypot(v.x - this.lastSet.x, v.y - this.lastSet.y) > VEHICLE_MODEL.recoilTriggerSpeed) {
      this.recoil = VEHICLE_MODEL.recoilSec;
    }
    const rc = this.recoil > 0;
    if (rc) this.recoil = Math.max(0, this.recoil - dt);
    const mults: VehicleMults = { maxSpeed: this.maxSpeedMult, accel: this.accelMult, grip: rc ? VEHICLE_MODEL.recoilGrip : 1, pivotRate: this.pivotRate };
    const ctl = rc ? { ...controls, throttle: controls.throttle * VEHICLE_MODEL.recoilThrottle } : controls;
    const r = stepVehicle(
      { vx: v.x, vy: v.y, angle: this.angle, angularVel: this.body.angularVelocity * STEP_HZ },
      ctl, this.spec, mults, dt,
    );
    this.lastSet = { x: r.vx, y: r.vy };
    this.lateralSpeed = r.lateral;
    this.scene.matter.body.setVelocity(this.body, { x: r.vx / STEP_HZ, y: r.vy / STEP_HZ });
    this.scene.matter.body.setAngularVelocity(this.body, r.angularVel / STEP_HZ);
  }

  /** Like applyImpulse but not mistaken for a crash by the recoil detector. Call before drive(). */
  protected nudge(dvx: number, dvy: number): void {
    this.applyImpulse(dvx, dvy);
    if (this.lastSet) this.lastSet = { x: this.lastSet.x + dvx, y: this.lastSet.y + dvy };
  }

  /** Rotate the body a little (before drive(), which re-derives angular velocity from the new angle). */
  protected rotateBody(angle: number): void {
    this.scene.matter.body.setAngle(this.body, angle);
  }

  /** Instantaneous velocity change in px/s (and rad/s of spin). */
  applyImpulse(dvx: number, dvy: number, spin = 0): void {
    const v = this.body.velocity;
    this.scene.matter.body.setVelocity(this.body, { x: v.x + dvx / STEP_HZ, y: v.y + dvy / STEP_HZ });
    if (spin) {
      this.scene.matter.body.setAngularVelocity(this.body, this.body.angularVelocity + spin / STEP_HZ);
    }
  }

  setPose(x: number, y: number, angle: number): void {
    const b = this.scene.matter.body;
    b.setPosition(this.body, { x, y });
    b.setAngle(this.body, angle);
    b.setVelocity(this.body, { x: 0, y: 0 });
    b.setAngularVelocity(this.body, 0);
    this.syncView();
  }

  /** Copy body transform to the view. Call once per frame after physics. */
  syncView(): void {
    this.view.setPosition(this.body.position.x, this.body.position.y);
    this.view.setRotation(this.body.angle);
  }

  destroyVehicle(): void {
    this.scene.matter?.world?.remove(this.body); // world is null if Matter already shut down
    this.view.destroy();
  }
}

export const PLAYER_MASK_ALL = CAT.static | CAT.traffic | CAT.police | CAT.prop | CAT.player | CAT.sensor | CAT.dino;
