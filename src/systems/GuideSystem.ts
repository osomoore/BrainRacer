/** Guide buddies: one flying dino / star per player that leads the way to the goal and circles it on arrival. */
import { GUIDE } from '../config/gameConfig';
import { GuideBuddy } from '../entities/GuideBuddy';
import { distToPath, edgeHoldDist, hoverSpot, viewEdgeDist, nextGoalMode, orbitPoint, pointAlongPath, trimPath } from '../entities/guideMath';
import { NodeIndex, findPath } from '../entities/policeAI';
import type { GameSystem, RaceContext } from '../core/race';
import type { PlayerId, Vec2 } from '../core/types';

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
  static order = 160;   // after cars/camera have moved this frame
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
    ctx.players.forEach((car, i) => {
      const g = this.guides[i];
      if (!g) return;
      const pos: Vec2 = { x: car.x, y: car.y };
      let target: Vec2;
      if (!goal) {
        g.goalMode = false;
        g.buddy.setHappy(false);
        const fwd = { x: car.x + Math.cos(car.angle), y: car.y + Math.sin(car.angle) };
        target = hoverSpot(pos, fwd, this.holdFor(ctx, i, pos, fwd), car.angle);
      } else {
        const d = Math.hypot(goal.x - car.x, goal.y - car.y);
        g.goalMode = nextGoalMode(g.goalMode, d, g.arrived, GUIDE);
        g.buddy.setHappy(g.goalMode);
        if (g.goalMode) {
          g.orbit += GUIDE.orbitSpeed * dt;
          const rot = ctx.camera.viewRotation(car.player);   // world direction of screen-up
          const c = { x: goal.x - Math.sin(rot) * GUIDE.orbitLift, y: goal.y - Math.cos(rot) * GUIDE.orbitLift };
          target = orbitPoint(c, g.orbit, GUIDE.orbitRadius);
        } else {
          target = this.guideSpot(g, ctx, i, pos, goal, car.angle, dt);
        }
      }
      g.buddy.update(dt, target, { x: car.x, y: car.y, vx: car.velocity.x, vy: car.velocity.y, angle: car.angle });
    });
  }

  /** Hover spot ahead of the car along the lane-graph route (straight line if there is none). */
  private guideSpot(g: PlayerGuide, ctx: RaceContext, idx: number, pos: Vec2, goal: { id: number; x: number; y: number }, carAngle: number, dt: number): Vec2 {
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
    const toAhead = Math.hypot(ahead.x - pos.x, ahead.y - pos.y);
    return hoverSpot(pos, ahead, Math.min(this.holdFor(ctx, idx, pos, ahead), Math.max(toAhead, GUIDE.holdDist)), carAngle);
  }

  /** Hover distance (world px): GUIDE.edgeFrac of the way from the car to the edge of its view, toward `toward`. */
  private holdFor(ctx: RaceContext, idx: number, pos: Vec2, toward: Vec2): number {
    const cam = ctx.camera;
    const player = ctx.players[idx].player;
    const layout = cam.layout();
    const r = layout.mode === 'merged' ? { x: 0, y: 0, w: 1920, h: 1080 } : layout.playerViews[idx];
    if (!r) return GUIDE.holdDist;
    // keep clear of the centre HUD (scoreboard): inset the top, and the seam side in split screen
    const seam = layout.mode === 'split' ? GUIDE.seamInset : 0;
    const left = r.x + (idx === 1 ? seam : 0), right = r.x + r.w - (idx === 0 ? seam : 0);
    const view = { x: left, y: r.y + GUIDE.topInset, w: right - left, h: r.h - GUIDE.topInset };
    const dx = toward.x - pos.x, dy = toward.y - pos.y, l = Math.hypot(dx, dy);
    if (l < 1e-3) return GUIDE.holdDist;
    const u = { x: dx / l, y: dy / l };
    const s0 = cam.worldToScreen(player, pos.x, pos.y);
    const s1 = cam.worldToScreen(player, pos.x + u.x * 100, pos.y + u.y * 100);
    const sx = s1.x - s0.x, sy = s1.y - s0.y, sl = Math.hypot(sx, sy);
    if (sl < 1e-3) return GUIDE.holdDist;
    const zoom = sl / 100;
    const edge = viewEdgeDist(s0, { x: sx / sl, y: sy / sl }, view);
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
