import type Phaser from 'phaser';
import { ellipse, fillStroke, hash, makeCanvas, type Ctx } from '../art/draw';
import { DEPTH } from '../config/gameConfig';
import type { QueuedMap } from '../config/queuedMaps';
import { Rng } from '../core/rng';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type BuildingLot, type WorldData } from '../core/types';
import { queuedRunway, queuedVolcanoTunnel } from './gen/queuedWorlds';
import { box, paintQueuedBuilding, paintQueuedPlane, paintQueuedScenery, QUEUED_PALETTES } from './queuedWorldArt';

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
  if (map === 'house' && index === 1) {
    for (let y = 0; y < 128; y += 32) {
      box(c, '#573d4d69', 0, y, 128, 2);
      box(c, '#eaba8a7d', 0, y + 2, 128, 2);
      box(c, '#573d4d50', y % 64 === 0 ? 20 : 84, y, 2, 32);
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
  } else if (index === 2 || map === 'brickworks') {
    const step = map === 'brickworks' ? 16 : 32;
    for (let x = 0; x < 128; x += step) {
      box(c, '#27243538', x, 0, 1, 128);
      box(c, '#fff5d539', 0, x + 1, 128, 1);
      if (map === 'brickworks') box(c, '#fff5d538', x + 1, 0, 1, 128);
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
    paintQueuedBuilding(c, map, lot.style);
  });
  const ts = world.tileSize;
  objects.push(scene.add.image((lot.tx + lot.tw / 2) * ts, (lot.ty + lot.th / 2) * ts, key)
    .setDisplaySize(lot.tw * ts, lot.th * ts).setDepth(DEPTH.building).setName(`${map}-landmark`));
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
  const planeArt = texture(scene, 'queued_runway_plane', 200, 200, c => {
    c.scale(2, 2);
    paintQueuedPlane(c, '#9db9c8', '#3a566a', '#f6d79b');
  });
  const shadowArt = texture(scene, 'queued_runway_plane_shadow', 64, 64, c => {
    ellipse(c, 32, 32, 30, 13);
    fillStroke(c, '#23313875', null);
  });
  objects.push(scene.add.image((start + end) / 2, y, runway).setDisplaySize(end - start, 1.6 * ts)
    .setDepth(DEPTH.ground + 1).setName('airport-runway'));
  for (let x = start + 0.2 * ts; x < end; x += 2.3 * ts) {
    for (const side of [-1, 1]) {
      objects.push(scene.add.image(x, y + side * 0.88 * ts, glow).setDepth(DEPTH.ground + 2));
    }
  }
  const shadow = scene.add.image(start, y, shadowArt).setDepth(DEPTH.decal - 1);
  const plane = scene.add.image(start, y, planeArt).setDepth(DEPTH.airborne + 1).setName('airport-landing-plane');
  objects.push(shadow, plane);
  return clock => {
    const time = clock % 34;
    const departing = time >= 17;
    const t = (time % 17) / 17;
    const x = start + (end - start) * t;
    const altitude = departing ? t ** 3 : Math.max(0, 1 - t * 1.6) ** 2;
    shadow.setPosition(x, y).setScale(3.2 - altitude).setAlpha(1 - altitude * 0.6);
    plane.setPosition(x, y - altitude * 340).setScale(1.1 + altitude * 0.75);
    const endFade = Math.min(1, t * 10, (1 - t) * 10);
    plane.setAlpha(endFade);
    shadow.setAlpha(endFade * (1 - altitude * 0.6));
  };
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
  const rng = new Rng(world.seed ^ 0xc3b88b1);
  const life: { img: Phaser.GameObjects.Image; x: number; y: number; phase: number }[] = [];
  const sprites = Array.from({ length: 3 }, (_, style) => texture(scene, `queued_${map}_scenery_${style}`, 100, 100,
    c => paintQueuedScenery(c, map, style)));
  for (let y = 3; y < world.heightTiles - 3; y += 2) for (let x = 3; x < world.widthTiles - 3; x += 2) {
    const tile = world.tiles[y * world.widthTiles + x];
    if ((tile !== Tile.Grass && tile !== Tile.Park && tile !== Tile.Dirt) || !rng.chance(tile === Tile.Park ? 0.62 : 0.19)) continue;
    const px = (x + rng.range(0.3, 0.7)) * ts, py = (y + rng.range(0.3, 0.7)) * ts;
    const style = rng.int(0, sprites.length - 1);
    const img = scene.add.image(px, py, sprites[style]).setScale(rng.range(0.57, 1.13)).setDepth(DEPTH.decal - 1);
    objects.push(img);
    if (map === 'tundra' && style >= 2) life.push({ img, x: px, y: py, phase: rng.range(0, Math.PI * 2) });
  }
  if (map === 'volcano') addVolcanoTunnel(scene, world, objects);
  const runway = map === 'airport' ? addAirportRunway(scene, world, objects) : undefined;
  let clock = 0;
  return dt => {
    clock += dt;
    runway?.(clock);
    for (const { img, x, y, phase } of life) {
      const t = clock * 0.8 + phase;
      img.setPosition(x + Math.sin(t) * 23, y + Math.cos(t) * 7).setRotation(Math.cos(t) * 0.18);
    }
  };
}
