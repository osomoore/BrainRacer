import type Phaser from 'phaser';
import { ellipse, fillStroke, hash, makeCanvas, type Ctx } from '../art/draw';
import { DEPTH, QUEUED_FEATURES } from '../config/gameConfig';
import type { QueuedMap } from '../config/queuedMaps';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type BuildingLot, type WorldData } from '../core/types';
import { QUEUED_SHOWCASE_STYLE, queuedMushroomFeatures, queuedRunway, queuedVolcanoTunnel } from './gen/queuedWorlds';
import { queuedPlaneTexture } from '../systems/queuedWorldFeatureArt';
import { queuedBuildingPose, usesNatureArt } from './laterBuildingFootprints';
import { laterBuiltBuilding } from './laterBuiltArt';
import { laterNatureBuilding } from './laterNatureArt';
import { addQueuedScenery } from './queuedScenery';
import { box, QUEUED_PALETTES } from './queuedWorldArt';

type Objects = Phaser.GameObjects.GameObject[];

const ROAD_BASE = 6;
const EDGE = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];

function tileIndex(world: WorldData, i: number): number {
  switch (world.tiles[i]) {
    case Tile.Water: return 0;
    case Tile.Sidewalk:
    case Tile.Building: return 2;
    case Tile.Park: return 3;
    case Tile.Plaza: return 4;
    case Tile.Dirt: return 5;
    case Tile.Road: return ROAD_BASE + (world.roadMask[i] & 15);
    default: return 1;
  }
}

function tileSource(map: QueuedMap, size: number): (index: number) => HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  const p = QUEUED_PALETTES[map];
  const scale = size / 128;
  return index => {
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const road = index >= ROAD_BASE;
    box(c, road ? p.road : p.floor[index], 0, 0, 128, 128);
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(128 * hash(i, 0, index));
      const y = Math.floor(128 * hash(i, 1, index));
      const length = map === 'brickworks' ? 5 + (i % 4) * 3 : i % 6 + 2;
      box(c, i % 2 ? '#fff5d921' : '#35334522', x, y, length, map === 'brickworks' ? length : 1.5);
    }
    if (road) paintRoad(c, map, index - ROAD_BASE);
    else paintFloorDetail(c, map, index);
    return canvas;
  };
}

function paintFloorDetail(c: Ctx, map: QueuedMap, index: number): void {
  const p = QUEUED_PALETTES[map];
  if (index === 0) {
    const tint = map === 'volcano' ? '#ffc45399' : '#ecf3d937';
    for (let row = 0; row < 8; row++) {
      const y = 8 + row * 16, start = 32 * hash(row, 2);
      c.lineWidth = map === 'volcano' ? 3 : 2;
      c.strokeStyle = tint;
      for (let x = start; x < 128; x += 52) {
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 8, y - 3, x + 18, y);
        c.stroke();
      }
    }
    return;
  }
  if (map === 'house' && index === 3) {
    for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) {
      box(c, (x + y) % 32 ? '#927593' : '#806b8e', x, y, 16, 16);
      box(c, '#d1a79a38', x + 5, y + 5, 6, 6);
      box(c, '#4b425632', x, y + 15, 16, 1);
    }
  } else if (map === 'house' && index === 1) {
    for (let y = 0; y < 128; y += 32) {
      box(c, '#573d4d69', 0, y, 128, 2);
      box(c, '#eaba8a7d', 0, y + 2, 128, 2);
      box(c, '#573d4d50', y % 64 === 0 ? 20 : 84, y, 2, 32);
    }
  } else if (map === 'airport' && (index === 3 || index === 4)) {
    for (const y of [0, 64]) {
      box(c, '#27374688', 0, y, 128, 1);
      box(c, '#d8dccc60', 0, y + 1, 128, 1);
      for (const x of [12, 104]) box(c, '#353f5677', x, y + 45, 12, 4);
    }
    box(c, '#27374666', 63, 0, 1, 128);
  } else if (map === 'castle' && index === 3) {
    for (let y = 0; y < 128; y += 16) for (let x = -16 + (y % 32); x < 128; x += 32) {
      box(c, '#62494055', x, y + 1, 29, 14);
      box(c, '#d7b68858', x + 1, y + 1, 28, 3);
    }
  } else if (map === 'candy' && index === 3) {
    for (let i = 0; i < 18; i++) {
      const x = 8 + 112 * hash(i, 81), y = 8 + 112 * hash(i, 82);
      c.save();
      c.translate(x, y);
      c.rotate(hash(i, 83) * Math.PI);
      box(c, p.colors[i % p.colors.length], -5, -1, 10, 2);
      c.restore();
    }
  } else if (map === 'tundra' && index === 5) {
    for (const [x, y, dx, dy] of [[27, 33, 60, 16], [7, 85, 38, -15], [73, 115, 42, -32], [61, 68, 47, 7]]) {
      c.strokeStyle = '#effbfa92';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + dx * 0.54, y + dy * 0.7 + 7);
      c.lineTo(x + dx, y + dy);
      c.stroke();
    }
  } else if (map === 'volcano' && index === 3) {
    for (let i = 0; i < 14; i++) {
      const x = 124 * hash(i, 83), y = 124 * hash(i, 84);
      box(c, '#261e2e9c', x, y, 4 + i % 6, 3);
      box(c, '#e99b594d', x + 1, y, 4, 1);
    }
  } else if (index === 2 || map === 'brickworks') {
    const step = map === 'brickworks' ? 16 : 32;
    for (let x = 0; x < 128; x += step) {
      box(c, '#27243538', x, 0, 1, 128);
      box(c, '#fff5d539', 0, x + 1, 128, 1);
      if (map === 'brickworks') {
        box(c, '#fff5d538', x + 1, 0, 1, 128);
        for (let y = 8; y < 128; y += 16) {
          ellipse(c, x + 8, y, 3.2, 3.2);
          fillStroke(c, '#422a3336', null);
          ellipse(c, x + 7, y - 1, 2, 2);
          fillStroke(c, '#ffe8ab42', null);
        }
      }
    }
  } else if (index === 3) {
    for (let i = 0; i < 22; i++) {
      const x = 124 * hash(i, 4), y = 121 * hash(i, 5);
      box(c, i % 3 ? '#382c452b' : p.colors[i % p.colors.length], x, y, 4, 2);
    }
  }
}

