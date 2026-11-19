import Phaser from 'phaser';
import { CAT, COLLISION, DEFAULT_SETTINGS, DEPTH, VEHICLE_MODEL } from '../../config/gameConfig';
import { TEX } from '../../core/assetKeys';
import { bus } from '../../core/events';
import type { BodyOwner, ICameraRig, RaceContext } from '../../core/race';
import { Rng } from '../../core/rng';
import { services } from '../../core/services';
import type { CameraLayout, PlayerId, PlayerInput, Rect, WorldData } from '../../core/types';
import { PlayerCar } from '../../entities/PlayerCar';
import { SkidMarks } from '../../fx/SkidMarks';
import { CollisionSystem } from '../../systems/CollisionSystem';

const W = 4000, H = 3000;
const SPAWNS = [{ x: 500, y: 500, a: 0 }, { x: 500, y: 760, a: 0 }];

/**
 * Dev scene (?dev=DriveTest): driving arena. P0 = dino (keyboard WASD or pad 0), P1 = kart (arrows or pad 1).
 * T turbo P0 - G ghost P0 - J airborne 1 s (P0) - R reset.
 * Optional query: ?substeps=N splits each Matter update into N sub-steps.
 */
export default class DriveTest extends Phaser.Scene {
  private cars: PlayerCar[] = [];
  private skids!: SkidMarks;
  private collisions = new CollisionSystem();
  private ctx!: RaceContext;
  private hud!: Phaser.GameObjects.Text;
  private crashLog: string[] = [];
  private keys!: Record<'T' | 'G' | 'J' | 'R', Phaser.Input.Keyboard.Key>;
  private substeps = 1;

  constructor() { super('DriveTest'); }

