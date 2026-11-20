import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, radial, rr, type Ctx } from '../art/draw';
import { DEPTH } from '../config/gameConfig';
import { Rng } from '../core/rng';
import type { WorldData } from '../core/types';
import { underwaterTexture } from './underwaterPaint';

const INK = '#183750';

function paintSwimmer(c: Ctx, whale: boolean): void {
  const light = whale ? '#7bb3d2' : '#9de3c5';
  const dark = whale ? '#3c688f' : '#218e92';
  const skin = bodyGrad(c, 10, 15, 370, 140, light, dark);
  c.beginPath();
  c.moveTo(138, 93);
  c.bezierCurveTo(90, 75, 57, 22, 14, 28);
  c.bezierCurveTo(20, 59, 38, 80, 67, 93);
  c.bezierCurveTo(35, 107, 19, 133, 18, 157);
  c.bezierCurveTo(64, 160, 93, 110, 138, 102);
  c.closePath();
  fillStroke(c, skin, INK, 5);
  for (const side of [-1, 1]) {
    c.save();
    c.translate(240, 93);
    c.scale(1, side);
    c.beginPath();
    c.moveTo(-32, 35);
    c.quadraticCurveTo(2, 77, 68, 89);
    c.quadraticCurveTo(62, 59, 35, 30);
    c.closePath();
    fillStroke(c, bodyGrad(c, 0, 35, 68, 54, light, dark), INK, 5);
    c.restore();
  }
  c.beginPath();
  c.moveTo(70, 93);
  c.bezierCurveTo(119, 74, 177, whale ? 14 : 33, 282, whale ? 31 : 48);
  c.bezierCurveTo(403, 29, 407, 142, 306, 145);
  c.bezierCurveTo(211, 168, 114, 111, 70, 101);
  c.closePath();
  fillStroke(c, skin, INK, 5);
  c.beginPath();
  c.moveTo(119, 85);
  c.quadraticCurveTo(232, 21, 311, 47);
  c.quadraticCurveTo(244, 32, 120, 96);
  c.closePath();
  fillStroke(c, '#c9f6e260', null);
  if (whale) {
    ellipse(c, 249, 80, 9, 6);
    fillStroke(c, '#3c6288', '#b1d4e6', 2);
    for (const y of [66, 113]) {
      ellipse(c, 354, y, 6, 5);
      fillStroke(c, INK, '#d6f4e8', 2);
    }
  } else {
    c.beginPath();
    c.moveTo(164, 96);
    c.quadraticCurveTo(205, 87, 259, 91);
    c.quadraticCurveTo(219, 74, 165, 95);
    fillStroke(c, '#e3f598', '#28767d', 2);
    for (const [x, y] of [[312, 64], [312, 121]]) {
      ellipse(c, x, y, 12, 11);
      fillStroke(c, '#f7fddf', INK, 3);
      ellipse(c, x + 4, y, 6, 7);
      fillStroke(c, INK, null);
    }
  }
}

export function submarineTexture(scene: Phaser.Scene): string {
  return underwaterTexture(scene, 'submarine', 400, 200, c => {
    rr(c, 46, 47, 312, 107, 53);
    fillStroke(c, bodyGrad(c, 46, 47, 312, 107, '#ffc975', '#d36b37'), '#5e423c', 6);
    for (const y of [53, 147]) {
      rr(c, 23, y - 10, 84, 20, 7);
      fillStroke(c, '#b66b46', '#513c3c', 5);
    }
    rr(c, 112, 78, 147, 58, 20);
    fillStroke(c, bodyGrad(c, 112, 78, 147, 58, '#ffd779', '#aa5f40'), '#724737', 5);
    for (const x of [155, 200, 245, 320]) {
      ellipse(c, x, x > 300 ? 100 : 106, x > 300 ? 28 : 15, x > 300 ? 33 : 15);
      fillStroke(c, bodyGrad(c, x - 17, 74, 34, 51, '#c8f9e6', '#478fa3'), '#8c543c', 5);
      ellipse(c, x - 4, x > 300 ? 91 : 103, 6, 4);
      fillStroke(c, '#e2ffed', null);
    }
    c.fillStyle = '#ffedae';
    c.fillRect(82, 62, 217, 5);
    ellipse(c, 354, 100, 13, 25);
    fillStroke(c, '#fff6b9', '#b88350', 4);
    for (const [x, y, r] of [[24, 97, 6], [16, 108, 4], [32, 113, 5], [8, 92, 5]]) {
      ellipse(c, x, y, r, r);
      fillStroke(c, '#bcebd147', '#bcebd17d', 2);
    }
  });
}

