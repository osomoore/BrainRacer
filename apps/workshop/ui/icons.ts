/** Simple baked icons (car, dino) for the workshop tiles. Each returns a texture key, 300 x 200. */
import Phaser from 'phaser';

export const ICON_W = 300;
export const ICON_H = 200;

export function carIconTexture(scene: Phaser.Scene): string {
  const key = 'ws:icon:car';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.lineStyle(8, 0x1b1b3a, 1);
  g.fillStyle(0x9bd7ff, 1);
  g.fillPoints([new Phaser.Geom.Point(90, 80), new Phaser.Geom.Point(125, 28), new Phaser.Geom.Point(205, 28), new Phaser.Geom.Point(245, 80)], true);
  g.strokePoints([new Phaser.Geom.Point(90, 80), new Phaser.Geom.Point(125, 28), new Phaser.Geom.Point(205, 28), new Phaser.Geom.Point(245, 80)], true);
  g.fillStyle(0xe8232a, 1);
  g.fillRoundedRect(20, 70, 260, 80, 28);
  g.strokeRoundedRect(20, 70, 260, 80, 28);
  g.fillStyle(0xffd23f, 1).fillCircle(262, 100, 10);
  for (const x of [80, 220]) {
    g.fillStyle(0x1b1b3a, 1).fillCircle(x, 152, 36);
    g.fillStyle(0xcfd8e3, 1).fillCircle(x, 152, 15);
  }
  g.generateTexture(key, ICON_W, ICON_H);
  g.destroy();
  return key;
}

export function dinoIconTexture(scene: Phaser.Scene): string {
  const key = 'ws:icon:dino';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.lineStyle(8, 0x1b1b3a, 1);
  g.fillStyle(0x2fb84f, 1);
  const tail = [new Phaser.Geom.Point(60, 110), new Phaser.Geom.Point(4, 150), new Phaser.Geom.Point(70, 140)];
  g.fillPoints(tail, true); g.strokePoints(tail, true);
  g.fillEllipse(140, 115, 190, 110); g.strokeEllipse(140, 115, 190, 110);
  g.fillRoundedRect(112, 135, 36, 56, 12); g.strokeRoundedRect(112, 135, 36, 56, 12);
  g.fillRoundedRect(170, 135, 36, 56, 12); g.strokeRoundedRect(170, 135, 36, 56, 12);
  g.fillCircle(232, 60, 48); g.strokeCircle(232, 60, 48);
  g.fillRoundedRect(232, 62, 62, 40, 16); g.strokeRoundedRect(232, 62, 62, 40, 16);
  g.fillStyle(0xffd23f, 1);
  for (const [x, y] of [[100, 62], [135, 52], [170, 58]] as const) g.fillTriangle(x - 14, y + 14, x, y - 16, x + 14, y + 14);
  g.fillStyle(0xffffff, 1).fillCircle(240, 48, 14);
  g.fillStyle(0x1b1b3a, 1).fillCircle(244, 50, 7);
  g.generateTexture(key, ICON_W, ICON_H);
  g.destroy();
  return key;
}
