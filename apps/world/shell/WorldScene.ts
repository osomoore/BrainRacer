import Phaser from 'phaser';
import { goToGame } from '../../../shared/hub';
import type { DeviceId, DeviceInput } from '../../../shared/input/deviceInput';
import { listProfiles, type PlayerProfile } from '../../../shared/profiles';
import { WORLD_HOST, WORLD_SAVE } from '../config';
import type { WorldContext, WorldModule, WorldModuleClass, WorldPlayer as LivePlayer } from '../core/runtime';
import { hexKey, hexToWorld } from '../gen/hex';
import { WorldGen } from '../gen/world';
import { createWorldBus } from '../host/bus';
import { followPlayer, viewRotation, worldCamera } from '../host/cameras';
import { idleControls, WorldControls } from '../host/controls';
import { drivePlayer } from '../host/drive';
import { FallbackGround } from '../host/fallbackGround';
import { LiveWorld } from '../host/liveWorld';
import { loadPlayerSave, readingOf, savePlayerSave } from '../logic/save';
import { worldSeed } from '../logic/seed';
import { activeCreation } from '../logic/slots';
import { traitsOf } from '../logic/traits';

/** ProfileScene's selection payload. The scene resolves these selections into runtime players. */
export interface WorldPlayer { profile: PlayerProfile; device: DeviceId }

const moduleFiles = import.meta.glob<{ default: WorldModuleClass }>('../{render,play,activities,hud}/**/*Module.ts', { eager: true });
const modules = Object.entries(moduleFiles)
  .filter(([, file]) => typeof file.default === 'function')
  .sort(([a, left], [b, right]) => (left.default.order ?? 0) - (right.default.order ?? 0) || a.localeCompare(b));
const hasPlayModule = modules.some(([path]) => path.startsWith('../play/'));
const hasTerrainModule = modules.some(([path]) => path.toLowerCase().endsWith('/terrainmodule.ts'));
const worldWindow = window as Window & { __world?: WorldContext | Phaser.Game };

function quickStart(): readonly WorldPlayer[] | undefined {
  if (!import.meta.env.DEV && import.meta.env.VITE_QA_QUICK_MAPS !== '1') return;
  const play = new URLSearchParams(location.search).get('play');
  if (play !== '1' && play !== '2') return;
  return ([1, 2] as const).slice(0, Number(play)).map(layout => ({
    profile: { id: `world-quick-${layout}`, name: `Player ${layout}`, createdAt: 0 },
    device: { kind: 'kb', layout },
  }));
}

export class WorldScene extends Phaser.Scene {
  private readonly quick: readonly WorldPlayer[] | undefined;
  private ctx?: WorldContext;

  constructor(private readonly devices: DeviceInput) {
    const quick = quickStart();
    super({ key: 'World', active: !!quick });
    this.quick = quick;
  }

