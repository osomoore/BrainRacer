import Phaser from 'phaser';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import { WORLD } from '../config';
import { DEPTH, type HexLive, type WorldContext, type WorldModule, type WorldPlayer } from '../core/runtime';
import type { BiomeId, Creation, HexPlan, Vec } from '../core/types';
import { hexKey, worldToHex } from '../gen/hex';
import { WorldGen } from '../gen/world';
import { normalizePlayerSave } from '../logic/save';
import { traitsOf } from '../logic/traits';
import MinimapModule from '../render/minimapModule';
import TerrainModule from '../render/terrainModule';

const STOPS: BiomeId[] = ['lake', 'snow', 'mud', 'darkwood', 'meadow'];
const ZOOM_LEVELS = [0.8, 1, 1.5];
const COLORS = [0xffcd55, 0x62cfff];

/** Standalone terrain preview. 1–5 change biome, Z changes zoom, arrows pan, and Q/E turn. */
export default class TerrainView extends Phaser.Scene {
  readonly terrain = new TerrainModule();
  private readonly minimap: WorldModule = new MinimapModule();
  private ctx!: WorldContext;
  private stops!: HexPlan[];
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'q' | 'e', Phaser.Input.Keyboard.Key>;
  private zoomIndex = 0;

  constructor() { super('TerrainView'); }