function paintRoad(c: Ctx, map: QueuedMap, mask: number): void {
  const p = QUEUED_PALETTES[map];
  for (const [i, bit] of EDGE.entries()) {
    if (mask & bit) continue;
    c.save();
    c.translate(64, 64);
    c.rotate(i * Math.PI / 2);
    c.translate(-64, -64);
    box(c, p.curb, 0, 0, 128, 11);
    box(c, '#ffefe655', 0, 10, 128, 2);
    if (map === 'brickworks' || map === 'castle' || map === 'house') {
      for (let x = 8; x < 128; x += 16) {
        box(c, p.shade, x, 0, 1, 9);
        box(c, '#fffad840', x + 2, 3, 10, 2);
      }
    } else if (map === 'mushroom' || map === 'candy' || map === 'volcano') {
      for (let x = 9; x < 128; x += 22) {
        ellipse(c, x, 6, 3, 2);
        fillStroke(c, map === 'volcano' ? '#ee9c53' : '#f1abc2', null);
      }
    }
    // With two-tile roads, a line on the opposite edge reads as a continuous center stripe.
    const opposite = EDGE[(i + 2) % 4];
    if (mask & opposite) {
      for (const x of [16, 79]) box(c, p.lane, x, 126, 32, 2);
      if (map === 'airport') for (const x of [8, 57, 106]) box(c, '#d3e6cd', x, 13, 8, 2);
    }
    c.restore();
  }
}

function texture(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): string {
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, w, h);
    paint(ctx);
    done();
  }
  return key;
}

function addBuilding(scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objects: Objects, map: QueuedMap): void {
  const key = texture(scene, `queued_${map}_building_${lot.style}`, 400, 320, c => {
    c.scale(2, 2);
    const paint = usesNatureArt(map) ? laterNatureBuilding : laterBuiltBuilding;
    paint(c, map, lot.style);
  });
  const { x, y, width, height, angle } = queuedBuildingPose(map, world, lot);
  const name = lot.style === QUEUED_SHOWCASE_STYLE ? 'showcase' : 'landmark';
  objects.push(scene.add.image(x, y, key).setDisplaySize(width, height)
    .setRotation(angle).setDepth(DEPTH.building).setName(`${map}-${name}`));
}

export function queuedWorldTileset(map: QueuedMap) {
  return {
    key: `world_tileset_${map}`,
    source: (size: number) => tileSource(map, size),
    index: tileIndex,
    building: (scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objects: Objects) => (
      addBuilding(scene, world, lot, objects, map)
    ),
  };
}

