import Phaser from 'phaser';
import { CAR_SPECS, CAT, DEPTH, REWARDS, VEHICLE_MODEL } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { IPlayerCar } from '../core/race';
import { services } from '../core/services';
import type { CarKind, PlayerId, PlayerInput } from '../core/types';
import type { SkidMarks } from '../fx/SkidMarks';
import { PLAYER_MASK_ALL, Vehicle } from './Vehicle';

const MASK_GHOST = PLAYER_MASK_ALL & ~(CAT.traffic | CAT.police);
const CAR_COLORS: Record<CarKind, { body: number; stripe: number }> = {
  dino: { body: 0x2ecc40, stripe: 0x1a7a26 },
  kart: { body: 0xff3b30, stripe: 0xa3231b },
};

/** Texture `key` if it exists, else a generated fallback (rounded rect + darker front stripe). */
function carTexture(scene: Phaser.Scene, key: string, kind: CarKind, w: number, h: number): string {
  if (scene.textures.exists(key)) return key;
  const fb = `${key}_fallback`;
  if (!scene.textures.exists(fb)) {
    const c = CAR_COLORS[kind];
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(c.body, 1).fillRoundedRect(0, 0, w, h, 10);
    g.fillStyle(c.stripe, 1).fillRoundedRect(w * 0.72, 3, w * 0.24, h - 6, 5);
    g.fillStyle(0xcfefff, 1).fillRoundedRect(w * 0.5, 5, w * 0.14, h - 10, 3); // windscreen
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

export class PlayerCar extends Vehicle implements IPlayerCar {
  readonly player: PlayerId;
  readonly kind: CarKind;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private _turbo = false;
  private _ghost = false;
  private _airborne = false;
  private controlEnabled = true;
  private slowMult = 1;
  private slowLeft = 0;
  private visScale = 1;
  private lastSkid: ({ x: number; y: number } | null)[] = [null, null];
  /** True while laying skid marks (for debug). */
  skidding = false;

  constructor(
    scene: Phaser.Scene, player: PlayerId, kind: CarKind, x: number, y: number, angle: number,
    private readonly skids?: SkidMarks,
  ) {
    const spec = CAR_SPECS[kind];
    super(scene, spec, { x, y, angle, category: CAT.player, mask: PLAYER_MASK_ALL });
    this.player = player;
    this.kind = kind;
    this.setOwner({ kind: 'player', player, car: this });

    const key = carTexture(scene, kind === 'dino' ? TEX.carDino : TEX.carKart, kind, spec.length, spec.width);
    this.shadow = scene.add.image(0, 0, shadowTexture(scene)).setDisplaySize(spec.length * 1.1, spec.width * 1.2).setAlpha(0.35);
    this.sprite = scene.add.image(0, 0, key).setDisplaySize(spec.length, spec.width);
    this.view.add([this.shadow, this.sprite]);
    this.view.setDepth(DEPTH.vehicle);
    this.shadow.setPosition(3, 4);
  }

  get speedFrac() { return Math.abs(this.forwardSpeed) / this.currentMaxSpeed; }
  get airborne() { return this._airborne; }
  get turbo() { return this._turbo; }
  get ghost() { return this._ghost; }

  setTurbo(on: boolean): void {
    this._turbo = on;
    this.refreshMults();
  }

  setGhost(on: boolean): void {
    this._ghost = on;
    this.refreshFilter();
    this.view.setAlpha(on ? VEHICLE_MODEL.ghostAlpha : 1);
  }

  setAirborne(on: boolean): void {
    this._airborne = on;
    this.refreshFilter();
    this.view.setDepth(on ? DEPTH.airborne : DEPTH.vehicle);
  }

  slow(mult: number, sec: number): void {
    this.slowMult = mult;
    this.slowLeft = sec;
    this.refreshMults();
  }

  setControlEnabled(on: boolean): void { this.controlEnabled = on; }

  private refreshMults(): void {
    this.maxSpeedMult = (this._turbo ? REWARDS.turboSpeedMult : 1) * (this.slowLeft > 0 ? this.slowMult : 1);
    this.accelMult = this._turbo ? REWARDS.turboAccelMult : 1;
  }

  private refreshFilter(): void {
    this.body.collisionFilter.mask = this._airborne ? 0 : this._ghost ? MASK_GHOST : PLAYER_MASK_ALL;
  }

  update(input: PlayerInput, dt: number): void {
    if (this.slowLeft > 0) {
      this.slowLeft -= dt;
      if (this.slowLeft <= 0) { this.slowLeft = 0; this.refreshMults(); }
    }
    const on = this.controlEnabled;
    this.drive({ throttle: on ? input.throttle : 0, brake: on ? input.brake : 0, steer: on ? input.steer : 0 }, dt);
    this.syncView();
    this.updateVisual(dt);
    this.updateSkids(on ? input.brake : 0);
    services.audio.engine(this.player).set(Math.min(this.speedFrac, 1.5), this._turbo);
  }

  /** Airborne scale + shadow offset (eased). */
  private updateVisual(dt: number): void {
    const target = this._airborne ? VEHICLE_MODEL.airborneScale : 1;
    this.visScale += (target - this.visScale) * (1 - Math.exp(-14 * dt));
    this.sprite.setScale(this.visScale * this.spec.length / this.sprite.width, this.visScale * this.spec.width / this.sprite.height);
    const lift = (this.visScale - 1) / (VEHICLE_MODEL.airborneScale - 1); // 0..1
    // shadow offset is fixed in world space (down-right), so rotate into the car's local frame
    const ox = 3 + 26 * lift, oy = 4 + 34 * lift;
    const a = -this.angle;
    this.shadow.setPosition(ox * Math.cos(a) - oy * Math.sin(a), ox * Math.sin(a) + oy * Math.cos(a));
    this.shadow.setAlpha(0.35 - 0.12 * lift);
  }

  private updateSkids(brake: number): void {
    const M = VEHICLE_MODEL;
    const fwd = this.forwardSpeed;
    this.skidding = !this._airborne && (
      Math.abs(this.lateralSpeed) > M.skidLateralSpeed ||
      (brake > M.skidBrakeAmount && fwd > M.skidBrakeSpeed)
    );
    if (!this.skids || !this.skidding) { this.lastSkid = [null, null]; return; }
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    const rear = -this.spec.length * 0.32, side = this.spec.width * 0.4;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -side : side;
      const wx = this.x + cos * rear - sin * s;
      const wy = this.y + sin * rear + cos * s;
      const last = this.lastSkid[i];
      if (!last || Math.hypot(wx - last.x, wy - last.y) >= M.skidSpacing) {
        const heading = last ? Math.atan2(wy - last.y, wx - last.x) : this.angle;
        this.skids.add(wx, wy, heading, M.skidSpacing + 3);
        this.lastSkid[i] = { x: wx, y: wy };
      }
    }
  }

  destroy(): void {
    services.audio.engine(this.player).stop();
    this.destroyVehicle();
  }
}
