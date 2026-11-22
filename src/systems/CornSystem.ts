import Phaser from 'phaser';
import { DEPTH, FARM_CORN } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId, Rect } from '../core/types';
import { pxToTile, tileAt } from '../world/geometry';
import { dragFor, needsStamp, shouldSpringBack, speedMultFor, surfaceOfTile, type Surface } from './cornTrack';

interface Stamp { img: Phaser.GameObjects.Image; born: number }
interface Track { lastX: number; lastY: number; surface: Surface; rustleAt: number; puffAcc: number; phase: number }

/** Farm only: corn and mud slow cars; driven-through corn flattens into a trail that springs back off screen. */
export class CornSystem implements GameSystem {
  readonly name = 'corn';
  static order = 75;
  private ctx!: RaceContext;
  private active = false;
  private pool: Stamp[] = [];
  private next = 0;
  private cullT = 0;
  private tracks = new Map<IVehicle, Track>();
  private puffs = 0;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.active = ctx.settings.map === 'farm';
  }

  private surfaceAt(x: number, y: number): Surface {
    const w = this.ctx.world;
    return surfaceOfTile(tileAt(w, pxToTile(x, w.tileSize), pxToTile(y, w.tileSize)));
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.active) return;
    const now = ctx.elapsedSec;
    for (const car of ctx.players) {
      const off = car.airborne || car.riding || car.disabled;
      this.drive(car, car.player, off, dt, now);
    }
    for (const npc of ctx.npcs) {
      if (!npc.destroyed) this.drive(npc, -1, false, dt, now);
    }
    this.cullT += dt;
    if (this.cullT >= FARM_CORN.cullEverySec) {
      this.cullT = 0;
      this.cull(now);
      for (const v of [...this.tracks.keys()]) {
        if (!(ctx.players as IVehicle[]).includes(v) && !(ctx.npcs as Set<IVehicle>).has(v)) this.tracks.delete(v);
      }
    }
  }

  private drive(v: IVehicle, player: number, off: boolean, dt: number, now: number): void {
    let tr = this.tracks.get(v);
    if (!tr) {
      tr = { lastX: v.x, lastY: v.y, surface: 'none', rustleAt: 0, puffAcc: 0, phase: Math.random() * 6 };
      this.tracks.set(v, tr);
    }
    const surface: Surface = off ? 'none' : this.surfaceAt(v.x, v.y);
    const prev = tr.surface;
    tr.surface = surface;
    if (surface === 'none') { tr.lastX = v.x; tr.lastY = v.y; return; }
    const vel = v.velocity;
    const speed = Math.hypot(vel.x, vel.y);

    // Slowdown: players via slow() (renewed each frame), NPCs by bleeding speed above the cap.
    const mult = speedMultFor(surface);
    if (player >= 0) this.ctx.players[player].slow(mult, 0.12);
    else {
      const cap = v.spec.maxSpeed * mult;
      if (speed > cap) {
        const k = ((speed - cap) / speed) * (1 - Math.exp(-3 * dt));
        v.applyImpulse(-vel.x * k, -vel.y * k);
      }
    }
    if (speed > 1) {
      const k = 1 - Math.exp(-dragFor(surface) * dt);
      v.applyImpulse(-vel.x * k, -vel.y * k);
    }
    const plowing = speed >= FARM_CORN.minPlowSpeed;
    const pan = this.pan(player);
    const fx = Math.cos(v.angle), fy = Math.sin(v.angle);

    if (surface === 'mud') {
      if (plowing) {
        tr.phase += dt * FARM_CORN.mudWobbleHz * Math.PI * 2;
        const side = Math.sin(tr.phase) * FARM_CORN.mudWobble * Math.min(1, speed / Math.max(1, v.spec.maxSpeed)) * dt;
        v.applyImpulse(-fy * side, fx * side);
      }
      if (prev !== 'mud') {
        services.audio.sfx('mudSplash', { pan });
        this.puff(v.x, v.y, FARM_CORN.splashCount, FARM_CORN.mudTint, 130);
      }
      return;
    }

    if (!plowing) return;
    if (needsStamp(tr.lastX, tr.lastY, v.x, v.y)) {
      tr.lastX = v.x; tr.lastY = v.y;
      this.stamp(v.x + fx * 4, v.y + fy * 4, v.angle, now);
    }
    if (now - tr.rustleAt >= FARM_CORN.rustleEverySec) {
      tr.rustleAt = now;
      services.audio.sfx('cornRustle', { pan, volume: FARM_CORN.rustleVolume });
    }
    tr.puffAcc += dt * FARM_CORN.puffsPerSec;
    while (tr.puffAcc >= 1) {
      tr.puffAcc -= 1;
      const t = FARM_CORN.leafTints;
      this.puff(v.x + fx * v.spec.length * 0.5, v.y + fy * v.spec.length * 0.5, 1, t[Math.floor(Math.random() * t.length)], 70, v.angle);
    }
  }

  private pan(player: number): number {
    if (player < 0 || this.ctx.players.length < 2) return 0;
    return player % 2 === 0 ? -FARM_CORN.pan : FARM_CORN.pan;
  }

  private stamp(x: number, y: number, angle: number, now: number): void {
    let st = this.pool[this.next];
    if (!st) {
      st = { img: this.ctx.scene.add.image(0, 0, TEX.farm.cornFlat).setDepth(DEPTH.decal + 1), born: 0 };
      this.pool[this.next] = st;
    }
    this.next = (this.next + 1) % FARM_CORN.stampPool; // oldest-first recycling
    const j = FARM_CORN.stampJitterPx;
    st.born = now;
    st.img.setPosition(x + (Math.random() - 0.5) * 2 * j, y + (Math.random() - 0.5) * 2 * j)
      .setRotation(angle + (Math.random() - 0.5) * 2 * FARM_CORN.stampJitterRad)
      .setScale(FARM_CORN.stampScale).setAlpha(FARM_CORN.stampAlpha).setVisible(true);
  }

  /** Corn outside every player view (plus margin) stands back up: nothing is remembered off screen. */
  private cull(now: number): void {
    const views: Rect[] = [];
    for (let i = 0; i < this.ctx.players.length; i++) views.push(this.ctx.camera.worldView(i as PlayerId));
    for (const st of this.pool) {
      if (st.img.visible && shouldSpringBack(st.img.x, st.img.y, now - st.born, views)) st.img.setVisible(false);
    }
  }

  /** Cosmetic puffs; `dir` (radians) makes a forward-facing cone, otherwise a full ring. */
  private puff(x: number, y: number, n: number, tint: number, dist: number, dir?: number): void {
    const s = this.ctx.scene;
    for (let i = 0; i < n; i++) {
      if (this.puffs >= FARM_CORN.puffMax) return;
      const a = dir === undefined ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * 2.2;
      const d = dist * (0.5 + Math.random() * 0.7);
      const img = s.add.image(x, y, TEX.fxDust).setTint(tint).setAlpha(0.85).setDepth(DEPTH.fx).setScale(0.35);
      this.puffs++;
      s.tweens.add({
        targets: img, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0.9, alpha: 0, angle: (Math.random() - 0.5) * 200,
        duration: 450, ease: 'Cubic.easeOut', onComplete: () => { img.destroy(); this.puffs--; },
      });
    }
  }

  destroy(): void {
    for (const st of this.pool) st.img.destroy();
    this.pool = [];
    this.tracks.clear();
  }
}
