import type Phaser from 'phaser';
import { DEPTH, UNDERGROUND } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { Tile, type WorldData } from '../core/types';
import { isUndergroundLava, UNDERGROUND_CROSSINGS, undergroundRiverSpan } from './gen/underground';
import { DIRS } from './gen/grid';
import { tileAt } from './geometry';
import { block, glow, undergroundArt, undergroundTexture } from './undergroundArt';
import { addUndergroundRail } from './undergroundRail';

export interface UndergroundWorldHandle { update(dt: number): void }

function makeBridges(scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[]): void {
  const ts = world.tileSize;
  for (const y of UNDERGROUND_CROSSINGS) {
    const spans = [y - 1, y, y + 1, y + 2].map(row => undergroundRiverSpan(row, world.heightTiles, world.seed));
    const left = Math.min(...spans.map(span => span[0])) - 1;
    const right = Math.max(...spans.map(span => span[1])) + 1;
    const width = (right - left) * ts;
    const key = undergroundTexture(scene, `bridge_${width}`, width, ts * 2, c => {
      block(c, 'rgba(53,58,83,.5)', 0, 22, width, ts * 2 - 44);
      for (let x = 9; x < width; x += 52) {
        block(c, '#1c263b', x, 22, 3, ts * 2 - 44);
        for (const yy of [29, ts * 2 - 34]) block(c, '#8894a6', x + 7, yy, 4, 4);
      }
      for (const edge of [0, ts * 2 - 22]) {
        block(c, '#241d39', 0, edge, width, 22);
        block(c, '#a57489', 0, edge + 2, width, 5);
        block(c, '#f19173', 0, edge + 9, width, 3);
        block(c, '#5f496c', 0, edge + 16, width, 4);
        for (let x = 15; x < width; x += 72) {
          block(c, '#635477', x, edge, 10, 22); block(c, '#ffdb9a', x + 2, edge + 8, 6, 6);
        }
      }
    });
    objs.push(scene.add.image(left * ts, y * ts, key).setOrigin(0).setDepth(DEPTH.decal - 2).setName('underground-lava-bridge'));
  }
}

