import type Phaser from 'phaser';
import { BUTTONS, WORLD_PLAY } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import { bakeDisc, bakePlate } from '../hud/icons';
import { padConnected } from '../hud/questDialog';

type Door = { hint: Phaser.GameObjects.Container; badge: Phaser.GameObjects.Container; inside?: string; tapped: boolean };
const DOOR_PLATE = 'world-home-lab-door';
const DOOR_BADGE = 'world-home-lab-pad-a';

export class HomePadUI {
  private ctx!: WorldContext;
  private readonly doors = new Map<WorldPlayer, Door>();

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    const { scene } = ctx;
    bakePlate(scene, DOOR_PLATE, 268, BUTTONS.card.minTap, 0x142c39, 0.96, 24, 0xffdb75);
    bakeDisc(scene, DOOR_BADGE, 25, BUTTONS.colors.a);
    for (const player of ctx.players) {
      const button = scene.add.image(0, 0, DOOR_PLATE).setInteractive({ useHandCursor: true });
      const text = scene.add.text(0, 0, 'Lab', {
        fontFamily: 'Arial, sans-serif', fontSize: '42px', fontStyle: 'bold', color: '#fff6dc',
      }).setOrigin(0.5);
      const badge = scene.add.container(-82, 0, [
        scene.add.image(0, 0, DOOR_BADGE),
        scene.add.text(0, 0, 'A', { fontFamily: 'Arial, sans-serif', fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5),
      ]);
      const hint = scene.add.container(0, 0, [button, text, badge]).setDepth(55).setVisible(false);
      const door: Door = { hint, badge, tapped: false };
      button.on('pointerdown', () => {
        if (hint.visible && !player.busy) door.tapped = true;
      });
      ctx.showOnlyTo(hint, player);
      this.doors.set(player, door);
    }
  }

  updatePlayer(player: WorldPlayer): void {
    const door = this.doors.get(player)!;
    const { move, controls, camera } = player;
    const { world } = this.ctx;
    const home = world.plan(world.hexAt(move.x, move.y)).home;
    const inside = home && Math.hypot(move.x - home.at.x, move.y - home.at.y) <= WORLD_PLAY.homeRadius
      ? home.id : undefined;
    if (inside !== door.inside) {
      if (door.inside) this.ctx.bus.emit('home:leave', { player, homeId: door.inside });
      door.inside = inside;
      if (inside) this.ctx.bus.emit('home:enter', { player, homeId: inside });
    }

    const available = !!inside && !player.busy;
    if (available && (controls.pressed.a || door.tapped)) {
      // The door uses the same Lab shortcut as Y, including the HUD confirmation.
      controls.pressed.a = false;
      controls.pressed.y = true;
      this.ctx.bus.emit('player:interact', { player, target: { kind: 'home' } });
    }
    door.tapped = false;
    const rotation = this.ctx.viewRotation(player);
    const lift = 146 / camera.zoom;
    door.badge.setVisible(available && padConnected());
    door.hint.setVisible(available)
      .setPosition(move.x - Math.sin(rotation) * lift, move.y - Math.cos(rotation) * lift)
      .setRotation(-rotation).setScale(1 / camera.zoom);
  }

  destroy(): void {
    for (const { hint } of this.doors.values()) hint.destroy();
    this.doors.clear();
  }
}
