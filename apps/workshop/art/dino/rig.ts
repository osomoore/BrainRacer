/** Dinosaur rig (side + top). Parts are baked textures on containers; animations drive BaseRig.S. */
import type Phaser from 'phaser';
import type { RigAnim } from '../../core/runtime';
import type { Model, View } from '../../core/types';
import { partImage, type PartSpec } from '../bake';
import { rotPt } from '../geom';
import { BaseRig } from '../rigBase';
import { CLAWS, TEETH } from './looks';
import { type DinoLooks, type Skeleton, dinoLooks, hingePos, skeleton } from './skeleton';
import { type SkinSpec, skinSpec } from './skin';
import * as S from './drawSide';
import * as T from './drawTop';

type C = Phaser.GameObjects.Container;
type Img = Phaser.GameObjects.Image;
const ASPECTS = ['color', 'head', 'teeth', 'claws', 'legs', 'move', 'tail', 'body', 'size', 'extra'];

interface LimbRef { c: C; slot: { y: number; far: boolean; front: boolean; rot: number; len: number } }

export class DinoRig extends BaseRig {
  private bodyG!: C; private torsoC!: C; private tailC!: C; private neckC!: C; private headC!: C; private jaw!: C;
  private legs: LimbRef[] = [];
  private arms: LimbRef[] = [];
  private wings: { c: C; far: boolean }[] = [];
  private l!: DinoLooks;
  private sk!: Skeleton;
  private tailRot = 0;

  constructor(scene: Phaser.Scene, model: Model, view: View) {
    super(scene, 'dino', model, view);
    this.init();
  }

  protected supports(a: RigAnim): boolean { return a !== 'drive' && a !== 'spinWheels'; }

  play(anim: RigAnim): void {
    let a = anim;
    const pose = this.l?.pose;
    if (pose === 'fly' && ['idle', 'walk', 'run', 'happy'].includes(a)) a = 'flap';
    else if (pose === 'swim' && ['walk', 'run'].includes(a)) a = 'walk';
    else if (a === 'drive') a = 'run';
    else if (a === 'spinWheels') a = 'run';
    if (a === 'wag') this.S.wag = -1;
    super.play(a);
    if (a === 'wag') { this.scene.tweens.killTweensOf(this.S); this.S.wag = -1; this.tw({ wag: 1 }, 220, { repeat: -1, yoyo: true }); }
  }

  private img(c: C, spec: PartSpec | null, aspects: string[], x = 0, y = 0): Img | null {
    if (!spec) return null;
    const im = partImage(this.scene, spec, x, y);
    c.add(im);
    for (const a of aspects) this.parts[a].push(im);
    return im;
  }

  protected construct(): void {
    const sc = this.scene, m = this.model;
    this.parts = {};
    for (const a of ASPECTS) this.parts[a] = [];
    this.legs = []; this.arms = []; this.wings = [];
    const l = (this.l = dinoLooks(m));
    this.scale = l.scale;
    const sk = skinSpec(m);
    const claw = CLAWS[m.claws] ?? CLAWS['claws.small'];
    this.sk = skeleton(l, claw.arm);
    void sc;
    if (this.view === 'side') this.buildSide(sk, claw); else this.buildTop(sk, claw);
  }

  private mk(parent: C, x: number, y: number, rot = 0): C {
    const c = this.scene.add.container(x, y);
    c.rotation = rot;
    parent.add(c);
    return c;
  }

