import type { WorldContext, WorldPlayer } from '../core/runtime';
import { canGroundAt, step, type MoveResult, type MoveWorld } from '../logic/move';
import { activeCreation, swapCreation } from '../logic/slots';
import { traitsOf } from '../logic/traits';

export function quickSwap(ctx: WorldContext, player: WorldPlayer): void {
  const using = swapCreation(player.save.using);
  const creation = activeCreation(player.profileId, { ...player.save, using });
  if (player.move.flying) {
    const traits = traitsOf(creation, player.reading);
    if (!traits.wings && !canGroundAt(ctx.world, player.move, traits)) return;
  }
  player.save.using = using;
  ctx.setCreation(player, creation);
  ctx.save(player);
}

/** Fallback entry point used by the host when the play module is absent. */
export function drivePlayer(ctx: WorldContext, player: WorldPlayer, dt: number): void {
  if (player.busy) return;
  if (player.controls.pressed.x) quickSwap(ctx, player);
  driveMovement(ctx, player, dt);
}

/** Adapt shared player input and live hexes to pure movement. */
export function driveMovement(ctx: WorldContext, player: WorldPlayer, dt: number)
  : Pick<MoveResult, 'blockedFeature' | 'blockedWall'> | undefined {
  if (player.busy) return;
  const { controls, move } = player;
  const { world } = ctx;
  const collisionWorld: MoveWorld = {
    surfaceAt: (x, y) => world.surfaceAt(x, y),
    nearbySolids: (x, y, radius) => world.nearbySolids(x, y, radius),
    obstacleCanMoveTo(obstacle, at) {
      // Retain generated hex ownership for render streaming and session persistence.
      const from = world.hexAt(obstacle.at.x, obstacle.at.y);
      const to = world.hexAt(at.x, at.y);
      return from.q === to.q && from.r === to.r;
    },
  };
  const { obstacleEffects, blockedFeature, blockedWall, ...next } = step(move, controls, player.traits, collisionWorld, dt);
  Object.assign(move, next);
  for (const { obstacle, effect, at } of obstacleEffects) {
    const hex = world.hexAt(obstacle.at.x, obstacle.at.y);
    const live = world.live(hex).obstacles.get(obstacle.id);
    if (!live || live.gone) continue;
    if (effect === 'break') live.gone = true;
    if (at) live.at = at;
    ctx.bus.emit('obstacle:effect', { player, hex, obstacle: live, effect });
  }
  return { blockedFeature, blockedWall };
}
