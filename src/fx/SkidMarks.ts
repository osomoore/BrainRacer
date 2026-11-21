import Phaser from 'phaser';
import { DEPTH, VEHICLE_MODEL } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';

const FALLBACK_KEY = 'fx_skid_fallback';

interface MarkStyle {
  key?: string;
  name?: string;
  width?: number;
  fadeSec?: number;
  depth?: number;
}

type Mark = { image: Phaser.GameObjects.Image; age: number; alpha: number };

/** Pooled, fading tire marks. Call add() at wheel positions and update(dt) once per frame. */
export class SkidMarks {
  private readonly pool: Mark[] = [];
  private head = 0;
  private readonly key: string;

  constructor(private readonly scene: Phaser.Scene, readonly max = VEHICLE_MODEL.skidMax, private readonly style: MarkStyle = {}) {
    if (style.key) this.key = style.key;
    else if (scene.textures.exists(TEX.skid)) this.key = TEX.skid;
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

  private create(): Mark {
    const image = this.scene.add.image(0, 0, this.key).setDepth(this.style.depth ?? DEPTH.decal).setVisible(false);
    if (this.style.name) image.setName(this.style.name);
    return { image, age: 0, alpha: 0 };
  }

  prewarm(): this {
    while (this.pool.length < this.max) this.pool.push(this.create());
    return this;
  }

  /** Lay a mark. `len` stretches it along the heading. */
  add(x: number, y: number, angle: number, len = 12, alpha = .55): void {
    const mark = this.pool[this.head] ?? (this.pool[this.head] = this.create());
    mark.image.setPosition(x, y).setRotation(angle).setDisplaySize(len, this.style.width ?? 5).setAlpha(alpha).setVisible(true);
    mark.age = 0;
    mark.alpha = alpha;
    this.head = (this.head + 1) % this.max;
  }

  update(dt: number): void {
    const fade = this.style.fadeSec ?? VEHICLE_MODEL.skidFadeSec;
    for (const mark of this.pool) {
      if (!mark.image.visible) continue;
      mark.age += dt;
      if (mark.age >= fade) mark.image.setVisible(false);
      else mark.image.setAlpha(mark.alpha * (1 - mark.age / fade));
    }
  }

  destroy(): void {
    for (const mark of this.pool) mark.image.destroy();
    this.pool.length = 0;
    this.head = 0;
  }
}
