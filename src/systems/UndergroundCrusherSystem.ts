import Phaser from 'phaser';
import { CAT, DEPTH, UNDERGROUND_TRAFFIC as U } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { ownerOf, type GameSystem, type INpcVehicle, type IVehicle, type RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import type { Vec2 } from '../core/types';
import { STEP_HZ } from '../entities/Vehicle';
import { ParticlePool } from '../fx/ParticlePool';
import { isDrivable } from '../world/geometry';

const CRATE_LABEL = 'underground-ore-crate';
const CRATE_STATIONS: readonly Vec2[] = [
  { x: 13.85, y: 10.77 }, { x: 16.75, y: 9.23 }, { x: 18.65, y: 10.76 },
  { x: 32.65, y: 9.24 }, { x: 36.25, y: 10.76 },
  { x: 6.22, y: 15.5 }, { x: 18.74, y: 19.7 }, { x: 41.77, y: 16.2 },
  { x: 11.25, y: 23.76 }, { x: 16, y: 22.24 }, { x: 32.4, y: 23.76 },
  { x: 6.23, y: 28.2 }, { x: 31.76, y: 30.65 }, { x: 40.23, y: 28.7 },
  { x: 12.5, y: 37.23 }, { x: 18.75, y: 38.77 }, { x: 34.2, y: 37.23 }, { x: 38.15, y: 38.77 },
];

interface ContactEvent {
  pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[];
}

type Target = { body: MatterJS.BodyType; crate: Phaser.GameObjects.GameObject } | { body: MatterJS.BodyType; npc: INpcVehicle };
interface Hit {
  driver: IVehicle;
  driverBody: MatterJS.BodyType;
  target: Target;
  nose: Vec2;
  speed: number;
  side: number;
}

export class UndergroundCrusherSystem implements GameSystem {
  readonly name = 'undergroundCrusher';
  private ctx?: RaceContext;
  private rng!: Rng;
  private particles!: ParticlePool;
  private crates = new Map<number, { body: MatterJS.BodyType; image: Phaser.GameObjects.GameObject }>();
  private pending = new Map<number, Hit>();
  private offEnd?: () => void;
  private ended = false;

  init(ctx: RaceContext): void {
    if (ctx.settings.map !== 'underground') return;
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x0aece);
    this.particles = new ParticlePool(ctx.scene, 100);
    const { tileSize: ts } = ctx.world;
    for (const { x, y } of CRATE_STATIONS) {
      for (const offset of [-0.16, 0.18]) {
        const px = (x + offset) * ts, py = y * ts;
        if (!isDrivable(ctx.world, px, py)) continue;
        const size = U.oreCrateSize;
        const image = ctx.scene.matter.add.image(px, py, TEX.underground.oreCrate, undefined, {
          shape: { type: 'rectangle', width: size, height: size },
          mass: U.oreCrateMass, frictionAir: 0.095, restitution: 0.36,
          collisionFilter: { category: CAT.prop, mask: CAT.static | CAT.player | CAT.traffic | CAT.prop | CAT.police | CAT.dino },
        });
        image.setDisplaySize(size, size).setRotation(this.rng.range(-0.22, 0.22)).setDepth(DEPTH.prop).setName(CRATE_LABEL);
        const body = image.body as MatterJS.BodyType & { plugin: { owner?: { kind: 'prop'; prop: Phaser.GameObjects.GameObject } } };
        body.label = CRATE_LABEL;
        body.plugin.owner = { kind: 'prop', prop: image };
        this.crates.set(body.id, { body, image });
      }
    }
    ctx.scene.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.onContact);
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; this.pending.clear(); });
  }

  update(dt: number): void {
    if (!this.ctx) return;
    for (const hit of this.pending.values()) this.smash(hit, this.ctx);
    this.pending.clear();
    this.particles.update(dt);
  }

  destroy(): void {
    if (!this.ctx) return;
    const world = this.ctx.scene.matter.world;
    world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.onContact);
    this.offEnd?.();
    for (const { body, image } of this.crates.values()) { world?.remove(body); image.destroy(); }
    this.crates.clear();
    this.pending.clear();
    this.particles.destroy();
  }

  private onContact = ({ pairs }: ContactEvent): void => {
    if (!this.ctx || this.ended || this.ctx.elapsedSec <= 0 || this.ctx.paused || this.ctx.questionBreak) return;
    for (const { bodyA, bodyB } of pairs) {
      if (bodyA.isSensor || bodyB.isSensor) continue;
      this.queue(bodyA, bodyB.parent ?? bodyB);
      this.queue(bodyB, bodyA.parent ?? bodyA);
    }
  };

  private queue(driverBody: MatterJS.BodyType, body: MatterJS.BodyType): void {
    if (this.pending.has(body.id)) return;
    const owner = ownerOf(driverBody);
    let driver: IVehicle;
    if (owner?.kind === 'player' && owner.car.chassis.texture.key === TEX.underground.rockCrusher) {
      if (owner.car.airborne || owner.car.disabled || owner.car.riding || owner.car.boardingPosition) return;
      driver = owner.car;
    } else if (owner?.kind === 'npc' && owner.npc.appearanceKey === TEX.underground.rockCrusher && !owner.npc.destroyed) {
      driver = owner.npc;
    } else return;
    const crate = this.crates.get(body.id);
    const other = ownerOf(body);
    let target: Target;
    if (crate) target = { body, crate: crate.image };
    else if (other?.kind === 'npc' && !other.npc.destroyed && other.npc.spec.mass < driver.spec.mass) {
      target = { body, npc: other.npc };
    } else return;

    const nose = { x: Math.cos(driver.angle), y: Math.sin(driver.angle) };
    const speed = driver.forwardSpeed;
    const dx = body.position.x - driver.x, dy = body.position.y - driver.y;
    const ahead = dx * nose.x + dy * nose.y, side = dy * nose.x - dx * nose.y;
    const leader = (body.velocity.x * nose.x + body.velocity.y * nose.y) * STEP_HZ;
    if (speed < U.crusherForwardMin || speed - leader < U.crusherImpactMin || ahead < driver.spec.length * 0.34) return;
    this.pending.set(body.id, { driver, driverBody: driver.body, target, nose, speed, side });
  }

  private smash({ driver, driverBody, target, nose, speed, side }: Hit, ctx: RaceContext): void {
    const { x, y } = target.body.position;
    if ('crate' in target) {
      if (!this.crates.delete(target.body.id)) return;
      ctx.scene.matter.world.remove(target.body);
      target.crate.destroy();
    } else {
      if (target.npc.destroyed) return;
      const sign = Math.sign(side) || (this.rng.chance(0.5) ? 1 : -1);
      const push = U.crusherSideImpulse * sign;
      target.npc.applyImpulse(nose.x * speed * 0.62 - nose.y * push, nose.y * speed * 0.62 + nose.x * push, U.crusherSpin * sign);
    }
    if (driverBody === driver.body && driverBody === ownerVehicleBody(driver)) {
      const restore = Math.max(0, speed * U.crusherKeepSpeed - driver.forwardSpeed);
      if (restore > 0) driver.applyImpulse(nose.x * restore, nose.y * restore);
    }
    for (let i = 0; i < 9; i++) {
      const a = this.rng.range(0, Math.PI * 2), v = this.rng.range(55, 210);
      this.particles.spawn({ key: TEX.underground.oreChip, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: this.rng.range(0.25, 0.48), s0: this.rng.range(0.4, 1), s1: 0, spin: this.rng.range(-7, 7) });
    }
    ctx.camera.shakeAt(x, y, 780, 0.009, 150);
    services.audio.sfx('squash', { volume: 0.6 });
  }
}

function ownerVehicleBody(driver: IVehicle): MatterJS.BodyType | undefined {
  const owner = ownerOf(driver.body);
  return owner?.kind === 'player' && owner.car === driver ? owner.car.body
    : owner?.kind === 'npc' && owner.npc === driver && !owner.npc.destroyed ? owner.npc.body : undefined;
}
