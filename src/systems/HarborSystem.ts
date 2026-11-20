import Phaser from 'phaser';
import { CAT, DEPTH, HARBOR, TILE_SIZE } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { BodyOwner, GameSystem, IVehicle, RaceContext } from '../core/race';
import { Tile, type Vec2 } from '../core/types';
import { ParticlePool } from '../fx/ParticlePool';
import { isDrivable, tileAt } from '../world/geometry';
import { harborTexture } from '../world/harborWorld';

const TS = TILE_SIZE;
const CLEAR = 3 * TS;
const BEACH_TOP = 7 * TS, BEACH_BOTTOM = 41 * TS;

interface Beachgoer { image: Phaser.GameObjects.Image; position: Vec2; from: Vec2; to: Vec2; jump: number }
interface Watercraft { image: Phaser.GameObjects.Image; x: number; y: number; phase: number; drift: number }

/** Harbor life runs on game time, so bridges, waves and people pause with the race. */
export class HarborSystem implements GameSystem {
  readonly name = 'harbor';
  private ctx?: RaceContext;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private looseProps: Phaser.Physics.Matter.Image[] = [];
  private people: Beachgoer[] = [];
  private watercraft: Watercraft[] = [];
  private tracks?: ParticlePool;
  private lastTrack = new Map<IVehicle, Vec2>();
  private pushed = new Set<IVehicle | Phaser.Physics.Matter.Image>();
  private gate?: MatterJS.BodyType;
  private beam?: Phaser.GameObjects.Image;
  private ship?: Phaser.GameObjects.Image;
  private grade?: Phaser.GameObjects.Image;
  private wave?: Phaser.GameObjects.Image;
  private leaves: Phaser.GameObjects.Image[] = [];
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
    const umbrella = texture('umbrella', 100, 100, c => {
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff0d8' : '#ed6a56'; c.beginPath(); c.moveTo(50, 50); c.arc(50, 50, 46, i * Math.PI / 4, (i + 1) * Math.PI / 4); c.closePath(); c.fill(); }
      c.fillStyle = '#9b5942'; c.beginPath(); c.arc(50, 50, 5, 0, 7); c.fill();
    });
    const scatterable = (x: number, y: number, key: string, radius: number, name: string) => {
      const item = s.matter.add.image(x * TS, y * TS, key, undefined, {
        shape: { type: 'circle', radius }, mass: 0.4, restitution: 0.65, frictionAir: 0.08,
        collisionFilter: { category: CAT.prop, mask: 0xffff, group: 0 },
      });
      (item.body as MatterJS.BodyType & { plugin: { owner: BodyOwner } }).plugin.owner = { kind: 'prop', prop: item };
      item.setDepth(DEPTH.prop).setName(name);
      this.looseProps.push(item);
      this.objects.push(item);
    };
    for (const [x, y] of [[33, 14], [35, 12], [38, 13], [33, 25], [37, 29], [34, 33], [39, 34]]) scatterable(x, y, umbrella, 35, 'harbor-umbrella');
    const ball = texture('beachball', 44, 44, c => {
      for (const [i, color] of ['#fff7cc', '#f67952', '#fff7cc', '#47b6c6', '#fff7cc', '#eeb641'].entries()) {
        c.fillStyle = color; c.beginPath(); c.moveTo(20, 18); c.arc(22, 22, 20, i * Math.PI / 3, (i + 1) * Math.PI / 3); c.closePath(); c.fill();
      }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(20, 18, 4.5, 0, Math.PI * 2); c.fill();
    });
    for (const [x, y] of [[36, 16], [36.5, 16.6], [38.5, 28]]) scatterable(x, y, ball, 19, 'harbor-beachball');
    const person = texture('person', 42, 54, c => {
      c.fillStyle = '#273a51'; c.beginPath(); c.ellipse(21, 35, 11, 16, 0, 0, 7); c.fill();
      c.fillStyle = '#f2bc86'; c.beginPath(); c.arc(21, 15, 10, 0, 7); c.fill();
      c.fillStyle = '#f2a644'; c.fillRect(10, 27, 22, 13);
    });
    for (const [x, y] of [[31, 14], [34, 14], [37, 15], [32, 28], [35, 31], [38, 32], [32, 34]]) {
      const position = { x: x * TS, y: y * TS };
      const sprite = image(position.x, position.y, person, DEPTH.vehicle - 1).setName('harbor-beachgoer');
      this.people.push({ image: sprite, position, from: position, to: position, jump: 0 });
    }
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
    const surfer = texture('surfer', 118, 58, c => {
      c.fillStyle = '#d8f4eb'; c.beginPath(); c.ellipse(58, 30, 56, 18, -0.12, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e76c54'; c.beginPath(); c.ellipse(69, 28, 31, 8, -0.12, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#234b66'; c.fillRect(58, 18, 15, 21);
      c.fillStyle = '#c88156'; c.beginPath(); c.arc(69, 23, 7, 0, Math.PI * 2); c.fill();
    });
    const boat = texture('sailboat', 95, 105, c => {
      c.fillStyle = '#654744'; c.beginPath(); c.ellipse(45, 50, 20, 42, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff1cb'; c.beginPath(); c.moveTo(40, 12); c.lineTo(70, 67); c.lineTo(39, 67); c.fill();
      c.fillStyle = '#ee865b'; c.beginPath(); c.moveTo(35, 32); c.lineTo(35, 66); c.lineTo(13, 66); c.fill();
    });
    this.watercraft = [
      { image: image(0, 0, surfer, DEPTH.decal).setName('harbor-surfer'), x: 25, y: 16, phase: 0, drift: 0.78 },
      { image: image(0, 0, surfer, DEPTH.decal).setName('harbor-surfer'), x: 25, y: 34, phase: 2, drift: 0.69 },
      { image: image(0, 0, boat, DEPTH.decal), x: 22, y: 13, phase: 3, drift: 0.26 },
      { image: image(0, 0, boat, DEPTH.decal), x: 22.5, y: 29, phase: 1, drift: 0.29 },
    ];
    const leaf = texture('drawleaf', 390, 250, c => {
      c.fillStyle = '#9a6552'; c.fillRect(0, 0, 390, 250); c.fillStyle = '#d2b394'; c.fillRect(0, 8, 390, 16); c.fillRect(0, 226, 390, 16); c.fillStyle = '#f9db98'; for (let x = 20; x < 390; x += 65) c.fillRect(x, 121, 35, 6);
    });
    this.leaves = [image(21 * TS, 21 * TS, leaf, DEPTH.decal + 2).setOrigin(0, .5), image(27 * TS, 21 * TS, leaf, DEPTH.decal + 2).setOrigin(0, .5).setRotation(Math.PI)];
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
    if (this.cycle + dt < cycle - open || this.gate || !vehicles.some(v => Math.abs(v.x - 24 * TS) < CLEAR + v.spec.length / 2 && Math.abs(v.y - 21 * TS) < 2 * TS)) this.cycle += dt;
    if (this.cycle >= cycle) this.cycle -= cycle;
    const opening = this.cycle >= cycle - open;
    if (opening && !this.gate) {
      const body = ctx.scene.matter.add.rectangle(24 * TS, 21 * TS, 5.5 * TS, 2 * TS, { isStatic: true, collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 }, plugin: { owner: { kind: 'boundary' } } });
      this.gate = body as unknown as MatterJS.BodyType;
      this.gate.label = 'harbor-raised-drawbridge';
    } else if (!opening && this.gate) { ctx.scene.matter.world.remove(this.gate); this.gate = undefined; }
    const lift = opening ? Math.min(1, (this.cycle - (cycle - open)) / liftSec, (cycle - this.cycle) / liftSec) : 0;
    this.leaves.forEach(i => i.setScale(1 - lift * .7, 1).setTint(opening ? 0xc8a49b : 0xffffff));
    this.ship?.setPosition(24 * TS, opening ? (12 + 18 * (this.cycle - (cycle - open)) / open) * TS : -500);
    this.beam?.setRotation(this.clock * .32);
    const night = Phaser.Math.Clamp((ctx.elapsedSec / ctx.roundLengthSec - 0.33) / 0.55, 0, 1);
    const tint = Phaser.Display.Color.GetColor(246 - 218 * night, 169 - 139 * night, 109 - 40 * night);
    this.grade?.setTint(tint).setAlpha(0.12 + night * 0.36);
    this.beam?.setAlpha(0.45 + night * 0.55);
    for (const boat of this.watercraft) {
      const phase = this.clock * boat.drift + boat.phase;
      boat.image.setPosition((boat.x + Math.sin(phase) * 0.65) * TS, (boat.y + Math.cos(phase) * 1.2) * TS)
        .setRotation(Math.sin(phase) * 0.38);
    }
    for (const person of this.people) this.updateBeachgoer(person, vehicles, dt, ctx);
    this.updateTide(dt, vehicles);
    this.updateTracks(dt, ctx);
  }

