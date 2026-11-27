import type Phaser from 'phaser';
import type { ItemId } from '../core/types';

const SIZE = 96;
const INK = 0x182740;
const colors: Record<ItemId, number> = {
  rock: 0xa8b6c9, mudPie: 0xb78051, shell: 0xffa9af, pinecone: 0xd09757, snowball: 0xdaf5ff,
  cactusFlower: 0xff87bb, fern: 0x8ee582, crystal: 0x9af4ff, feather: 0xf9eddf,
  egg: 0xffd5a5, duck: 0xffde57, lamb: 0xfbf4e1,
};

export function questItemTexture(scene: Phaser.Scene, item: ItemId): string {
  const key = `world-quest-item:${item}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(INK, 1).fillCircle(48, 48, 46);
  g.lineStyle(4, 0xffdf66, 1).strokeCircle(48, 48, 43);
  g.fillStyle(colors[item], 1);
  switch (item) {
    case 'duck':
      g.fillEllipse(43, 58, 51, 27).fillCircle(62, 36, 14);
      g.fillStyle(0xff9252).fillEllipse(74, 42, 17, 9);
      g.fillStyle(INK).fillCircle(65, 33, 3);
      break;
    case 'lamb':
      for (const x of [33, 51, 66]) g.fillCircle(x, 49, 16);
      g.fillEllipse(49, 58, 51, 23);
      g.fillStyle(0xa78c86).fillEllipse(67, 52, 21, 25).fillEllipse(70, 40, 22, 8);
      g.fillStyle(INK).fillCircle(69, 49, 3);
      break;
    case 'shell':
      g.fillEllipse(48, 47, 57, 40).fillRoundedRect(34, 51, 28, 22, 7);
      g.lineStyle(3, 0x9c465f);
      for (const x of [29, 41, 55, 67]) g.lineBetween(x, 38, 48, 64);
      break;
    case 'fern':
      g.lineStyle(5, colors.fern).lineBetween(38, 73, 60, 23);
      for (const [x, y] of [[41, 35], [63, 42], [33, 49], [56, 56], [31, 61]]) g.fillEllipse(x, y, 22, 10);
      break;
    case 'cactusFlower':
      for (let i = 0; i < 5; i++) g.fillCircle(48 + 16 * Math.cos(i * Math.PI * 0.4), 48 + 16 * Math.sin(i * Math.PI * 0.4), 13);
      g.fillStyle(0xffdf66).fillCircle(48, 48, 10);
      break;
    case 'crystal':
      g.fillPoints([{ x: 48, y: 18 }, { x: 70, y: 39 }, { x: 58, y: 73 }, { x: 38, y: 73 }, { x: 26, y: 39 }], true);
      g.fillStyle(0x47a4db).fillTriangle(48, 20, 68, 39, 55, 72);
      break;
    case 'feather':
      g.fillEllipse(54, 40, 30, 44);
      g.lineStyle(4, 0x997a79).lineBetween(31, 73, 60, 34);
      break;
    case 'rock':
      g.fillPoints([{ x: 25, y: 60 }, { x: 34, y: 34 }, { x: 61, y: 29 }, { x: 75, y: 48 }, { x: 63, y: 67 }, { x: 40, y: 70 }], true);
      g.fillStyle(0x7286a1).fillTriangle(25, 60, 55, 51, 63, 67);
      break;
    case 'pinecone':
    case 'mudPie':
      g.fillEllipse(48, 49, item === 'mudPie' ? 59 : 39, item === 'mudPie' ? 35 : 53);
      g.fillStyle(0x7a4e3a);
      for (const [x, y] of [[45, 35], [38, 47], [54, 48], [45, 62]]) g.fillCircle(x, y, 4);
      break;
    case 'snowball':
    case 'egg':
      g.fillEllipse(48, 48, item === 'egg' ? 36 : 48, 51);
      g.fillStyle(0xffffff, 0.65).fillCircle(41, 39, 8);
      break;
  }
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
  return key;
}
