import Phaser from 'phaser';
import { CAT, GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { cityGen } from '../../world/gen';
import { buildWorld, type BuiltWorld } from '../../world/WorldBuilder';
import type { WorldData } from '../../core/types';

/**
 * Dev scene: ?dev=WorldTest[&seed=N][&x=px&y=px&zoom=z&split=1]
 * WASD/arrows fly, Q/E zoom, M overview, C split cam, B matter debug, Space spawn box car
 * (drive it with I/J/K/L), F follow box.
 * Test hooks: window.__worldTest = { world, built, scene }.
 */
export default class WorldTest extends Phaser.Scene {
  private world!: WorldData;
  private built!: BuiltWorld;
  private cam2?: Phaser.Cameras.Scene2D.Camera;
  private fps: Phaser.GameObjects.Text[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private box?: Phaser.GameObjects.Rectangle;
  private follow = false;
  private debugOn = false;

  constructor() { super('WorldTest'); }

  create(): void {
    const q = new URLSearchParams(location.search);
    const seed = Number(q.get('seed') ?? 3);
    this.world = cityGen(seed);
    this.built = buildWorld(this, this.world);
    const b = this.built.bounds;
    this.matter.world.setBounds(b.x, b.y, b.w, b.h);
    const sp = this.world.playerSpawns[0];
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b2a4a');
    cam.setZoom(Number(q.get('zoom') ?? 0.62));
    cam.centerOn(Number(q.get('x') ?? sp.x), Number(q.get('y') ?? sp.y));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,I,J,K,L') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-M', () => this.overview());
    kb.on('keydown-C', () => this.toggleSplit());
    kb.on('keydown-B', () => this.toggleDebug());
    kb.on('keydown-F', () => { this.follow = !this.follow; });
    kb.on('keydown-SPACE', () => this.spawnBox());

    this.fps.push(this.makeFps());
    if (q.get('split') === '1') this.toggleSplit();
    if (q.get('overview') === '1') this.overview();
    if (q.get('debug') === '1') this.toggleDebug();
    (window as unknown as Record<string, unknown>).__worldTest = { world: this.world, built: this.built, scene: this };
  }

  private makeFps(): Phaser.GameObjects.Text {
    return this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', backgroundColor: '#000000aa' })
      .setScrollFactor(0).setDepth(1000).setOrigin(0, 0);
  }

  private overview(): void {
    const cam = this.cameras.main;
    const b = this.built.bounds;
    const vw = cam.width, vh = cam.height;
    cam.setZoom(Math.min(vw / b.w, vh / b.h));
    cam.centerOn(b.w / 2, b.h / 2);
    if (this.cam2) {
      this.cam2.setZoom(cam.zoom);
      this.cam2.centerOn(b.w / 2, b.h / 2);
    }
  }

  private toggleDebug(): void {
    this.debugOn = !this.debugOn;
    if (this.debugOn) this.matter.world.createDebugGraphic();
    this.matter.world.drawDebug = this.debugOn;
    if (!this.debugOn) this.matter.world.debugGraphic?.clear();
    this.matter.world.debugGraphic?.setVisible(this.debugOn).setDepth(900);
  }

  private toggleSplit(): void {
    const cam = this.cameras.main;
    if (this.cam2) {
      this.cameras.remove(this.cam2);
      this.cam2 = undefined;
      cam.setViewport(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.fps[1]?.destroy();
      this.fps.length = 1;
      this.fps[0].setVisible(true);
      return;
    }
    const half = GAME_WIDTH / 2;
    cam.setViewport(0, 0, half - 2, GAME_HEIGHT);
    const c2 = this.cameras.add(half + 2, 0, half - 2, GAME_HEIGHT);
    c2.setBackgroundColor('#0b2a4a').setZoom(cam.zoom);
    c2.centerOn(cam.midPoint.x + 800, cam.midPoint.y);
    this.cam2 = c2;
    const t2 = this.makeFps();
    this.fps.push(t2);
    // each fps readout visible only to its own camera
    c2.ignore(this.fps[0]);
    cam.ignore(t2);
    if (this.matter.world.debugGraphic) { /* debug draws in both cameras; fine */ }
  }

  private spawnBox(): void {
    if (this.box) return;
    const cam = this.cameras.main;
    const r = this.add.rectangle(cam.midPoint.x, cam.midPoint.y, 64, 36, 0xff5533).setDepth(20);
    this.matter.add.gameObject(r, {
      mass: 14, frictionAir: 0.08, friction: 0.02, frictionStatic: 0, restitution: 0.3,
      collisionFilter: { category: CAT.player, mask: 0xffff, group: 0 },
    });
    this.box = r;
    this.follow = true;
    this.cam2?.ignore(this.fps[0]);
  }

  update(_t: number, dtMs: number): void {
    const dt = dtMs / 1000;
    const cam = this.cameras.main;
    const k = this.keys;
    const speed = 1800 / cam.zoom;
    let dx = 0, dy = 0;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    if (dx || dy) this.follow = false;
    let z = 0;
    if (k.Q.isDown) z -= 1;
    if (k.E.isDown) z += 1;
    if (z) {
      const nz = Phaser.Math.Clamp(cam.zoom * Math.pow(1.8, z * dt), 0.1, 3);
      cam.setZoom(nz);
      this.cam2?.setZoom(nz);
    }
    const body = this.box?.body as MatterJS.BodyType | undefined;
    if (this.box && body) {
      const turn = (k.L.isDown ? 1 : 0) - (k.J.isDown ? 1 : 0);
      const thr = (k.I.isDown ? 1 : 0) - (k.K.isDown ? 1 : 0);
      if (turn) this.matter.body.setAngularVelocity(body, turn * 0.07);
      if (thr) {
        const a = body.angle, f = 0.0012 * thr * body.mass;
        this.matter.body.applyForce(body, body.position, { x: Math.cos(a) * f, y: Math.sin(a) * f });
      }
      if (this.follow) {
        cam.centerOn(this.box.x, this.box.y);
        if (this.cam2) this.cam2.centerOn(this.box.x + 900, this.box.y);
      }
    }
    if (dx || dy) {
      const m = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed * dt);
      cam.scrollX += m.x; cam.scrollY += m.y;
      if (this.cam2) { this.cam2.scrollX += m.x; this.cam2.scrollY += m.y; }
    }

    // fps readouts: scrollFactor-0 text under zoom -> compensate so it appears at the viewport corner
    const fpsStr = `${this.game.loop.actualFps.toFixed(0)} fps  z${cam.zoom.toFixed(2)}`;
    const cams = [cam, this.cam2];
    this.fps.forEach((t, i) => {
      const c = cams[i];
      if (!c) return;
      t.setText(fpsStr);
      t.setScale(1 / c.zoom);
      t.setPosition(c.width / 2 - (c.width / 2 - 10) / c.zoom, c.height / 2 - (c.height / 2 - 10) / c.zoom);
    });
  }
}
