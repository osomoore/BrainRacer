import { buildRig } from '../../workshop/art';
import type { ModelRig, RigAnim } from '../../workshop/core/runtime';
import { WORLD_HOST } from '../config';
import { DEPTH, type WorldContext, type WorldModule, type WorldPlayer } from '../core/runtime';

export default class PlayersModule implements WorldModule {
  static order = 310;
  private ctx!: WorldContext;
  private off?: () => void;
  private readonly rigs = new Map<WorldPlayer, { rig: ModelRig; animation?: RigAnim; scale: number }>();

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    ctx.players.forEach(player => this.build(player));
    this.off = ctx.bus.on('player:swap', ({ player }) => this.build(player));
    this.update();
  }

  update(): void {
    for (const [player, entry] of this.rigs) {
      const { move, traits } = player;
      const rolling = Math.hypot(move.vx, move.vy) > 12;
      const animation = move.airborne > 0 ? 'jump' : rolling ? traits.kind === 'dino' ? 'walk' : 'drive' : 'idle';
      if (entry.animation !== animation) {
        entry.rig.play(animation);
        entry.animation = animation;
      }
      entry.rig.root.setPosition(move.x, move.y).setRotation(move.angle)
        .setScale(entry.scale * (move.airborne > 0 ? 1.12 : 1));
    }
  }

  destroy(): void {
    this.off?.();
    for (const player of this.rigs.keys()) this.remove(player);
  }

  private build(player: WorldPlayer): void {
    this.remove(player);
    const { creation, move, traits } = player;
    const scene = this.ctx.scene;
    const rig = buildRig(scene, creation.workshop, creation.model, 'top');
    const length = WORLD_HOST.playerLengths[traits.width - 1];
    const scale = length / rig.width;
    rig.root.setSize(rig.width, rig.height).setDepth(DEPTH.players)
      .setPosition(move.x, move.y).setRotation(move.angle).setScale(scale);
    player.sprite = rig.root;
    this.rigs.set(player, { rig, scale });
  }

  private remove(player: WorldPlayer): void {
    this.rigs.get(player)?.rig.destroy();
    this.rigs.delete(player);
    player.sprite = undefined;
  }
}
