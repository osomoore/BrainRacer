import Phaser from 'phaser';
import { CameraRig, type CameraTarget } from '../../camera/CameraRig';
import { PLAYER_COLORS } from '../../config/gameConfig';
import { EventBus } from '../../core/events';
import { services } from '../../core/services';
import type { CameraLayout, Rect, Vec2 } from '../../core/types';

const WORLD: Rect = { x: 0, y: 0, w: 6000, h: 6000 };
const SPEED = 600;
const OVERLAY_KEY = 'CameraTestOverlay';

/** Simple kinematic marker that satisfies CameraTarget. */
class Marker implements CameraTarget {
  x: number; y: number;
  velocity: Vec2 = { x: 0, y: 0 };
  turbo = false;
  angle = 0;
  readonly view: Phaser.GameObjects.Container;
  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    this.x = x; this.y = y;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillCircle(4, 6, 46);
    g.fillStyle(color, 1).fillCircle(0, 0, 44);
    g.lineStyle(6, 0xffffff, 1).strokeCircle(0, 0, 44);
    g.fillStyle(0xffffff, 1).fillTriangle(70, 0, 30, -24, 30, 24);
    this.view = scene.add.container(x, y, [g]).setDepth(20);
  }
  move(steer: number, fwd: number, dt: number) {
    const len = Math.hypot(steer, fwd) || 1;
    const sp = SPEED * (this.turbo ? 2 : 1);
    this.velocity = { x: (steer / len) * sp, y: (-fwd / len) * sp };
    this.x = Phaser.Math.Clamp(this.x + this.velocity.x * dt, 40, WORLD.w - 40);
    this.y = Phaser.Math.Clamp(this.y + this.velocity.y * dt, 40, WORLD.h - 40);
    this.view.setPosition(this.x, this.y);
    if (steer || fwd) this.angle = Phaser.Math.Angle.RotateTo(this.angle, Math.atan2(this.velocity.y, this.velocity.x), 4 * dt);
    this.view.setRotation(this.angle);
  }
}

/** Screen-space overlay (separate scene so it is not drawn by both world cameras). */
class Overlay extends Phaser.Scene {
  text!: Phaser.GameObjects.Text;
  divider!: Phaser.GameObjects.Graphics;
  constructor() { super(OVERLAY_KEY); }
  create() {
    this.divider = this.add.graphics();
    this.text = this.add.text(24, 1060, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 6 },
    }).setOrigin(0, 1);
  }
  /** Temporary divider drawn purely from camera:layout events (proves the contract). */
  setLayout(layout: CameraLayout) {
    this.divider.clear();
    if (layout.mode !== 'split') return;
    const r = layout.playerViews[1];
    this.divider.fillStyle(0x111111, 1).fillRect(r.x - 4, r.y, 8, r.h);
    this.divider.fillStyle(0xffffff, 1).fillRect(r.x - 2, r.y, 4, r.h);
  }
}

/** Dev scene (?dev=CameraTest): WASD = P1 (green), arrows = P2 (red), M = 1/2 players, T = turbo, K = shake. */
export default class CameraTest extends Phaser.Scene {
  private markers: Marker[] = [];
  private rig!: CameraRig;
  private bus = new EventBus();
  private overlay!: Overlay;
  private twoPlayers = true;
  private layoutLog: string[] = [];

  constructor() { super('CameraTest'); }

