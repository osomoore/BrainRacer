import type Phaser from 'phaser';
import { ellipse, fillStroke, makeCanvas, rr, type Ctx } from '../art/draw';
import { DEPTH, QUEUED_SCENERY as DETAIL } from '../config/gameConfig';
import type { QueuedMap } from '../config/queuedMaps';
import { Rng } from '../core/rng';
import { Tile, type WorldData } from '../core/types';
import { usesNatureArt } from './laterBuildingFootprints';
import { laterBuiltMotion, laterBuiltProp } from './laterBuiltArt';
import { laterNatureMotion, laterNatureProp } from './laterNatureArt';

type Motion = 'spin' | 'float' | 'drift' | 'pass' | 'pulse';
const MOTIONS: Record<QueuedMap, readonly [Motion, Motion, Motion]> = {
  brickworks: ['drift', 'drift', 'pulse'],
  mushroom: ['float', 'drift', 'pass'],
  tundra: ['drift', 'float', 'pass'],
  volcano: ['drift', 'float', 'pulse'],
  candy: ['spin', 'spin', 'float'],
  castle: ['spin', 'pulse', 'spin'],
  airport: ['spin', 'pulse', 'pass'],
  house: ['spin', 'spin', 'pulse'],
};

const SCENES = {
  brickworks: { name: 'parts-yard', props: [3, 0, 2, 5, 6], floor: '#af8b6198', edge: '#d5ac6a', radius: 12 },
  mushroom: { name: 'toadstool-garden', props: [7, 1, 4, 3, 6], floor: '#75958493', edge: '#b1c895', radius: 75 },
  tundra: { name: 'sled-camp', props: [8, 1, 5, 6, 7], floor: '#c5e4e0a8', edge: '#ecfffa', radius: 68 },
  volcano: { name: 'geothermal-field', props: [0, 6, 7, 1, 4], floor: '#57424bb0', edge: '#a56e62', radius: 44 },
  candy: { name: 'sweet-stall', props: [5, 0, 8, 7, 10], floor: '#fccabbb0', edge: '#fff0d2', radius: 46 },
  castle: { name: 'courtyard', props: [1, 7, 3, 5, 6], floor: '#b3a38a9a', edge: '#d4c3a4', radius: 20 },
  airport: { name: 'service-apron', props: [0, 2, 7, 11, 5], floor: '#526574', edge: '#e9ce7f', radius: 10 },
  house: { name: 'play-rug', props: [11, 3, 10, 2, 9], floor: '#846196', edge: '#e4b275', radius: 28 },
} as const;

type Ambient = {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  phase: number;
  period: number;
  scale: number;
  angle: number;
  motion: Motion;
};

function drawFrame(scene: Phaser.Scene, key: string, paint: (c: Ctx) => void): string {
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, 150, 150);
    ctx.scale(1.5, 1.5);
    paint(ctx);
    done();
  }
  return key;
}

function animate(fx: Ambient, clock: number): void {
  const { image, x, y, phase, period, scale, angle, motion } = fx;
  const progress = (clock / period + phase) % 1;
  const t = progress * Math.PI * 2;
  switch (motion) {
    case 'spin':
      image.setRotation(angle + t);
      break;
    case 'float':
      image.setPosition(x + Math.cos(t) * 31, y + Math.sin(t) * 23)
        .setRotation(angle + Math.sin(t) * 0.3).setAlpha(0.68 + 0.32 * Math.sin(t) ** 2);
      break;
    case 'drift':
      image.setPosition(x + progress * 59 - 15, y + Math.sin(t) * 12 - progress * 28)
        .setScale(scale * (0.55 + progress * 0.75)).setAlpha(Math.sin(progress * Math.PI) ** 1.6);
      break;
    case 'pass': {
      const distance = (progress - 0.5) * 155;
      image.setPosition(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance)
        .setAlpha(Math.min(1, progress * 7, (1 - progress) * 7));
      break;
    }
    case 'pulse':
      image.setScale(scale * (0.89 + 0.11 * Math.sin(t))).setAlpha(0.72 + 0.28 * Math.cos(t) ** 2);
      break;
  }
}

