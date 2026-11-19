import Phaser from 'phaser';
import { CameraRig } from '../camera/CameraRig';
import { DEFAULT_SETTINGS, DINO, TILE_SIZE, VEHICLE_MODEL } from '../config/gameConfig';
import { bus } from '../core/events';
import type { GameSystem, RaceContext } from '../core/race';
import { Rng, randomSeed } from '../core/rng';
import { services } from '../core/services';
import type { PlayerId, RoundResults, Settings } from '../core/types';
import { PlayerCar } from '../entities/PlayerCar';
import { SkidMarks } from '../fx/SkidMarks';
import { createSystems } from '../systems';
import { cityGen } from '../world/gen';
import { buildWorld, type BuiltWorld } from '../world/WorldBuilder';
import { REG, SCENE } from './keys';

const COUNTDOWN_SEC = 3;

/**
 * Integration point (orchestrator-owned). Builds the world, cars, camera rig and all systems
 * (auto-registered from src/systems/*System.ts), runs the countdown, pause and round end.
 *
 * URL overrides (dev/testing): ?seed=N  ?round=SEC  ?debug=1 (matter debug draw)
 */
export class RaceScene extends Phaser.Scene {
  private ctx!: RaceContext;
  private rig!: CameraRig;
  private built!: BuiltWorld;
  private skids!: SkidMarks;
  private systems: GameSystem[] = [];
  private players: PlayerCar[] = [];
  private countdown = 0;
  private lastCount = 0;
  private started = false;
  private ended = false;
  private offs: (() => void)[] = [];

  constructor() { super(SCENE.race); }

  create() {
    const params = new URLSearchParams(location.search);
    const settings: Settings = structuredClone(this.registry.get(REG.settings) ?? DEFAULT_SETTINGS);
    const seed = Number(params.get('seed')) || settings.seed || randomSeed();
    const roundLengthSec = Number(params.get('round')) || settings.roundLengthSec;
    services.audio.setVolumes(settings.musicVolume, settings.sfxVolume);

    const engine = this.matter.world.engine as unknown as { positionIterations: number; velocityIterations: number };
    engine.positionIterations = VEHICLE_MODEL.positionIterations;
    engine.velocityIterations = VEHICLE_MODEL.velocityIterations;
    if (params.get('debug') === '1') this.matter.world.createDebugGraphic();

    const world = cityGen(seed);
    this.built = buildWorld(this, world);
    this.skids = new SkidMarks(this);

    this.players = settings.players.map((p, i) => {
      const s = world.playerSpawns[i] ?? world.playerSpawns[0];
      const car = new PlayerCar(this, i as PlayerId, p.car, s.x, s.y, s.angle, this.skids);
      car.setControlEnabled(false);
      return car;
    });

    const bounds = { x: 0, y: 0, w: world.widthTiles * TILE_SIZE, h: world.heightTiles * TILE_SIZE };
    this.rig = new CameraRig(this, { targets: this.players, worldBounds: bounds, bus });

    this.ctx = {
      scene: this,
      bus,
      world,
      settings,
      rng: new Rng(seed ^ 0x5bd1e995),
      players: this.players,
      npcs: new Set(),
      goal: null,
      dino: { active: false, x: 0, y: 0, angle: 0, radius: DINO.length * 0.3 },
      camera: this.rig,
      elapsedSec: 0,
      roundLengthSec,
      paused: false,
      questionBreak: false,
    };
    this.registry.set(REG.race, this.ctx);

    this.systems = createSystems();
    for (const s of this.systems) s.init(this.ctx);

    this.offs.push(
      bus.on('game:resume', () => this.setPaused(false)),
      bus.on('dino:spawned', () => services.audio.music('dino', 1.5)),
      bus.on('dino:defeated', () => { if (!this.ended) services.audio.music('race', 1.5); }),
      bus.on('dino:left', () => { if (!this.ended) services.audio.music('race', 1.5); }),
      bus.on('round:end', ({ results }) => this.endRound(results)),
    );

    // HUD on top (restart it if this is a race restart).
    if (this.scene.isActive(SCENE.hud) || this.scene.isPaused(SCENE.hud)) this.scene.stop(SCENE.hud);
    this.scene.launch(SCENE.hud);
    this.scene.bringToTop(SCENE.hud);

    this.countdown = COUNTDOWN_SEC;
    this.lastCount = COUNTDOWN_SEC + 1;
    this.started = false;
    this.ended = false;
    services.audio.music(null, 0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    (window as unknown as { __race?: RaceContext }).__race = this.ctx;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    services.input.poll();

    // Pause toggle (HUD hosts the overlay and emits game:resume; a second pause press also resumes).
    const pausedBy = this.players.findIndex((p) => services.input.get(p.player).pause);
    if (pausedBy >= 0 && this.started && !this.ended) {
      if (!this.ctx.paused) { this.setPaused(true); bus.emit('game:pause', { by: pausedBy as PlayerId }); }
      else bus.emit('game:resume', {});
    }
    if (this.ctx.paused) { this.rig.update(0); return; }

    if (!this.started) this.runCountdown(dt);
    else if (!this.ended) this.ctx.elapsedSec += dt;

    for (const car of this.players) car.update(services.input.get(car.player), dt);
    this.skids.update(dt);
    if (this.started) for (const s of this.systems) s.update(dt, this.ctx);
    this.rig.update(dt);
  }

  private runCountdown(dt: number) {
    this.countdown -= dt;
    const n = Math.ceil(this.countdown);
    if (n !== this.lastCount && n > 0) {
      this.lastCount = n;
      bus.emit('ui:banner', { text: String(n), durationSec: 0.8 });
      services.audio.sfx('countdown');
    }
    if (this.countdown <= 0) {
      this.started = true;
      bus.emit('ui:banner', { text: 'GO!', color: '#7CFC00', durationSec: 1 });
      services.audio.sfx('go');
      services.audio.music('race', 0.5);
      for (const car of this.players) car.setControlEnabled(true);
      bus.emit('round:start', { lengthSec: this.ctx.roundLengthSec });
    }
  }

  private setPaused(on: boolean) {
    if (this.ctx.paused === on) return;
    this.ctx.paused = on;
    if (on) this.matter.world.pause(); else this.matter.world.resume();
  }

  private endRound(results: RoundResults) {
    if (this.ended) return;
    this.ended = true;
    this.registry.set(REG.results, results);
    for (const car of this.players) car.setControlEnabled(false);
    services.audio.music('results', 0.5);
    bus.emit('ui:banner', { text: "TIME'S UP!", color: '#FFD700', durationSec: 3 });
    this.time.delayedCall(4000, () => {
      this.scene.stop(SCENE.hud);
      this.scene.start(SCENE.results);
    });
  }

  private teardown() {
    // Phaser's Matter plugin may already have shut down (world === null); every step is guarded
    // so one failure can never block the scene transition.
    const safe = (fn: () => void) => { try { fn(); } catch (e) { console.warn('[race teardown]', e); } };
    for (const off of this.offs) safe(off);
    this.offs = [];
    for (const s of this.systems) safe(() => s.destroy());
    this.systems = [];
    for (const car of this.players) safe(() => car.destroy());
    this.players = [];
    safe(() => this.rig.destroy());
    safe(() => this.skids.destroy());
    safe(() => this.built.destroy());
    bus.clear();
  }
}
