/** Race car rig (side + top). Parts are baked textures; animations drive the state in BaseRig. */
import type Phaser from 'phaser';
import { WS_ART } from '../../config';
import type { RigAnim } from '../../core/runtime';
import type { Model, View } from '../../core/types';
import { partImage } from '../bake';
import { BaseRig } from '../rigBase';
import { BUMPER, SPRING } from './looks';
import { type RaceGeom, type RaceLooks, raceGeom, raceLooks } from './geometry';
import * as S from './drawSide';
import * as T from './drawTop';

type Img = Phaser.GameObjects.Image;
const RACE_ASPECTS = ['wheels', 'engine', 'gears', 'springs', 'bumpers', 'paint', 'body', 'shape', 'size', 'extra'];

export class RaceRig extends BaseRig {
  private bodyG!: Phaser.GameObjects.Container;
  private bumperG!: Phaser.GameObjects.Container;
  private wheelF!: Phaser.GameObjects.Container;
  private wheelR!: Phaser.GameObjects.Container;
  private springs: { img: Img; h: number }[] = [];
  private springG!: Phaser.GameObjects.Container;
  private floatG!: Phaser.GameObjects.Container;
  private flame: Img | null = null;
  private L!: RaceLooks;
  private geo!: RaceGeom;

  constructor(scene: Phaser.Scene, model: Model, view: View) {
    super(scene, 'race', model, view);
    this.init();
  }

  protected supports(a: RigAnim): boolean { return !['walk', 'run', 'chomp', 'crouch', 'stand', 'flap', 'wag'].includes(a); }

  protected construct(): void {
    const m = this.model, sc = this.scene;
    const L = (this.L = raceLooks(m));
    const geo = (this.geo = raceGeom(L));
    this.scale = L.scale;
    const P: Record<string, Phaser.GameObjects.GameObject[]> = {};
    for (const a of RACE_ASPECTS) P[a] = [];
    this.parts = P;
    this.flame = null;
    this.springs = [];
    this.bodyG = sc.add.container(0, 0);
    this.bumperG = sc.add.container(0, 0);
    this.wheelF = sc.add.container(0, 0);
    this.wheelR = sc.add.container(0, 0);
    this.springG = sc.add.container(0, 0);
    this.floatG = sc.add.container(0, 0);
    // Suspension and bumpers sit behind the body; tires cover the suspension and floats sit outside them.
    this.world.add([this.bumperG, this.springG, this.bodyG, this.wheelF, this.wheelR, this.floatG]);
    const add = (aspect: string, img: Img, x: number, y: number, flipX = false, scale = 1, rot = 0): Img => {
      img.setPosition(x, y).setScale(img.scaleX * scale * (flipX ? -1 : 1), img.scaleY * scale).setRotation(rot);
      this.bodyG.add(img);
      P[aspect].push(img);
      return img;
    };
    const midY = (geo.bottom + geo.chassisTop(0)) / 2;
    const hubY = geo.hubY;
    this.anchors = {
      wheelFront: { x: geo.frontAxle, y: hubY }, wheelRear: { x: geo.rearAxle, y: hubY },
      exhaust: { x: geo.rear - 14, y: geo.bottom + 8 }, roof: { x: (geo.cabin[0].x + geo.cabin[3].x) / 2, y: geo.roofTop },
      front: { x: geo.front, y: midY }, back: { x: geo.rear, y: midY },
    };
    const wheelId = m.wheels;
    if (this.view === 'side') this.constructSide(add, wheelId, midY);
    else this.constructTop(add, wheelId);
  }

