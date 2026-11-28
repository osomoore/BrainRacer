import type { WorldContext, WorldPlayer } from '../core/runtime';
import type { Feature } from '../core/types';
import { step, type MoveWorld } from '../logic/move';
import { activeCreation, swapCreation } from '../logic/slots';

export function quickSwap(ctx: WorldContext, player: WorldPlayer): void {
  player.save.using = swapCreation(player.save.using);
  ctx.setCreation(player, activeCreation(player.profileId, player.save));
  ctx.save(player);
}

/** Fallback entry point used by the host when the play module is absent. */
export function drivePlayer(ctx: WorldContext, player: WorldPlayer, dt: number): void {
  if (player.busy) return;
  if (player.controls.pressed.x) quickSwap(ctx, player);
  driveMovement(ctx, player, dt);
}

/** Adapt shared player input and live hexes to pure movement. */
export function driveMovement(ctx: WorldContext, player: WorldPlayer, dt: number): Feature | undefined {
  if (player.busy) return;
  const { controls, move } = player;
  const { world } = ctx;
  // Rotate screen-relative dino input back into world axes. Cars steer relative to their nose.
  const rotation = -ctx.viewRotation(player);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const input = player.traits.kind === 'car' ? controls : {
    ...controls,
    x: controls.x * cos - controls.y * sin,
    y: controls.x * sin + controls.y * cos,
  };
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
  const { obstacleEffects, blockedFeature, ...next } = step(move, input, player.traits, collisionWorld, dt);
  Object.assign(move, next);
  for (const { obstacle, effect, at } of obstacleEffects) {
    const hex = world.hexAt(obstacle.at.x, obstacle.at.y);
    const live = world.live(hex).obstacles.get(obstacle.id);
    if (!live || live.gone) continue;
    if (effect === 'break') live.gone = true;
    if (at) live.at = at;
    ctx.bus.emit('obstacle:effect', { player, hex, obstacle: live, effect });
  }
  return blockedFeature;
}
