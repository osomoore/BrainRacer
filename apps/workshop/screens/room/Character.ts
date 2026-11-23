/** The little player character: a baked kid figure that walks in straight lines with a bob and swinging feet. */
import Phaser from 'phaser';
import { WS_ROOM } from '../../config';
import { KID_H, kidTextures } from './icons';
import { stepToward, type Point } from './layout';

export class Character {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly legL: Phaser.GameObjects.Image;
  private readonly legR: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private pos: Point;
  private target: Point | null = null;
  private onArrive: (() => void) | null = null;
  private phase = 0;
  private stepClock = 0;
  private readonly scale: number;

  constructor(scene: Phaser.Scene, color: number, at: Point, private readonly onStep: () => void) {
    const t = kidTextures(scene, color);
    this.scale = WS_ROOM.charH / KID_H;
    this.pos = { ...at };
    this.shadow = scene.add.ellipse(0, 0, 80, 20, 0x000000, 0.25);
    this.legL = scene.add.image(-16, -16, t.leg).setOrigin(0.5, 1);
    this.legR = scene.add.image(16, -16, t.leg).setOrigin(0.5, 1);
    this.body = scene.add.image(0, -14, t.body).setOrigin(0.5, 1);
    this.root = scene.add.container(at.x, at.y, [this.shadow, this.legL, this.legR, this.body]).setScale(this.scale).setDepth(500);
    this.syncDepth();
  }

  get position(): Point { return { ...this.pos }; }
  get walking(): boolean { return this.target !== null; }

  /** Starts walking; `done` fires on arrival. Replaces any walk in progress. */
  walkTo(target: Point, done: () => void): void {
    this.target = { ...target };
    this.onArrive = done;
    this.phase = 0;
    this.stepClock = 0;
    if (target.x !== this.pos.x) this.root.setScale(this.scale * (target.x < this.pos.x ? -1 : 1), this.scale);
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    if (this.target) {
      const r = stepToward(this.pos, this.target, WS_ROOM.walkSpeed * dt);
      this.pos = r.p;
      this.phase += dt * Math.PI * 2 / WS_ROOM.stepSec;
      this.stepClock += dt;
      if (this.stepClock >= WS_ROOM.stepSec / 2) { this.stepClock = 0; this.onStep(); }
      const swing = Math.sin(this.phase);
      this.legL.y = -16 - Math.max(0, swing) * 14;
      this.legR.y = -16 - Math.max(0, -swing) * 14;
      this.body.y = -14 - Math.abs(Math.sin(this.phase * 1)) * WS_ROOM.bobPx;
      this.root.setRotation(Math.sin(this.phase) * 0.05);
      if (r.arrived) {
        const done = this.onArrive;
        this.target = null; this.onArrive = null;
        this.legL.y = this.legR.y = -16; this.body.y = -14; this.root.setRotation(0);
        done?.();
      }
    } else {
      // idle breathing
      this.phase += dt * 2.2;
      this.body.y = -14 - (Math.sin(this.phase) + 1) * 1.5;
    }
    if (this.root.x !== this.pos.x || this.root.y !== this.pos.y) {
      this.root.setPosition(this.pos.x, this.pos.y);
      this.syncDepth();
    }
  }

  private syncDepth(): void { this.root.setDepth(500 + this.pos.y / 10); }

  destroy(): void { this.root.destroy(); }
}
