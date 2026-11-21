import Phaser from 'phaser';
import { CAT, DEPTH, POLICE, POLICE_SPEC } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { INpcVehicle } from '../core/race';
import type { PlayerId } from '../core/types';
import { newBrain, type PoliceBrain, type PoliceMode } from './policeAI';
import { Vehicle } from './Vehicle';

const MASK = CAT.static | CAT.player | CAT.traffic | CAT.police | CAT.prop | CAT.dino;

function ensureTexture(scene: Phaser.Scene, key: string, make: (g: Phaser.GameObjects.Graphics) => void, w: number, h: number): string {
  if (scene.textures.exists(key)) return key;
  const fb = `${key}_fallback`;
  if (!scene.textures.exists(fb)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    make(g);
    g.generateTexture(fb, w, h);
    g.destroy();
  }
  return fb;
}

export class PoliceCar extends Vehicle implements INpcVehicle {
  readonly npcKind = 'police' as const;
  readonly brain: PoliceBrain = newBrain();
  mode: PoliceMode = 'patrol';
  /** Player being chased (chase mode). */
  target: PlayerId | null = null;
  /** Seconds the AI is told to back off (after a bump). */
  backoff = 0;
  /** Seconds spent leaving (after a chase ends). */
  leaveSec = 0;
  /** Part of the monster-rider swarm: leaves at its own (faster) speed. */
  swarm = false;
  private _destroyed = false;
  private flashT = 0;
  private flashIdx = 0;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private glowAlpha = 0;

  constructor(scene: Phaser.Scene, private readonly npcs: Set<INpcVehicle>, x: number, y: number, angle: number) {
    super(scene, POLICE_SPEC, { x, y, angle, category: CAT.police, mask: MASK });
    this.body.friction = 0.02;
    this.setOwner({ kind: 'npc', npc: this });
    const L = POLICE_SPEC.length, W = POLICE_SPEC.width;
    const key0 = ensureTexture(scene, TEX.police[0], (g) => {
      g.fillStyle(0xf4f4f4, 1).fillRoundedRect(0, 0, L, W, 8);
      g.fillStyle(0x1b2a4a, 1).fillRect(L * 0.3, 0, L * 0.22, W);
      g.fillStyle(0xff2020, 1).fillRect(L * 0.38, 2, 6, W / 2 - 2);
      g.fillStyle(0x2060ff, 1).fillRect(L * 0.38, W / 2, 6, W / 2 - 2);
    }, L, W);
    const glowKey = ensureTexture(scene, TEX.beacon, (g) => {
      g.fillStyle(0xffffff, 0.25).fillCircle(32, 32, 32);
      g.fillStyle(0xffffff, 0.45).fillCircle(32, 32, 16);
    }, 64, 64);
    this.glow = scene.add.image(0, 0, glowKey).setDisplaySize(180, 180).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.sprite = scene.add.image(0, 0, key0).setDisplaySize(L, W);
    this.view.add([this.glow, this.sprite]);
    this.view.setDepth(DEPTH.vehicle);
    npcs.add(this);
  }

  get destroyed() { return this._destroyed; }
  get appearanceKey() { return this.sprite.texture.key; }

  /** Drive + visuals for one frame. */
  step(controls: { throttle: number; brake: number; steer: number }, dt: number): void {
    this.maxSpeedMult = this.mode === 'chase' ? 1 : this.mode === 'leave' ? (this.swarm ? POLICE.monsterSwarmLeaveSpeedFrac : POLICE.leaveSpeedFrac) : POLICE.patrolSpeedFrac;
    this.drive(controls, dt);
    this.syncView();
    this.flashT += dt;
    if (this.flashT >= POLICE.lightFlashSec) {
      this.flashT -= POLICE.lightFlashSec;
      this.flashIdx ^= 1;
      const k = TEX.police[this.flashIdx];
      if (this.scene.textures.exists(k)) this.sprite.setTexture(k);
      this.glow.setTint(this.flashIdx ? 0x3060ff : 0xff2020);
    }
    const want = this.mode === 'chase' ? 0.7 : 0;
    this.glowAlpha += (want - this.glowAlpha) * (1 - Math.exp(-8 * dt));
    this.glow.setAlpha(this.glowAlpha);
  }

  squash(): void {
    if (this._destroyed) return;
    try { this.scene.matter.world.remove(this.body); } catch { /* already removed */ }
    this.npcs.delete(this);
    this.scene.tweens.add({
      targets: this.view, scaleY: 0.15, scaleX: 1.25, alpha: 0.6, duration: 160,
      onComplete: () => this.finish(),
    });
  }

  destroy(): void {
    this.finish();
  }

  private finish(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.npcs.delete(this);
    try { this.scene.matter.world.remove(this.body); } catch { /* already removed */ }
    this.view.destroy();
  }
}
