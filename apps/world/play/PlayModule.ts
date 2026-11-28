import { WORLD_PLAY } from '../config';
import type { WorldContext, WorldModule, WorldPlayer } from '../core/runtime';
import { driveMovement, quickSwap } from '../host/drive';
import { HomePadUI } from './homePad';
import { PlayEffects } from './playEffects';

export default class PlayModule implements WorldModule {
  static order = 100;
  private ctx!: WorldContext;
  private effects!: PlayEffects;
  private readonly home = new HomePadUI();
  private readonly lastBump = new Map<WorldPlayer, number>();

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.effects = new PlayEffects(ctx);
    this.home.init(ctx);
  }

  update(dt: number): void {
    const { ctx } = this;
    for (const player of ctx.players) {
      this.home.updatePlayer(player);
      if (!player.busy && player.controls.pressed.x) quickSwap(ctx, player);
      const feature = driveMovement(ctx, player, dt);
      if (feature && ctx.time >= (this.lastBump.get(player) ?? 0)) {
        this.lastBump.set(player, ctx.time + WORLD_PLAY.bumpCooldown);
        this.effects.blocked(player, feature);
      }
    }
    this.effects.update(dt);
  }

  destroy(): void {
    this.home.destroy();
    this.effects.destroy();
    this.lastBump.clear();
  }
}