  create() {
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.setBackgroundColor('#2f6b32');
    const eng = this.matter.world.engine;
    eng.positionIterations = VEHICLE_MODEL.positionIterations;
    eng.velocityIterations = VEHICLE_MODEL.velocityIterations;
    this.substeps = Math.max(1, Number(new URLSearchParams(location.search).get('substeps') ?? 1) | 0);
    if (this.substeps > 1) this.matter.world.autoUpdate = false;

    this.buildGround();
    this.buildArena();

    this.skids = new SkidMarks(this);
    this.cars = [
      new PlayerCar(this, 0, 'dino', SPAWNS[0].x, SPAWNS[0].y, SPAWNS[0].a, this.skids),
      new PlayerCar(this, 1, 'kart', SPAWNS[1].x, SPAWNS[1].y, SPAWNS[1].a, this.skids),
    ];

    // inputs: keyboard layouts by default, gamepads override
    services.input.reset();
    services.input.assign(0, { type: 'keyboard', layout: 'left' });
    services.input.assign(1, { type: 'keyboard', layout: 'right' });

    const camStub: ICameraRig = {
      layout: (): CameraLayout => ({ mode: 'single', playerViews: [] }),
      worldView: (): Rect => { const v = this.cameras.main.worldView; return { x: v.x, y: v.y, w: v.width, h: v.height }; },
      shake: (_p, intensity, ms) => this.cameras.main.shake(ms, intensity),
      shakeAt: (_x, _y, _r, intensity, ms) => this.cameras.main.shake(ms, intensity),
      worldToScreen: (_p, x, y) => { const c = this.cameras.main; return { x: (x - c.worldView.x) * c.zoom, y: (y - c.worldView.y) * c.zoom }; },
      viewRotation: () => 0,
      showOnlyTo: () => {},
    };
    this.ctx = {
      scene: this, bus, world: {} as WorldData, settings: DEFAULT_SETTINGS, rng: new Rng(1),
      players: this.cars, npcs: new Set(), goal: null,
      dino: { active: false, x: 0, y: 0, angle: 0, radius: 0 }, camera: camStub,
      elapsedSec: 0, roundLengthSec: 300, paused: false, questionBreak: false,
    };
    this.collisions.init(this.ctx);
    bus.on('vehicle:crash', (e) => {
      this.crashLog.unshift(`P${e.player} ${e.with} ${e.impact.toFixed(0)}`);
      this.crashLog.length = Math.min(this.crashLog.length, 4);
    });

    const kb = this.input.keyboard!;
    this.keys = {
      T: kb.addKey('T'), G: kb.addKey('G'), J: kb.addKey('J'), R: kb.addKey('R'),
    };
    this.hud = this.add.text(20, 16, '', { fontFamily: 'monospace', fontSize: '30px', color: '#ffffff', backgroundColor: '#000000aa', lineSpacing: 4 })
      .setScrollFactor(0).setDepth(200);

    this.cameras.main.centerOn(SPAWNS[0].x, SPAWNS[0].y);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.collisions.destroy(); this.skids.destroy(); });
    (window as unknown as { __drive: unknown }).__drive = { scene: this, cars: this.cars, ctx: this.ctx };
  }

  private buildGround() {
    if (this.textures.exists(TEX.tileGrass)) {
      this.add.tileSprite(0, 0, W, H, TEX.tileGrass).setOrigin(0).setDepth(DEPTH.ground);
    }
    const g = this.add.graphics().setDepth(DEPTH.ground + 1);
    g.lineStyle(2, 0x000000, 0.12);
    for (let x = 0; x <= W; x += 128) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 128) g.lineBetween(0, y, W, y);
    // asphalt under the 2x2 city block test (blocks sit on top, leaving 128 px roads)
    g.fillStyle(0x444a52, 1);
    g.fillRect(400 - 128, 1650 - 128, 2 * 600 + 128 + 256, 2 * 600 + 128 + 256);
  }

  private owner(o: BodyOwner) { return o; }

  private addWall(x: number, y: number, w: number, h: number, owner: BodyOwner, color = 0x8a8f98) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, color).setStrokeStyle(4, 0x40454d).setDepth(DEPTH.building);
    this.matter.add.gameObject(r, {
      shape: { type: 'rectangle' }, isStatic: true, restitution: 0.3, friction: 0.02, frictionStatic: 0,
      collisionFilter: { category: CAT.static, mask: 0xffff },
    });
    (r.body as MatterJS.BodyType & { plugin: { owner?: BodyOwner } }).plugin.owner = owner;
  }

  private buildArena() {
    const T = 100;
    const boundary = this.owner({ kind: 'boundary' });
    this.addWall(-T, -T, W + 2 * T, T, boundary, 0x203040);
    this.addWall(-T, H, W + 2 * T, T, boundary, 0x203040);
    this.addWall(-T, 0, T, H, boundary, 0x203040);
    this.addWall(W, 0, T, H, boundary, 0x203040);

    // 2x2 city blocks with 128 px roads between them (corner test)
    const S = 600, gap = 128, ox = 400, oy = 1650;
    let id = 1;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      this.addWall(ox + i * (S + gap), oy + j * (S + gap), S, S, { kind: 'building', buildingId: id++ }, 0xb86a4b);
    }
    // a lone thin wall and a wall to hit head-on at speed
    this.addWall(2400, 1700, 40, 800, { kind: 'building', buildingId: id++ }, 0xb86a4b);
    this.addWall(3000, 400, 300, 300, { kind: 'building', buildingId: id++ }, 0xb86a4b);
    this.addWall(3500, 1000, 30, 400, { kind: 'building', buildingId: id++ }, 0xb86a4b); // thin: tunneling test

    // loose crates
    for (let i = 0; i < 8; i++) this.addProp(1600 + (i % 4) * 70, 900 + Math.floor(i / 4) * 70, 40, 0xc68642, 'rect');
    // slalom of cones
    for (let i = 0; i < 9; i++) this.addProp(1000 + i * 220, 1200 + (i % 2 ? 70 : -70), 24, 0xff7a1a, 'circle');
  }

  private addProp(x: number, y: number, size: number, color: number, shape: 'rect' | 'circle') {
    const go = shape === 'rect'
      ? this.add.rectangle(x, y, size, size, color).setStrokeStyle(3, 0x5a3a14)
      : this.add.circle(x, y, size / 2, color).setStrokeStyle(3, 0xffffff);
    go.setDepth(DEPTH.prop);
    this.matter.add.gameObject(go, {
      shape: { type: shape === 'rect' ? 'rectangle' : 'circle' },
      frictionAir: 0.06, friction: 0.1, frictionStatic: 0, restitution: 0.3, density: 0.0008,
      collisionFilter: { category: CAT.prop, mask: 0xffff },
    });
    (go.body as MatterJS.BodyType & { plugin: { owner?: BodyOwner } }).plugin.owner = { kind: 'prop', prop: go };
  }

  private reset() {
    this.cars.forEach((c, i) => { c.setPose(SPAWNS[i].x, SPAWNS[i].y, SPAWNS[i].a); c.setTurbo(false); c.setGhost(false); c.setAirborne(false); });
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    services.input.poll();
    const pads = services.input.devices().filter((d) => d.type === 'gamepad');
    if (pads[0]) services.input.assign(0, pads[0]);
    if (pads[1]) services.input.assign(1, pads[1]);

    const J = Phaser.Input.Keyboard.JustDown;
    const p0 = this.cars[0];
    if (J(this.keys.T)) p0.setTurbo(!p0.turbo);
    if (J(this.keys.G)) p0.setGhost(!p0.ghost);
    if (J(this.keys.J)) { p0.setAirborne(true); this.time.delayedCall(1000, () => p0.setAirborne(false)); }
    if (J(this.keys.R)) this.reset();

    this.ctx.elapsedSec += dt;
    // test hook: window.__pilot(i, car) may return a PlayerInput to drive a car from scripts
    const pilot = (window as unknown as { __pilot?: (i: number, c: PlayerCar) => PlayerInput | null }).__pilot;
    this.cars.forEach((c, i) => c.update(pilot?.(i, c) ?? services.input.get(i as PlayerId), dt));
    if (this.substeps > 1) for (let i = 0; i < this.substeps; i++) this.matter.world.step(deltaMs / this.substeps);
    this.collisions.update(dt, this.ctx);
    this.skids.update(dt);

    // camera: P0, or the midpoint when both cars are moving
    const moving = this.cars.map((c) => Math.hypot(c.velocity.x, c.velocity.y) > 60);
    let tx = p0.x, ty = p0.y;
    if (moving[0] && moving[1]) { tx = (this.cars[0].x + this.cars[1].x) / 2; ty = (this.cars[0].y + this.cars[1].y) / 2; }
    else if (!moving[0] && moving[1]) { tx = this.cars[1].x; ty = this.cars[1].y; }
    const cam = this.cameras.main;
    cam.centerOn(cam.midPoint.x + (tx - cam.midPoint.x) * 0.12, cam.midPoint.y + (ty - cam.midPoint.y) * 0.12);

    const lines = this.cars.map((c, i) => {
      const v = c.velocity;
      return `P${i} ${c.kind}  spd ${Math.hypot(v.x, v.y).toFixed(0).padStart(4)}  fwd ${c.forwardSpeed.toFixed(0).padStart(4)}  frac ${c.speedFrac.toFixed(2)}  slip ${c.lateralSpeed.toFixed(0).padStart(4)}${c.turbo ? ' TURBO' : ''}${c.ghost ? ' GHOST' : ''}${c.airborne ? ' AIR' : ''}`;
    });
    this.hud.setText([...lines, `[T]urbo [G]host [J]ump [R]eset  crash>${COLLISION.minImpact}`, ...this.crashLog]);
  }
}