  private buildSide(sk: SkinSpec, claw: (typeof CLAWS)[string]): void {
    const { l, model: m } = this;
    const k = this.sk;
    const g = this.world;
    this.bodyG = this.mk(g, 0, 0);
    const B = this.bodyG;
    const P = this.parts;
    // tail
    this.tailC = this.mk(B, k.tailBase.x, k.tailBase.y);
    this.img(this.tailC, S.tailSide(l.tail, sk, m.tail), ['tail', ...(sk.ex?.kind === 'feathers' ? ['extra'] : [])]);
    // far limbs and wings
    if (k.pose === 'fly') { const w = this.mk(B, k.wing.x + 10, k.wing.y + 4); this.img(w, S.wingSide(sk, true), ['move']); this.wings.push({ c: w, far: true }); }
    const legImg = (slot: Skeleton['legs'][number], parent: C) => {
      const c = this.mk(parent, slot.x, slot.y, slot.rot);
      const hand = k.pose === 'crawl' && slot.front;
      this.img(c, S.legSide(l.legs, sk, m.legs, claw, m.claws, slot.len, slot.far, hand, k.pose === 'swim'), hand ? ['legs', 'claws'] : ['legs']);
      this.legs.push({ c, slot });
    };
    for (const s of k.legs.filter((q) => q.far)) legImg(s, B);
    for (const s of k.arms.filter((q) => q.far)) this.armImg(s, B, sk, claw, m.claws);
    if (k.pose === 'crawl') for (const s of k.legs.filter((q) => !q.far)) legImg(s, B);
    // The neck overlaps the shoulder so the torso outline doesn't cut across it.
    this.torsoC = this.mk(B, k.torso.x, k.torso.y, k.torso.rot);
    if (l.body.kind === 'sail') this.img(this.torsoC, S.sailSide(l.body), ['body']);
    const torso = this.img(this.torsoC, S.torsoSide(l.body, sk, m.body), ['color', 'body']);
    if (torso) torso.scaleY *= k.torso.ry / l.body.ry;
    if (l.body.kind === 'armor') this.img(this.torsoC, S.platesSide(l.body), ['body']);
    // neck + head
    const h = l.head;
    this.neckC = this.mk(B, k.neckBase.x, k.neckBase.y, k.neckAng);
    this.img(this.neckC, S.neckSide(h, sk, m.head), ['head']);
    this.headC = this.mk(this.neckC, h.neckLen, 0, k.headRot - k.neckAng);
    if (sk.ex?.kind === 'frill') this.img(this.headC, S.frillSide(h, sk), ['extra']);
    this.img(this.headC, S.headSide(h, sk, m.head, m.teeth), ['head', 'color']);
    this.jaw = this.mk(this.headC, 0, 0);
    this.img(this.jaw, S.jawSide(h, sk, m.head, m.teeth), ['teeth']);
    const up = S.teethSide(h, m.teeth);
    this.img(this.headC, up, ['teeth']);
    if (TEETH[m.teeth]?.kind === 'beak') P.teeth.push(this.headC);
    if (sk.ex?.kind === 'feathers') this.img(this.headC, S.featherHeadSide(h, sk), ['extra']);
    if (k.pose !== 'crawl') for (const s of k.legs.filter((q) => !q.far)) legImg(s, B);
    for (const s of k.arms.filter((q) => !q.far)) this.armImg(s, B, sk, claw, m.claws);
    // far wing drawn before; near wing on top
    if (k.pose === 'fly') { const w = this.mk(B, k.wing.x, k.wing.y); this.img(w, S.wingSide(sk, false), ['move']); this.wings.push({ c: w, far: false }); }
    P.move.push(...(k.pose === 'fly' ? [] : this.legs.map((q) => q.c)));
    P.size.push(this.bodyG);
    if (sk.ex && sk.ex.kind !== 'feathers' && sk.ex.kind !== 'frill') P.extra.push(this.torsoC);
    this.tailRot = 0;
    this.cy = Math.max(60, -k.torso.y);
    // anchors / foci (design px, ground = 0)
    const hinge = hingePos(k, h);
    const hr = k.headRot;
    const mouth = rotPt({ x: h.len * 0.95, y: 4 }, hr);
    const headTop = rotPt({ x: h.len * 0.4, y: -h.top }, hr);
    const tailTip = { x: k.tailBase.x - l.tail.len, y: k.tailBase.y + l.tail.droop };
    const tc = { x: k.torso.x, y: k.torso.y };
    const feetX = k.legs.length ? k.legs.reduce((s, q) => s + q.x, 0) / k.legs.length : 0;
    this.anchors = {
      mouth: { x: hinge.x + mouth.x, y: hinge.y + mouth.y }, headTop: { x: hinge.x + headTop.x, y: hinge.y + headTop.y },
      tail: tailTip, feet: { x: feetX, y: 0 }, belly: { x: tc.x, y: tc.y + k.torso.ry * 0.7 },
      front: { x: hinge.x + h.len, y: hinge.y - h.top * 0.3 }, back: { x: tailTip.x, y: tailTip.y },
    };
    const A = this.anchors;
    const armPos = k.arms[1] ?? k.legs.find((q) => q.front) ?? k.legs[0];
    const fx = (a: string, x: number, y: number, z: number) => { this.foci[a] = { x, y, zoom: z }; };
    fx('color', tc.x, tc.y, 1.5); fx('body', tc.x, tc.y, 1.6); fx('head', hinge.x + h.len * 0.4, hinge.y - h.top * 0.4, 2);
    fx('teeth', A.mouth.x - h.len * 0.2, A.mouth.y, 2.6); fx('claws', armPos.x + 10, armPos.y + (('len' in armPos ? (armPos as { len: number }).len : claw.arm) * 0.8), 2.4);
    const nearLeg = k.legs.find((q) => !q.far) ?? k.legs[0];
    fx('legs', feetX - Math.sin(nearLeg.rot) * nearLeg.len * 0.5, nearLeg.y + Math.cos(nearLeg.rot) * nearLeg.len * 0.5, 1.8);
    fx('move', tc.x, tc.y, 1.2);
    fx('tail', (k.tailBase.x + tailTip.x) / 2, (k.tailBase.y + tailTip.y) / 2, 1.5); fx('size', 0, -this.cy, 1);
    const exk = sk.ex?.kind;
    if (exk === 'feathers' || exk === 'frill') fx('extra', hinge.x, hinge.y - h.top * 0.6, 2);
    else fx('extra', tc.x, tc.y, 1.6);
  }

