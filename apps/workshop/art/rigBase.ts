/** Shared rig plumbing: root/pivot/world containers, anim state proxy + tweens, focus/anchor bookkeeping. */
import type Phaser from 'phaser';
import type { ModelRig, RigAnim } from '../core/runtime';
import type { AspectId, Model, View, WorkshopId } from '../core/types';
import { WS_ART } from '../config';

export interface AnimState {
  /** Body bob, px (up positive). */ bob: number;
  tilt: number; sx: number; sy: number;
  /** Whole-model hop, px (up positive). */ lift: number;
  roll: number; shakeX: number;
  /** Wheel spin, radians. */ spin: number;
  jaw: number; flap: number; wag: number;
  /** Leg cycle phase, radians, and amplitude 0..1. */ gait: number; amp: number;
  crouch: number; nod: number; sway: number; flame: number;
}

const fresh = (): AnimState => ({ bob: 0, tilt: 0, sx: 1, sy: 1, lift: 0, roll: 0, shakeX: 0, spin: 0, jaw: 0, flap: 0, wag: 0, gait: 0, amp: 0, crouch: 0, nod: 0, sway: 0, flame: 1 });

export abstract class BaseRig implements ModelRig {
  readonly root: Phaser.GameObjects.Container;
  readonly view: View;
  width = 0;
  height = 0;
  parts: Record<AspectId, Phaser.GameObjects.GameObject[]> = {};
  protected readonly scaler: Phaser.GameObjects.Container;
  protected readonly pivot: Phaser.GameObjects.Container;
  protected readonly world: Phaser.GameObjects.Container;
  protected S: AnimState = fresh();
  protected anchors: Record<string, { x: number; y: number }> = {};
  protected foci: Record<AspectId, { x: number; y: number; zoom: number }> = {};
  /** Height of the model centre above the ground (pivot for rolls), design px. */
  protected cy = 100;
  protected scale = 1;
  protected lastLoop: RigAnim = 'idle';
  protected model: Model;
  private dead = false;

  constructor(protected scene: Phaser.Scene, protected workshop: WorkshopId, model: Model, view: View) {
    this.view = view;
    this.model = { ...model };
    this.root = scene.add.container(0, 0);
    this.scaler = scene.add.container(0, 0);
    this.pivot = scene.add.container(0, 0);
    this.world = scene.add.container(0, 0);
    this.root.add(this.scaler);
    this.scaler.add(this.pivot);
    this.pivot.add(this.world);
  }

  /** Subclass: fill `world`, `parts`, `anchors`, `foci`, `cy`, `scale`. */
  protected abstract construct(): void;
  protected abstract render(): void;
  protected abstract supports(anim: RigAnim): boolean;

  protected init(): void {
    this.rebuild();
    this.play('idle');
  }

  private rebuild(): void {
    this.world.removeAll(true);
    this.parts = {};
    this.anchors = {};
    this.foci = {};
    this.world.setPosition(0, 0).setScale(1);
    this.pivot.setPosition(0, 0).setRotation(0);
    this.construct();
    this.scaler.setScale(this.scale);
    this.scaler.setPosition(0, 0);
    this.world.setPosition(0, this.view === 'side' ? this.cy : 0);
    this.pivot.setPosition(0, this.view === 'side' ? -this.cy : 0);
    const b = this.scaler.getBounds();
    this.width = Math.round(b.width);
    this.height = Math.round(b.height);
    this.render();
  }

  focus(aspect: AspectId): { x: number; y: number; zoom: number } {
    const f = this.foci[aspect] ?? { x: 0, y: -this.cy, zoom: 1.2 };
    return { x: f.x * this.scale, y: f.y * this.scale, zoom: f.zoom };
  }

  anchor(name: string): { x: number; y: number } {
    const a = this.anchors[name] ?? { x: 0, y: -this.cy };
    return { x: a.x * this.scale, y: a.y * this.scale };
  }

  setModel(model: Model): void {
    this.model = { ...model };
    this.scene.tweens.killTweensOf(this.S);
    this.rebuild();
    this.play(this.lastLoop);
  }

  protected tw(props: Partial<Record<keyof AnimState, number>>, duration: number, extra: Record<string, unknown> = {}): void {
    this.scene.tweens.add({ targets: this.S, ...props, duration, ease: 'Sine.easeInOut', onUpdate: () => this.alive() && this.render(), ...extra });
  }

  private alive(): boolean { return !this.dead && this.root.scene !== undefined && this.root.active; }

