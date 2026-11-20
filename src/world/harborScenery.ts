import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { Rng } from '../core/rng';
import type { WorldData } from '../core/types';

type Texture = (scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => string;

/** Baked, non-solid details leave room for cars to explore the beach and market. */
export function addHarborScenery(scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[], texture: Texture): void {
  const rng = new Rng(world.seed ^ 0x53434e45), ts = world.tileSize;
  const add = (key: string, x: number, y: number, angle = 0, depth: number = DEPTH.decal) => {
    objs.push(scene.add.image(x * ts, y * ts, key).setDepth(depth).setRotation(angle));
  };
  const towel = texture(scene, 'towel_group', 190, 130, c => {
    c.fillStyle = 'rgba(85,66,46,.14)'; c.fillRect(12, 18, 166, 99);
    c.fillStyle = '#fae8c1'; c.fillRect(8, 12, 105, 68);
    c.fillStyle = '#e37971'; for (let x = 13; x < 110; x += 22) c.fillRect(x, 12, 10, 68);
    c.fillStyle = '#63b3b7'; c.fillRect(123, 51, 50, 37);
    c.fillStyle = '#f8f0da'; c.fillRect(123, 47, 50, 9); c.fillRect(139, 40, 17, 7);
    c.fillStyle = '#f4d25e'; c.beginPath(); c.arc(144, 104, 14, 0, Math.PI * 2); c.fill();
  });
  const shells = texture(scene, 'shore_detail', 180, 100, c => {
    c.fillStyle = 'rgba(255,247,212,.65)';
    for (const [x,y] of [[18,28], [66,70], [135,22], [154,75]]) {
      c.beginPath(); c.ellipse(x, y, 10, 6, .4, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(255,255,236,.45)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(5, 49); c.quadraticCurveTo(45, 34, 86, 48); c.stroke();
  });
  const pennants = texture(scene, 'pennants', 340, 95, c => {
    c.strokeStyle = '#805440'; c.lineWidth = 5; c.beginPath(); c.moveTo(8, 18); c.quadraticCurveTo(170, 72, 332, 18); c.stroke();
    const colors = ['#ef7462', '#f5d268', '#77bdb3', '#f6e9c8'];
    for (let i = 0; i < 11; i++) {
      const x = 24 + i * 29, y = 22 + 32 * (1 - Math.pow((x - 170) / 170, 2));
      c.fillStyle = colors[i % colors.length]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y + 2); c.lineTo(x + 10, y + 24); c.closePath(); c.fill();
    }
    c.fillStyle = '#805440'; c.fillRect(3, 10, 10, 80); c.fillRect(327, 10, 10, 80);
  });
  const dockBits = texture(scene, 'dock_details', 240, 100, c => {
    c.fillStyle = '#95673e'; c.fillRect(25, 25, 54, 46); c.fillRect(85, 37, 39, 35);
    c.strokeStyle = '#e4b979'; c.lineWidth = 4; c.strokeRect(29, 29, 46, 38); c.strokeRect(89, 41, 31, 27);
    c.fillStyle = '#e7d6b3'; c.beginPath(); c.arc(165, 48, 23, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ca5d4d'; c.beginPath(); c.arc(165, 48, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e7d6b3'; c.beginPath(); c.arc(165, 48, 8, 0, Math.PI * 2); c.fill();
  });
  for (const [x,y] of [[33.5,13.5], [36.4,14.7], [37.8,25], [34.2,26.5], [38.3,32], [36,34]]) {
    add(towel, x + rng.range(-.3,.3), y + rng.range(-.3,.3), rng.range(-.45,.45));
  }
  for (const y of [11.5, 16, 24, 27, 33, 35.5]) add(shells, 27.7 + rng.range(0,.5), y, rng.range(-.4,.4));
  // Pennant spans mark generous drive-through gaps in two open-air market rows.
  add(pennants, 14.5, 18, 0, DEPTH.prop + 2);
  add(pennants, 10, 16, 0, DEPTH.prop + 2);
  add(dockBits, 25.8, 13, 0, DEPTH.prop + 1);
  add(dockBits, 25.8, 30, Math.PI, DEPTH.prop + 1);
}
