import Phaser from 'phaser';
import { CRYSTAL_TEX, ensureCrystalTextures } from '../art/crystal';
import { DEPTH, DINO_RIDE } from '../config/gameConfig';
import { crystalPulse } from './dinoRide';

/** The defeated boss as a big pulsing crystal in the boss's colour. Textures baked once; only transforms change per frame. */
export class BossCrystal {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly gem: Phaser.GameObjects.Image;
  private t = 0;
  private mult = 1;

  constructor(scene: Phaser.Scene, private x: number, private y: number, tint: number) {
    ensureCrystalTextures(scene);
    this.glow = scene.add.image(x, y, CRYSTAL_TEX.glow).setDepth(DEPTH.dino - 1).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    this.gem = scene.add.image(x, y, CRYSTAL_TEX.gem).setDepth(DEPTH.dino).setTint(tint);
    this.apply();
  }

  /** `mult` shrinks it near the end of the window (1 = full size). */
  update(dt: number, mult: number): void {
    this.t += dt;
    this.mult = mult;
    this.apply();
  }

  private apply(): void {
    const pulse = crystalPulse(this.t, DINO_RIDE.crystalPulseHz);
    const h = DINO_RIDE.crystalSize * this.mult * (1 + pulse * DINO_RIDE.crystalPulseScale);
    this.gem.setPosition(this.x, this.y).setScale(h / this.gem.height).setAlpha(0.88 + 0.12 * pulse);
    this.glow.setPosition(this.x, this.y).setScale((h * DINO_RIDE.crystalGlowScale) / this.glow.width)
      .setAlpha(0.45 + 0.25 * pulse);
  }

  setVisible(on: boolean): void { this.gem.setVisible(on); this.glow.setVisible(on); }

  destroy(): void { this.gem.destroy(); this.glow.destroy(); }
}
