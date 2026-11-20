import Phaser from 'phaser';
import { CAT, DEPTH, DINO_SMASH, FARM_TRAFFIC, HAY_WAGON_SPEC } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { Vec2 } from '../core/types';
import { hitchPoint } from '../systems/farmTraffic';
import { NPC_MASK, NpcVehicle } from './NpcVehicle';

/** A solid trailer that swings around a physical hitch and can roll away on its own. */
export class HayWagon extends NpcVehicle {
  private hitch?: MatterJS.ConstraintType;
  private tractor?: NpcVehicle;
  private launchTime = 0;
  private settleTime = 0;

  constructor(scene: Phaser.Scene, tractor: NpcVehicle) {
    const h = hitchPoint(tractor.x, tractor.y, tractor.angle, tractor.spec.length);
    const half = HAY_WAGON_SPEC.length / 2;
    super(
      scene, 'truck', TEX.farm.hayWagon, HAY_WAGON_SPEC,
      h.x - Math.cos(tractor.angle) * half, h.y - Math.sin(tractor.angle) * half, tractor.angle,
    );
    // Same negative group: the wagon and its tractor never collide with each other.
    const group = -tractor.body.id;
    tractor.body.collisionFilter.group = group;
    this.body.collisionFilter.group = group;
    const cos = Math.cos(tractor.angle), sin = Math.sin(tractor.angle);
    const tractorHalf = tractor.spec.length / 2;
    this.tractor = tractor;
    this.hitch = scene.matter.add.constraint(tractor.body, this.body, FARM_TRAFFIC.wagonGapPx, FARM_TRAFFIC.wagonHitchStiffness, {
      pointA: { x: -cos * tractorHalf, y: -sin * tractorHalf },
      pointB: { x: cos * half, y: sin * half },
      damping: FARM_TRAFFIC.wagonHitchDamping,
      render: { visible: false },
    });
  }

  get hitched(): boolean { return this.hitch !== undefined; }
  get dinoProtected(): boolean { return this.launchTime > 0 || this.settleTime > 0; }

  detach(): void {
    if (!this.hitch) return;
    this.scene.matter.world?.removeConstraint(this.hitch);
    this.hitch = undefined;
    if (this.tractor) this.tractor.body.collisionFilter.group = 0;
    this.tractor = undefined;
    this.body.collisionFilter.group = 0;
  }

  launch(normal: Vec2, spin: number): void {
    this.detach();
    this.launchTime = DINO_SMASH.npcAirSec;
    this.settleTime = FARM_TRAFFIC.wagonDinoGraceSec;
    // Keep world geometry solid during a toss; hide the chassis collision from moving traffic.
    this.body.collisionFilter.mask = CAT.static;
    const speed = DINO_SMASH.npcLaunchSpeed * DINO_SMASH.truckSpeedMult;
    this.applyImpulse(normal.x * speed, normal.y * speed, spin);
    this.view.setDepth(DEPTH.fx);
  }

  step(dt: number): void {
    if (this.destroyed) return;
    if (this.launchTime > 0) {
      this.launchTime = Math.max(0, this.launchTime - dt);
      const t = this.launchTime / DINO_SMASH.npcAirSec;
      const height = 4 * t * (1 - t);
      const scale = 1 + DINO_SMASH.npcPeakScale * height;
      const rise = DINO_SMASH.npcPeakHeight * height;
      this.sprite.setDisplaySize(this.spec.length * scale, this.spec.width * scale)
        .setPosition(-Math.sin(this.angle) * rise, -Math.cos(this.angle) * rise);
      if (this.launchTime === 0) {
        this.body.collisionFilter.mask = NPC_MASK;
        this.view.setDepth(DEPTH.vehicle - 1);
      }
    } else {
      this.settleTime = Math.max(0, this.settleTime - dt);
    }
    const { x, y } = this.body.velocity;
    const sin = Math.sin(this.angle), cos = Math.cos(this.angle);
    const lateral = -sin * x + cos * y;
    const grip = this.launchTime > 0 ? 0 : 1 - Math.exp(-FARM_TRAFFIC.wagonLateralDrag * dt);
    const roll = this.hitched || this.launchTime > 0 ? 1 : Math.exp(-FARM_TRAFFIC.wagonRollDrag * dt);
    const m = this.scene.matter.body;
    m.setVelocity(this.body, { x: (x + sin * lateral * grip) * roll, y: (y - cos * lateral * grip) * roll });
    if (!this.hitched) m.setAngularVelocity(this.body, this.body.angularVelocity * roll);
    this.syncView();
  }

  override squash(): void { this.detach(); super.squash(); }
  override destroy(): void { this.detach(); super.destroy(); }
}
