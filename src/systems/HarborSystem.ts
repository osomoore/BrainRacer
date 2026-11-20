import Phaser from 'phaser';
import { CAT, DEPTH, HARBOR, TILE_SIZE } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { Tile, type Vec2 } from '../core/types';
import { ParticlePool } from '../fx/ParticlePool';
import { tileAt } from '../world/geometry';
import { makeHarborDrawbridge } from '../world/harborBridges';
import { makeHarborLife } from '../world/harborLife';
import { makeHarborProps } from '../world/harborProps';
import { harborTexture } from '../world/harborTexture';

const TS = TILE_SIZE;
const BRIDGE = HARBOR.drawbridge;
const BEACH_TOP = 7 * TS, BEACH_BOTTOM = 41 * TS;

/** Harbor life runs on game time, so bridges, waves and people pause with the race. */
export class HarborSystem implements GameSystem {
  readonly name = 'harbor';
  private ctx?: RaceContext;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private updateProps?: ReturnType<typeof makeHarborProps>;
  private updateLife?: ReturnType<typeof makeHarborLife>;
  private updateDrawbridge?: ReturnType<typeof makeHarborDrawbridge>;
  private tracks?: ParticlePool;
  private lastTrack = new Map<IVehicle, Vec2>();
  private pushed = new Set<IVehicle>();
  private gate?: MatterJS.BodyType;
  private beam?: Phaser.GameObjects.Image;
  private ship?: Phaser.GameObjects.Image;
  private grade?: Phaser.GameObjects.Image;
  private wave?: Phaser.GameObjects.Image;
  private clock = 0;
  private cycle = 0;
  private tideClock = 10;
  private offEnd?: () => void;
  private ended = false;

