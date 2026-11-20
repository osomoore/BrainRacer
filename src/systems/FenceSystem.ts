import { FARM_FENCE } from '../config/gameConfig';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import type { Vec2 } from '../core/types';
import { getFarmFenceSections, type FarmFenceSection } from '../world/farmWorld';
import { fenceOffscreen, hitsFence } from './fenceLogic';

/** Drive through farm fences; the knocked-aside sections return once everyone has moved away. */
export class FenceSystem implements GameSystem {
  readonly name = 'fence';
  static order = 75;
  private previous = new Map<IVehicle, Vec2>();
  private offStomp?: () => void;

  update(dt: number, ctx: RaceContext): void {
    if (!ctx.world.farm) return;
    const sections = getFarmFenceSections(ctx.scene);
    const views = ctx.players.map((car) => ctx.camera.worldView(car.player));
    for (const car of ctx.players) {
      const current = { x: car.x, y: car.y };
      const previous = this.previous.get(car) ?? current;
      this.previous.set(car, current);
      const vx = current.x - previous.x, vy = current.y - previous.y;
      const moved = Math.hypot(vx, vy);
      if (car.airborne || car.disabled || car.boardingPosition || moved < 0.1 || moved > ctx.world.tileSize / 2) continue;
      this.scatter(sections, previous, current, FARM_FENCE.hitRadius, Math.atan2(vy, vx));
    }
    for (const f of sections) {
      if (!f.scatter) continue;
      if (fenceOffscreen(f.x, f.y, f.length / 2 + FARM_FENCE.scatterDistance, views, FARM_FENCE.viewMargin)) {
        f.image.setPosition(f.x, f.y).setRotation(f.angle);
        f.shadow.setVisible(true);
        f.scatter = undefined;
      } else if (f.scatter.elapsed < FARM_FENCE.scatterSec) {
        f.scatter.elapsed = Math.min(FARM_FENCE.scatterSec, f.scatter.elapsed + dt);
        const progress = 1 - (1 - f.scatter.elapsed / FARM_FENCE.scatterSec) ** 3;
        const shift = FARM_FENCE.scatterDistance * progress;
        f.image.setPosition(f.x + Math.cos(f.scatter.angle) * shift, f.y + Math.sin(f.scatter.angle) * shift)
          .setRotation(f.angle + 1.2 * progress);
      }
    }
  }

  private scatter(sections: FarmFenceSection[], start: Vec2, end: Vec2, radius: number, angle: number): void {
    for (const f of sections) {
      if (f.scatter) continue;
      const dx = Math.cos(f.angle) * f.length / 2, dy = Math.sin(f.angle) * f.length / 2;
      if (!hitsFence(start, end, { x: f.x - dx, y: f.y - dy }, { x: f.x + dx, y: f.y + dy }, radius)) continue;
      f.scatter = { angle, elapsed: 0 };
      f.shadow.setVisible(false);
    }
  }

  init(ctx: RaceContext): void {
    if (!ctx.world.farm) return;
    const sections = getFarmFenceSections(ctx.scene);
    this.offStomp = ctx.bus.on('dino:stompPath', ({ start, end, radius, direction }) => {
      this.scatter(sections, start, end, radius, Math.atan2(direction.y, direction.x));
    });
  }

  destroy(): void { this.previous.clear(); this.offStomp?.(); }
}
