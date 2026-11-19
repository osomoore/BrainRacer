import Phaser from 'phaser';
import { HAY_WAGON_SPEC } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { hitchPoint, trailerPose } from '../systems/farmTraffic';
import { NpcVehicle } from './NpcVehicle';

/**
 * Hay wagon trailer: a solid NPC part (kind 'truck') whose body is placed each frame by a trailing-point
 * follower pinned to the tractor hitch. It never drives itself; it collides with everything except its tractor.
 */
export class HayWagon extends NpcVehicle {
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
  }

  /** Re-pin the wagon to the tractor's hitch (call after the tractor has driven this frame). */
  follow(tractor: NpcVehicle): void {
    if (this.destroyed) return;
    const h = hitchPoint(tractor.x, tractor.y, tractor.angle, tractor.spec.length);
    const pose = trailerPose(h.x, h.y, this.x, this.y, HAY_WAGON_SPEC.length / 2, tractor.angle);
    const m = this.scene.matter.body;
    const v = tractor.body.velocity;
    m.setPosition(this.body, { x: pose.x, y: pose.y });
    m.setAngle(this.body, pose.angle);
    m.setVelocity(this.body, { x: v.x, y: v.y });
    m.setAngularVelocity(this.body, 0);
    this.syncView();
  }
}
