import Phaser from 'phaser';
import { FARM_LOOK } from '../../config/gameConfig';
import { generateFarm } from '../../world/gen/farm';
import { buildWorld } from '../../world/WorldBuilder';

/**
 * Dev scene: ?dev=FarmView[&seed=N][&x=px&y=px][&zoom=z][&rot=deg]
 * Static look at the farm renderer (tiles, buildings, shadows, golden grade) with a free camera.
 * WASD/arrows pan, Q/E zoom, R/T rotate. Hook: window.__farmView = { world, built, scene }.
 */
export default class FarmView extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('FarmView'); }

  create(): void {
    const q = new URLSearchParams(location.search);
    const world = generateFarm(Number(q.get('seed') ?? 3));
    const built = buildWorld(this, world);
    const W = built.bounds.w, H = built.bounds.h;
    this.add.image(0, 0, '__WHITE').setOrigin(0).setDisplaySize(W, H)
      .setTint(FARM_LOOK.gradeColor).setAlpha(FARM_LOOK.gradeAlpha).setDepth(FARM_LOOK.gradeDepth);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#2a6fa0');
    cam.setZoom(Number(q.get('zoom') ?? 0.5));
    cam.setRotation((Number(q.get('rot') ?? 0) * Math.PI) / 180);
    cam.centerOn(Number(q.get('x') ?? W / 2), Number(q.get('y') ?? H / 2));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,R,T') as Record<string, Phaser.Input.Keyboard.Key>;
    (window as unknown as Record<string, unknown>).__farmView = { world, built, scene: this };
  }

  update(_t: number, dtMs: number): void {
    const cam = this.cameras.main, k = this.keys, dt = dtMs / 1000;
    const v = 900 / cam.zoom * dt;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    cam.scrollX += dx * v; cam.scrollY += dy * v;
    if (k.Q.isDown) cam.setZoom(cam.zoom * (1 - dt));
    if (k.E.isDown) cam.setZoom(cam.zoom * (1 + dt));
    if (k.R.isDown) cam.setRotation((cam as unknown as { rotation: number }).rotation - dt);
    if (k.T.isDown) cam.setRotation((cam as unknown as { rotation: number }).rotation + dt);
  }
}