  private constructSide(add: (a: string, i: Img, x: number, y: number, f?: boolean, s?: number, r?: number) => Img, wheelId: string, midY: number): void {
    const { scene: sc, model: m, L, geo } = this;
    const { body: b, shape: s } = L;
    void s;
    const P = this.parts;
    // rocket (behind body)
    if (m.extra === 'extra.rocket') {
      const y = geo.bottom - L.body.chH * 0.45;
      add('extra', partImage(sc, S.rocketSide()), geo.rear + 8, y);
      this.flame = add('extra', partImage(sc, S.flameSide()), geo.rear - 96, y);
    }
    if (m.extra === 'extra.floats') { const f = partImage(sc, S.floatSide(b.len - 30)); f.setPosition(0, geo.bottom + 8); this.floatG.add(f); P.extra.push(f); }
    // The lower edge of the engine sits behind the hood outline.
    const cabinFront = geo.cabin[3].x;
    const hoodX = (cabinFront + geo.front) / 2;
    const hoodLen = geo.front - cabinFront;
    const slope = Math.atan2(geo.chassisTop(hoodX + 10) - geo.chassisTop(hoodX - 10), 20);
    const hy = Math.min(geo.chassisTop(hoodX), geo.topY(hoodX)) + 2;
    add('engine', partImage(sc, S.engineSide(m.engine)), hoodX, hy, false, Math.min(1, Math.max(0.05, hoodLen / 90)), slope);
    add('body', partImage(sc, S.bodySide(L, geo, m.paint, { body: m.body, shape: m.shape })), 0, 0);
    P.paint.push(...P.body); P.shape.push(...P.body);
    const ex = S.exhaustSide(m.engine);
    if (ex) { const pipe = partImage(sc, ex).setPosition(geo.rear + 4, geo.bottom + 3); this.bumperG.add(pipe); P.engine.push(pipe); }
    // extras on top
    const [r0, r1] = geo.cabinTopRange;
    const rearDeckX = geo.rear + 28;
    const rearDeckY = geo.topY(rearDeckX) + 2;
    switch (m.extra) {
      case 'extra.roofRack': {
        const w = Math.max(70, (r1 - r0) * 0.9), cx = (r0 + r1) / 2;
        const legH = Math.round(Math.max(10, geo.topY(cx - w / 2) - geo.roofTop + 6));
        add('extra', partImage(sc, S.rackSide(w, legH, L.compactRack)), cx, geo.roofTop + 2);
        break;
      }
      case 'extra.spoiler': add('extra', partImage(sc, S.spoilerSide(m.paint)), rearDeckX, rearDeckY); break;
      case 'extra.snorkel': {
        const x = cabinFront + 4, y0 = geo.topY(x) + 4;
        add('extra', partImage(sc, S.snorkelSide(Math.round(y0 - geo.roofTop + 26))), x, y0);
        break;
      }
      case 'extra.winch': {
        const winch = partImage(sc, S.winchSide()).setPosition(geo.front + 8, geo.bottom - 4);
        winch.setScale(winch.scaleX * 0.65, winch.scaleY * 0.65);
        this.bumperG.add(winch);
        P.extra.push(winch);
        break;
      }
      default: break;
    }
    // bumpers
    const bl = BUMPER[m.bumpers] ?? BUMPER['bumpers.small'];
    const by = (side: 'f' | 'r') => geo.bottom - Math.min(bl.h / 2 + 4, (b.chH * (side === 'f' ? L.shape.noseK : L.shape.tailK)) / 2 + 2);
    const frontBumper = partImage(sc, S.bumperSide(m.bumpers)).setPosition(geo.front - 6, by('f'));
    const rearBumper = partImage(sc, S.bumperSide(m.bumpers));
    rearBumper.setPosition(geo.rear + 6, by('r')).setScale(-rearBumper.scaleX * bl.rear, rearBumper.scaleY * bl.rear);
    this.bumperG.add([frontBumper, rearBumper]); P.bumpers.push(frontBumper, rearBumper);
    // wheels + springs
    for (const [wc, ax] of [[this.wheelF, geo.frontAxle], [this.wheelR, geo.rearAxle]] as const) {
      const wi = partImage(sc, S.wheelSide(wheelId));
      wc.add(wi);
      wc.setPosition(ax, geo.hubY).setScale(geo.wheelRadius / L.wheel.r);
      P.wheels.push(wi);
    }
    const sp = SPRING[m.springs] ?? SPRING['springs.soft'];
    const H = sp.lift + WS_ART.raceRideRaise + 26 + (m.springs === 'springs.bouncy' ? 6 : 0);
    for (const ax of [geo.frontAxle, geo.rearAxle]) {
      const img = partImage(sc, S.springSide(m.springs, H), ax, geo.hubY);
      this.springG.add(img);
      this.springs.push({ img, h: H });
      P.springs.push(img);
    }
    P.size.push(this.bodyG);
    this.cy = -geo.roofTop / 2;
    const fx = (a: string, x: number, y: number, zoom: number) => { this.foci[a] = { x, y, zoom }; };
    fx('wheels', geo.frontAxle, geo.hubY, 2.2); fx('engine', hoodX, hy - 10, 2.4); fx('gears', 0, midY, 2.6);
    fx('springs', geo.frontAxle, geo.hubY - 20, 2.6); fx('bumpers', geo.front, midY, 2.4);
    fx('paint', 0, -geo.height * 0.45, 1.5); fx('body', 0, -geo.height * 0.45, 1.4); fx('shape', 0, -geo.height * 0.45, 1.4);
    fx('size', 0, -geo.height / 2, 1);
    const ex2: Record<string, [number, number]> = {
      'extra.roofRack': [(r0 + r1) / 2, geo.roofTop - 20], 'extra.rocket': [geo.rear - 40, geo.bottom - 20],
      'extra.floats': [0, geo.bottom + 4], 'extra.spoiler': [rearDeckX, rearDeckY - 22],
      'extra.snorkel': [cabinFront, geo.roofTop - 10], 'extra.winch': [geo.front + 13, geo.bottom - 14],
    };
    const e = ex2[m.extra] ?? [0, -geo.height / 2];
    fx('extra', e[0], e[1], 2);
    if (m.extra === 'extra.rocket') this.anchors.exhaust = { x: geo.rear - 100, y: geo.bottom - L.body.chH * 0.45 };
  }