  create() {
    services.input.reset();
    services.input.assign(0, { type: 'keyboard', layout: 'left' });
    services.input.assign(1, { type: 'keyboard', layout: 'right' });
    this.drawWorld();
    this.markers = [
      new Marker(this, 2800, 3000, Phaser.Display.Color.HexStringToColor(PLAYER_COLORS[0]).color),
      new Marker(this, 3200, 3000, Phaser.Display.Color.HexStringToColor(PLAYER_COLORS[1]).color),
    ];

    if (!this.scene.get(OVERLAY_KEY)) this.scene.add(OVERLAY_KEY, Overlay, false);
    this.scene.launch(OVERLAY_KEY);
    this.overlay = this.scene.get(OVERLAY_KEY) as Overlay;

    this.bus.on('camera:layout', ({ layout }) => {
      this.layoutLog.push(layout.mode);
      if (this.overlay.divider) this.overlay.setLayout(layout);
      else this.overlay.events.once(Phaser.Scenes.Events.CREATE, () => this.overlay.setLayout(layout));
    });
    this.buildRig();

    const kb = this.input.keyboard!;
    kb.on('keydown-M', () => {
      this.twoPlayers = !this.twoPlayers;
      this.markers[1].view.setVisible(this.twoPlayers);
      this.buildRig();
    });
    kb.on('keydown-T', () => this.markers.forEach((m) => (m.turbo = !m.turbo)));
    kb.on('keydown-K', () => this.rig.shake(0, 0.01, 300));
    kb.on('keydown-L', () => this.rig.shakeAt(this.markers[1].x, this.markers[1].y, 900, 0.015, 400));

    (window as unknown as { __cameraTest: unknown }).__cameraTest = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rig.destroy();
      this.bus.clear();
      this.scene.stop(OVERLAY_KEY);
    });
  }

  private buildRig() {
    this.rig?.destroy();
    this.rig = new CameraRig(this, {
      targets: this.twoPlayers ? this.markers : [this.markers[0]],
      worldBounds: WORLD,
      bus: this.bus,
    });
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    services.input.poll();
    this.markers.forEach((m, i) => {
      const inp = services.input.get(i as 0 | 1);
      if (i === 1 && !this.twoPlayers) return;
      m.move(inp.steer, inp.throttle - inp.brake, dt);
    });
    this.rig.update(dt);

    const r = this.rig;
    const wv0 = r.worldView(0);
    this.overlay.text?.setText([
      `mode ${r.mode.padEnd(6)}  split ${r.splitAmount.toFixed(2)}  needed ${r.neededZoom.toFixed(3)}  ` +
        `cam0 z ${r.camZoom(0).toFixed(3)}  cam1 z ${r.camVisible(1) ? r.camZoom(1).toFixed(3) : '  -  '}`,
      `P1 ${fmtP(this.markers[0])}  P2 ${this.twoPlayers ? fmtP(this.markers[1]) : '-'}  ` +
        `rot0 ${r.viewRotation(0).toFixed(2)} view0 ${Math.round(wv0.x)},${Math.round(wv0.y)} ${Math.round(wv0.w)}x${Math.round(wv0.h)}  turbo ${this.markers[0].turbo ? 'on' : 'off'}`,
      'WASD / arrows move · M 1-2 players · T turbo · K shake P1 · L shakeAt P2',
    ]);
  }

  private drawWorld() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2d5a27, 1).fillRect(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    for (let v = 0; v <= WORLD.w; v += 250) {
      const major = v % 1000 === 0;
      g.lineStyle(major ? 8 : 2, major ? 0xe8e8e8 : 0x9ccc95, major ? 0.9 : 0.5);
      g.lineBetween(v, 0, v, WORLD.h);
      g.lineBetween(0, v, WORLD.w, v);
    }
    g.lineStyle(24, 0xff00ff, 1).strokeRect(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    const colors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1, 0x34495e];
    let n = 0;
    for (let y = 500; y < WORLD.h; y += 1000) {
      for (let x = 500; x < WORLD.w; x += 1000) {
        const c = colors[n++ % colors.length];
        g.fillStyle(c, 1);
        if (n % 3 === 0) g.fillCircle(x, y, 140);
        else if (n % 3 === 1) g.fillRect(x - 140, y - 140, 280, 280);
        else g.fillTriangle(x, y - 160, x - 150, y + 120, x + 150, y + 120);
      }
    }
    for (let y = 0; y <= WORLD.h; y += 1000) {
      for (let x = 0; x <= WORLD.w; x += 1000) {
        this.add.text(x + 12, y + 12, `${x},${y}`, { fontFamily: 'Arial', fontSize: '44px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setDepth(1);
      }
    }
  }
}

const fmtP = (m: Marker) => `${Math.round(m.x)},${Math.round(m.y)}`;
