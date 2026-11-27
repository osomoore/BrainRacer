import { WORLD_HOST } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import { step } from '../logic/move';
import { activeCreation, swapSlots } from '../logic/slots';
import { viewRotation } from './cameras';
import type { LiveWorld } from './liveWorld';

/** Basic driving until the play module takes over. */
export function drivePlayer(ctx: WorldContext, world: LiveWorld, player: WorldPlayer, dt: number): void {
  if (player.busy) return;
  const { controls, move } = player;
  if (controls.pressed.x && player.save.alternate) {
    player.save.using = swapSlots(player.save).using;
    ctx.setCreation(player, activeCreation(player.profileId, player.save));
    ctx.save(player);
  }
  // Rotate screen-relative dino input back into world axes. Cars steer relative to their nose.
  const rotation = -viewRotation(player);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const input = player.traits.kind === 'car' ? controls : {
    ...controls,
    x: controls.x * cos - controls.y * sin,
    y: controls.x * sin + controls.y * cos,
  };
  const { obstacleEffects, ...next } = step(move, input, player.traits, world, dt);
  Object.assign(move, next);
  for (const { obstacle, effect } of obstacleEffects) {
    const hex = world.ownerOf(obstacle);
    const live = hex && world.live(hex).obstacles.get(obstacle.id);
    if (!live || !hex || live.gone) continue;
    if (effect === 'break') live.gone = true;
    if (effect === 'push') {
      const dx = live.at.x - move.x, dy = live.at.y - move.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const distance = Math.min(WORLD_HOST.pushSpeed, Math.hypot(move.vx, move.vy)) * dt;
      const at = { x: live.at.x + dx * distance / length, y: live.at.y + dy * distance / length };
      const dest = world.hexAt(at.x, at.y);
      // Ownership stays with the plan that spawned this obstacle.
      if (dest.q === hex.q && dest.r === hex.r) live.at = at;
    }
    ctx.bus.emit('obstacle:effect', { player, hex, obstacle: live, effect });
  }
}