function addAirportRunway(scene: Phaser.Scene, world: WorldData, objects: Objects): (clock: number) => void {
  const { start, end, y } = queuedRunway(world), ts = world.tileSize;
  const runway = texture(scene, 'queued_runway', 640, 64, c => {
    box(c, '#3a4954', 0, 0, 640, 64);
    for (const edge of [3, 60]) box(c, '#adbdbe', 0, edge, 640, 1);
    for (let x = 15; x < 635; x += 24) box(c, '#e0e7da', x, 31, 12, 2);
    for (const x of [9, 615]) for (let j = 0; j < 6; j++) box(c, '#e5eadd', x, 11 + j * 7, 14, 3);
  });
  const glow = texture(scene, 'queued_runway_beacon', 24, 24, c => {
    ellipse(c, 12, 12, 11, 11);
    fillStroke(c, '#73d9b55e', null);
    ellipse(c, 12, 12, 5, 5);
    fillStroke(c, '#b6ffe7', null);
  });
  const planeArt = queuedPlaneTexture(scene);
  objects.push(scene.add.image((start + end) / 2, y, runway).setDisplaySize(end - start, 1.6 * ts)
    .setDepth(DEPTH.ground + 1).setName('airport-runway'));
  for (let x = start + 0.2 * ts; x < end; x += 2.3 * ts) {
    for (const side of [-1, 1]) {
      objects.push(scene.add.image(x, y + side * 0.88 * ts, glow).setDepth(DEPTH.ground + 2));
    }
  }
  const shadow = scene.add.image(start, y, planeArt).setTintFill(0x172634).setDepth(DEPTH.decal - 1);
  const plane = scene.add.image(start, y, planeArt).setDepth(DEPTH.airborne + 1).setName('airport-landing-plane');
  objects.push(shadow, plane);
  return clock => {
    const cycle = clock / QUEUED_FEATURES.airportPlanePeriodSec;
    const departing = Math.floor(cycle) % 2 === 1;
    const time = cycle % 1;
    const t = Math.min(1, time * 1.2);
    const x = start + (end - start) * (departing ? t ** 1.55 : 1 - (1 - t) ** 1.55);
    const altitude = departing ? t ** 4 : (1 - t) ** 5;
    const endFade = Math.min(1, t * 12, (1 - t) * 12);
    shadow.setPosition(x + altitude * 65 + 8, y + altitude * 85 + 8).setScale(1.04 + altitude * 0.1);
    plane.setPosition(x, y).setScale(1.04 + altitude * 0.46);
    plane.setAlpha(endFade);
    shadow.setAlpha(endFade * (0.42 - altitude * 0.27));
  };
}