  create(): void {
    this.zoomIndex = 0;
    const params = new URLSearchParams(location.search);
    const requestedSeed = Number(params.get('seed') ?? 29);
    const gen = new WorldGen(Number.isSafeInteger(requestedSeed) ? requestedSeed : 29);
    const plans = gen.hexesNear(0, 0, 5).map(coord => gen.plan(coord));
    this.stops = STOPS.map(biome => plans.find(plan => plan.biome === biome) ?? plans[0]);
    const count = params.get('players') === '1' ? 1 : 2;
    const viewportWidth = WORLD.width / count;
    const players = Array.from({ length: count }, (_, slot) => {
      const index = slot as 0 | 1;
      const camera = index === 0 ? this.cameras.main : this.cameras.add();
      camera.setViewport(index * viewportWidth, 0, viewportWidth, WORLD.height)
        .setBackgroundColor('#233b38').setZoom(ZOOM_LEVELS[this.zoomIndex]);
      return this.makePlayer(index, camera, gen);
    });
    const events = new Phaser.Events.EventEmitter();
    const live = new Map<string, HexLive>();
    this.ctx = {
      scene: this,
      time: 0,
      players,
      bus: {
        on: (name, listener) => {
          events.on(name, listener);
          return () => { events.off(name, listener); };
        },
        emit: (name, data) => { events.emit(name, data); },
      },
      world: {
        seed: gen.seed,
        plan: coord => gen.plan(coord),
        surfaceAt: (x, y) => gen.surfaceAt(x, y),
        hexAt: worldToHex,
        hexesNear: (x, y, rings) => gen.hexesNear(x, y, rings),
        homeFor: profileId => gen.homeFor(profileId),
        live: coord => {
          const key = hexKey(coord);
          const previous = live.get(key);
          if (previous) return previous;
          const plan = gen.plan(coord);
          const entry: HexLive = {
            plan, obstacles: new Map(plan.obstacles.map(obstacle => [obstacle.id, obstacle])), takenItems: new Set(),
          };
          live.set(key, entry);
          return entry;
        },
        nearbySolids: () => ({ obstacles: [], features: [] }),
      },
      showOnlyTo: (obj, player) => {
        for (const other of players) if (other !== player) other.camera.ignore(obj);
      },
      save: () => {},
      award: () => false,
      viewRotation: player => -player.move.angle - Math.PI / 2,
      setCreation: (player, creation) => {
        player.creation = creation;
        player.traits = traitsOf(creation);
      },
    };
    for (const player of players) {
      this.moveToStop(player, player.index);
      const giver = gen.hexesNear(player.move.x, player.move.y, 1).map(coord => gen.plan(coord)).find(plan => plan.giver);
      if (giver?.giver) {
        player.save.quests.push({
          carrying: true,
          quest: {
            id: `${giver.giver.id}#0`, giverId: giver.giver.id, giverHex: giver.coord,
            kind: 'fetch', item: 'shell', fromBiome: 'lake', goal: { kind: 'giver' }, stars: 1,
            text: { starter: 'Bring it back.', easy: 'Bring the shell back.', medium: 'Return the shell.', hard: 'Return the shell.' },
          },
        });
      }
    }
    this.terrain.init(this.ctx);
    this.minimap.init(this.ctx);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.minimap.destroy?.();
      this.terrain.destroy?.();
      events.destroy();
    });

    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys('up,down,left,right,q,e') as typeof this.keys;
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((key, index) => {
      keyboard.on(`keydown-${key}`, () => this.moveToStop(players[0], index));
    });
    keyboard.on('keydown-Z', () => {
      this.zoomIndex = (this.zoomIndex + 1) % ZOOM_LEVELS.length;
      for (const player of players) player.camera.setZoom(ZOOM_LEVELS[this.zoomIndex]);
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const player = this.ctx.players[0];
    const { up, down, left, right, q, e } = this.keys;
    const dx = Number(right.isDown) - Number(left.isDown);
    const dy = Number(down.isDown) - Number(up.isDown);
    const turn = Number(e.isDown) - Number(q.isDown);
    if (dx || dy || turn) {
      player.move.angle += turn * 1.5 * dt;
      const rotation = Math.PI / 2 + player.move.angle;
      this.positionPlayer(player, {
        x: player.move.x + (dx * Math.cos(rotation) - dy * Math.sin(rotation)) * 650 * dt,
        y: player.move.y + (dx * Math.sin(rotation) + dy * Math.cos(rotation)) * 650 * dt,
      });
    }
    this.ctx.time += dt;
    this.terrain.update(dt);
    this.minimap.update(dt);
  }

  private makePlayer(index: 0 | 1, camera: WorldPlayer['camera'], gen: WorldGen): WorldPlayer {
    const workshop = index === 0 ? 'race' : 'dino';
    const creation: Creation = { workshop, model: defaultModel(CATALOGS[workshop]) };
    const marker = this.add.triangle(0, 0, 1, 1, 47, 21, 1, 41, COLORS[index])
      .setStrokeStyle(4, 0x293235);
    return {
      index, profileId: `preview-${index + 1}`, name: `Player ${index + 1}`, reading: 'easy',
      save: normalizePlayerSave({}, workshop), creation, traits: traitsOf(creation), camera,
      move: { x: 0, y: 0, angle: -0.5 + index, vx: 0, vy: 0, airborne: 0 },
      hex: { q: 0, r: 0 }, surface: gen.surfaceAt(0, 0),
      sprite: this.add.container(0, 0, [marker]).setDepth(DEPTH.players),
      controls: { x: 0, y: 0, throttle: 0, brake: 0, pressed: { a: false, b: false, x: false, y: false, menu: false } },
      carrying: [], busy: false,
    };
  }

  private moveToStop(player: WorldPlayer, index: number): void {
    const plan = this.stops[index];
    const feature = plan.features.find(f => f.kind === 'bridge' || f.kind === 'cave');
    this.positionPlayer(player, feature?.at ?? plan.center);
  }

  private positionPlayer(player: WorldPlayer, at: Vec): void {
    const from = player.hex;
    player.move.x = at.x;
    player.move.y = at.y;
    player.hex = this.ctx.world.hexAt(at.x, at.y);
    player.surface = this.ctx.world.surfaceAt(at.x, at.y);
    if (player.hex.q !== from.q || player.hex.r !== from.r) {
      this.ctx.bus.emit('player:hex', { player, from, to: player.hex, biome: player.surface.biome });
    }
    player.sprite?.setPosition(at.x, at.y).setRotation(player.move.angle);
    player.camera.centerOn(at.x, at.y).setRotation(-Math.PI / 2 - player.move.angle);
  }
}
