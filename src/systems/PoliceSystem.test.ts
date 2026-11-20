import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLICE } from '../config/gameConfig';
import { EventBus } from '../core/events';
import type { INpcVehicle, RaceContext } from '../core/race';
import { Rng } from '../core/rng';
import { services } from '../core/services';
import { Tile, type PlayerId } from '../core/types';
import { PoliceCar } from '../entities/PoliceCar';
import { newBrain } from '../entities/policeAI';
import { isPoliceTexture, PoliceSystem } from './PoliceSystem';

vi.mock('../entities/PoliceCar', () => ({
  PoliceCar: class {
    readonly npcKind = 'police';
    readonly brain = newBrain();
    readonly spec = { maxSpeed: 400 };
    readonly velocity = { x: 0, y: 0 };
    forwardSpeed = 0;
    mode = 'patrol';
    target = null;
    backoff = 0;
    leaveSec = 0;
    destroyed = false;

    constructor(_: unknown, private npcs: Set<unknown>, public x: number, public y: number, public angle: number) {
      npcs.add(this);
    }

    step() {}
    applyImpulse() {}
    destroy() {
      this.destroyed = true;
      this.npcs.delete(this);
    }
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe('PoliceSystem pursuit slots', () => {
  it('shares the two-slot cap between spawns and patrols, independently for each player', () => {
    vi.stubGlobal('location', { search: '?heat=100' });
    const npcs = new Set<INpcVehicle>();
    const bus = new EventBus();
    const players = [
      { player: 0, x: 100, y: 100, velocity: { x: 0, y: 0 }, turbo: false, slow: vi.fn(), applyImpulse: vi.fn() },
      { player: 1, x: 4900, y: 100, velocity: { x: 0, y: 0 }, turbo: false, slow: vi.fn(), applyImpulse: vi.fn() },
    ];
    const ctx = {
      bus, npcs, players, rng: new Rng(3), elapsedSec: 1,
      dino: { active: false, rider: null },
      world: {
        widthTiles: 65, heightTiles: 3, tileSize: 100,
        tiles: new Uint8Array(65 * 3).fill(Tile.Road),
        laneGraph: { nodes: [1100, 1300, 5900, 6100].map((x, i) => ({ id: i, x, y: 100, next: [i ^ 1] })) },
      },
      camera: { worldView: (p: PlayerId) => ({ x: players[p].x - 300, y: 0, w: 600, h: 300 }) },
    } as unknown as RaceContext;
    const police = new PoliceSystem();
    police.init(ctx);

    // Place patrols in sight while the real population logic spawns the first chaser.
    const spawn = (x: number): PoliceCar =>
      (police as unknown as { spawn(spot: { x: number; y: number; angle: number }): PoliceCar })
        .spawn({ x, y: 100, angle: 0 });
    const chasers = (player: PlayerId): PoliceCar[] =>
      Array.from(npcs as Set<PoliceCar>).filter((c) => c.mode === 'chase' && c.target === player);
    const patrol1 = spawn(180);
    const reserve = spawn(200);
    spawn(4980);
    spawn(5000);
    spawn(5020);
    for (let i = 0; i < 5; i++) bus.emit('vehicle:crash', { player: 1, with: 'traffic', impact: 600, x: 4900, y: 100 });

    police.update(0.01);
    expect(chasers(0)).toHaveLength(2);
    expect(chasers(1)).toHaveLength(2);
    expect(patrol1.target).toBe(0);
    expect(reserve.mode).toBe('patrol');

    bus.emit('vehicle:crash', { player: 0, with: 'police', impact: 600, x: patrol1.x, y: patrol1.y });
    expect(patrol1.backoff).toBe(POLICE.bumpBackoffSec);
    police.update(0.01);
    expect(chasers(0)).toHaveLength(2);
    expect(reserve.mode).toBe('patrol');

    // Capturing a cruiser removes it immediately and leaves a slot for the reserve.
    patrol1.destroy();
    police.update(0.01);
    expect(chasers(0)).toHaveLength(2);
    expect(reserve.target).toBe(0);
    expect(chasers(1)).toHaveLength(2);
    police.destroy();
  });
});

describe('isPoliceTexture', () => {
  it('matches only the police light-bar chassis keys', () => {
    expect(isPoliceTexture('police_0')).toBe(true);
    expect(isPoliceTexture('police_1')).toBe(true);
    expect(isPoliceTexture('traffic_0')).toBe(false);
    expect(isPoliceTexture('')).toBe(false);
    expect(isPoliceTexture(undefined)).toBe(false);
  });
});

describe('PoliceSystem player siren', () => {
  const setup = (texture: string) => {
    vi.stubGlobal('location', { search: '' });
    const bus = new EventBus();
    const player = { player: 0, x: 0, y: 0, velocity: { x: 0, y: 0 }, chassis: { texture: { key: texture } } };
    const ctx = {
      bus, npcs: new Set<INpcVehicle>(), players: [player], rng: new Rng(3), elapsedSec: 1,
      dino: { active: false, rider: null },
      paused: false, questionBreak: false,
      world: {
        widthTiles: 1, heightTiles: 1, tileSize: 100, tiles: new Uint8Array([Tile.Road]),
        laneGraph: { nodes: [] },
      },
      camera: { worldView: () => ({ x: 0, y: 0, w: 100, h: 100 }) },
    } as unknown as RaceContext;
    const stop = vi.fn();
    const loop = vi.spyOn(services.audio, 'loop').mockReturnValue(stop);
    const police = new PoliceSystem();
    police.init(ctx);
    return { ctx, bus, player, police, stop, loop };
  };

  it('loops louder while the player drives a cruiser, and stops when they leave it', () => {
    const { player, police, stop, loop } = setup('police_0');
    police.update(0.016);
    expect(loop).toHaveBeenCalledWith('siren', { pan: 0, volume: 0.7, sirenTone: 'bright' });
    expect(POLICE.playerSirenVolume).toBeGreaterThan(POLICE.sirenVolume);
    police.update(0.016);
    expect(loop).toHaveBeenCalledTimes(1);

    player.chassis.texture.key = 'traffic_0';
    police.update(0.016);
    expect(stop).toHaveBeenCalledTimes(1);
    police.destroy();
  });

  it('is silenced by pause and question breaks, and resumes after them', () => {
    const { ctx, bus, police, stop, loop } = setup('police_1');
    police.update(0.016);
    bus.emit('game:pause', { by: 0 });
    expect(stop).toHaveBeenCalledTimes(1);

    bus.emit('game:resume', {});
    police.update(0.016);
    expect(loop).toHaveBeenCalledTimes(2);

    ctx.questionBreak = true;
    bus.emit('challenge:shown', { challenge: {} as never });
    expect(stop).toHaveBeenCalledTimes(2);
    ctx.questionBreak = false;
    police.update(0.016);
    expect(loop).toHaveBeenCalledTimes(3);
    police.destroy();
  });

  it('stops for good when the round ends and on destroy', () => {
    const { bus, police, stop, loop } = setup('police_0');
    police.update(0.016);
    bus.emit('round:end', { results: {} as never });
    expect(stop).toHaveBeenCalledTimes(1);
    police.update(0.016);
    expect(loop).toHaveBeenCalledTimes(1);
    police.destroy();
    expect(stop).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
