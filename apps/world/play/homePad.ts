import Phaser from 'phaser';
import { WORLD_PLAY } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import type { CreationSlot } from '../core/types';
import { quickSwap } from '../host/drive';
import { resolveSlot } from '../logic/slots';

type Slot = 'primary' | 'alternate';
type Row = { target: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
type Panel = {
  player: WorldPlayer;
  root: Phaser.GameObjects.Container;
  hint: Phaser.GameObjects.Container;
  rows: Row[];
  inside?: string;
  open: boolean;
  slot?: Slot;
  selected: number;
  direction: number;
};

const ROW_HEIGHT = 120;
const WIDTH = 520;
const FONT = { fontFamily: 'Arial, sans-serif', fontSize: '42px', fontStyle: 'bold', color: '#fff6dc' };
const OPTIONS = ['My Race Car', 'My Dino', 'Keep a copy', 'Back'];

/** Home controls capture input only while the player actively edits the pad. */
export class HomePadUI {
  private ctx!: WorldContext;
  private readonly panels = new Map<WorldPlayer, Panel>();

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    for (const player of ctx.players) this.panels.set(player, this.createPanel(player));
  }

  updatePlayer(player: WorldPlayer): void {
    const panel = this.panels.get(player)!;
    const { move, controls } = player;
    const world = this.ctx.world;
    const home = world.plan(world.hexAt(move.x, move.y)).home;
    const inside = home && Math.hypot(move.x - home.at.x, move.y - home.at.y) <= WORLD_PLAY.homeRadius
      ? home.id : undefined;
    if (inside !== panel.inside) {
      if (panel.inside) this.ctx.bus.emit('home:leave', { player, homeId: panel.inside });
      panel.inside = inside;
      if (inside) this.ctx.bus.emit('home:enter', { player, homeId: inside });
      else if (panel.open) this.close(panel);
    }

    if (panel.open) {
      const direction = Math.abs(controls.y) > 0.55 ? Math.sign(controls.y) : 0;
      if (direction && direction !== panel.direction) {
        panel.selected = Phaser.Math.Wrap(panel.selected + direction, 0, panel.rows.length);
        this.refresh(panel);
      }
      panel.direction = direction;
      if (controls.pressed.b) this.back(panel);
      else if (controls.pressed.a) this.activate(panel, panel.selected);
      controls.pressed.a = controls.pressed.b = controls.pressed.x = false;
    } else if (!player.busy) {
      if (controls.pressed.x) {
        quickSwap(this.ctx, player);
        controls.pressed.x = false;
      }
      if (inside && controls.pressed.a) {
        this.open(panel);
        controls.pressed.a = false;
      }
    }
    panel.hint.setVisible(!!inside && !panel.open && !player.busy);
    this.position(panel);
  }

  destroy(): void {
    for (const panel of this.panels.values()) {
      if (panel.open) this.close(panel);
      panel.hint.destroy();
      panel.root.destroy();
    }
    this.panels.clear();
  }

  private createPanel(player: WorldPlayer): Panel {
    const scene = this.ctx.scene;
    const root = scene.add.container(0, 0).setDepth(55).setVisible(false);
    const hint = scene.add.container(0, 0).setDepth(55).setVisible(false);
    const panel: Panel = { player, root, hint, rows: [], open: false, selected: 0, direction: 0 };
    this.ctx.showOnlyTo(root, player);
    this.ctx.showOnlyTo(hint, player);
    const pad = scene.add.rectangle(0, 0, 268, ROW_HEIGHT, 0x142c39, 0.96).setStrokeStyle(3, 0xffdb75)
      .setInteractive({ useHandCursor: true });
    hint.add([pad, scene.add.text(0, 0, 'Swap Pad', FONT).setOrigin(0.5)]);
    pad.on('pointerdown', () => {
      if (hint.visible && panel.inside && !player.busy) this.open(panel);
    });
    for (let index = 0; index < OPTIONS.length; index++) {
      const y = (index - 1.5) * (ROW_HEIGHT + 4);
      const target = scene.add.rectangle(0, y, WIDTH, ROW_HEIGHT, 0x142c39)
        .setStrokeStyle(3, 0xffdb75);
      const label = scene.add.text(0, y, '', FONT).setOrigin(0.5);
      target.on('pointerdown', () => {
        if (panel.open) this.activate(panel, index);
      });
      root.add([target, label]);
      panel.rows.push({ target, label });
    }
    this.refresh(panel);
    return panel;
  }

  private position(panel: Panel): void {
    const { player } = panel;
    const { move, camera } = player;
    const rotation = this.ctx.viewRotation(player);
    const place = (object: Phaser.GameObjects.Container, offset: number) => {
      const lift = offset / camera.zoom;
      object.setPosition(move.x - Math.sin(rotation) * lift, move.y - Math.cos(rotation) * lift)
        .setRotation(-rotation).setScale(1 / camera.zoom);
    };
    place(panel.root, 228);
    place(panel.hint, 146);
  }

  private open(panel: Panel): void {
    panel.open = true;
    panel.player.busy = true;
    panel.selected = 0;
    panel.direction = 0;
    panel.root.setVisible(true);
    panel.hint.setVisible(false);
    for (const { target } of panel.rows) target.setInteractive({ useHandCursor: true });
    this.refresh(panel);
    this.position(panel);
  }

  private close(panel: Panel): void {
    panel.open = false;
    panel.slot = undefined;
    panel.player.busy = false;
    panel.root.setVisible(false);
    for (const { target } of panel.rows) target.disableInteractive();
  }

  private refresh(panel: Panel): void {
    const labels = panel.slot ? OPTIONS : ['Primary', 'Alternate', 'Workshop', 'Close'];
    panel.rows.forEach(({ target, label }, index) => {
      label.setText(labels[index]);
      target.setFillStyle(index === panel.selected ? 0x3c6146 : 0x142c39);
    });
  }

  private back(panel: Panel): void {
    if (!panel.slot) {
      this.close(panel);
      return;
    }
    panel.selected = panel.slot === 'primary' ? 0 : 1;
    panel.slot = undefined;
    this.refresh(panel);
  }

  private activate(panel: Panel, index: number): void {
    if (index === 3) {
      this.back(panel);
      return;
    }
    const { player, slot } = panel;
    if (!slot) {
      if (index === 2) this.ctx.bus.emit('nav:workshop', { player });
      else {
        panel.slot = index === 0 ? 'primary' : 'alternate';
        const current = player.save[panel.slot];
        panel.selected = current?.source === 'copy' ? 2 : current?.workshop === 'dino' ? 1 : 0;
        this.refresh(panel);
      }
      return;
    }
    const next: CreationSlot = index === 2
      ? { source: 'copy', workshop: player.creation.workshop, model: { ...player.creation.model } }
      : { source: 'live', workshop: index === 0 ? 'race' : 'dino' };
    player.save[slot] = next;
    if (slot === player.save.using) this.ctx.setCreation(player, resolveSlot(player.profileId, next));
    this.ctx.save(player);
    this.back(panel);
  }
}