  private constructTop(add: (a: string, i: Img, x: number, y: number, f?: boolean, s?: number, r?: number) => Img, wheelId: string): void {
    const { scene: sc, model: m, L, geo } = this;
    const { body: b } = L;
    const P = this.parts;
    const hw = b.hw, cw = hw * 0.76;
    const c0 = geo.cabin[0].x, c1 = geo.cabin[3].x;
    if (m.extra === 'extra.rocket') {
      add('extra', partImage(sc, T.rocketTop()), geo.rear + 8, 0);
      this.flame = add('extra', partImage(sc, S.flameSide()), geo.rear - 96, 0, false, 1);
      this.flame.setScale(this.flame.scaleX, this.flame.scaleY * 0.8);
    }
    if (m.extra === 'extra.floats') for (const sy of [-1, 1]) add('extra', partImage(sc, T.floatTop(b.len * 0.6)), 0, sy * (hw + 4));
    add('body', partImage(sc, T.bodyTop(L, m.paint, { body: m.body, shape: m.shape })), 0, 0);
    P.paint.push(...P.body); P.shape.push(...P.body);
    const hoodLen = geo.front - c1;
    add('engine', partImage(sc, T.engineTop(m.engine)), (c1 + geo.front) / 2, 0, false, Math.min(1, Math.max(0.05, hoodLen / 80)));
    const ex = T.exhaustTop(m.engine, hw);
    if (ex) { const pipe = partImage(sc, ex).setPosition(geo.rear + 4, 0); this.bumperG.add(pipe); P.engine.push(pipe); }
    switch (m.extra) {
      case 'extra.roofRack': add('extra', partImage(sc, T.rackTop((c1 - c0) * 0.8, cw * 1.5, L.compactRack)), (c0 + c1) / 2, 0); break;
      case 'extra.spoiler': add('extra', partImage(sc, T.spoilerTop(hw, m.paint)), geo.rear + 28, 0); break;
      case 'extra.snorkel': add('extra', partImage(sc, T.snorkelTop()), c1 - 4, -cw); break;
      case 'extra.winch': add('extra', partImage(sc, T.winchTop()), geo.front + 12, 0, false, 0.65); break;
      default: break;
    }
    const frontBumper = partImage(sc, T.bumperTop(m.bumpers, hw)).setPosition(geo.front - 10, 0);
    const rearScale = BUMPER[m.bumpers]?.rear ?? 1;
    const rearBumper = partImage(sc, T.bumperTop(m.bumpers, hw));
    rearBumper.setPosition(geo.rear + 10, 0).setScale(-rearBumper.scaleX * rearScale, rearBumper.scaleY * rearScale);
    this.bumperG.add([frontBumper, rearBumper]); P.bumpers.push(frontBumper, rearBumper);
    const wheelScale = geo.wheelRadius / L.wheel.r;
    const wy = hw - 4 + L.wheel.topW * wheelScale * 0.25 + Math.max(0, geo.wheelRadius - 55) * 0.34;
    for (const [wc, ax] of [[this.wheelF, geo.frontAxle], [this.wheelR, geo.rearAxle]] as const) {
      wc.setPosition(ax, 0);
      for (const sy of [-1, 1]) {
        const wi = partImage(sc, T.wheelTop(wheelId), 0, sy * wy);
        wi.setScale(wi.scaleX * wheelScale);
        wc.add(wi);
        P.wheels.push(wi);
      }
    }
    P.size.push(this.bodyG);
    this.anchors = {
      wheelFront: { x: geo.frontAxle, y: 0 }, wheelRear: { x: geo.rearAxle, y: 0 }, exhaust: { x: geo.rear - 14, y: 0 },
      roof: { x: (c0 + c1) / 2, y: 0 }, front: { x: geo.front, y: 0 }, back: { x: geo.rear, y: 0 },
    };
    this.cy = 0;
  }

  protected render(): void {
    const S0 = this.S;
    const side = this.view === 'side';
    this.world.setScale(S0.sx, S0.sy);
    this.world.x = S0.shakeX;
    this.pivot.y = (side ? -this.cy : 0) - (side ? S0.lift : 0);
    this.pivot.rotation = S0.roll;
    // Side view: the body rides raiseY higher on its (longer) springs. Done here rather than in raceGeom() so the
    // painted body PNGs (keyed by geometry) stay valid.
    const raiseY = side ? WS_ART.raceRideRaise : 0;
    this.bodyG.y = (side ? -S0.bob : S0.bob * 0.3) - raiseY;
    this.bodyG.rotation = S0.tilt;
    this.bumperG.y = -raiseY;
    this.springG.y = this.bodyG.y + raiseY;
    if (side) {
      this.wheelF.rotation = S0.spin; this.wheelR.rotation = S0.spin;
      for (const sp of this.springs) sp.img.setScale(sp.img.scaleX, (1 + S0.bob / sp.h) / 1.5);
    }
    if (this.flame) this.flame.setScale(S0.flame / 1.5, (side ? 1 : 0.8) / 1.5);
  }
}
