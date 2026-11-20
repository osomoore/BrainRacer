import type Phaser from 'phaser';
import { TEX } from '../../core/assetKeys';
import { Rng } from '../../core/rng';
import type { RaceMap } from '../../core/types';

type Artwork = {
  colors: [number, number, number];
  landmark: string;
  boss: string;
  car: string;
};

const ART: Record<RaceMap, Artwork> = {
  city: { colors: [0x1372cc, 0x06294e, 0x75e8ff], landmark: TEX.roof[2], boss: TEX.dinoHead, car: TEX.carDino },
  industrial: { colors: [0x513173, 0x150d35, 0xffb666], landmark: TEX.industrial.factoryBay, boss: TEX.factoryRobot.head, car: TEX.industrial.forklift },
  harbor: { colors: [0x007d93, 0x01465e, 0xfedd89], landmark: TEX.farm.boathouse, boss: TEX.octopus.head, car: TEX.convertible[0] },
  underground: { colors: [0x623dad, 0x21154c, 0xe498ff], landmark: TEX.underground.oreCrate, boss: TEX.rockMonster.head, car: TEX.underground.crystalRunner },
  farm: { colors: [0xba641e, 0x532938, 0xffe49c], landmark: TEX.farm.barn, boss: TEX.giantChicken.head, car: TEX.farm.tractor },
  sky: { colors: [0x3d70c7, 0x29346e, 0xb6faff], landmark: TEX.unlockGuides.cloudPuff, boss: TEX.thundercloud.head, car: TEX.unlockVehicles.galeRoadster },
  forest: { colors: [0x216457, 0x142839, 0x99f5ae], landmark: TEX.farm.pines, boss: TEX.walkingTree.head, car: TEX.unlockVehicles.mossRover },
  underwater: { colors: [0x126eb3, 0x092a65, 0x78ffd9], landmark: TEX.unlockGuides.jelly, boss: TEX.landshark.head, car: TEX.unlockVehicles.mantaRacer },
};

/** A poster composition made with the destination's game art, drawn into the reveal layer. */
export function worldKeyArt(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: RaceMap): void {
  const { colors: [top, bottom, accent], landmark, boss, car } = ART[map];
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom).fillRect(0, 0, 1920, 1080);
  g.fillStyle(accent, 0.13).fillCircle(1180, 530, 360);
  g.fillStyle(accent, 0.17).fillCircle(1180, 530, 300);
  for (let i = 0; i < 14; i++) {
    const a = i * Math.PI / 7;
    g.fillStyle(accent, 0.13).fillTriangle(1180, 530, 1180 + Math.cos(a) * 1700, 530 + Math.sin(a) * 1700,
      1180 + Math.cos(a + 0.1) * 1700, 530 + Math.sin(a + 0.1) * 1700);
  }
  const rng = new Rng(731);
  for (let i = 0; i < 85; i++) {
    g.fillStyle(accent, rng.next() * 0.56).fillCircle(rng.next() * 1920, 150 + rng.next() * 750, 2 + rng.next() * 7);
  }
  g.lineStyle(9, accent, 0.75).strokeRect(58, 52, 1804, 976);
  layer.add(g);
  const sprite = (key: string, x: number, y: number, width: number, angle: number, alpha = 1) => {
    const image = scene.add.image(x, y, key).setAngle(angle).setAlpha(alpha);
    image.setScale(width / image.width);
    layer.add(image);
    return image;
  };
  sprite(landmark, 310, 550, 390, -14, 0.68);
  sprite(landmark, 1590, 526, 380, 11, 0.65);
  sprite(landmark, 1660, 667, 235, -12, 0.8);
  sprite(boss, 1240, 551, 570, -14);

  const road = scene.add.graphics();
  road.fillStyle(bottom, 0.95).fillPoints([
    { x: 42, y: 804 }, { x: 875, y: 516 }, { x: 1010, y: 509 }, { x: 698, y: 858 },
  ], true);
  road.lineStyle(7, accent, 0.85).lineBetween(42, 804, 875, 516).lineBetween(698, 858, 1010, 509);
  for (let i = 0; i < 9; i++) {
    const t = (i / 10) ** 1.7, t2 = ((i + 0.6) / 10) ** 1.7;
    road.lineStyle(12 - i, 0xfff5cd, 0.9).lineBetween(336 + t * 605, 820 - t * 308, 336 + t2 * 605, 820 - t2 * 308);
  }
  layer.add(road);
  const racer = sprite(car, 616, 680, 390, -26);
  scene.tweens.add({ targets: racer, x: 663, y: 658, duration: 2550, ease: 'Sine.Out' });
}
