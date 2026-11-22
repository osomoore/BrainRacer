import { questionsOffAllowed, resolveRaceQuestions } from '../config/questionsPolicy';
import Phaser from 'phaser';
import { CameraRig } from '../camera/CameraRig';
import { DEFAULT_SETTINGS, DEVELOPER_ROUND_SEC, DINO, QUEUED_FEATURES, VEHICLE_MODEL, WORLD_MUSIC } from '../config/gameConfig';
import { getTuning } from '../config/deviceTuning';
import { currentLaunchOverrides } from '../config/launchOptions';
import { isQueuedMap, type QueuedMap } from '../config/queuedMaps';
import { bus } from '../core/events';
import { perfProbe } from '../core/perfProbe';
import type { GameSystem, RaceContext } from '../core/race';
import { selectedLoadout } from '../core/progression';
import { playerRacer, teamRoundSec } from '../core/racerProfiles';
import { awardRacers, loadAllProgress, racerProgressOf, racerLoadouts, teamPlayableMap } from '../core/racerProgress';
import { Rng, randomSeed } from '../core/rng';
import { services } from '../core/services';
import type { MusicTrack, PlayerId, RaceMap, RoundResults, Settings, WorldData } from '../core/types';
import { PlayerCar } from '../entities/PlayerCar';
import { SkidMarks } from '../fx/SkidMarks';
import { createSystems } from '../systems';
import { cityGen, generateFarm } from '../world/gen';
import { generateIndustrial } from '../world/gen/industrial';
import { generateHarbor } from '../world/gen/harbor';
import { generateUnderground } from '../world/gen/underground';
import { generateSky } from '../world/gen/sky';
import { generateForest } from '../world/gen/forest';
import { generateUnderwater } from '../world/gen/underwater';
import { generateQueuedWorld, queuedIceAt } from '../world/gen/queuedWorlds';
import { buildWorld, type BuiltWorld } from '../world/WorldBuilder';
import { REG, SCENE } from './keys';

const COUNTDOWN_SEC = 3;
const RACE_WORLDS: Record<Exclude<RaceMap, QueuedMap>, { generate: (seed: number) => WorldData; music: MusicTrack }> = {
  city: { generate: cityGen, music: 'race' },
  industrial: { generate: generateIndustrial, music: 'industrial' },
  farm: { generate: generateFarm, music: 'farm' },
  harbor: { generate: generateHarbor, music: 'race' },
  underground: { generate: generateUnderground, music: 'underground' },
  sky: { generate: generateSky, music: 'sky' },
  forest: { generate: generateForest, music: 'forest' },
  underwater: { generate: generateUnderwater, music: 'underwater' },
};

