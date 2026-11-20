import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, lin, radial, rr } from '../art/draw';
import { DEPTH, SKY, SKY_DRAWBRIDGE, SKY_FIXED_CROSSINGS, SKY_NORTH_SOUTH_ROADS } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type BuildingLot, type WorldData } from '../core/types';
import { isSkyBridgeDeck } from './gen/sky';
import { tileAt } from './geometry';
import { box, cloudBank, dirigibleTexture, line, railTexture, skyBridgeDeck, skyRoof, skyTexture } from './skyArt';

type Objects = Phaser.GameObjects.GameObject[];

export function skyTileIndex(world: WorldData, index: number): number {
  const x = index % world.widthTiles;
  const y = Math.floor(index / world.widthTiles);
  switch (world.tiles[index]) {
    case Tile.Water: return 0;
    case Tile.Road: return isSkyBridgeDeck(x, y) ? 0 : 6 + (world.roadMask[index] & 15);
    default: return 4;
  }
}

export function skyTileSource(size: number): (index: number) => CanvasImageSource {
  return index => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const c = tile.getContext('2d')!;
    if (index === 0) return tile;
    if (index < 6) {
      box(c, '#b9aec8', 0, 0, size, size);
      box(c, '#dbc7cc', 0, 0, size, 2);
      box(c, '#978caf', 0, size - 2, size, 2);
      box(c, '#d0bcd1', 0, 0, 2, size);
      for (const x of [9, size - 13]) for (const y of [9, size - 13]) box(c, '#9a88a7', x, y, 4, 4);
      return tile;
    }
    box(c, '#68738c', 0, 0, size, size);
    const shoulder = () => {
      box(c, '#a99fb4', 0, 0, size, 17);
      box(c, '#e8ca8d', 0, 12, size, 3);
      box(c, '#50617e', 0, 15, size, 5);
      for (const x of [23, 71, 114]) box(c, '#f7e5a4', x, 3, 7, 4);
    };
    for (const bit of [ROAD_N, ROAD_E, ROAD_S, ROAD_W]) {
      if (!((index - 6) & bit)) shoulder();
      c.translate(size, 0); c.rotate(Math.PI / 2);
    }
    return tile;
  };
}

export function addSkyBuilding(scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objects: Objects): void {
  const ts = world.tileSize;
  objects.push(scene.add.image((lot.tx + lot.tw / 2) * ts, (lot.ty + lot.th / 2) * ts, skyRoof(scene, lot.style))
    .setDisplaySize(lot.tw * ts + 20, lot.th * ts + 20).setDepth(DEPTH.building).setName('sky-building'));
}

function addRailRuns(scene: Phaser.Scene, world: WorldData, objects: Objects): void {
  const ts = world.tileSize, key = railTexture(scene);
  const scan = (outer: number, inner: number, vertical: boolean, direction: number) => {
    const openSky = (i: number, j: number) => {
      const [x, y] = vertical ? [i, j] : [j, i];
      return tileAt(world, x, y) === Tile.Water || isSkyBridgeDeck(x, y);
    };
    for (let i = 1; i < outer - 1; i++) {
      let start = -1;
      for (let j = 0; j <= inner; j++) {
        const edge = j < inner && !openSky(i, j) && openSky(i + direction, j);
        const joinsDrawbridge = vertical && (i === SKY_DRAWBRIDGE.left - 1 || i === SKY_DRAWBRIDGE.right) &&
          j >= SKY_DRAWBRIDGE.row && j < SKY_DRAWBRIDGE.row + SKY_DRAWBRIDGE.height;
        if (edge && !joinsDrawbridge) {
          if (start < 0) start = j;
          continue;
        }
        if (start < 0) continue;
        const along = (start + j) * ts / 2;
        const cross = (i + Number(direction > 0)) * ts;
        const rotation = vertical ? -direction * Math.PI / 2 : (direction > 0 ? 0 : Math.PI);
        objects.push(scene.add.tileSprite(vertical ? cross : along, vertical ? along : cross, (j - start) * ts, 45, key)
          .setOrigin(.5, 0).setRotation(rotation).setDepth(DEPTH.ground + 1).setName('sky-safety-rail'));
        start = -1;
      }
    }
  };
  for (const side of [-1, 1]) {
    scan(world.widthTiles, world.heightTiles, true, side);
    scan(world.heightTiles, world.widthTiles, false, side);
  }
}