  private armImg(s: Skeleton['arms'][number], parent: C, sk: SkinSpec, claw: (typeof CLAWS)[string], clawId: string): void {
    const c = this.mk(parent, s.x, s.y, s.rot);
    this.img(c, S.armSide(claw, sk, clawId, s.far), ['claws']);
    this.arms.push({ c, slot: { y: s.y, far: s.far, front: false, rot: s.rot, len: claw.arm } });
  }

  private buildTop(sk: SkinSpec, claw: (typeof CLAWS)[string]): void {
    const { l, model: m } = this;
    const k = this.sk;
    const rx = l.body.rx, hw = T.topHalfW(l.body, k.pose);
    const B = (this.bodyG = this.mk(this.world, 0, 0));
    const P = this.parts;
    this.tailC = this.mk(B, -rx * 0.88, 0);
    this.img(this.tailC, T.tailTop(l.tail, sk, m.tail), ['tail', ...(sk.ex?.kind === 'feathers' ? ['extra'] : [])]);
    const pos: { x: number; y: number; far: boolean; front: boolean; rot: number }[] = [];
    if (k.pose === 'crawl') for (const sy of [-1, 1]) { pos.push({ x: -rx * 0.52, y: sy * (hw + 2), far: sy < 0, front: false, rot: 0 }, { x: rx * 0.5, y: sy * (hw + 2), far: sy < 0, front: true, rot: 0 }); }
    else if (k.pose === 'stand') for (const sy of [-1, 1]) pos.push({ x: -rx * 0.32, y: sy * hw, far: sy < 0, front: false, rot: sy * 0.2 });
    else if (k.pose === 'fly') for (const sy of [-1, 1]) pos.push({ x: -rx * 0.3, y: sy * hw * 0.5, far: sy < 0, front: false, rot: 0 });
    else for (const sy of [-1, 1]) pos.push({ x: -rx * 0.6, y: sy * hw * 0.92, far: sy < 0, front: false, rot: sy * 2.3 });
    for (const p of pos) {
      const c = this.mk(B, p.x, p.y, p.rot);
      const hand = k.pose === 'crawl' && p.front;
      const im = this.img(c, T.legTop(l.legs, claw, sk, m.legs, m.claws, hand), hand ? ['legs', 'claws'] : ['legs']);
      if (im && p.y < 0) im.setScale(im.scaleX, -im.scaleY);
      this.legs.push({ c, slot: { y: p.y, far: p.far, front: p.front, rot: p.rot, len: 40 } });
    }
    if (k.pose === 'fly') for (const sy of [-1, 1]) {
      const c = this.mk(B, rx * 0.12, sy * hw * 0.7);
      const im = this.img(c, T.wingTop(sk), ['move']);
      if (im && sy > 0) im.setScale(im.scaleX, -im.scaleY);
      this.wings.push({ c, far: sy < 0 });
    }
    if (k.pose !== 'crawl') for (const sy of [-1, 1]) {
      const c = this.mk(B, rx * 0.62, sy * hw * 0.8, sy * (k.pose === 'swim' ? 1.9 : 0.3));
      const im = this.img(c, T.armTop(claw, sk, m.claws), ['claws']);
      if (im && sy < 0) im.setScale(im.scaleX, -im.scaleY);
      this.arms.push({ c, slot: { y: c.y, far: sy < 0, front: false, rot: c.rotation, len: claw.arm } });
    }
    const h = l.head;
    this.neckC = this.mk(B, rx * 0.78, 0, 0);
    this.img(this.neckC, T.neckTop(h, sk, m.head), ['head']);
    this.headC = this.mk(this.neckC, h.neckLen, 0, 0);
    if (sk.ex?.kind === 'frill') this.img(this.headC, T.frillTop(h, sk), ['extra']);
    this.img(this.headC, T.headTop(h, sk, m.head, m.teeth), ['head', 'color']);
    this.jaw = this.mk(this.headC, 0, 0);
    this.torsoC = this.mk(B, 0, 0);
    this.img(this.torsoC, T.torsoTop(l.body, k.pose, sk, m.body), ['color', 'body']);
    if (l.body.kind === 'armor') this.img(this.torsoC, T.platesTop(l.body, k.pose), ['body']);
    if (l.body.kind === 'sail') this.img(this.torsoC, T.sailTop(l.body, k.pose), ['body']);
    P.size.push(this.bodyG);
    if (sk.ex && !['feathers', 'frill'].includes(sk.ex.kind)) P.extra.push(this.torsoC);
    this.cy = 0;
    const tip = { x: -rx * 0.88 - l.tail.len, y: 0 };
    const hx = rx * 0.78 + h.neckLen;
    this.anchors = {
      mouth: { x: hx + h.len, y: 0 }, headTop: { x: hx + h.len * 0.4, y: 0 }, tail: tip, feet: { x: 0, y: 0 }, belly: { x: 0, y: 0 },
      front: { x: hx + h.len, y: 0 }, back: tip,
    };
  }

