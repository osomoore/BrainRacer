import type Phaser from 'phaser';
import { radial, type Ctx } from '../art/draw';
import { DEPTH } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { type BuildingLot, type WorldData } from '../core/types';
import { UNDERWATER_GLASS_ROADS, UNDERWATER_VIEWING_POOLS } from './gen/underwater';
import { paintUnderwaterBuilding, underwaterBuildingKind } from './underwaterBuildings';
import { addUnderwaterLife } from './underwaterLife';
import { paintTube, underwaterTexture } from './underwaterPaint';
import { addUnderwaterReefs } from './underwaterReefs';
import { paintDeepWater } from './underwaterTiles';

export { UNDERWATER_TILESET_KEY, underwaterTileIndex, underwaterTileSource } from './underwaterTiles';

type Objects = Phaser.GameObjects.GameObject[];

export function addUnderwaterBuilding(scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objects: Objects): void {
  const kind = underwaterBuildingKind(lot);
  const key = underwaterTexture(scene, `building_${kind}`, 256, 256, c => paintUnderwaterBuilding(c, lot));
  const ts = world.tileSize;
  objects.push(scene.add.image((lot.tx + lot.tw / 2) * ts, (lot.ty + lot.th / 2) * ts, key)
    .setDisplaySize(lot.tw * ts, lot.th * ts).setDepth(DEPTH.building).setName(`underwater-building-${kind}`));
}

function paintCaustics(c: Ctx): void {
  c.fillStyle = radial(c, 250, 250, 3, 249, [[0, '#6dc8d535'], [0.75, '#55b3c620'], [1, '#5dd0e000']]);
  c.fillRect(0, 0, 500, 500);
  const rng = new Rng(37514);
  for (let i = 0; i < 37; i++) {
    const x = rng.range(50, 450), y = rng.range(50, 450);
    const alpha = 0.17 * Math.max(0, 1 - Math.hypot(x - 250, y - 250) / 245);
    c.strokeStyle = `rgba(144,230,224,${alpha})`;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 30, y + 12);
    c.bezierCurveTo(x - 18, y + 19, x - 15, y - 17, x + 5, y - 4);
    c.quadraticCurveTo(x + 14, y + 11, x + 31, y - 7);
    c.stroke();
  }
}

export function addUnderwaterWorld(scene: Phaser.Scene, world: WorldData, objects: Objects): (dt: number) => void {
  const ts = world.tileSize;
  const width = world.widthTiles * ts, height = world.heightTiles * ts;
  const water = underwaterTexture(scene, 'deep-water', 600, 600, c => paintDeepWater(c, 600));
  objects.push(scene.add.image(width / 2, height / 2, water).setDisplaySize(width + 1200, height + 1200)
    .setDepth(DEPTH.ground - 4).setName('underwater-seabed'));

  for (const { start, end, center, vertical } of UNDERWATER_GLASS_ROADS) {
    const w = (end - start) * ts;
    const key = underwaterTexture(scene, `glass_${w}`, w, 2 * ts, c => paintTube(c, w, 2 * ts));
    const along = (start + end) * ts / 2, across = center * ts;
    objects.push(scene.add.image(vertical ? across : along, vertical ? along : across, key)
      .setRotation(vertical ? Math.PI / 2 : 0)
      .setDepth(DEPTH.decal - 1).setName('underwater-glass-tube'));
  }
  for (const { x, y, w, h } of UNDERWATER_VIEWING_POOLS) {
    const viewWidth = w * ts, viewHeight = h * ts;
    const key = underwaterTexture(scene, `viewing_pool_${w}_${h}`, viewWidth, viewHeight, c => {
      c.strokeStyle = '#163b53';
      c.lineWidth = 24;
      c.strokeRect(0, 0, viewWidth, viewHeight);
      c.strokeStyle = '#8ce3cb';
      c.lineWidth = 3;
      c.strokeRect(3, 3, viewWidth - 6, viewHeight - 6);
      c.fillStyle = '#fff0ad';
      for (let px = ts / 2; px < viewWidth; px += ts) {
        c.fillRect(px - 13, 7, 26, 4);
        c.fillRect(px - 13, viewHeight - 11, 26, 4);
      }
    });
    objects.push(scene.add.image((x + w / 2) * ts, (y + h / 2) * ts, key)
      .setDepth(DEPTH.ground + 1).setName('underwater-viewing-pool'));
  }

  const reefs = addUnderwaterReefs(scene, world, objects);
  const rng = new Rng(world.seed ^ 0x19395);
  const caustic = underwaterTexture(scene, 'caustics', 500, 500, paintCaustics);
  const glimmers = Array.from({ length: 45 }, () => {
    const x = rng.range(2, 44) * ts, y = rng.range(3, 43) * ts, phase = rng.range(0, 6.28);
    const img = scene.add.image(x, y, caustic).setDepth(DEPTH.decal - 2).setScale(rng.range(1.1, 2.2));
    objects.push(img);
    return { img, x, y, phase };
  });
  const life = addUnderwaterLife(scene, world, objects);
  let clock = 0;
  return dt => {
    clock += dt;
    life(dt);
    reefs(dt);
    for (const { img, x, y, phase } of glimmers) {
      const t = clock * 0.58 + phase;
      img.setPosition(x + Math.cos(t) * 46, y + Math.sin(t) * 32).setAlpha(0.6 + Math.sin(t * 1.4) * 0.29);
    }
  };
}
