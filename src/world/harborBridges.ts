import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { harborTexture } from './harborTexture';

type Owned = Phaser.GameObjects.GameObject[];
const box = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color; c.fillRect(x, y, w, h);
};
const line = (c: CanvasRenderingContext2D, color: string, width: number, points: number[]) => {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
};

/** The broad deck and paired towers are baked once and reused by both cameras. */
export function addHarborSuspension(scene: Phaser.Scene, tileSize: number, objects: Owned): void {
  const ts = tileSize;
  const key = harborTexture(scene, 'suspension_v2', 1024, 320, c => {
    box(c, '#39434c', 0, 39, 1024, 242);
    box(c, '#6f7778', 0, 47, 1024, 226);
    box(c, '#555e63', 0, 62, 1024, 196);
    for (let x = 20; x < 1024; x += 90) box(c, '#ead19d', x, 157, 48, 6);
    for (const y of [42, 265]) {
      box(c, '#712f2d', 0, y, 1024, 13);
      box(c, '#d8795e', 0, y, 1024, 5);
      for (let x = 12; x < 1024; x += 36) box(c, '#f1b48b', x, y + 3, 5, 9);
    }
    // Two arcing main cables and their vertical suspenders frame the roadway.
    for (const side of [0, 1]) {
      c.save(); if (side) { c.translate(0, 320); c.scale(1, -1); }
      c.strokeStyle = '#ffe1b7'; c.lineWidth = 6; c.beginPath();
      c.moveTo(105, 20); c.quadraticCurveTo(512, 143, 919, 20); c.stroke();
      for (let x = 145; x < 919; x += 48) {
        const t = (x - 105) / 814;
        const y = 20 + 246 * t * (1 - t);
        line(c, '#f6c59e', 3, [x, y, x, 45]);
      }
      c.restore();
    }
    for (const x of [85, 899]) {
      box(c, '#542d2c', x - 10, 2, 60, 316);
      box(c, '#ad4b3d', x - 5, 7, 50, 306);
      box(c, '#e89973', x, 13, 9, 294);
      box(c, '#efb38c', x - 11, 20, 62, 14);
      box(c, '#efb38c', x - 11, 286, 62, 14);
      box(c, '#743832', x - 9, 101, 58, 13);
      box(c, '#743832', x - 9, 206, 58, 13);
      for (const y of [29, 290]) { box(c, '#ffe5a5', x + 13, y, 13, 8); }
    }
  });
  objects.push(scene.add.image(24 * ts, 9 * ts, key).setDisplaySize(8 * ts, 2.5 * ts).setDepth(DEPTH.decal + 1).setName('harbor-suspension'));
}

/** Animated visual leaves and signals; the caller owns collision timing and cleanup. */
export function makeHarborDrawbridge(scene: Phaser.Scene, tileSize: number, objects: Owned): (lift: number, opening: boolean, clock: number) => void {
  const ts = tileSize;
  const leaf = harborTexture(scene, 'draw_leaf_v2', 384, 256, c => {
    box(c, '#353f48', 0, 0, 384, 256);
    box(c, '#737778', 0, 7, 384, 242);
    box(c, '#515b60', 0, 22, 384, 212);
    for (let x = 22; x < 384; x += 72) box(c, '#f6d59b', x, 125, 40, 6);
    for (const y of [7, 236]) {
      box(c, '#764b40', 0, y, 384, 13); box(c, '#e4b18e', 0, y, 384, 5);
      for (let x = 10; x < 384; x += 30) box(c, '#f6d2aa', x, y + 3, 5, 10);
    }
    // Transverse expansion joints and riveted hinge at the outer end.
    for (let x = 80; x < 384; x += 96) box(c, 'rgba(27,42,48,.35)', x, 22, 3, 212);
    box(c, '#c98864', 0, 17, 15, 222);
    for (let y = 30; y < 235; y += 34) { c.fillStyle = '#ffe2a6'; c.beginPath(); c.arc(7, y, 3, 0, Math.PI * 2); c.fill(); }
    box(c, '#e6be91', 377, 20, 7, 216);
  });
  const signal = harborTexture(scene, 'draw_signal_v2', 52, 52, c => {
    c.fillStyle = '#3a3434'; c.beginPath(); c.arc(26, 26, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c35b45'; c.beginPath(); c.arc(26, 26, 17, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe1a0'; c.beginPath(); c.arc(21, 20, 5, 0, Math.PI * 2); c.fill();
  });
  const barrier = harborTexture(scene, 'draw_barrier_v2', 28, 256, c => {
    box(c, '#6b4741', 0, 0, 28, 256); box(c, '#fff1d1', 4, 3, 20, 250);
    c.save(); c.beginPath(); c.rect(4, 3, 20, 250); c.clip();
    c.strokeStyle = '#dd5746'; c.lineWidth = 14;
    for (let y = -35; y < 290; y += 45) { c.beginPath(); c.moveTo(3, y); c.lineTo(25, y + 24); c.stroke(); }
    c.restore();
  });
  const add = (x: number, y: number, key: string, depth: number) => {
    const image = scene.add.image(x, y, key).setDepth(depth); objects.push(image); return image;
  };
  objects.push(scene.add.tileSprite(24 * ts, 21 * ts, 6 * ts, 2 * ts, TEX.tileWater)
    .setDepth(DEPTH.decal + 1).setName('harbor-drawbridge-water'));
  const left = add(21 * ts, 21 * ts, leaf, DEPTH.decal + 2).setOrigin(0, .5).setDisplaySize(3 * ts, 2 * ts).setName('harbor-drawbridge-left');
  const right = add(27 * ts, 21 * ts, leaf, DEPTH.decal + 2).setOrigin(0, .5).setRotation(Math.PI).setDisplaySize(3 * ts, 2 * ts).setName('harbor-drawbridge-right');
  const gates = [20.8, 27.2].map(x => add(x * ts, 21 * ts, barrier, DEPTH.decal + 3).setDisplaySize(.22 * ts, 2 * ts).setVisible(false).setName('harbor-drawbridge-barrier'));
  const lights = [20.8, 27.2].flatMap(x => [19.95, 22.05].map(y => add(x * ts, y * ts, signal, DEPTH.prop).setDisplaySize(.4 * ts, .4 * ts).setName('harbor-drawbridge-light')));
  return (lift, opening, clock) => {
    const scale = 1 - Phaser.Math.Clamp(lift, 0, 1) * .82;
    left.setScale(scale * (3 * ts / 384), 2 * ts / 256);
    right.setScale(scale * (3 * ts / 384), 2 * ts / 256);
    left.setTint(opening ? 0xe8d4be : 0xffffff); right.setTint(opening ? 0xe8d4be : 0xffffff);
    gates.forEach(gate => gate.setVisible(opening));
    lights.forEach((light, i) => light.setTint(opening ? ((Math.floor(clock * 3) + i) % 2 ? 0xff3b26 : 0xffd35a) : 0x75978a));
  };
}
