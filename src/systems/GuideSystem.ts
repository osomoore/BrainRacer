/** Guide buddies lead each player to the goal and circle it on arrival. */
import { GAME_HEIGHT, GAME_WIDTH, GUIDE, SKY_DRAWBRIDGE, UNDERWATER_CROSSING } from '../config/gameConfig';
import { GuideBuddy } from '../entities/GuideBuddy';
import { edgeHoldDist, hoverSpot, nextGoalMode, obstacleDist, orbitPoint, viewEdgeDist } from '../entities/guideMath';
import type { GameSystem, RaceContext } from '../core/race';
import type { PlayerId, Rect, Vec2 } from '../core/types';
import { scoreboardRect } from '../ui/hud/hudConfig';
import { guideRoute } from '../world/guideRoute';

const FULL_VIEW = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };

interface PlayerGuide {
  buddy: GuideBuddy;
  goalMode: boolean;
  arrived: boolean;
  orbit: number;
  redirect: boolean;
}

export class GuideSystem implements GameSystem {
  readonly name = 'guide';
  static order = 160;   // after cars have moved this frame
  private guides: PlayerGuide[] = [];
  private offs: (() => void)[] = [];
  private spanTile?: number;
  private spanSurface?: number;
  private routedGoal?: Vec2;
  private towardGoal?: (car: Vec2) => Vec2;

  init(ctx: RaceContext): void {
    const w = ctx.world.widthTiles;
    if (ctx.settings.map === 'sky') this.spanTile = SKY_DRAWBRIDGE.row * w + SKY_DRAWBRIDGE.left;
    if (ctx.settings.map === 'underwater') this.spanTile = UNDERWATER_CROSSING.top * w + UNDERWATER_CROSSING.left;
    this.guides = ctx.players.map((car, i) => ({
      buddy: new GuideBuddy(ctx, car.player, ctx.settings.players[i]?.guide ?? (car.kind === 'dino' ? 'dino' : 'star')),
      goalMode: false, arrived: false, orbit: i * Math.PI, redirect: false,
    }));
    this.offs.push(
      ctx.bus.on('goal:spawned', () => {
        for (const g of this.guides) {
          g.arrived = g.goalMode = false;
          g.redirect = true;
        }
      }),
      ctx.bus.on('goal:arrived', ({ player }) => { const g = this.byPlayer(ctx, player); if (g) g.arrived = true; }),
      ctx.bus.on('goal:completed', () => { for (const g of this.guides) { g.arrived = false; g.goalMode = false; g.buddy.setHappy(false); } }),
    );
  }

  private byPlayer(ctx: RaceContext, player: PlayerId): PlayerGuide | undefined {
    const i = ctx.players.findIndex((p) => p.player === player);
    return this.guides[i];
  }

  update(dt: number, ctx: RaceContext): void {
    const goal = ctx.goal;
    if (goal && this.spanTile !== undefined) {
      const surface = ctx.world.tiles[this.spanTile];
      if (this.routedGoal !== goal || this.spanSurface !== surface) {
        this.routedGoal = goal;
        this.spanSurface = surface;
        this.towardGoal = guideRoute(ctx.world, goal);
      }
    }
    const layout = ctx.camera.layout();
    ctx.players.forEach((car, i) => {
      const g = this.guides[i];
      if (!g) return;
      const pos: Vec2 = { x: car.x, y: car.y };
      const view = layout.mode === 'merged' ? FULL_VIEW : layout.playerViews[i];
      const holdFor = (toward: Vec2) => this.holdFor(ctx, car.player, pos, toward, view, layout.mode === 'split');
      let target: Vec2;
      if (!goal) {
        g.goalMode = false;
        g.buddy.setHappy(false);
        const fwd = { x: car.x + Math.cos(car.angle), y: car.y + Math.sin(car.angle) };
        target = hoverSpot(pos, fwd, holdFor(fwd), car.angle);
      } else {
        const d = Math.hypot(goal.x - car.x, goal.y - car.y);
        const toward = this.towardGoal?.(pos) ?? goal;
        g.goalMode = toward === goal && nextGoalMode(g.goalMode, d, g.arrived, GUIDE);
        g.buddy.setHappy(g.goalMode);
        if (g.goalMode) {
          g.orbit += GUIDE.orbitSpeed * dt;
          const rot = ctx.camera.viewRotation(car.player);   // world direction of screen-up
          const c = { x: goal.x - Math.sin(rot) * GUIDE.orbitLift, y: goal.y - Math.cos(rot) * GUIDE.orbitLift };
          target = orbitPoint(c, g.orbit, GUIDE.orbitRadius);
        } else {
          target = hoverSpot(pos, toward, Math.min(holdFor(toward), Math.hypot(toward.x - car.x, toward.y - car.y)), car.angle);
        }
      }
      if (g.redirect) {
        g.buddy.redirect(target);
        g.redirect = false;
      }
      g.buddy.update(dt, target, { x: car.x, y: car.y, vx: car.velocity.x, vy: car.velocity.y, angle: car.angle });
    });
  }

  /** Hover distance (world px): GUIDE.edgeFrac of the way from the car to the edge of its view, toward `toward`. */
  private holdFor(ctx: RaceContext, player: PlayerId, pos: Vec2, toward: Vec2, r: Rect | undefined, split: boolean): number {
    const cam = ctx.camera;
    if (!r) return GUIDE.holdDist;
    // Split views keep the seam and top clear of the shared scoreboard and destination cards.
    const seam = split ? GUIDE.seamInset : 0;
    const top = ctx.players.length > 1 ? GUIDE.topInset : 0;
    const view = { x: r.x + (player === 1 ? seam : 0), y: r.y + top, w: r.w - seam, h: r.h - top };
    const dx = toward.x - pos.x, dy = toward.y - pos.y, l = Math.hypot(dx, dy);
    if (l < 1e-3) return GUIDE.holdDist;
    const u = { x: dx / l, y: dy / l };
    const s0 = cam.worldToScreen(player, pos.x, pos.y);
    const s1 = cam.worldToScreen(player, pos.x + u.x * 100, pos.y + u.y * 100);
    const sx = s1.x - s0.x, sy = s1.y - s0.y, sl = Math.hypot(sx, sy);
    if (sl < 1e-3) return GUIDE.holdDist;
    const zoom = sl / 100;
    const dir = { x: sx / sl, y: sy / sl };
    let edge = viewEdgeDist(s0, dir, view);
    if (ctx.players.length === 1) edge = Math.min(edge, obstacleDist(s0, dir, scoreboardRect(1)));
    return edgeHoldDist(edge, GUIDE.edgeFrac, GUIDE.edgeMargin, zoom, GUIDE.holdDist, GUIDE.holdMax);
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    for (const g of this.guides) g.buddy.destroy();
    this.guides = [];
  }
}
