import type Phaser from 'phaser';
import { FARM_LOOK } from '../config/gameConfig';
import type { GameSystem, RaceContext } from '../core/race';

/**
 * Farm golden hour: one world-sized warm layer just above the ground tiles and below the long
 * shadows, so fields and roads glow warm while shadows stay cool and cars, goal rings, guide
 * buddies and the HUD keep full contrast. A single quad per camera; nothing to update.
 */
export class FarmLightSystem implements GameSystem {
  readonly name = 'farmLight';
  private grade?: Phaser.GameObjects.Image;

  init(ctx: RaceContext): void {
    if (ctx.settings.map !== 'farm' || !ctx.world.farm) return;
    const W = ctx.world.widthTiles * ctx.world.tileSize, H = ctx.world.heightTiles * ctx.world.tileSize;
    this.grade = ctx.scene.add.image(0, 0, '__WHITE').setName('farm-golden-hour')
      .setOrigin(0).setDisplaySize(W, H).setTint(FARM_LOOK.gradeColor).setAlpha(FARM_LOOK.gradeAlpha)
      .setDepth(FARM_LOOK.gradeDepth);
  }

  update(): void { /* static */ }

  destroy(): void {
    this.grade?.destroy();
    this.grade = undefined;
  }
}
