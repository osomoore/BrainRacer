import type Phaser from 'phaser';
import { buildRig } from '../../workshop/art';
import type { ModelRig, RigAnim } from '../../workshop/core/runtime';
import { WORLD_CARRY_ART, WORLD_HOST, WORLD_PLAY } from '../config';
import { DEPTH, type WorldContext, type WorldModule, type WorldPlayer } from '../core/runtime';
import type { ItemId } from '../core/types';
import { questItemTexture } from '../hud/questItemArt';

type PlayerRig = {
  rig: ModelRig;
  animation?: RigAnim;
  scale: number;
  cargo: Phaser.GameObjects.Container;
  pictured?: readonly ItemId[];
};

export default class PlayersModule implements WorldModule {
  static order = 310;
  private ctx!: WorldContext;
  private off?: () => void;
  private readonly rigs = new Map<WorldPlayer, PlayerRig>();

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
      const flapping = move.flying || (player.flapUntil ?? 0) > this.ctx.time;
      // The Workshop rig maps a winged dino's idle and walk loops to flap.
      const animation = flapping ? 'flap' : move.airborne > 0 ? 'jump' : traits.wings ? 'stand'
        : rolling ? traits.kind === 'dino' ? 'walk' : 'drive' : 'idle';
      if (entry.animation !== animation) {
        entry.rig.play(animation);
        entry.animation = animation;
      }
      entry.rig.root.setPosition(move.x, move.y).setRotation(move.angle)
        .setScale(entry.scale * (move.flying ? WORLD_PLAY.flight.scale : move.airborne > 0 ? 1.12 : 1));
      this.updateCarried(player.carrying, entry);
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
    const cargo = scene.add.container(-rig.width * WORLD_CARRY_ART.rear, 0);
    rig.root.add(cargo);
    player.sprite = rig.root;
    this.rigs.set(player, { rig, scale, cargo });
  }

  private remove(player: WorldPlayer): void {
    this.rigs.get(player)?.rig.destroy();
    this.rigs.delete(player);
    player.sprite = undefined;
  }

  private updateCarried(items: readonly ItemId[], entry: PlayerRig): void {
    if (entry.pictured === items) return;
    entry.pictured = items;
    entry.cargo.removeAll(true);
    const { scene } = this.ctx;
    const size = entry.rig.width * WORLD_CARRY_ART.size;
    const spacing = size * WORLD_CARRY_ART.spacing;
    items.forEach((item, i) => {
      const y = (i - (items.length - 1) / 2) * spacing;
      entry.cargo.add(scene.add.image(0, y, questItemTexture(scene, item)).setDisplaySize(size, size));
    });
  }
}
