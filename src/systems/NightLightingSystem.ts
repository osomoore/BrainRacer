import Phaser from 'phaser';
import { INDUSTRIAL_LIGHTING, INDUSTRIAL_PROPS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { ensureNightGlow } from '../art/industrialHeadlight';
import type { GameSystem, IPlayerCar, RaceContext } from '../core/race';

/** Decorations that cast a warm ground pool. */
const POOLED_KINDS = new Set(['bridge', 'factoryBay', 'gantry', 'waterTower', 'lampPost', 'conveyor', 'smokeStack']);

export class NightLightingSystem implements GameSystem {
  readonly name = 'nightLighting';
  static order = 150; // after JumpSystem updates the rendered chassis

  private readonly beams: { car: IPlayerCar; image: Phaser.GameObjects.Image }[] = [];
  private readonly chassisMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parentMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  private ctx?: RaceContext;
  private goalGlow?: Phaser.GameObjects.Image;
  private readonly halos: { car: IPlayerCar; image: Phaser.GameObjects.Image }[] = [];
  private readonly extras: Phaser.GameObjects.GameObject[] = [];
  private readonly nose = new Phaser.Math.Vector2();

  init(ctx: RaceContext): void {
    const industrial = ctx.settings.map === 'industrial';
    if (!industrial) return;
    const L = INDUSTRIAL_LIGHTING;
    const glow = ensureNightGlow(ctx.scene);
    if (industrial) {
      const W = ctx.world.widthTiles * ctx.world.tileSize, H = ctx.world.heightTiles * ctx.world.tileSize;
      this.extras.push(ctx.scene.add.image(0, 0, '__WHITE').setName('industrial-night-overlay')
        .setOrigin(0).setDisplaySize(W, H).setTint(L.nightColor).setAlpha(L.nightAlpha).setDepth(L.nightDepth));
      this.goalGlow = ctx.scene.add.image(0, 0, glow).setDepth(L.nightDepth + 1)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(L.goalGlowColor).setVisible(false);
      this.extras.push(this.goalGlow);
      for (const d of ctx.world.industrial?.decorations ?? []) {
        if (!POOLED_KINDS.has(d.kind)) continue;
        const size = INDUSTRIAL_PROPS.poolPx[d.kind];
        const pool = ctx.scene.add.image(d.x, d.y, glow).setDepth(L.nightDepth + 1)
          .setBlendMode(Phaser.BlendModes.ADD).setTint(L.poolColor).setAlpha(size ? L.poolAlpha * 0.8 : L.poolAlpha)
          .setRotation(d.angle).setDisplaySize(size ?? d.w * L.poolScale, size ?? d.h * L.poolScale);
        this.extras.push(pool);
      }
      this.ctx = ctx;
    }
    for (const car of ctx.players) {
      const image = ctx.scene.add.image(0, 0, TEX.industrial.headlight)
        .setName(`${industrial ? 'industrial' : 'city'}-headlight-${car.player}`)
        .setOrigin(0, 0.5)
        .setDepth(L.nightDepth + 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.beams.push({ car, image });
      const halo = ctx.scene.add.image(0, 0, glow).setDepth(L.nightDepth + 1)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(L.carHaloColor)
        .setScale(L.carHaloScale * 42 / 128).setAlpha(L.carHaloAlpha);
      this.halos.push({ car, image: halo });
    }
    this.update();
  }

  update(): void {
    const goal = this.ctx?.goal;
    if (this.goalGlow) {
      this.goalGlow.setVisible(!!goal);
      if (goal) this.goalGlow.setPosition(goal.x, goal.y)
        .setDisplaySize(goal.radius * 2 * INDUSTRIAL_LIGHTING.goalGlowScale, goal.radius * 2 * INDUSTRIAL_LIGHTING.goalGlowScale)
        .setAlpha(INDUSTRIAL_LIGHTING.goalGlowAlpha);
    }
    for (const { car, image } of this.halos) {
      image.setPosition(car.chassis.x, car.chassis.y).setVisible(!car.disabled && !car.riding);
    }
    for (const { car, image } of this.beams) {
      const chassis = car.chassis;
      const transform = chassis.getWorldTransformMatrix(this.chassisMatrix, this.parentMatrix);
      transform.transformPoint(chassis.width * INDUSTRIAL_LIGHTING.bumperOffset, 0, this.nose);
      const lateralScale = Math.hypot(transform.c, transform.d) * chassis.height / INDUSTRIAL_LIGHTING.referenceWidth;
      image.setPosition(this.nose.x, this.nose.y)
        .setRotation(Math.atan2(transform.b, transform.a))
        .setScale(car.airborne ? INDUSTRIAL_LIGHTING.airborneLengthScale : 1, lateralScale)
        .setAlpha(car.disabled || car.riding ? 0 : (car.airborne ? INDUSTRIAL_LIGHTING.airborneAlpha : INDUSTRIAL_LIGHTING.alpha) * car.view.alpha);
    }
  }

  destroy(): void {
    for (const { image } of this.beams) image.destroy();
    this.beams.length = 0;
    for (const { image } of this.halos) image.destroy();
    this.halos.length = 0;
    for (const o of this.extras) o.destroy();
    this.extras.length = 0;
    this.goalGlow = undefined;
  }
}
