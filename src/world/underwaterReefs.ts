import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, poly, radial, star, type Ctx } from '../art/draw';
import { DEPTH } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { Tile, type WorldData } from '../core/types';
import { isUnderwaterGlassPlaza, isUnderwaterGlassRoad, UNDERWATER_VIEWING_POOLS } from './gen/underwater';
import { underwaterTexture } from './underwaterPaint';

const REEF_SIZE = 252;
const MID = REEF_SIZE / 2;

function shelf(c: Ctx, rng: Rng): void {
  ellipse(c, MID, MID, 118, 90);
  fillStroke(c, radial(c, MID, MID, 16, 122, [[0, '#3f7180c9'], [.68, '#29627776'], [1, '#29567400']]), null);
  for (let i = 0; i < 23; i++) {
    const angle = rng.range(0, Math.PI * 2), distance = rng.range(26, 104);
    const x = MID + Math.cos(angle) * distance;
    const y = MID + Math.sin(angle) * distance * .74;
    const size = rng.range(2, 13);
    ellipse(c, x, y, size, size * .61);
    fillStroke(c, bodyGrad(c, x - size, y - size, size * 2, size * 2, '#759b98', '#365d71'), '#25566a', 2);
  }
}

function fan(c: Ctx, x: number, y: number, rotation: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.beginPath();
  c.moveTo(0, 24);
  c.bezierCurveTo(-16, 8, -32, -3, -30, -29);
  c.bezierCurveTo(-16, -45, 20, -42, 34, -25);
  c.quadraticCurveTo(34, -2, 0, 24);
  c.closePath();
  fillStroke(c, color, '#344969', 3);
  for (const dx of [-25, -15, -3, 9, 21, 29]) {
    c.beginPath();
    c.moveTo(0, 20);
    c.quadraticCurveTo(dx * 0.92, 1, dx, -30 + Math.abs(dx) * .24);
    c.lineWidth = 2.5;
    c.strokeStyle = '#fadacbbb';
    c.stroke();
  }
  c.restore();
}

function sponges(c: Ctx, x: number, y: number, r: number, color: string): void {
  for (const [dx, dy, s] of [[-.76, .05, .64], [.38, -.54, 1], [.76, .47, .57], [-.34, .68, .45]]) {
    const cx = x + dx * r, cy = y + dy * r;
    ellipse(c, cx, cy, r * s, r * s * .84);
    fillStroke(c, color, '#294765', 2.5);
    ellipse(c, cx - r * .13 * s, cy - r * .14 * s, r * .64 * s, r * .53 * s);
    fillStroke(c, '#334561', '#f3d0a2b5', 2.5);
  }
}

function anemone(c: Ctx, x: number, y: number, color: string, rng: Rng): void {
  for (let i = 0; i < 17; i++) {
    const angle = i * Math.PI * 2 / 17;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const r = rng.range(17, 35);
    c.beginPath();
    c.moveTo(x + dx * 9, y + dy * 9);
    c.quadraticCurveTo(x + dx * r * .73 - dy * 10, y + dy * r * .73 + dx * 10, x + dx * r, y + dy * r);
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.stroke();
    ellipse(c, x + dx * r, y + dy * r, 3, 3);
    fillStroke(c, '#ffe0c4', null);
  }
  ellipse(c, x, y, 11, 9);
  fillStroke(c, '#b184ba', '#734f80', 2);
}

function shell(c: Ctx, x: number, y: number, angle: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  poly(c, [-14, -9, -5, -15, 5, -15, 14, -9, 4, 10, -4, 10]);
  fillStroke(c, '#f5ccad', '#805f82', 2);
  c.beginPath();
  for (const dx of [-9, -4, 1, 6, 11]) {
    c.moveTo(0, 7);
    c.lineTo(dx, -11);
  }
  c.strokeStyle = '#bd819e';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();
}

