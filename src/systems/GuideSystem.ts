/** Guide buddies: one flying dino / star per player that leads the way to the goal and circles it on arrival. */
import { GAME_HEIGHT, GAME_WIDTH, GUIDE } from '../config/gameConfig';
import type { GoalState } from '../core/events';
import { GuideBuddy } from '../entities/GuideBuddy';
import { distToPath, edgeHoldDist, goalRingInView, hoverSpot, nextGoalMode, obstacleDist, orbitPoint, pointAlongPath, trimPath, viewEdgeDist } from '../entities/guideMath';
import { NodeIndex, findPath } from '../entities/policeAI';
import type { GameSystem, RaceContext } from '../core/race';
import type { PlayerId, Rect, Vec2 } from '../core/types';
import { scoreboardRect } from '../ui/hud/hudConfig';

const FULL_VIEW = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };

interface PlayerGuide {
  buddy: GuideBuddy;
  path: number[];
  repathT: number;
  pathGoal: number;
  goalMode: boolean;
  arrived: boolean;
  orbit: number;
}

export class GuideSystem implements GameSystem {
  readonly name = 'guide';
  static order = 160;   // after cars have moved this frame
  private guides: PlayerGuide[] = [];
  private index: NodeIndex | null = null;
  private offs: (() => void)[] = [];

  init(ctx: RaceContext): void {
    const graph = ctx.world?.laneGraph;
    if (graph && graph.nodes.length) this.index = new NodeIndex(graph);
    this.guides = ctx.players.map((car, i) => ({
      buddy: new GuideBuddy(ctx, car.player, car.kind),
      path: [], repathT: 0, pathGoal: -1, goalMode: false, arrived: false, orbit: i * Math.PI,
    }));
    this.offs.push(
      ctx.bus.on('goal:spawned', () => { for (const g of this.guides) { g.arrived = false; g.path = []; g.repathT = 0; } }),
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
        g.goalMode = nextGoalMode(g.goalMode, d, g.arrived, GUIDE);
        g.buddy.setHappy(g.goalMode);
        if (g.goalMode) {
          g.orbit += GUIDE.orbitSpeed * dt;
          const rot = ctx.camera.viewRotation(car.player);   // world direction of screen-up
          const c = { x: goal.x - Math.sin(rot) * GUIDE.orbitLift, y: goal.y - Math.cos(rot) * GUIDE.orbitLift };
          target = orbitPoint(c, g.orbit, GUIDE.orbitRadius);
        } else if (view && this.goalVisible(ctx, car.player, goal, view)) {
          // Traffic lanes can take a detour even when the player can already see the destination.
          g.repathT = 0;
          target = hoverSpot(pos, goal, Math.min(holdFor(goal), d), car.angle);
          const fly = g.buddy.fly;
          if ((fly.x - pos.x) * (goal.x - pos.x) + (fly.y - pos.y) * (goal.y - pos.y) < 0) {
            g.buddy.snapTo(target);
          }
        } else {
          const ahead = this.routeLookAhead(g, ctx, pos, goal, dt);
          const toAhead = Math.hypot(ahead.x - pos.x, ahead.y - pos.y);
          target = hoverSpot(pos, ahead, Math.min(holdFor(ahead), Math.max(toAhead, GUIDE.holdDist)), car.angle);
        }
      }
      g.buddy.update(dt, target, { x: car.x, y: car.y, vx: car.velocity.x, vy: car.velocity.y, angle: car.angle });
    });
  }

  private goalVisible(ctx: RaceContext, player: PlayerId, goal: GoalState, view: Rect): boolean {
    const center = ctx.camera.worldToScreen(player, goal.x, goal.y);
    const rim = ctx.camera.worldToScreen(player, goal.x + (goal.ringRadius ?? goal.radius), goal.y);
    return goalRingInView(center, Math.hypot(rim.x - center.x, rim.y - center.y), view);
  }

  /** Look ahead along the lane-graph route, with the goal itself as the fallback. */
  private routeLookAhead(g: PlayerGuide, ctx: RaceContext, pos: Vec2, goal: GoalState, dt: number): Vec2 {
    const graph = ctx.world?.laneGraph;
    let ahead: Vec2 = { x: goal.x, y: goal.y };
    if (graph && this.index) {
      g.repathT -= dt;
      const off = g.path.length > 0 && distToPath(graph, g.path, pos) > GUIDE.offRouteDist;
      if (g.repathT <= 0 || g.pathGoal !== goal.id || off) {
        g.repathT = GUIDE.repathSec;
        g.pathGoal = goal.id;
        g.path = [];
        const from = this.index.nearest(pos.x, pos.y);
        const to = this.index.nearest(goal.x, goal.y);
        if (from >= 0 && to >= 0) {
          const n = graph.nodes[from];
          if (Math.hypot(n.x - pos.x, n.y - pos.y) <= GUIDE.noRouteNodeDist) g.path = findPath(graph, from, to) ?? [];
        }
      }
      if (g.path.length) {
        g.path = trimPath(graph, g.path, pos);
        if (g.path.length) ahead = pointAlongPath(graph, g.path, pos, GUIDE.lookAhead);
      }
    }
    return ahead;
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
    this.index = null;
  }
}
