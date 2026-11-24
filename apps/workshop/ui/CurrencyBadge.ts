import type Phaser from 'phaser';
import { ensureCurrencyIcon } from '../art/icons';
import type { WorkshopId } from '../core/types';
import { COLORS, makeText, roundedOriginY, roundedTexture } from './style';

/** Shared currency treatment for the pane balance and the larger results reward. */
export function currencyBadge(scene: Phaser.Scene, workshop: WorkshopId, x: number, y: number, amount: string, reward = false) {
  const width = reward ? 260 : 192;
  const height = reward ? 108 : 72;
  const fill = reward ? 0xffedab : 0x232a66;
  const bg = scene.add.image(0, 0, roundedTexture(scene, width, height, fill, { radius: height / 2 }))
    .setOrigin(0.5, roundedOriginY(height));
  const icon = scene.add.image(reward ? -63 : -48, 0, ensureCurrencyIcon(scene, workshop))
    .setDisplaySize(reward ? 84 : 60, reward ? 84 : 60);
  const label = makeText(scene, reward ? 42 : 28, 0, amount, {
    size: reward ? 62 : 40, color: reward ? COLORS.ink : COLORS.paper,
  });
  const root = scene.add.container(x, y, [bg, icon, label]).setName(reward ? 'workshop-payout' : 'workshop-wallet');
  return { root, label };
}