/** Use recognizable groupings near roads, with a first one within the starting neighborhood. */
function addScenes(scene: Phaser.Scene, world: WorldData, objects: Phaser.GameObjects.GameObject[], map: QueuedMap,
  paint: typeof laterNatureProp): Set<number> {
  const occupied = new Set<number>();
  const ts = world.tileSize, w = world.widthTiles, h = world.heightTiles;
  const theme = SCENES[map];
  const candidates: { x: number; y: number; index: number; startDistance: number }[] = [];
  const spawn = world.playerSpawns[0];
  const lawn = (i: number) => world.tiles[i] === Tile.Grass || world.tiles[i] === Tile.Park || world.tiles[i] === Tile.Dirt;
  const road = (i: number) => world.tiles[i] === Tile.Road;
  for (let y = 3; y < h - 4; y++) for (let x = 3; x < w - 4; x++) {
    const i = y * w + x;
    if (![i, i + 1, i + w, i + w + 1].every(lawn)) continue;
    if (![i - 1, i + w - 1, i - w, i - w + 1, i + 2, i + w + 2, i + w * 2, i + w * 2 + 1].some(road)) continue;
    candidates.push({ x, y, index: i, startDistance: Math.hypot((x + 1) * ts - spawn.x, (y + 1) * ts - spawn.y) });
  }
  candidates.sort((a, b) => a.startDistance - b.startDistance);
  const key = `queued_${map}_little_scene`;
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, 232, 232);
    rr(ctx, 10, 11, 212, 210, theme.radius);
    fillStroke(ctx, theme.floor, theme.edge, 3);
    ctx.setLineDash(map === 'airport' || map === 'brickworks' ? [9, 7] : [2, 6]);
    rr(ctx, 20, 21, 192, 190, theme.radius - 4);
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ellipse(ctx, 116, 116, 47, 47);
    ctx.stroke();
    const placements = [[111, 115, 1.23], [64, 68, 0.64], [167, 73, 0.63], [65, 163, 0.67], [169, 159, 0.68]];
    for (const [i, [x, y, scale]] of placements.entries()) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i % 3 - 1) * 0.2);
      ctx.scale(scale, scale);
      ctx.translate(-50, -50);
      paint(ctx, map, theme.props[i]);
      ctx.restore();
    }
    done();
  }
  const picked: typeof candidates = [];
  for (const candidate of candidates) {
    if (picked.some(other => Math.hypot(other.x - candidate.x, other.y - candidate.y) < 9)) continue;
    const { x, y, index } = candidate;
    picked.push(candidate);
    for (const i of [index, index + 1, index + w, index + w + 1]) occupied.add(i);
    objects.push(scene.add.image((x + 1) * ts, (y + 1) * ts, key).setAngle(picked.length * 90)
      .setDepth(DEPTH.decal - 1).setName(`${map}-${theme.name}`));
    if (picked.length === 7) break;
  }
  return occupied;
}

/** Park groupings, roadside details, and quieter scenery between neighborhoods. */
export function addQueuedScenery(scene: Phaser.Scene, world: WorldData, objects: Phaser.GameObjects.GameObject[], map: QueuedMap) {
  const propPaint = usesNatureArt(map) ? laterNatureProp : laterBuiltProp;
  const motionPaint = usesNatureArt(map) ? laterNatureMotion : laterBuiltMotion;
  const props = Array.from({ length: 12 }, (_, style) => drawFrame(scene, `queued_${map}_prop_${style}`, c => propPaint(c, map, style)));
  const frames = Array.from({ length: 3 }, (_, style) => drawFrame(scene, `queued_${map}_motion_${style}`, c => motionPaint(c, map, style)));
  const rng = new Rng(world.seed ^ 0xc3b88b1);
  const ts = world.tileSize, w = world.widthTiles, h = world.heightTiles;
  const occupied = addScenes(scene, world, objects, map, propPaint);
  const effects: Ambient[] = [];
  const candidates: { x: number; y: number; tile: Tile; roadside: boolean }[] = [];
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    const i = y * w + x;
    const tile = world.tiles[i];
    if (occupied.has(i) || (tile !== Tile.Grass && tile !== Tile.Park && tile !== Tile.Dirt)) continue;
    const roadside = [i - 1, i + 1, i - w, i + w].some(index => world.tiles[index] === Tile.Road);
    candidates.push({ x, y, tile, roadside });
  }
  const variants = rng.shuffle(props.slice());
  let propIndex = 0;
  for (const { x, y, tile, roadside } of rng.shuffle(candidates)) {
    const density = tile === Tile.Park ? DETAIL.parkDensity : roadside ? DETAIL.roadsideDensity : DETAIL.fieldDensity;
    if (!rng.chance(density)) continue;
    const px = (x + rng.range(0.37, 0.63)) * ts, py = (y + rng.range(0.37, 0.63)) * ts;
    const angle = map === 'airport' || map === 'house' || map === 'brickworks'
      ? rng.int(0, 3) * Math.PI / 2 : rng.range(0, Math.PI * 2);
    objects.push(scene.add.image(px, py, variants[propIndex++ % variants.length])
      .setScale(rng.range(0.45, 0.69)).setRotation(angle)
      .setDepth(DEPTH.decal - 1).setName(`${map}-scenery`));
    if ((tile === Tile.Park || roadside) && rng.chance(DETAIL.companionChance)) {
      const sx = px + Math.cos(angle) * 37, sy = py + Math.sin(angle) * 37;
      objects.push(scene.add.image(sx, sy, rng.pick(variants)).setScale(rng.range(0.23, 0.35))
        .setRotation(angle + 0.4).setDepth(DEPTH.decal - 1));
    }
    if (effects.length >= DETAIL.ambientLimit || !rng.chance(DETAIL.motionChance)
      || effects.some(e => Math.hypot(e.x - px, e.y - py) < DETAIL.minAmbientSpacing)) continue;
    const style = effects.length % frames.length, motion = MOTIONS[map][style];
    const scale = rng.range(0.48, 0.68);
    const image = scene.add.image(px, py, frames[style]).setScale(scale)
      .setRotation(angle).setDepth(DEPTH.prop + 1).setName(`${map}-ambient-${style}`);
    objects.push(image);
    effects.push({ image, x: px, y: py, phase: rng.next(), period: rng.range(2.8, 6.4), angle, scale, motion });
  }

  let clock = 0;
  return (dt: number) => {
    clock += dt;
    for (const fx of effects) animate(fx, clock);
  };
}