function paintReef(c: Ctx, variant: number): void {
  const rng = new Rng(19178 + variant);
  shelf(c, rng);
  const palettes = [
    ['#d889a2', '#ecaa75', '#caa2d7'],
    ['#8fcac1', '#a99dd8', '#ef97a6'],
    ['#cb9ed6', '#d99a8f', '#94b2e4'],
    ['#d3948e', '#e1bc8d', '#97d5c8'],
  ];
  const [primary, secondary, tertiary] = palettes[variant];
  fan(c, 87, 87, rng.range(-.85, .75), primary);
  fan(c, 148, 73, rng.range(.75, 2.1), tertiary);
  sponges(c, 153, 124, 26, secondary);
  anemone(c, 107, 141, primary, rng);
  sponges(c, 66, 123, 13, tertiary);
  shell(c, 179, 154, rng.range(0, Math.PI * 2));
  shell(c, 134, 177, rng.range(0, Math.PI * 2));
  star(c, 82, 166, 12, 5, 5, .23);
  fillStroke(c, '#d17fa5', '#f2bdba', 2);
}

function paintSeagrass(c: Ctx): void {
  const rng = new Rng(39182);
  for (let i = 0; i < 13; i++) {
    const angle = i * Math.PI * 2 / 13;
    const length = rng.range(27, 59);
    c.save();
    c.translate(72, 73);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(-6, 5);
    c.bezierCurveTo(-17, -length * .37, -6, -length * .64, 3, -length);
    c.bezierCurveTo(14, -length * .63, 5, -length * .32, 6, 5);
    c.closePath();
    fillStroke(c, bodyGrad(c, -10, -length, 20, length, '#abe2a0', '#297275'), '#286775', 2);
    c.restore();
  }
  ellipse(c, 72, 73, 16, 12);
  fillStroke(c, '#376e79', '#73b994', 2);
}

export function addUnderwaterReefs(scene: Phaser.Scene, world: WorldData, objects: Phaser.GameObjects.GameObject[]): (dt: number) => void {
  const rng = new Rng(world.seed ^ 0x19395);
  const { tileSize: ts, widthTiles: w, heightTiles: h } = world;
  const reef = Array.from({ length: 4 }, (_, i) => underwaterTexture(scene, `reef_${i}`, REEF_SIZE, REEF_SIZE, c => paintReef(c, i)));
  const grassKey = underwaterTexture(scene, 'seagrass', 144, 146, paintSeagrass);
  const grass: { image: Phaser.GameObjects.Image; rotation: number; scale: number; phase: number }[] = [];
  const addReef = (x: number, y: number, scale: number) => {
    objects.push(scene.add.image(x * ts, y * ts, rng.pick(reef)).setDepth(DEPTH.ground - 3)
      .setScale(scale).setRotation(rng.range(0, Math.PI * 2)).setName('underwater-reef-garden'));
    if (rng.chance(.48)) return;
    const rotation = rng.range(0, Math.PI * 2);
    const image = scene.add.image((x + rng.range(-.6, .6)) * ts, (y + rng.range(-.6, .6)) * ts, grassKey)
      .setDepth(DEPTH.ground - 2).setRotation(rotation).setName('underwater-seagrass');
    objects.push(image);
    grass.push({ image, rotation, scale: scale * .79, phase: rng.range(0, Math.PI * 2) });
  };
  for (const { x, y, w: width, h: height } of UNDERWATER_VIEWING_POOLS) {
    addReef(x + .7, y + .7, 1);
    addReef(x + width - .8, y + height - .8, .85);
  }
  for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) {
    const tile = world.tiles[y * w + x];
    const openWater = tile === Tile.Water;
    const transparent = tile === Tile.Road && isUnderwaterGlassRoad(x, y) || tile === Tile.Plaza && isUnderwaterGlassPlaza(x, y);
    const reefBelt = x >= 19 && x < 30 && y >= 12 && y < 36;
    if (!(openWater || transparent) || !rng.chance(reefBelt ? .71 : transparent ? .55 : .5)) continue;
    addReef(x + rng.range(.2, .95), y + rng.range(.2, .95), rng.range(.55, 1.13));
  }
  let clock = 0;
  return dt => {
    clock += dt;
    for (const { image, rotation, scale, phase } of grass) {
      const sway = Math.sin(clock * 1.7 + phase);
      image.setRotation(rotation + sway * .16).setScale(scale * (1 + sway * .1), scale * (1 - sway * .09));
    }
  };
}
