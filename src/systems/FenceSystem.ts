import { FARM_FENCE, FOREST } from '../config/gameConfig';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import type { Vec2 } from '../core/types';
import { getFarmFenceSections, type FarmFenceSection } from '../world/farmWorld';
import { getForestShrubs } from '../world/forestWorld';
import { fenceOffscreen, hitsFence } from './fenceLogic';

type ScatterProp = Omit<FarmFenceSection, 'shadow'> & { shadow?: FarmFenceSection['shadow'] };

/** Drive through fences and shrubs. They reset after leaving every player's view. */
export class FenceSystem implements GameSystem {
  readonly name = 'fence';
  static order = 75;
  private previous = new Map<IVehicle, Vec2>();
  private offStomp?: () => void;
  private sections: ScatterProp[] = [];

  update(dt: number, ctx: RaceContext): void {
    if (!this.sections.length) return;
    const forest = ctx.settings.map === 'forest';
    const hitRadius = forest ? FOREST.shrubHitRadius : FARM_FENCE.hitRadius;
    const scatterDistance = forest ? FOREST.shrubScatterDistance : FARM_FENCE.scatterDistance;
    const views = ctx.players.map((car) => ctx.camera.worldView(car.player));
    for (const car of ctx.players) {
      const current = { x: car.x, y: car.y };
      const previous = this.previous.get(car) ?? current;
      this.previous.set(car, current);
      const vx = current.x - previous.x, vy = current.y - previous.y;
      const moved = Math.hypot(vx, vy);
      if (car.airborne || car.disabled || car.boardingPosition || moved < 0.1 || moved > ctx.world.tileSize / 2) continue;
      this.scatter(previous, current, hitRadius, Math.atan2(vy, vx));
    }
    for (const f of this.sections) {
      if (!f.scatter) continue;
      const extent = forest ? Math.hypot(f.image.displayWidth, f.image.displayHeight) / 2 : f.length / 2;
      if (fenceOffscreen(f.x, f.y, extent + scatterDistance, views, FARM_FENCE.viewMargin)) {
        f.image.setPosition(f.x, f.y).setRotation(f.angle);
        f.shadow?.setVisible(true);
        f.scatter = undefined;
      } else if (f.scatter.elapsed < FARM_FENCE.scatterSec) {
        f.scatter.elapsed = Math.min(FARM_FENCE.scatterSec, f.scatter.elapsed + dt);
        const progress = 1 - (1 - f.scatter.elapsed / FARM_FENCE.scatterSec) ** 3;
        const shift = scatterDistance * progress;
        f.image.setPosition(f.x + Math.cos(f.scatter.angle) * shift, f.y + Math.sin(f.scatter.angle) * shift)
          .setRotation(f.angle + 1.2 * progress);
      }
    }
  }

  private scatter(start: Vec2, end: Vec2, radius: number, angle: number): void {
    for (const f of this.sections) {
      if (f.scatter) continue;
      const dx = Math.cos(f.angle) * f.length / 2, dy = Math.sin(f.angle) * f.length / 2;
      if (!hitsFence(start, end, { x: f.x - dx, y: f.y - dy }, { x: f.x + dx, y: f.y + dy }, radius)) continue;
      f.scatter = { angle, elapsed: 0 };
      f.shadow?.setVisible(false);
    }
  }

  init(ctx: RaceContext): void {
    this.sections = ctx.settings.map === 'forest' ? getForestShrubs(ctx.scene) : getFarmFenceSections(ctx.scene);
    if (!this.sections.length) return;
    this.offStomp = ctx.bus.on('dino:stompPath', ({ start, end, radius, direction }) => {
      this.scatter(start, end, radius, Math.atan2(direction.y, direction.x));
    });
  }

  destroy(): void { this.sections = []; this.previous.clear(); this.offStomp?.(); }
}