function addMushroomSites(scene: Phaser.Scene, world: WorldData, objects: Objects): void {
  const { boardwalk, garden, cove } = queuedMushroomFeatures(world.seed);
  const ts = world.tileSize;
  const board = texture(scene, 'queued_mushroom_boardwalk', 128, 128, c => {
    box(c, '#493958', 0, 0, 128, 128);
    for (let y = 4; y < 125; y += 16) {
      box(c, y % 3 ? '#9a5f76' : '#b27585', 0, y, 128, 14);
      box(c, '#ebb6a4', 0, y, 128, 2);
      for (const x of [8, 117]) box(c, '#f7c696', x, y + 5, 3, 3);
    }
  });
  for (const [x, y, w, h] of boardwalk) {
    objects.push(scene.add.tileSprite((x + w / 2) * ts, (y + h / 2) * ts, w * ts, h * ts, board)
      .setDepth(DEPTH.ground + 1).setName('mushroom-boardwalk'));
  }
  const spore = texture(scene, 'queued_mushroom_spore_garden', 128, 128, c => {
    const haze = c.createRadialGradient(64, 64, 7, 64, 64, 62);
    haze.addColorStop(0, '#fff3a1a8');
    haze.addColorStop(0.5, '#fbb6cd67');
    haze.addColorStop(1, '#fbb6cd00');
    box(c, haze, 0, 0, 128, 128);
    for (const [x, y, r] of [[45, 39, 11], [92, 53, 13], [57, 86, 16], [25, 76, 6], [98, 92, 8]]) {
      box(c, '#f9d099', x - 2, y + 1, 4, r);
      ellipse(c, x, y, r, Math.max(4, r * 0.5));
      fillStroke(c, r > 10 ? '#e297bd' : '#a4ece0', '#613e6e', 1.5);
      ellipse(c, x - r * 0.25, y - 2, r * 0.4, 2);
      fillStroke(c, '#fff5ce', null);
    }
  });
  const [gx, gy, gw, gh] = garden;
  for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
    if (world.tiles[y * world.widthTiles + x] !== Tile.Plaza) continue;
    if ((x + y) % 3 === 0 || y === gy || y === gy + gh - 1) {
      objects.push(scene.add.image((x + 0.5) * ts, (y + 0.5) * ts, spore)
        .setAngle((x * 47 + y * 83) % 360).setDepth(DEPTH.decal - 1).setName('mushroom-spore-garden'));
    }
  }
  const ripple = texture(scene, 'queued_mushroom_cove_ripple', 96, 96, c => {
    for (const r of [22, 37]) {
      ellipse(c, 48, 48, r, r * 0.63);
      c.strokeStyle = '#caf2bb55';
      c.lineWidth = 2;
      c.stroke();
    }
    ellipse(c, 48, 48, 15, 10);
    fillStroke(c, '#8fccaf', '#474764', 2);
    ellipse(c, 46, 47, 6, 5);
    fillStroke(c, '#f9d3ad', null);
  });
  const [cx, cy, cw, ch] = cove[0];
  for (let y = cy; y < cy + ch; y += 2) for (let x = cx; x < cx + cw - 1; x += 2) {
    if (world.tiles[y * world.widthTiles + x] !== Tile.Water) continue;
    objects.push(scene.add.image((x + 0.35) * ts, (y + 0.52) * ts, ripple)
      .setDepth(DEPTH.ground + 1).setName('mushroom-cove-lilies'));
  }
}

function addVolcanoTunnel(scene: Phaser.Scene, world: WorldData, objects: Objects): void {
  const { x, y } = queuedVolcanoTunnel(world), ts = world.tileSize;
  const key = texture(scene, 'queued_volcano_tunnel', 192, 408, c => {
    const gradient = c.createLinearGradient(0, 0, 192, 0);
    gradient.addColorStop(0, '#241e2c');
    gradient.addColorStop(0.24, '#342d3d');
    gradient.addColorStop(0.5, '#4f4148');
    gradient.addColorStop(0.76, '#342d3d');
    gradient.addColorStop(1, '#241e2c');
    box(c, gradient, 0, 0, 192, 408);
    for (const side of [0, 170]) {
      box(c, '#67515a', side, 0, 22, 408);
      for (let row = 0; row < 408; row += 30) {
        box(c, '#2c2635', side, row, 22, 3);
        box(c, '#8b6661', side + 3, row + 4, 16, 2);
      }
      for (const py of [34, 119, 200, 285, 370]) {
        ellipse(c, side + 11, py, 9, 22);
        fillStroke(c, '#db853e76', null);
        box(c, '#ffdb86', side + 7, py - 9, 8, 18);
      }
    }
    for (const py of [0, 394]) {
      box(c, '#7a5f65', 0, py, 192, 14);
      box(c, '#ad8071', 0, py + 2, 192, 4);
    }
    for (let py = 23; py < 388; py += 32) box(c, '#e7ac6e90', 95, py, 2, 13);
  });
  objects.push(scene.add.image(x, y, key).setDisplaySize(2 * ts, 4.25 * ts)
    .setDepth(DEPTH.ground + 1).setName('volcano-tunnel'));
}

export function addQueuedWorld(scene: Phaser.Scene, world: WorldData, objects: Objects, map: QueuedMap): (dt: number) => void {
  const palette = QUEUED_PALETTES[map], ts = world.tileSize;
  const W = world.widthTiles * ts, H = world.heightTiles * ts;
  objects.push(scene.add.rectangle(W / 2, H / 2, W + 1800, H + 1800, Number.parseInt(palette.floor[0].slice(1), 16))
    .setDepth(DEPTH.ground - 2));
  const updateScenery = addQueuedScenery(scene, world, objects, map);
  if (map === 'volcano') addVolcanoTunnel(scene, world, objects);
  if (map === 'mushroom') addMushroomSites(scene, world, objects);
  const runway = map === 'airport' ? addAirportRunway(scene, world, objects) : undefined;
  let clock = 0;
  return dt => {
    clock += dt;
    runway?.(clock);
    updateScenery(dt);
  };
}