  private updateBeachgoer(person: Beachgoer, vehicles: IVehicle[], dt: number, ctx: RaceContext): void {
    if (person.jump <= 0) {
      const nearest = vehicles.reduce<IVehicle | undefined>((best, v) => {
        const distance = (vehicle: IVehicle) => Math.hypot(vehicle.x - person.position.x, vehicle.y - person.position.y);
        return distance(v) < HARBOR.beachgoerClearance && (!best || distance(v) < distance(best)) ? v : best;
      }, undefined);
      if (!nearest) return;
      const angle = Math.atan2(person.position.y - nearest.y, person.position.x - nearest.x);
      for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const x = person.position.x + Math.cos(angle + turn) * HARBOR.beachgoerJumpDistance;
        const y = person.position.y + Math.sin(angle + turn) * HARBOR.beachgoerJumpDistance;
        if (x < 27.5 * TS || x > 43 * TS || y < BEACH_TOP || y > BEACH_BOTTOM || !isDrivable(ctx.world, x, y)) continue;
        person.from = person.position;
        person.to = { x, y };
        person.jump = HARBOR.beachgoerJumpSec;
        break;
      }
    }
    if (person.jump <= 0) return;
    person.jump = Math.max(0, person.jump - dt);
    const progress = 1 - person.jump / HARBOR.beachgoerJumpSec;
    const travel = 1 - (1 - progress) ** 2;
    person.position = { x: Phaser.Math.Linear(person.from.x, person.to.x, travel), y: Phaser.Math.Linear(person.from.y, person.to.y, travel) };
    person.image.setPosition(person.position.x, person.position.y - Math.sin(progress * Math.PI) * 50);
  }

  private updateTide(dt: number, vehicles: IVehicle[]): void {
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
    for (const prop of this.looseProps) {
      if (!inSurge(prop) || this.pushed.has(prop)) continue;
      this.pushed.add(prop);
      prop.setVelocity(3, 0.6).setAngularVelocity(0.12);
    }
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
    this.objects = []; this.looseProps = []; this.people = []; this.leaves = []; this.gate = undefined; this.ctx = undefined;
  }
}
