import type Phaser from 'phaser';
import { DEPTH, QUEUED_ATMOSPHERE as WEATHER } from '../config/gameConfig';
import { isQueuedMap, isQueuedParkTrackMap, type QueuedMap } from '../config/queuedMaps';
import type { GameSystem, IPlayerCar, RaceContext } from '../core/race';
import { Rng } from '../core/rng';
import { Tile, type Vec2 } from '../core/types';
import { SkidMarks } from '../fx/SkidMarks';
import { queuedFeatureSites } from '../world/gen/queuedWorlds';
import { parkTrackTexture, queuedWeatherTexture, snowTrackTexture } from './queuedAtmosphereArt';
import { parkTrackAlpha, snowTrackAlpha, traceWheel, wrapFront } from './queuedAtmosphereMath';

type Front = { image: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; phase: number };
type Track = { previous: Vec2; wheels: [Vec2, Vec2] };

export class QueuedAtmosphereSystem implements GameSystem {
  readonly name = 'queuedAtmosphere';
  private map?: QueuedMap;
  private fronts: Front[] = [];
  private tracksPool?: SkidMarks;
  private tracks = new Map<IPlayerCar, Track>();
  private ventTiles: readonly number[] = [];
  private clock = 0;

  init(ctx: RaceContext): void {
    const { scene, world } = ctx;
    const map = ctx.settings.map;
    if (!isQueuedMap(map)) return;
    this.map = map;
    if (map === 'volcano') this.ventTiles = queuedFeatureSites(map, world).gate.tiles;
    if (map === 'tundra') {
      const { max, width, fadeSec } = WEATHER.snowTracks;
      this.tracksPool = new SkidMarks(scene, max, {
        key: snowTrackTexture(scene), name: 'tundra-snow-track', width, fadeSec, depth: DEPTH.decal + 1,
      }).prewarm();
    } else if (isQueuedParkTrackMap(map)) {
      const { max, width, fadeSec } = WEATHER.parkTracks;
      this.tracksPool = new SkidMarks(scene, max, {
        key: parkTrackTexture(scene, map), name: `${map}-park-track`, width, fadeSec, depth: DEPTH.decal - 2,
      }).prewarm();
    }

    const key = queuedWeatherTexture(scene, map);
    const rng = new Rng(world.seed).fork(0x174cb);
    const config = WEATHER.fronts[map];
    const width = world.widthTiles * world.tileSize, height = world.heightTiles * world.tileSize;
    const add = (x: number, y: number, variation: number, phase: number) => {
      const speed = config.speed * variation;
      const image = scene.add.image(x, y, key).setName(`queued-weather-${map}`)
        .setScale(config.scale * variation).setDepth(DEPTH.fx + 1).setRotation(config.angle);
      this.fronts.push({ image, x, y, phase, vx: speed * Math.cos(config.angle), vy: speed * Math.sin(config.angle) });
    };
    for (let row = 0; row < config.rows; row++) for (let col = 0; col < config.columns; col++) {
      add((col + rng.range(.12, .88)) * width / config.columns, (row + rng.range(.18, .82)) * height / config.rows,
        rng.range(.82, 1.18), rng.range(0, 2 * Math.PI));
    }
    // One front comes through the starting neighborhood as the rest traverse the map.
    const start = world.playerSpawns[0];
    add(start.x - config.speed * 1.8, start.y - config.speed * Math.sin(config.angle) * 1.8, 1, 0);
    this.updateFronts(width, height, false);
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.map || ctx.paused || ctx.questionBreak || ctx.timeExpired) return;
    this.clock += dt;
    const { world } = ctx;
    const erupting = this.ventTiles.some(i => world.tiles[i] === Tile.Water);
    this.updateFronts(world.widthTiles * world.tileSize, world.heightTiles * world.tileSize, erupting);
    if (this.tracksPool) {
      this.tracksPool.update(dt);
      for (const car of ctx.players) this.updateTracks(car, world, this.tracksPool);
    }
  }

  destroy(): void {
    for (const { image } of this.fronts) image.destroy();
    this.fronts.length = 0;
    this.tracksPool?.destroy();
    this.tracks.clear();
  }

  private updateFronts(width: number, height: number, erupting: boolean): void {
    const { alpha, period } = WEATHER.fronts[this.map!];
    const wave = this.clock / period * 2 * Math.PI;
    for (const front of this.fronts) {
      const pulse = .5 + .5 * Math.cos(wave + front.phase);
      const peak = this.map === 'tundra' ? .38 + .62 * pulse ** 2 : .58 + .42 * pulse;
      const strength = Math.min(1, alpha * peak + (erupting ? .22 : 0));
      front.image.setPosition(
        wrapFront(front.x + this.clock * front.vx, width, WEATHER.wrapPad),
        wrapFront(front.y + this.clock * front.vy + Math.sin(wave + front.phase) * 75, height, WEATHER.wrapPad),
      ).setAlpha(strength);
    }
  }

  private updateTracks(car: IPlayerCar, world: RaceContext['world'], marks: SkidMarks): void {
    if (car.airborne || car.disabled || car.riding || car.boardingPosition) {
      this.tracks.delete(car);
      return;
    }
    const { spacing, minSpeed, resetDistance } = WEATHER.snowTracks;
    const current = { x: car.x, y: car.y };
    const rear = car.spec.length * -.32, offset = car.spec.width * .4;
    const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
    const wheel = (side: number): Vec2 => ({ x: current.x + cos * rear - sin * side, y: current.y + sin * rear + cos * side });
    const left = wheel(-offset), right = wheel(offset);
    const trail = this.tracks.get(car);
    if (!trail || Math.hypot(current.x - trail.previous.x, current.y - trail.previous.y) > resetDistance) {
      this.tracks.set(car, { previous: current, wheels: [left, right] });
      return;
    }
    trail.previous = current;
    // Rendering can tick between fixed Matter steps. Preserve partial wheel samples
    // across those frames as long as the car is still moving.
    const { x: vx, y: vy } = car.velocity;
    if (vx * vx + vy * vy < minSpeed * minSpeed) {
      trail.wheels = [left, right];
      return;
    }
    const lay = (at: Vec2, angle: number) => {
      const alpha = this.map === 'tundra' ? snowTrackAlpha(world, at.x, at.y) : parkTrackAlpha(this.map!, world, at.x, at.y);
      if (alpha) marks.add(at.x, at.y, angle, spacing + 2, alpha);
    };
    trail.wheels = [traceWheel(trail.wheels[0], left, spacing, lay), traceWheel(trail.wheels[1], right, spacing, lay)];
  }
}