  init(ctx: RaceContext): void {
    if (ctx.settings.map !== 'harbor') return;
    this.ctx = ctx;
    if (new URLSearchParams(location.search).get('harbor') === 'now') {
      this.cycle = HARBOR.bridgeCycleSec - HARBOR.bridgeOpenSec - 4;
      this.tideClock = HARBOR.tidePeriodSec - 2;
    }
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; });
    const s = ctx.scene;
    const texture = (name: string, w: number, h: number, fn: (c: CanvasRenderingContext2D) => void) => harborTexture(s, name, w, h, fn);
    const image = (x: number, y: number, key: string, depth: number) => {
      const i = s.add.image(x, y, key).setDepth(depth); this.objects.push(i); return i;
    };
    this.updateProps = makeHarborProps(ctx, this.objects);
    this.updateLife = makeHarborLife(ctx, this.objects);
    const beam = texture('beam', 650, 230, c => {
      const gradient = c.createLinearGradient(0, 0, 650, 0); gradient.addColorStop(0, 'rgba(255,247,169,.45)'); gradient.addColorStop(1, 'rgba(255,247,169,0)');
      c.fillStyle = gradient; c.beginPath(); c.moveTo(0, 115); c.lineTo(650, 0); c.lineTo(650, 230); c.closePath(); c.fill();
    });
    this.beam = image(43 * TS, 5 * TS - 5, beam, DEPTH.fx - 1).setOrigin(0, 0.5).setName('harbor-lighthouse-beam');
    const ship = texture('ship', 190, 410, c => {
      c.fillStyle = '#753f39'; c.beginPath(); c.moveTo(95, 4); c.lineTo(172, 75); c.lineTo(155, 360); c.lineTo(95, 402); c.lineTo(35, 360); c.lineTo(18, 75); c.closePath(); c.fill();
      c.fillStyle = '#faf0dc'; c.fillRect(49, 92, 92, 212); c.fillStyle = '#e16a51'; c.fillRect(62, 153, 66, 60); c.fillStyle = '#75b8cb'; c.fillRect(67, 105, 56, 24);
    });
    this.ship = image(24 * TS, -500, ship, DEPTH.vehicle - 1).setName('harbor-ship');
    this.updateDrawbridge = makeHarborDrawbridge(s, TS, this.objects);
    this.grade = image(0, 0, '__WHITE', DEPTH.building + 2).setOrigin(0).setDisplaySize(ctx.world.widthTiles * TS, ctx.world.heightTiles * TS).setTint(0xf6a96d).setAlpha(0.12);
    this.grade.setName('harbor-sunset');
    const wave = texture('wave', 1100, 3300, c => {
      const gradient = c.createLinearGradient(0, 0, 1100, 0);
      gradient.addColorStop(0, 'rgba(92,188,202,0)'); gradient.addColorStop(.45, 'rgba(120,213,219,.35)'); gradient.addColorStop(.8, 'rgba(237,255,241,.6)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gradient; c.fillRect(0, 0, 1100, 3300);
    });
    this.wave = image(31 * TS, (BEACH_TOP + BEACH_BOTTOM) / 2, wave, DEPTH.decal + 3)
      .setDisplaySize(6 * TS, BEACH_BOTTOM - BEACH_TOP).setVisible(false).setName('harbor-tide');
    this.tracks = new ParticlePool(s, 360);
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.ctx || this.ended || ctx.paused || ctx.questionBreak) return;
    this.clock += dt;
    const vehicles = [...ctx.players, ...[...ctx.npcs].filter(v => !v.destroyed)];
    const { bridgeCycleSec: cycle, bridgeOpenSec: open, bridgeLiftSec: liftSec } = HARBOR;
    // Delay opening until the deck is empty; never trap a car on a raised span.
    const deckOccupied = vehicles.some(v => Math.abs(v.x - BRIDGE.centerX * TS) < BRIDGE.gateWidth * TS / 2 + v.spec.length / 2 &&
      Math.abs(v.y - BRIDGE.centerY * TS) < BRIDGE.gateHeight * TS);
    if (this.cycle + dt < cycle - open || this.gate || !deckOccupied) this.cycle += dt;
    if (this.cycle >= cycle) this.cycle -= cycle;
    const opening = this.cycle >= cycle - open;
    if (opening && !this.gate) {
      const body = ctx.scene.matter.add.rectangle(BRIDGE.centerX * TS, BRIDGE.centerY * TS, BRIDGE.gateWidth * TS, BRIDGE.gateHeight * TS,
        { isStatic: true, collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 }, plugin: { owner: { kind: 'boundary' } } });
      this.gate = body as unknown as MatterJS.BodyType;
      this.gate.label = 'harbor-raised-drawbridge';
    } else if (!opening && this.gate) { ctx.scene.matter.world.remove(this.gate); this.gate = undefined; }
    const lift = opening ? Math.min(1, (this.cycle - (cycle - open)) / liftSec, (cycle - this.cycle) / liftSec) : 0;
    this.updateDrawbridge?.(lift, opening, this.clock);
    this.ship?.setPosition(24 * TS, opening ? (12 + 18 * (this.cycle - (cycle - open)) / open) * TS : -500);
    this.beam?.setRotation(this.clock * .32);
    const { sunsetFadeStartFrac: sunset, fullNightFrac: fullNight } = HARBOR;
    const progress = Phaser.Math.Clamp((ctx.elapsedSec / ctx.roundLengthSec - sunset) / (fullNight - sunset), 0, 1);
    const night = progress * progress * (3 - 2 * progress);
    const tint = Phaser.Display.Color.GetColor(246 - 218 * night, 169 - 139 * night, 109 - 40 * night);
    this.grade?.setTint(tint).setAlpha(0.12 + night * 0.36);
    this.beam?.setAlpha(0.45 + night * 0.55);
    this.updateLife?.(dt, this.clock, vehicles);
    const tideFront = this.updateTide(dt, vehicles);
    this.updateProps?.(dt, vehicles, tideFront);
    this.updateTracks(dt, ctx);
  }

  private updateTide(dt: number, vehicles: IVehicle[]): number | undefined {
    this.tideClock = (this.tideClock + dt) % HARBOR.tidePeriodSec;
    const phase = this.tideClock / HARBOR.tideDurationSec;
    if (phase >= 1) {
      this.wave?.setVisible(false);
      this.pushed.clear();
      return;
    }
    const front = (27.5 + phase * 14.5) * TS;
    this.wave?.setVisible(true).setX(front - 3 * TS).setAlpha(Math.min(1, (1 - phase) * 5));
    const inSurge = ({ x, y }: Vec2) => x >= 27 * TS && x <= front && y >= BEACH_TOP && y <= BEACH_BOTTOM;
    for (const car of vehicles) {
      if (!inSurge(car) || this.pushed.has(car)) continue;
      this.pushed.add(car);
      car.applyImpulse(HARBOR.tideImpulse, HARBOR.tideImpulse * 0.2, 0.65);
    }
    return front;
  }

  private updateTracks(dt: number, ctx: RaceContext): void {
    this.tracks?.update(dt);
    for (const car of ctx.players) {
      const previous = this.lastTrack.get(car);
      if (car.airborne || car.riding || car.boardingPosition || tileAt(ctx.world, Math.floor(car.x / TS), Math.floor(car.y / TS)) !== Tile.Dirt) {
        this.lastTrack.delete(car);
        continue;
      }
      if (previous && Math.hypot(previous.x - car.x, previous.y - car.y) < HARBOR.sandTrackGap) continue;
      this.lastTrack.set(car, { x: car.x, y: car.y });
      if (!previous || Math.hypot(previous.x - car.x, previous.y - car.y) > TS) continue;
      for (const side of [-1, 1]) {
        const axle = car.spec.width * 0.31 * side;
        this.tracks?.spawn({ key: TEX.skid, x: car.x - Math.sin(car.angle) * axle, y: car.y + Math.cos(car.angle) * axle,
          rot: car.angle, life: HARBOR.sandTrackLife, s0: 0.55, a0: 0.42, tint: 0x8f6849, sx: 5, depth: DEPTH.decal });
      }
    }
  }
  destroy(): void {
    this.offEnd?.();
    if (this.gate) this.ctx?.scene.matter.world?.remove(this.gate);
    this.tracks?.destroy();
    this.lastTrack.clear();
    this.pushed.clear();
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.updateProps = undefined;
    this.updateLife = undefined;
    this.updateDrawbridge = undefined;
    this.gate = undefined;
    this.ctx = undefined;
  }
}
