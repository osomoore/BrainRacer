import Phaser from 'phaser';
import { CAT, DEPTH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { INpcVehicle } from '../core/race';
import type { VehicleSpec } from '../core/types';
import { Vehicle } from './Vehicle';

/** Everything except sensors. */
export const NPC_MASK = CAT.static | CAT.player | CAT.traffic | CAT.police | CAT.prop | CAT.dino;

const SQUASH_TWEEN_MS = 150;
const SQUASH_LINGER_MS = 1500;

function npcTexture(scene: Phaser.Scene, key: string, w: number, h: number): string {
  if (scene.textures.exists(key)) return key;
  const fb = `${key}_fallback`;
  if (!scene.textures.exists(fb)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x8899aa, 1).fillRoundedRect(0, 0, w, h, 8);
    g.fillStyle(0xcfefff, 1).fillRoundedRect(w * 0.55, 4, w * 0.15, h - 8, 3);
    g.generateTexture(fb, w, h);
    g.destroy();
  }
  return fb;
}

function shadowTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(TEX.carShadow)) return TEX.carShadow;
  const fb = `${TEX.carShadow}_fallback`;
  if (!scene.textures.exists(fb)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 1).fillEllipse(40, 24, 80, 48);
    g.generateTexture(fb, 80, 48);
    g.destroy();
  }
  return fb;
}

/**
 * Generic non-player vehicle (traffic, trucks, police subclass this). Texture key, spec, kind and
 * collision category are passed in. Subclasses add their own AI.
 */
export class NpcVehicle extends Vehicle implements INpcVehicle {
  readonly sprite: Phaser.GameObjects.Image;
  private _destroyed = false;

  constructor(
    scene: Phaser.Scene,
    readonly npcKind: 'traffic' | 'truck' | 'police',
    textureKey: string,
    spec: VehicleSpec,
    x: number, y: number, angle: number,
    category: number = CAT.traffic,
    mask: number = NPC_MASK,
  ) {
    super(scene, spec, { x, y, angle, category, mask });
    this.body.friction = 0.02;
    this.body.frictionStatic = 0;
    this.setOwner({ kind: 'npc', npc: this });

    const shadow = scene.add.image(3, 4, shadowTexture(scene)).setDisplaySize(spec.length * 1.1, spec.width * 1.2).setAlpha(0.3);
    this.sprite = scene.add.image(0, 0, npcTexture(scene, textureKey, spec.length, spec.width)).setDisplaySize(spec.length, spec.width);
    this.view.add([shadow, this.sprite]);
    this.view.setDepth(DEPTH.vehicle - 1);
    this.syncView();
  }

  get destroyed() { return this._destroyed; }
  get appearanceKey() { return this.sprite.texture.key; }

  /** Comic flatten: body is removed immediately, the sprite squishes, then disappears. */
  squash(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.scene.matter.world.remove(this.body);
    const view = this.view;
    this.scene.tweens.add({
      targets: view, scaleY: 0.15, duration: SQUASH_TWEEN_MS, ease: 'Back.easeOut',
    });
    this.scene.time.delayedCall(SQUASH_LINGER_MS, () => { this.scene.tweens.killTweensOf(view); view.destroy(); });
  }

  destroy(): void {
    if (this._destroyed) { return; }
    this._destroyed = true;
    this.destroyVehicle();
  }
}