/** Swim below the tile layer, visible only through glass and open water. */
export function addUnderwaterLife(scene: Phaser.Scene, world: WorldData, objects: Phaser.GameObjects.GameObject[]): (dt: number) => void {
  const ts = world.tileSize;
  const whale = underwaterTexture(scene, 'whale', 400, 190, c => paintSwimmer(c, true));
  const fish = underwaterTexture(scene, 'fish', 400, 190, c => paintSwimmer(c, false));
  const sub = submarineTexture(scene);
  const bubble = underwaterTexture(scene, 'bubble', 40, 40, c => {
    ellipse(c, 20, 20, 17, 17);
    fillStroke(c, radial(c, 20, 20, 4, 18, [[0, '#a5dbde00'], [1, '#bcffeb54']]), '#b8eadb7d', 2);
    ellipse(c, 13, 12, 4, 3);
    fillStroke(c, '#d6fff196', null);
  });
  const beasts = [
    { key: whale, name: 'whale', x: 22, y: 16.55, v: 0.85, scale: 1.9, sign: 1 },
    { key: whale, name: 'whale', x: 30, y: 32, v: -0.93, scale: 2.15, sign: -1 },
    { key: fish, name: 'giant-fish', x: 27, y: 23.6, v: -1.53, scale: 0.82, sign: -1 },
    { key: fish, name: 'giant-fish', x: 11, y: 26.5, v: 1.46, scale: 1.05, sign: 1 },
    { key: fish, name: 'giant-fish', x: 39, y: 27.4, v: -1.32, scale: 0.92, sign: -1 },
    { key: fish, name: 'giant-fish', x: 34, y: 6.7, v: -1.13, scale: 1.00, sign: -1 },
    { key: sub, name: 'patrol-submarine', x: 16, y: 40, v: 1.4, scale: 0.77, sign: 1 },
  ].map((p, i) => {
    const img = scene.add.image(p.x * ts, p.y * ts, p.key).setDepth(DEPTH.ground - 1).setScale(p.scale)
      .setFlipX(p.sign < 0).setAlpha(p.name === 'whale' ? 0.71 : 0.91).setName(`underwater-${p.name}`);
    objects.push(img);
    return { ...p, img, phase: i * 1.7 };
  });
  const rng = new Rng(world.seed ^ 0x19845f);
  const bubbles = Array.from({ length: 33 }, () => {
    const x = rng.range(2, 44), y = rng.range(3, 45), rate = rng.range(0.25, 0.7), scale = rng.range(0.27, 0.8);
    const img = scene.add.image(x * ts, y * ts, bubble).setDepth(DEPTH.ground - .5);
    objects.push(img);
    return { img, x, y, rate, scale, phase: rng.next() };
  });
  let clock = 0;
  return dt => {
    clock += dt;
    const width = world.widthTiles + 8;
    for (const beast of beasts) {
      const { img, x, y, v, phase, scale } = beast;
      const xWrapped = (((x + 4 + clock * v) % width) + width) % width - 4;
      img.setPosition(xWrapped * ts, (y + Math.sin(clock * 0.42 + phase) * 0.82) * ts)
        .setRotation(Math.cos(clock * 0.42 + phase) * 0.11)
        .setScale(scale, scale * (1 + Math.sin(clock * 3 + phase) * 0.055));
    }
    for (const { img, x, y, rate, scale, phase } of bubbles) {
      const travel = (phase + clock * rate) % 1;
      img.setPosition((x + Math.sin(travel * Math.PI * 2) * 0.28) * ts, (y - travel * 1.4) * ts)
        .setScale(scale * (0.5 + travel * 0.5)).setAlpha(Math.sin(travel * Math.PI) * 0.65);
    }
  };
}