  play(anim: RigAnim): void {
    const S = this.S;
    this.scene.tweens.killTweensOf(S);
    const keepCrouch = anim === 'crouch' ? S.crouch : 0;
    Object.assign(S, fresh());
    S.crouch = keepCrouch;
    let a = anim;
    if (!this.supports(a)) a = this.view === 'side' && this.workshop === 'race' && (a === 'walk' || a === 'run') ? 'drive' : a === 'chomp' || a === 'flap' || a === 'wag' || a === 'crouch' || a === 'stand' ? 'happy' : a;
    const loop = { repeat: -1, yoyo: true };
    const lin = { repeat: -1, ease: 'Linear' };
    const isLoop = !['jump', 'tumble', 'chomp', 'crouch', 'stand'].includes(a);
    if (isLoop) this.lastLoop = a;
    const ch = (steps: Record<string, unknown>[], onDone?: () => void) => this.scene.tweens.chain({
      targets: S, tweens: steps.map((s) => ({ ease: 'Sine.easeInOut', onUpdate: () => this.alive() && this.render(), ...s })),
      onComplete: () => { if (this.alive()) { onDone?.(); } },
    });
    switch (a) {
      case 'idle': this.tw({ bob: 2.5, sway: 1 }, 900, loop); break;
      case 'drive': this.tw({ spin: Math.PI * 2 }, 520, lin); this.tw({ bob: 3 }, 110, loop); this.tw({ flame: 1.4 }, 90, loop); break;
      case 'spinWheels': this.tw({ spin: Math.PI * 2 }, 130, lin); this.tw({ shakeX: 4, tilt: -0.03 }, 45, loop); this.tw({ flame: 1.5 }, 60, loop); break;
      case 'walk': S.amp = 0.6; this.tw({ gait: Math.PI * 2 }, 760, { ...lin }); this.tw({ bob: 4 }, 190, loop); break;
      case 'run': S.amp = 1; this.tw({ gait: Math.PI * 2 }, 420, { ...lin }); this.tw({ bob: 8, tilt: 0.03 }, 105, loop); break;
      case 'jump':
        ch([{ sy: 0.78, sx: 1.18, duration: 130 }, { sy: 1.2, sx: 0.88, lift: 170, duration: 260, ease: 'Quad.easeOut' }, { sy: 1, sx: 1, lift: 0, duration: 280, ease: 'Quad.easeIn' }, { sy: 0.82, sx: 1.14, duration: 90 }, { sy: 1, sx: 1, duration: 140 }], () => this.play(this.lastLoop));
        break;
      case 'tumble':
        ch([{ roll: -Math.PI * 2, lift: 90, duration: 700, ease: 'Quad.easeOut' }, { lift: 0, duration: 260, ease: 'Bounce.easeOut' }, { sy: 0.85, sx: 1.12, duration: 90 }, { sy: 1, sx: 1, duration: 120 }], () => { S.roll = 0; this.play(this.lastLoop); });
        break;
      case 'happy': this.tw({ lift: 26, sy: 1.06, sx: 0.96 }, 220, { ...loop, ease: 'Quad.easeOut' }); break;
      case 'dizzy': S.tilt = -0.12; this.tw({ tilt: 0.12, sway: 1 }, 520, loop); break;
      case 'celebrate': this.tw({ lift: 60, sy: 1.08, sx: 0.94 }, 260, { ...loop, ease: 'Quad.easeOut' }); this.tw({ tilt: 0.16, flap: 1, wag: 1 }, 260, loop); break;
      case 'chomp': ch([{ jaw: 0.62, duration: 150 }, { jaw: 0, duration: 110 }, { jaw: 0.62, duration: 150 }, { jaw: 0, duration: 110 }, { jaw: 0.62, duration: 150 }, { jaw: 0, duration: 110 }], () => this.play(this.lastLoop)); break;
      case 'crouch': this.tw({ crouch: 1 }, 260, { ease: 'Quad.easeOut' }); break;
      case 'stand': S.crouch = 1; this.tw({ crouch: 0, sy: 1.04 }, 300, { ease: 'Back.easeOut' }); break;
      case 'flap': this.tw({ flap: 1 }, 170, loop); this.tw({ lift: 10 }, 340, loop); break;
      case 'wag': this.tw({ wag: 1 }, 200, loop); break;
    }
    this.render();
  }

  destroy(): void {
    this.dead = true;
    this.scene.tweens.killTweensOf(this.S);
    this.root.destroy();
  }
}

/** Pixel height the room should assume for a medium model (config). */
export const nominalSideHeight = (): number => WS_ART.modelSideH;