  protected render(): void {
    const S0 = this.S;
    const side = this.view === 'side';
    if (!this.bodyG) return;
    this.world.setScale(S0.sx, S0.sy);
    this.world.x = S0.shakeX;
    this.pivot.y = (side ? -this.cy : 0) - (side ? S0.lift : 0);
    this.pivot.rotation = S0.roll + S0.tilt;
    const k = this.sk, pose = k.pose;
    this.bodyG.y = side ? -S0.bob + S0.crouch * 20 : S0.bob * 0.2;
    this.torsoC.rotation = (side ? k.torso.rot : 0) + S0.crouch * (pose === 'stand' ? 0.25 : 0);
    this.torsoC.scaleY = 1 + Math.sin(S0.sway * Math.PI) * 0.015;
    const amp = S0.amp;
    const planted = side && (pose === 'crawl' || pose === 'stand') && amp === 0;
    for (const q of this.legs) {
      const ph = (q.slot.far ? Math.PI : 0) + (q.slot.front ? Math.PI : 0);
      const swing = Math.sin(S0.gait + ph) * amp * (pose === 'swim' ? 0.5 : 0.55);
      q.c.rotation = q.slot.rot + swing;
      q.c.y = q.slot.y + (planted ? S0.bob : 0);
      if (side) q.c.scaleY = Math.max(0.5, 1 - (S0.crouch * 20) / q.slot.len);
      if (pose === 'fly' && side) q.c.rotation = q.slot.rot + Math.sin(S0.flap * 3) * 0.05;
    }
    for (const q of this.arms) {
      const ph = q.slot.far ? Math.PI : 0;
      q.c.rotation = q.slot.rot + Math.sin(S0.gait + ph) * amp * 0.3 + (pose === 'swim' ? 0.2 * Math.sin(S0.gait + ph) : 0);
    }
    for (const w of this.wings) {
      const f = S0.flap;
      if (side) w.c.rotation = 0.55 - f * 1.3 + (w.far ? 0.1 : 0);
      else w.c.scaleY = Math.max(0.25, 1 - f * 0.6) * (w.c.scaleY < 0 ? -1 : 1);
    }
    this.tailC.rotation = this.tailRot - S0.wag * 0.3 + Math.sin(S0.gait) * 0.09 * amp + Math.sin(S0.sway * Math.PI) * 0.02;
    if (!side) this.tailC.rotation = S0.wag * 0.35 + Math.sin(S0.gait) * 0.15 * amp;
    const nk = side ? k.neckAng : 0;
    this.neckC.rotation = nk + (side ? Math.sin(S0.gait * 2) * 0.03 * amp : 0) + S0.sway * 0.02 + S0.nod + S0.tilt * 0.5 - S0.crouch * 0.1;
    this.headC.rotation = (side ? k.headRot : 0) - nk + S0.tilt * 0.8 + Math.sin(S0.gait * 2) * 0.03 * amp;
    this.jaw.rotation = S0.jaw;
  }
}