function makeBanks(scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[]): void {
  const ts = world.tileSize;
  const edgeTexture = (lava: boolean) => undergroundTexture(scene, lava ? 'lava_edge' : 'rock_edge', ts, 32, c => {
    const shade = c.createLinearGradient(0, 0, 0, 32);
    shade.addColorStop(0, lava ? 'rgba(255,143,77,.8)' : '#575277');
    shade.addColorStop(.27, lava ? 'rgba(255,88,49,.42)' : 'rgba(97,84,129,.65)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = shade; c.fillRect(0, 0, ts, 32);
    for (let x = 8; x < ts; x += 26) block(c, lava ? '#ffcd83' : '#665b84', x, 1, 12, 2);
  });
  const keys = [edgeTexture(false), edgeTexture(true)];
  for (let y = 1; y < world.heightTiles - 1; y++) for (let x = 1; x < world.widthTiles - 1; x++) {
    if (tileAt(world, x, y) !== Tile.Grass) continue;
    for (const [i, { dx, dy }] of DIRS.entries()) {
      if (tileAt(world, x + dx, y + dy) !== Tile.Water) continue;
      const lava = isUndergroundLava(world, x + dx, y + dy);
      objs.push(scene.add.image((x + .5 + dx / 2) * ts, (y + .5 + dy / 2) * ts, keys[Number(lava)])
        .setOrigin(.5, 0).setRotation((i + 1) * Math.PI / 2).setDepth(DEPTH.decal - 3));
    }
  }
}

/** Install static cave scenery and animate only with driving time, including after pause. */
export function addUndergroundWorld(scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[]): UndergroundWorldHandle {
  const ts = world.tileSize, rng = new Rng(world.seed ^ 0x554e4447), art = undergroundArt(scene);
  const add = (name: string, x: number, y: number, depth: number = DEPTH.prop, scale = 1, angle = 0) => {
    const image = scene.add.image(x * ts, y * ts, art(name)).setDepth(depth).setScale(scale).setRotation(angle).setName(`underground-${name}`);
    objs.push(image);
    return image;
  };
  makeBanks(scene, world, objs);
  makeBridges(scene, world, objs);

  const updateRail = addUndergroundRail(scene, ts, objs);

  const landmarks = [
    ['portal', 8, 8.4, 1.35], ['elevator', 11.8, 7.5, 1.5], ['elevator', 35.7, 39.8, 1.5],
    ['chute', 13, 12.3, 1.21], ['ore-bin', 14.1, 12.9, .85], ['portal', 15, 18.5, 1.35],
    ['chute', 34, 26.7, 1.21], ['ore-bin', 35.3, 26.9, 1], ['portal', 38.5, 32.1, 1.4],
    ['pool', 10.4, 15.7, 2], ['pool', 11.4, 29.8, 2.2], ['pool', 36.1, 30.8, 2.4],
    ['crystal', 12, 11.55, 1.35], ['violet-crystal', 15, 8.5, 1.15], ['mushroom', 11.5, 12.1, .8],
    ['stalagmite', 8.1, 11.6, 1.4], ['lantern', 13.8, 8.7, .95], ['floodlight', 15.6, 11.3, 1.35],
    ['fissure', 17.6, 7.8, 1.4], ['barrier', 9.15, 8.8, .9],
  ] as const;
  for (const [name, x, y, scale] of landmarks) {
    add(name, x, y, name === 'pool' || name === 'fissure' ? DEPTH.decal - 2 : DEPTH.prop, scale);
  }

  for (let i = 0; i < 130; i++) {
    const x = rng.int(3, world.widthTiles - 4), y = rng.int(3, world.heightTiles - 4);
    if (tileAt(world, x, y) !== Tile.Grass) continue;
    const edge = DIRS.some(({ dx, dy }) => tileAt(world, x + dx, y + dy) === Tile.Water);
    if (!edge && !rng.chance(.37)) continue;
    const name = rng.pick(['crystal', 'violet-crystal', 'mushroom', 'stalagmite', 'fissure']);
    add(name, x + rng.range(.3, .7), y + rng.range(.3, .7), name === 'fissure' ? DEPTH.decal - 2 : DEPTH.prop,
      rng.range(.55, 1.15), rng.range(-.55, .55));
  }
  for (const y of UNDERGROUND_CROSSINGS) for (const x of [10, 14, 19, 29, 34, 38]) {
    add('chevron', x, y + 1, DEPTH.decal - 1, .65);
    const side = x % 3 ? -.32 : 2.27;
    const terrain = tileAt(world, x, Math.floor(y + side));
    if (terrain === Tile.Grass) add(x % 2 ? 'lantern' : 'floodlight', x + .5, y + side, DEPTH.prop, 1.25, side < 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  const steam = [[19.3, 8.5], [16, 23.85], [32.3, 11.4], [37.1, 35.45], [8.25, 36.4]].map(([x, y]) => {
    add('vent', x, y, DEPTH.decal - 1, .82);
    return { x, y, image: add('steam', x, y, DEPTH.prop + 1), phase: rng.next() };
  });
  const embers = Array.from({ length: 38 }, () => ({
    image: add('ember', 0, 0, DEPTH.decal, .64), start: rng.range(0, world.heightTiles), fraction: rng.range(.1, .9), phase: rng.range(0, 6.28),
  }));
  const lavaHalo = undergroundTexture(scene, 'lava-halo', 216, 216, c => glow(c, 108, 108, 108, '251,103,59', .55));
  const bubbles: { image: Phaser.GameObjects.Image; phase: number }[] = [];
  for (let y = 1; y < world.heightTiles - 1; y += 2) {
    const [left, right] = undergroundRiverSpan(y, world.heightTiles, world.seed);
    if (!isUndergroundLava(world, left, y)) continue;
    for (const x of [left + .2, right - .2]) objs.push(scene.add.image(x * ts, (y + .5) * ts, lavaHalo).setDepth(DEPTH.decal - 3).setScale(1.7));
    if (rng.chance(.72)) {
      const x = rng.range(left + 1, right - 1);
      bubbles.push({ image: add('lava-bubble', x, y + .5, DEPTH.decal - 2, 1, rng.range(0, 6.28)), phase: rng.next() });
    }
    if (rng.chance(.48)) {
      const x = rng.chance(.5) ? left + rng.range(.35, .76) : right - rng.range(.35, .76);
      add('basalt', x, y + .5, DEPTH.decal - 2, rng.range(.7, 1.4), rng.range(0, 6.28));
    }
  }

  let elapsed = 0;
  const update = (dt: number) => {
    elapsed += dt;
    updateRail(dt);
    for (const item of steam) {
      const p = (elapsed * .43 + item.phase) % 1;
      item.image.setPosition((item.x + p * .4) * ts, (item.y - p * .58) * ts).setScale(.55 + p * 1.14).setAlpha(Math.sin(p * Math.PI) * .7);
    }
    for (const item of embers) {
      const y = (item.start + elapsed * UNDERGROUND.emberSpeed / ts) % world.heightTiles;
      const [left, right] = undergroundRiverSpan(Math.floor(y), world.heightTiles, world.seed);
      const x = left + (right - left) * item.fraction + Math.sin(elapsed * 1.3 + item.phase) * .4;
      item.image.setPosition(x * ts, y * ts).setAlpha(isUndergroundLava(world, Math.floor(x), Math.floor(y)) ? .56 + Math.sin(elapsed * 3 + item.phase) * .3 : 0);
    }
    for (const item of bubbles) {
      const pulse = (elapsed * .62 + item.phase) % 1;
      item.image.setScale(.35 + pulse * 1.2).setAlpha(Math.sin(pulse * Math.PI) * .8);
    }
  };
  update(0);
  return { update };
}
