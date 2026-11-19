import Phaser from 'phaser';
import { DEPTH, INDUSTRIAL_LIGHTING } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IPlayerCar, RaceContext } from '../core/race';

export class NightLightingSystem implements GameSystem {
  readonly name = 'nightLighting';
  static order = 150; // after JumpSystem updates the rendered chassis

  private readonly beams: { car: IPlayerCar; image: Phaser.GameObjects.Image }[] = [];
  private readonly chassisMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parentMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  private readonly nose = new Phaser.Math.Vector2();

  init(ctx: RaceContext): void {
    const industrial = ctx.settings.map === 'industrial';
    if (!industrial) return;
    for (const car of ctx.players) {
      const image = ctx.scene.add.image(0, 0, TEX.industrial.headlight)
        .setName(`${industrial ? 'industrial' : 'city'}-headlight-${car.player}`)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.decal + 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.beams.push({ car, image });
    }
    this.update();
  }

  update(): void {
    for (const { car, image } of this.beams) {
      const chassis = car.chassis;
      const transform = chassis.getWorldTransformMatrix(this.chassisMatrix, this.parentMatrix);
      transform.transformPoint(chassis.width * INDUSTRIAL_LIGHTING.bumperOffset, 0, this.nose);
      const lateralScale = Math.hypot(transform.c, transform.d) * chassis.height / INDUSTRIAL_LIGHTING.referenceWidth;
      image.setPosition(this.nose.x, this.nose.y)
        .setRotation(Math.atan2(transform.b, transform.a))
        .setScale(car.airborne ? INDUSTRIAL_LIGHTING.airborneLengthScale : 1, lateralScale)
        .setAlpha(car.disabled ? 0 : (car.airborne ? INDUSTRIAL_LIGHTING.airborneAlpha : INDUSTRIAL_LIGHTING.alpha) * car.view.alpha);
    }
  }

  destroy(): void {
    for (const { image } of this.beams) image.destroy();
    this.beams.length = 0;
  }
}
