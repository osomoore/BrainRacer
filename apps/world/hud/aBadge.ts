import type Phaser from 'phaser';
import { BUTTONS } from '../config';
import { DEPTH, type WorldContext, type WorldPlayer } from '../core/runtime';
import { bakeDisc, bakeIcons, iconKey, type IconName } from './icons';

/**
 * Pulsing "press A" badge that floats above a creation (screen-up, so it stays upright in the heading-up camera).
 * Other modules create one per player and call `show('hand')` while an interaction is possible, `hide()` otherwise,
 * and `update()` every frame. Shown only in that player's view.
 */
export class ABadge {
  private readonly box: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Image;
  private shown = false;

  constructor(private readonly ctx: WorldContext, private readonly player: WorldPlayer) {
    const scene = ctx.scene;
    bakeIcons(scene);
    bakeDisc(scene, 'world-disc:a-badge', 48, BUTTONS.colors.a);
    const s = BUTTONS.badge.size;
    const disc = scene.add.image(0, 0, 'world-disc:a-badge').setDisplaySize(s, s);
    this.icon = scene.add.image(0, 0, iconKey('hand')).setDisplaySize(s * 0.62, s * 0.62);
    const letter = scene.add.text(s * 0.36, s * 0.36, 'A', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '36px', color: '#ffffff', stroke: '#1c2540', strokeThickness: 7,
    }).setOrigin(0.5);
    this.box = scene.add.container(0, 0, [disc, this.icon, letter]).setDepth(DEPTH.popups).setVisible(false);
    ctx.showOnlyTo(this.box, player);
  }

  show(icon: IconName = 'hand'): void {
    this.icon.setTexture(iconKey(icon));
    this.shown = true;
  }

  hide(): void { this.shown = false; }

  update(): void {
    this.box.setVisible(this.shown);
    if (!this.shown) return;
    const { player, ctx } = this;
    const rot = ctx.viewRotation(player);
    const lift = BUTTONS.badge.lift;
    // screen offset (0, -lift) -> world (camera is rotated by `rot`)
    const x = player.move.x - lift * Math.sin(rot);
    const y = player.move.y - lift * Math.cos(rot);
    const pulse = 1 + BUTTONS.badge.pulse * Math.sin((ctx.time / BUTTONS.badge.pulseSeconds) * Math.PI * 2);
    this.box.setPosition(x, y).setRotation(-rot).setScale(pulse / (player.camera.zoom || 1));
  }

  destroy(): void { this.box.destroy(); }
}