/**
 * Integration point (orchestrator-owned). Builds the world, cars, camera rig and all systems
 * (auto-registered from src/systems/*System.ts), runs the countdown, pause and round end.
 *
 * URL overrides (dev/testing): ?seed=N  ?round=SEC  ?every=SEC  ?music=0..1  ?sfx=0..1  ?debug=1  ?questions=off|words|math|mixed
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
  private inBreak = false;
  private raceMusic: MusicTrack = 'race';
  private offs: (() => void)[] = [];

  constructor() { super(SCENE.race); }

  create(data: { previewMap?: RaceMap } = {}) {
    const params = new URLSearchParams(location.search);
    const settings: Settings = structuredClone(this.registry.get(REG.settings) ?? DEFAULT_SETTINGS);
    // Questions are mandatory unless the app was started with the questions-off option (see questionsPolicy.ts).
    Object.assign(settings, resolveRaceQuestions(
      settings, params.get('questions'), import.meta.env.VITE_QUESTIONS, questionsOffAllowed()));
    const seed = Number(params.get('seed')) || settings.seed || randomSeed();
    // Round length / question interval / volumes are launch options (src/config/launchOptions.ts), applied on top of any saved value.
    const launch = currentLaunchOverrides();
    Object.assign(settings, launch);
    const developerMode = settings.developerMode === true;
    // Race length: ?round= wins, then Admin Mode's short test rounds, else the longer of the racers' times.
    settings.roundLengthSec = launch.roundLengthSec ?? (developerMode ? DEVELOPER_ROUND_SEC : teamRoundSec(settings.players, settings));
    const progress = loadAllProgress();
    const team = settings.players.map((p, i) => racerProgressOf(progress, playerRacer(p, i)));
    settings.map = data.previewMap ?? teamPlayableMap(settings.map, team, developerMode);
    settings.players = settings.players.map((player, i) => ({
      ...player, ...selectedLoadout(player, i, developerMode, racerLoadouts(team[i], developerMode)),
    }));
    const roundLengthSec = settings.roundLengthSec;
    services.audio.setVolumes(settings.musicVolume, settings.sfxVolume);

    const engine = this.matter.world.engine as unknown as { positionIterations: number; velocityIterations: number };
    engine.positionIterations = VEHICLE_MODEL.positionIterations;
    engine.velocityIterations = VEHICLE_MODEL.velocityIterations;
    if (params.get('debug') === '1') this.matter.world.createDebugGraphic();

    const map = settings.map;
    const world = isQueuedMap(map) ? generateQueuedWorld(map, seed) : RACE_WORLDS[map].generate(seed);
    this.raceMusic = isQueuedMap(map) ? map : RACE_WORLDS[map].music;
    this.built = buildWorld(this, world, settings.map);
    this.skids = new SkidMarks(this);

    this.players = settings.players.map((p, i) => {
      const s = world.playerSpawns[i] ?? world.playerSpawns[0];
      const car = new PlayerCar(this, i as PlayerId, p.car, s.x, s.y, s.angle, this.skids);
      car.setControlEnabled(false);
      return car;
    });

    const bounds = { x: 0, y: 0, w: world.widthTiles * world.tileSize, h: world.heightTiles * world.tileSize };
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
      timeExpired: false,
      pendingQuestions: false,
    };
    this.registry.set(REG.race, this.ctx);

    this.systems = createSystems();
    for (const s of this.systems) s.init(this.ctx);

    // Profiling (admin "Perf overlay"): physics step and whole-game render, on top of the per-system timing in update().
    perfProbe.enabled = getTuning().perfHud;
    perfProbe.reset();
    if (perfProbe.enabled) {
      const physBegin = () => perfProbe.begin('physics'), physEnd = () => perfProbe.end('physics');
      const renderBegin = () => perfProbe.begin('render'), renderEnd = () => perfProbe.end('render');
      this.matter.world.on('beforeupdate', physBegin);
      this.matter.world.on('afterupdate', physEnd);
      this.game.events.on(Phaser.Core.Events.PRE_RENDER, renderBegin);
      this.game.events.on(Phaser.Core.Events.POST_RENDER, renderEnd);
      this.offs.push(() => {
        this.matter.world?.off('beforeupdate', physBegin);
        this.matter.world?.off('afterupdate', physEnd);
        this.game.events.off(Phaser.Core.Events.PRE_RENDER, renderBegin);
        this.game.events.off(Phaser.Core.Events.POST_RENDER, renderEnd);
        perfProbe.enabled = false;
      });
    }

    const unlockAudio = () => { if (!services.audio.unlocked) void services.audio.unlock(); };
    this.input.keyboard?.on('keydown', unlockAudio);
    this.input.on('pointerdown', unlockAudio);
    this.offs.push(
      () => { this.input.keyboard?.off('keydown', unlockAudio); this.input.off('pointerdown', unlockAudio); },
      bus.on('game:resume', () => this.setPaused(false)),
      bus.on('dino:spawned', () => services.audio.music('dino', 1.5)),
      bus.on('dino:defeated', () => { if (!this.ended) services.audio.music(this.raceMusic, 1.5); }),
      bus.on('dino:left', () => { if (!this.ended) services.audio.music(this.raceMusic, 1.5); }),
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
    this.inBreak = false;
    services.audio.music(null, 0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    (window as unknown as { __race?: RaceContext }).__race = this.ctx;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    perfProbe.frame(performance.now());
    services.input.poll();

    // Pause toggle (HUD hosts the overlay and emits game:resume; a second pause press also resumes).
    const pausedBy = this.players.findIndex((p) => services.input.get(p.player).pause);
    if (pausedBy >= 0 && this.started && !this.ended) {
      if (!this.ctx.paused) { this.setPaused(true); bus.emit('game:pause', { by: pausedBy as PlayerId }); }
      else bus.emit('game:resume', {});
    }
    if (this.ctx.paused) { this.rig.update(0); return; }

    if (this.started && (this.ctx.questionBreak || this.ctx.timeExpired)) {
      this.setBreak(true);
      if (!this.ended) {
        if (!this.ctx.timeExpired) this.ctx.elapsedSec += dt;
        for (const s of this.systems) if (s.name === 'challenge' || s.name === 'roundTimer') s.update(dt, this.ctx);
        if (!this.ctx.questionBreak && !this.ctx.timeExpired) this.setBreak(false);
      }
      this.rig.update(0);
      return;
    }

    if (!this.started) this.runCountdown(dt);
    else if (!this.ended) this.ctx.elapsedSec += dt;

    perfProbe.begin('cars');
    for (const car of this.players) {
      const onIce = this.ctx.settings.map === 'tundra' && queuedIceAt(this.ctx.world, car.x, car.y);
      car.update(services.input.get(car.player), dt, onIce ? QUEUED_FEATURES.iceGrip : 1);
    }
    this.skids.update(dt);
    perfProbe.end('cars');
    if (this.started) for (const s of this.systems) {
      if (perfProbe.enabled) perfProbe.begin(`sys:${s.name}`);
      s.update(dt, this.ctx);
      if (perfProbe.enabled) perfProbe.end(`sys:${s.name}`);
      if (this.ctx.timeExpired) break;
    }
    if (this.started && !this.ended && !this.ctx.questionBreak) this.built.update?.(dt);
    // A system (challenge) may have just started a break: freeze right away.
    if (this.ctx.questionBreak || this.ctx.timeExpired) this.setBreak(true);
    if (this.started && !this.ended) this.updateMusicMix();
    this.rig.update(dt);
  }

  /** Freeze / unfreeze physics and quiet the engines for a question break. */
  private setBreak(on: boolean) {
    if (this.inBreak === on) return;
    this.inBreak = on;
    if (on) {
      this.matter.world.pause();
      for (const car of this.players) services.audio.engine(car.player).set(0, false);
    } else if (!this.ctx.paused) {
      this.matter.world.resume();
    }
    if (!this.ended) this.updateMusicMix();
  }

  private updateMusicMix(): void {
    const { settings, paused, elapsedSec, roundLengthSec } = this.ctx;
    if (!isQueuedMap(settings.map)) return;
    const finalStretch = roundLengthSec - elapsedSec <= Math.min(WORLD_MUSIC.finalSeconds, roundLengthSec * WORLD_MUSIC.finalFraction);
    const rushing = finalStretch || this.players.some(car => car.turbo);
    services.audio.setMusicMix(paused || this.inBreak ? 'quiet' : rushing ? 'rush' : 'driving');
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
      services.audio.music(this.raceMusic, 0.5);
      for (const car of this.players) car.setControlEnabled(true);
      bus.emit('round:start', { lengthSec: this.ctx.roundLengthSec });
    }
  }

  private setPaused(on: boolean) {
    if (this.ctx.paused === on) return;
    this.ctx.paused = on;
    if (on) this.matter.world.pause(); else if (!this.inBreak) this.matter.world.resume();
    this.updateMusicMix();
  }

  private endRound(results: RoundResults) {
    if (this.ended) return;
    this.ended = true;
    this.registry.set(REG.results, results);
    const settings = this.ctx.settings;
    const admin = settings.developerMode === true || this.registry.get(REG.settings)?.developerMode === true;
    const racers = settings.players.map((p, i) => playerRacer(p, i));
    const rewards = awardRacers(settings.map, results.goalsCompleted, racers, admin, new Rng(results.seed ^ 0x391bf724));
    for (const car of this.players) car.setControlEnabled(false);
    services.audio.setMusicMix('normal');
    services.audio.music('results', 0.5);
    bus.emit('ui:banner', { text: "TIME'S UP!", color: '#FFD700', durationSec: 3 });
    this.time.delayedCall(4000, () => {
      this.scene.stop(SCENE.hud);
      this.scene.start(SCENE.results, { settings, rewards });
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
    services.audio.setMusicMix('normal');
    bus.clear();
  }
}
