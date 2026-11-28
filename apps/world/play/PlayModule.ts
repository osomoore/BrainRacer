import { BUTTONS, WORLD_DRIVE, WORLD_PLAY } from '../config';
import type { WorldContext, WorldModule, WorldPlayer, WorldSpecial } from '../core/runtime';
import type { Obstacle } from '../core/types';
import { driveMovement, quickSwap } from '../host/drive';
import { canGroundAt, winchPull } from '../logic/move';
import { HomePadUI } from './homePad';
import { PlayEffects } from './playEffects';

export default class PlayModule implements WorldModule {
  static order = 100;
  private ctx!: WorldContext;
  private effects!: PlayEffects;
  private readonly home = new HomePadUI();
  private readonly lastBump = new Map<WorldPlayer, number>();
  private readonly cooldowns = new Map<WorldPlayer, { rocket: number; horn: number }>();

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.effects = new PlayEffects(ctx);
    this.home.init(ctx);
    for (const player of ctx.players) {
      this.cooldowns.set(player, { rocket: 0, horn: 0 });
      player.special = this.specialFor(player, this.winchTarget(player));
    }
  }

  update(dt: number): void {
    const { ctx } = this;
    for (const player of ctx.players) {
      this.home.updatePlayer(player);
      if (!player.busy && player.controls.pressed.x) quickSwap(ctx, player);
      const { b, y, menu } = player.controls.pressed;
      if (!player.busy && b && !y && !menu) {
        const target = this.winchTarget(player);
        this.activate(player, this.specialFor(player, target), target);
      }
      const feature = driveMovement(ctx, player, dt);
      if (!player.busy) player.special = this.specialFor(player, this.winchTarget(player));
      if (feature && ctx.time >= (this.lastBump.get(player) ?? 0)) {
        this.lastBump.set(player, ctx.time + WORLD_PLAY.bumpCooldown);
        this.effects.blocked(player, feature);
      }
    }
    this.effects.update(dt);
  }

  private winchTarget({ move, traits }: WorldPlayer): Obstacle | undefined {
    if (traits.kind !== 'car' || !traits.winch) return;
    const { reach, clearance } = WORLD_PLAY.winch;
    const radius = WORLD_DRIVE.colliderRadius[traits.width - 1];
    let target: Obstacle | undefined;
    let best: number = reach;
    for (const obstacle of this.ctx.world.nearbySolids(move.x, move.y, reach).obstacles) {
      if (obstacle.kind !== 'log' && obstacle.kind !== 'crate') continue;
      const distance = Math.hypot(obstacle.at.x - move.x, obstacle.at.y - move.y) - obstacle.radius;
      if (distance <= radius + clearance || distance >= best) continue;
      target = obstacle;
      best = distance;
    }
    return target;
  }

  private specialFor({ traits }: WorldPlayer, target?: Obstacle): WorldSpecial {
    if (traits.kind === 'dino') return traits.wings ? 'wings' : 'roar';
    if (target) return 'winch';
    return traits.rocket ? 'rocket' : 'horn';
  }

  private activate(player: WorldPlayer, special: WorldSpecial, target?: Obstacle): void {
    const { move, traits } = player;
    const { world, time, bus } = this.ctx;
    const cooldown = this.cooldowns.get(player)!;
    switch (special) {
      case 'wings':
        if (move.flying) {
          if (!canGroundAt(world, move, traits)) return;
          move.flying = false;
          delete move.flightOrigin;
        } else if (player.carrying.length > 0) {
          player.flapUntil = time + WORLD_PLAY.flight.flapSeconds;
        } else if (!move.airborne && canGroundAt(world, move, traits)) {
          move.flying = true;
          move.flightOrigin = { x: move.x, y: move.y };
          delete player.flapUntil;
          delete move.jump;
        }
        break;
      case 'rocket':
        if (!move.airborne && time >= cooldown.rocket) {
          move.boost = WORLD_PLAY.rocket.seconds;
          cooldown.rocket = time + WORLD_PLAY.rocket.cooldown;
        }
        break;
      case 'winch': {
        if (!target || move.airborne) return;
        const hex = world.hexAt(target.at.x, target.at.y);
        const at = winchPull({
          surfaceAt: (x, y) => world.surfaceAt(x, y),
          nearbySolids: (x, y, radius) => world.nearbySolids(x, y, radius),
          obstacleCanMoveTo(_, at) {
            const destination = world.hexAt(at.x, at.y);
            return destination.q === hex.q && destination.r === hex.r;
          },
        }, move, traits, target);
        const live = world.live(hex).obstacles.get(target.id);
        if (!at || !live || live.gone) return;
        live.at = at;
        bus.emit('obstacle:effect', { player, hex, obstacle: live, effect: 'push' });
        break;
      }
      case 'horn':
      case 'roar':
        if (time >= cooldown.horn) {
          cooldown.horn = time + BUTTONS.honk.cooldown;
          bus.emit('player:honk', { player });
        }
        break;
    }
  }

  destroy(): void {
    this.home.destroy();
    this.effects.destroy();
    this.lastBump.clear();
    this.cooldowns.clear();
  }
}