  create(data: { players?: readonly WorldPlayer[] } = {}): void {
    const selections = data.players ?? this.quick;
    if (!selections?.length) { this.scene.start('Title'); return; }
    if (!data.players) this.scene.stop('Title');
    const seed = !data.players && !new URLSearchParams(location.search).has('seed') ? WORLD_HOST.quickSeed : worldSeed();
    const roster = [...listProfiles().map(p => p.id), ...selections.map(p => p.profile.id)];
    const gen = new WorldGen(seed, roster);
    const world = new LiveWorld(gen);
    const home = hexToWorld(gen.homeFor(selections[0].profile.id)!);
    const players = selections.map(({ profile }, i): LivePlayer => {
      const index = i as 0 | 1;
      const save = loadPlayerSave(profile.id);
      const creation = activeCreation(profile.id, save);
      const spawn = (selections.length === 1 ? save.last : undefined) ?? {
        x: home.x, y: home.y + (i - (selections.length - 1) / 2) * WORLD_HOST.spawnSpacing, angle: 0,
      };
      return {
        index, profileId: profile.id, name: profile.name, reading: readingOf(profile.id),
        save, creation, traits: traitsOf(creation), move: { ...spawn, vx: 0, vy: 0, airborne: 0 },
        hex: world.hexAt(spawn.x, spawn.y), surface: world.surfaceAt(spawn.x, spawn.y),
        camera: worldCamera(this, index, selections.length), controls: idleControls(),
        carrying: save.quests.filter(quest => quest.carrying).map(quest => quest.quest.item),
        busy: false,
      };
    });
    const deviceIds = selections.map(selection => selection.device);
    const input = new WorldControls(this.devices, deviceIds);
    const bus = createWorldBus();
    const saveDue = new Map<LivePlayer, number>();
    const sessionClaims = new Map(players.map(player => [player, new Set(player.save.claimed)]));
    let lastCheckpoint = 0;

    const ctx: WorldContext = {
      scene: this, bus, world, players, time: 0,
      showOnlyTo(obj, player) {
        if (players.length < 2) return;
        for (const other of players) {
          if (other === player) obj.cameraFilter &= ~other.camera.id;
          else obj.cameraFilter |= other.camera.id;
        }
      },
      save(player) { saveDue.set(player, ctx.time + WORLD_HOST.saveDebounceSeconds); },
      award(player, stars, claimId, at, reason) {
        if (!claimId || !Number.isSafeInteger(stars) || stars <= 0) return false;
        const claims = sessionClaims.get(player)!;
        if (claims.has(claimId) || player.save.claimed.includes(claimId)) return false;
        claims.add(claimId);
        player.save.claimed.push(claimId);
        if (player.save.claimed.length > WORLD_SAVE.claimedLimit) player.save.claimed.shift();
        player.save.stars = Math.min(Number.MAX_SAFE_INTEGER, player.save.stars + stars);
        ctx.save(player);
        bus.emit('stars:award', { player, stars, at, reason });
        return true;
      },
      setCreation(player, creation) {
        player.creation = creation;
        player.traits = traitsOf(creation);
        bus.emit('player:swap', { player, creation });
      },
      viewRotation,
    };
    this.ctx = ctx;
    for (const player of players) followPlayer(player, 0);
    // The entry point initially exposes the Phaser game. Publish the context after its boot call returns.
    queueMicrotask(() => { if (this.ctx === ctx) worldWindow.__world = ctx; });

    const early: WorldModule[] = [];
    const play: WorldModule[] = [];
    const later: WorldModule[] = hasTerrainModule ? [] : [new FallbackGround()];
    for (const [, { default: Module }] of modules) {
      const order = Module.order ?? 0;
      const phase = order < 100 ? early : order < 200 ? play : later;
      phase.push(new Module());
    }
    const running = [...early, ...play, ...later];
    for (const module of running) module.init(ctx);

    const persist = (player: LivePlayer) => {
      const { x, y, angle } = player.move;
      player.save.last = { x, y, angle };
      savePlayerSave(player.profileId, player.save);
      saveDue.delete(player);
    };
    const persistAll = () => players.forEach(persist);
    const offWorkshop = bus.on('nav:workshop', () => {
      persistAll();
      goToGame('workshop', '?from=world');
    });
    const offRespawn = bus.on('player:respawn', ({ player }) => followPlayer(player, 0));
    window.addEventListener('pagehide', persistAll);

    const tick = (_time: number, elapsed: number) => {
      const dt = Math.min(WORLD_HOST.maxFrameSeconds, elapsed / 1000);
      ctx.time += dt;
      const controls = input.sample(deviceIds);
      for (const player of players) player.controls = controls[player.index];
      if (!hasPlayModule && players[0].controls.pressed.menu) { this.scene.start('Title'); return; }
      for (const module of early) module.update(dt);
      if (!hasPlayModule) for (const player of players) drivePlayer(ctx, world, player, dt);
      for (const module of play) module.update(dt);
      for (const player of players) {
        this.updateLocation(ctx, player);
        followPlayer(player, dt);
      }
      for (const module of later) module.update(dt);
      world.prune(players);
      if (ctx.time - lastCheckpoint >= WORLD_HOST.saveEverySeconds) {
        persistAll();
        lastCheckpoint = ctx.time;
      }
      for (const [player, due] of saveDue) if (ctx.time >= due) persist(player);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      persistAll();
      offWorkshop();
      offRespawn();
      input.destroy();
      window.removeEventListener('pagehide', persistAll);
      this.events.off(Phaser.Scenes.Events.UPDATE, tick);
      for (const module of running.reverse()) module.destroy?.();
      if (worldWindow.__world === ctx) worldWindow.__world = this.game;
      this.ctx = undefined;
    });
  }

  private updateLocation(ctx: WorldContext, player: LivePlayer): void {
    const { x, y } = player.move;
    const from = player.hex;
    const to = ctx.world.hexAt(x, y);
    player.surface = ctx.world.surfaceAt(x, y);
    if (hexKey(from) !== hexKey(to)) {
      player.hex = to;
      ctx.bus.emit('player:hex', { player, from, to, biome: player.surface.biome });
    }
  }
}
