import Phaser from 'phaser';
import { DEPTH, VEHICLE_MODEL } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';

const FALLBACK_KEY = 'fx_skid_fallback';

/** Pooled, fading tire marks. Call add() at wheel positions and update(dt) once per frame. */
export class SkidMarks {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly age: number[] = [];
  private head = 0;
  private count = 0;
  private readonly key: string;

  constructor(private readonly scene: Phaser.Scene, readonly max = VEHICLE_MODEL.skidMax) {
    if (scene.textures.exists(TEX.skid)) this.key = TEX.skid;
    else {
      if (!scene.textures.exists(FALLBACK_KEY)) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0x111111, 1).fillRoundedRect(0, 0, 8, 8, 3);
        g.generateTexture(FALLBACK_KEY, 8, 8);
        g.destroy();
      }
      this.key = FALLBACK_KEY;
    }
  }

  /** Lay a mark. `len` stretches it along the heading. */
  add(x: number, y: number, angle: number, len = 12): void {
    let img = this.pool[this.head];
    if (!img) {
      img = this.scene.add.image(0, 0, this.key).setDepth(DEPTH.decal);
      this.pool[this.head] = img;
    }
    img.setPosition(x, y).setRotation(angle).setDisplaySize(len, 5).setAlpha(0.55).setVisible(true);
    this.age[this.head] = 0;
    this.head = (this.head + 1) % this.max;
    this.count = Math.min(this.count + 1, this.max);
  }

  update(dt: number): void {
    const fade = VEHICLE_MODEL.skidFadeSec;
    for (let i = 0; i < this.count; i++) {
      const img = this.pool[i];
      if (!img || !img.visible) continue;
      const a = (this.age[i] += dt);
      if (a >= fade) img.setVisible(false);
      else img.setAlpha(0.55 * (1 - a / fade));
    }
  }

  destroy(): void {
    for (const img of this.pool) img?.destroy();
    this.pool.length = 0;
    this.count = 0;
  }
}
