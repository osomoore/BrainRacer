import { COLORS } from './style';

export function playerMenuColor(index: number): number {
  return index === 0 ? COLORS.p1 : COLORS.p2;
}

export function menuBackground(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const background = scene.add.graphics();
  background.fillGradientStyle(0x1a2a6c, 0x1a2a6c, 0x2b8cff, 0x2b8cff, 1).fillRect(0, 0, width, height);
  return background.setDepth(-900);
}
