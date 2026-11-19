import Phaser from 'phaser';
import { COLLISION } from '../config/gameConfig';
import type { CrashWith } from '../core/events';
import { ownerOf, type BodyOwner, type GameSystem, type RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId } from '../core/types';

const STEP_HZ = 60; // Matter velocity is px/step; see Vehicle.ts

interface PairLike {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  collision?: { normal?: { x: number; y: number } };
  normal?: { x: number; y: number };
}

export class CollisionSystem implements GameSystem {
  readonly name = 'collision';
  private ctx!: RaceContext;
  private clockMs = 0;
  private lastEmit = new Map<string, number>();
  private handler = (event: { pairs: PairLike[] }) => this.onStart(event.pairs);

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    ctx.scene.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
  }

  update(dtSec: number, _ctx?: RaceContext): void {
    this.clockMs += dtSec * 1000;
    if (this.lastEmit.size > 64) {
      for (const [k, t] of this.lastEmit) if (this.clockMs - t > COLLISION.pairThrottleMs * 4) this.lastEmit.delete(k);
    }
  }

  destroy(): void {
    this.ctx?.scene.matter?.world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    this.lastEmit.clear();
  }

  private onStart(pairs: PairLike[]): void {
    for (const pair of pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      if (a.isSensor || b.isSensor) continue;
      const oa = ownerOf(a), ob = ownerOf(b);
      if (!oa || !ob) continue;
      const pa = oa.kind === 'player' ? oa : null;
      const pb = ob.kind === 'player' ? ob : null;
      if (!pa && !pb && !(oa.kind === 'npc' && ob.kind === 'npc')) continue; // player hits and npc-npc hits only

      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      const last = this.lastEmit.get(key);
      if (last !== undefined && this.clockMs - last < COLLISION.pairThrottleMs) continue;

      // Relative velocity along the collision normal (px/step -> px/s).
      const n = pair.collision?.normal ?? pair.normal ?? { x: 1, y: 0 };
      const rvx = (a.velocity.x - b.velocity.x) * STEP_HZ;
      const rvy = (a.velocity.y - b.velocity.y) * STEP_HZ;
      const impact = Math.abs(rvx * n.x + rvy * n.y);
      if (impact < COLLISION.minImpact) continue;
      this.lastEmit.set(key, this.clockMs);

      const player = (pa ?? pb)?.player ?? null;
      let withKind: CrashWith;
      if (pa && pb) withKind = 'player';
      else if (!pa && !pb) withKind = this.classify(ob);
      else withKind = this.classify(pa ? ob : oa);
      if (withKind === 'dino') continue; // DinoSystem owns dino hits

      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      this.ctx.bus.emit('vehicle:crash', { player, with: withKind, impact, x, y });
      if (pa) this.ctx.bus.emit('vehicle:damage', { player: pa.player, impact });
      if (pb) this.ctx.bus.emit('vehicle:damage', { player: pb.player, impact });
      this.feedback(player, impact);
    }
  }

  private classify(o: BodyOwner): CrashWith {
    switch (o.kind) {
      case 'npc': return o.npc.npcKind === 'police' ? 'police' : 'traffic';
      case 'player': return 'player';
      case 'prop': return 'prop';
      case 'dino': return 'dino';
      default: return 'building';
    }
  }

  private feedback(player: PlayerId | null, impact: number): void {
    const big = impact >= COLLISION.bigImpact;
    const volume = Math.min(1, Math.max(0.25, impact / 700));
    const twoPlayers = this.ctx.players.length > 1;
    const pan = player === null || !twoPlayers ? 0 : player === 0 ? -0.6 : 0.6;
    services.audio.sfx(big ? 'crashBig' : 'crash', { pan, volume });
    if (player !== null) {
      services.input.rumble(player, Math.min(1, impact / 800), big ? 220 : 100);
      if (big) {
        const t = Math.min(1, (impact - COLLISION.bigImpact) / 600);
        this.ctx.camera.shake(player, COLLISION.shakeMin + (COLLISION.shakeMax - COLLISION.shakeMin) * t, COLLISION.shakeMs);
      }
    }
  }
}