export function addSkyWorld(scene: Phaser.Scene, world: WorldData, objects: Objects): { update(dt: number): void } {
  const ts = world.tileSize, rng = new Rng(world.seed ^ 0x534b5943);
  const width = world.widthTiles * ts, height = world.heightTiles * ts;
  const image = (x: number, y: number, texture: string, depth: number, name: string) => {
    const result = scene.add.image(x, y, texture).setDepth(depth).setName(`sky-${name}`);
    objects.push(result);
    return result;
  };
  const sky = skyTexture(scene, 'atmosphere', 600, 600, c => {
    box(c, lin(c, 0, 0, 570, 600, [[0, '#787bb0'], [.38, '#80afd6'], [.73, '#a4d0e6'], [1, '#e8c8d3']]), 0, 0, 600, 600);
    box(c, radial(c, 105, 104, 10, 320, [[0, '#fff0cdab'], [.44, '#ead7e35b'], [1, '#ead7e300']]), 0, 0, 600, 600);
  });
  image(width / 2, height / 2, sky, DEPTH.ground - 12, 'atmosphere').setDisplaySize(width + 2300, height + 2300);

  const clouds = Array.from({ length: SKY.cloudBands }, (_, row) =>
    Array.from({ length: SKY.cloudsPerBand }, (_, col) => {
      const x = (col + rng.range(-.3, .65)) / SKY.cloudsPerBand * width;
      const y = (row + rng.range(-.25, .95)) / SKY.cloudBands * height;
      const high = (row + col) % 3 === 0;
      const p = high ? rng.range(.56, 1.2) : rng.range(.74, 1.58);
      const drift = high ? rng.range(1.9, 3.1) : rng.range(.65, 1.6);
      const view = image(x, y, cloudBank(scene, (row + col) % 4), DEPTH.ground - (high ? 4 : 7), 'cloud-bank');
      view.setScale(p * 1.45, p).setRotation(rng.range(-.52, .52)).setAlpha(high ? rng.range(.48, .8) : rng.range(.32, .76));
      return { view, x, y, drift };
    })).flat();

  const tower = skyTexture(scene, 'lift-engine', 212, 162, c => {
    rr(c, 8, 20, 196, 124, 29); fillStroke(c, bodyGrad(c, 8, 20, 196, 124, '#b7a6c0', '#4d628f'), '#585a81', 6);
    for (const y of [23, 126]) box(c, '#dcb283', 29, y, 151, 7);
    for (const x of [59, 153]) {
      ellipse(c, x, 84, 37, 37); fillStroke(c, '#d4a980', '#695b7b', 4);
      ellipse(c, x, 84, 25, 25); fillStroke(c, '#536e9f', '#f7dca1', 3);
    }
    box(c, '#e7d0a0', 99, 48, 14, 68);
  });
  const rotor = skyTexture(scene, 'lift-rotor', 52, 52, c => {
    for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      c.save(); c.translate(26, 26); c.rotate(a);
      rr(c, -2, -3, 25, 13, 4); fillStroke(c, '#b3d6dc', '#596a9c', 2); c.restore();
    }
    ellipse(c, 26, 26, 6, 6); fillStroke(c, '#fff0a8', '#7f6082', 2);
  });
  const engines = [[7, 19.85], [16, 19.85], [31, 19.85], [40, 19.85], [8, 42.83], [16, 42.83], [31, 42.83], [39, 42.83]];
  const fans = engines.flatMap(([x, y]) => {
    image(x * ts, y * ts + 42, tower, DEPTH.ground - 2, 'lift-engine');
    return [-47, 47].map(dx => image(x * ts + dx, y * ts + 45, rotor, DEPTH.ground - 1, 'lift-rotor'));
  });

  addRailRuns(scene, world, objects);
  const bridgeHeight = SKY_DRAWBRIDGE.height * ts;
  const addSkyway = (start: number, end: number, across: number, vertical = false) => {
    const along = (start + end) * ts / 2;
    const cross = across * ts + bridgeHeight / 2;
    const deck = skyBridgeDeck(scene, (end - start) * ts, bridgeHeight, false);
    image(vertical ? cross - 14 : along, vertical ? along : cross + 14, deck, DEPTH.ground + 2, 'fixed-bridge')
      .setRotation(vertical ? Math.PI / 2 : 0);
  };
  for (const [index, row] of SKY_FIXED_CROSSINGS.entries()) {
    if (index === 0) {
      addSkyway(SKY_DRAWBRIDGE.left, SKY_DRAWBRIDGE.right, row);
      continue;
    }
    // Leave the railings open where the southern connector meets the east-west spans.
    addSkyway(SKY_DRAWBRIDGE.left, 23, row);
    addSkyway(25, SKY_DRAWBRIDGE.right, row);
  }
  for (const column of SKY_NORTH_SOUTH_ROADS) addSkyway(20, 27, column, true);
  addSkyway(32, 39, 23, true);

  const dash = skyTexture(scene, 'lane-dash', 30, 6, c => {
    rr(c, 0, 0, 30, 6, 3); fillStroke(c, '#decfa1', null);
  });
  for (let y = 1; y < world.heightTiles - 1; y++) for (let x = 1; x < world.widthTiles - 1; x++) {
    if (tileAt(world, x, y) !== Tile.Road || isSkyBridgeDeck(x, y)) continue;
    if (x >= SKY_DRAWBRIDGE.left && x < SKY_DRAWBRIDGE.right) continue;
    const road = (tx: number, ty: number) => tileAt(world, tx, ty) === Tile.Road;
    const horizontal = road(x, y - 1) && !road(x, y + 1) && !road(x, y - 2);
    const vertical = road(x - 1, y) && !road(x + 1, y) && !road(x - 2, y);
    if (horizontal) for (const dx of [.25, .75]) image((x + dx) * ts, y * ts, dash, DEPTH.ground + .5, 'lane');
    if (vertical) for (const dy of [.25, .75]) image(x * ts, (y + dy) * ts, dash, DEPTH.ground + .5, 'lane').setRotation(Math.PI / 2);
  }

  const park = skyTexture(scene, 'sky-garden', 272, 178, c => {
    rr(c, 4, 5, 264, 168, 39); fillStroke(c, '#d7adad', '#f8dfb6', 5);
    rr(c, 18, 20, 236, 134, 30); fillStroke(c, '#76aab0', '#748ba6', 4);
    for (const x of [44, 86, 186, 228]) for (const y of [45, 88, 132]) {
      ellipse(c, x, y, 13, 11); fillStroke(c, '#9bd5bd', null);
      ellipse(c, x + 3, y - 3, 6, 6); fillStroke(c, '#fff2b7', null);
    }
    ellipse(c, 136, 88, 38, 45); fillStroke(c, '#e4b7c4', '#ede0c8', 4);
    ellipse(c, 136, 88, 27, 34); fillStroke(c, '#9ddae6', '#8b9fc5', 3);
    line(c, '#ecfbdb', 2, 125, 102, 137, 63, 147, 105);
  });
  for (const [x, y] of [[5.9, 11.8], [10.8, 18.9], [32.1, 18.8], [41.9, 11.7], [10.4, 36.8], [32.2, 36.8]]) {
    image(x * ts, y * ts, park, DEPTH.decal - 2, 'garden').setScale(.83);
  }

  const ships = Array.from({ length: SKY.airshipCount }, (_, index) => {
    const track = [3.4, 14.8, 23.8, 33.6, 44.3][index % 5];
    const angle = index % 2 ? Math.PI : 0;
    const speed = SKY.airshipSpeed * rng.range(.74, 1.24) * (index % 2 ? -1 : 1);
    const view = image(0, track * ts, dirigibleTexture(scene, index % 3), DEPTH.ground - 3, 'dirigible')
      .setRotation(angle).setScale(rng.range(.85, 1.32)).setAlpha(.93);
    const x = index === 1 ? 23.5 * ts : rng.range(0, width);
    return { view, x, y: track * ts, speed, angle };
  });
  let elapsed = 0;
  const wrapX = (x: number, margin: number) => {
    const span = width + 2 * margin;
    return ((x + margin) % span + span) % span - margin;
  };
  const update = (dt: number) => {
    elapsed += dt;
    for (const cloud of clouds) {
      cloud.view.setPosition(wrapX(cloud.x + elapsed * cloud.drift * SKY.cloudSpeed, 720),
        cloud.y + Math.sin(cloud.x + elapsed * .15) * 22);
    }
    for (const ship of ships) {
      ship.view.setPosition(wrapX(ship.x + elapsed * ship.speed, 340), ship.y + Math.sin(elapsed * .38 + ship.y) * 49)
        .setRotation(ship.angle + Math.sin(elapsed * 1.2 + ship.y) * .035);
    }
    fans.forEach((fan, index) => fan.setRotation(elapsed * (index % 2 ? -7 : 8) + index));
  };
  update(0);
  return { update };
}
