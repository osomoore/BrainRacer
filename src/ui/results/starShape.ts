import Phaser from 'phaser';

/** Five-point star drawn with graphics: gold when earned, dim outline otherwise. */
export function starShape(scene: Phaser.Scene, x: number, y: number, earned: boolean, outer = 62): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : outer * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  g.fillStyle(earned ? 0xffd43b : 0x2b3a6b, 1).fillPoints(pts, true);
  g.lineStyle(8, earned ? 0xffffff : 0x5a6aa0, 1).strokePoints(pts, true);
  return g;
}
