import type Phaser from 'phaser';
import { BUTTONS, WORLD, WORLD_NAME_PULSE as PULSE } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import { interactionDisplayName } from './interactionNames';

export class NamePulse {
  private readonly labels = new Map<WorldPlayer, Phaser.GameObjects.Text>();
  private readonly pulses = new Map<WorldPlayer, { text: string; since: number }>();
  private readonly off: (() => void)[];

  constructor(private readonly ctx: WorldContext) {
    const show = (player: WorldPlayer, text: string) => {
      this.pulses.set(player, { text, since: ctx.time });
    };
    this.off = [
      ctx.bus.on('player:interact', ({ player, target }) => show(player, interactionDisplayName(target))),
      ctx.bus.on('activity:start', ({ player, site }) => show(player, interactionDisplayName({ kind: 'activity', id: site.kind }))),
    ];
  }

  build(scene: Phaser.Scene): void {
    const width = WORLD.width / this.ctx.players.length;
    for (const player of this.ctx.players) {
      const label = scene.add.text(width * (player.index + 0.5), PULSE.y, '', {
        fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: `${PULSE.fontSize}px`,
        color: '#fff8df', stroke: '#152640', strokeThickness: 10,
      }).setOrigin(0.5).setDepth(BUTTONS.depth + 6).setVisible(false);
      this.labels.set(player, label);
    }
  }

  update(): void {
    for (const [player, label] of this.labels) {
      const pulse = this.pulses.get(player);
      if (!pulse) continue;
      const elapsed = this.ctx.time - pulse.since;
      if (elapsed >= PULSE.seconds) {
        label.setVisible(false);
        this.pulses.delete(player);
        continue;
      }
      const wave = Math.sin(2 * Math.PI * elapsed / PULSE.seconds);
      if (label.text !== pulse.text) label.setText(pulse.text);
      label.setVisible(true)
        .setScale(1 + PULSE.pulseScale * wave ** 2)
        .setAlpha(Math.min(1, (PULSE.seconds - elapsed) / PULSE.fadeSeconds));
    }
  }

  destroy(): void {
    this.off.forEach(off => off());
    this.labels.clear();
    this.pulses.clear();
  }
}
