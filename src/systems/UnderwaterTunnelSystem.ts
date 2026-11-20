import { CAT, UNDERWATER_CROSSING, UNDERWATER_TUNNEL } from '../config/gameConfig';
import type { GameSystem, INpcVehicle, IPlayerCar, RaceContext } from '../core/race';
import { services } from '../core/services';
import {
  advanceUnderwaterTunnel, makeUnderwaterTunnel, setUnderwaterTunnelOpen, UNDERWATER_WARNING_START,
  underwaterCrossingOccupied, underwaterTunnelFrame,
} from '../world/underwaterTunnel';

export class UnderwaterTunnelSystem implements GameSystem {
  readonly name = 'underwaterTunnel';
  private ctx?: RaceContext;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private draw?: ReturnType<typeof makeUnderwaterTunnel>;
  private gate?: MatterJS.BodyType;
  private phase = 0;
  private clock = 0;
  private ended = false;
  private offEnd?: () => void;

  init(ctx: RaceContext): void {
    if (ctx.settings.map !== 'underwater') return;
    this.ctx = ctx;
    if (new URLSearchParams(location.search).get('underwater') === 'now') {
      this.phase = UNDERWATER_WARNING_START - UNDERWATER_TUNNEL.testLeadSec;
    }
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; });
    this.draw = makeUnderwaterTunnel(ctx.scene, ctx.world.tileSize, this.objects);
    this.draw(this.phase, this.clock);
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.ctx || this.ended || ctx.paused || ctx.questionBreak) return;
    const ts = ctx.world.tileSize;
    const { top, bottom, left, right } = UNDERWATER_CROSSING;
    const cx = (left + right) * ts / 2;
    const cy = (top + bottom) * ts / 2;
    const before = underwaterTunnelFrame(this.phase);
    const overlaps = (vehicle: IPlayerCar | INpcVehicle) => {
      if ('destroyed' in vehicle && vehicle.destroyed) return false;
      const radius = Math.hypot(vehicle.spec.length, vehicle.spec.width) / 2 + UNDERWATER_TUNNEL.clearancePx;
      return underwaterCrossingOccupied(vehicle, radius, ts);
    };
    const { dino } = ctx;
    const occupied = before.warning && !before.open && (
      ctx.players.some(overlaps) || [...ctx.npcs].some(overlaps) ||
      (dino.active && underwaterCrossingOccupied(dino, dino.radius + UNDERWATER_TUNNEL.clearancePx, ts))
    );
    this.clock += dt;
    this.phase = advanceUnderwaterTunnel(this.phase, dt, occupied);
    const { warning, open } = underwaterTunnelFrame(this.phase);
    if (warning && !before.warning) {
      const closest = Math.min(...ctx.players.map(car => Math.hypot(car.x - cx, car.y - cy)));
      const gain = Math.max(0, 1 - closest / UNDERWATER_TUNNEL.soundRadius);
      if (gain > 0) services.audio.sfx('crossing', { volume: gain });
    }
    if (open && !this.gate) {
      this.gate = ctx.scene.matter.add.rectangle(cx, cy, (right - left) * ts, (bottom - top) * ts, {
        isStatic: true,
        label: 'underwater-open-tunnel',
        collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 },
        plugin: { owner: { kind: 'boundary' } },
      }) as unknown as MatterJS.BodyType;
      setUnderwaterTunnelOpen(ctx.world, true);
    } else if (!open && this.gate) {
      ctx.scene.matter.world.remove(this.gate);
      this.gate = undefined;
      setUnderwaterTunnelOpen(ctx.world, false);
    }
    this.draw?.(this.phase, this.clock);
  }

  destroy(): void {
    this.offEnd?.();
    if (this.gate && this.ctx) {
      this.ctx.scene.matter.world?.remove(this.gate);
      setUnderwaterTunnelOpen(this.ctx.world, false);
    }
    this.gate = undefined;
    this.ctx = undefined;
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.draw = undefined;
  }
}
