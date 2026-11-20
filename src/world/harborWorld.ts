import Phaser from 'phaser';
import { addHarborScenery } from './harborScenery';
import { DEPTH } from '../config/gameConfig';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, type WorldData } from '../core/types';

import { addHarborSuspension } from './harborBridges';
import { harborTexture } from './harborTexture';

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(x, y, w, h); };

export function harborLighthouseTexture(scene: Phaser.Scene): string {
  return harborTexture(scene, 'lighthouse', 260, 300, c => {
    c.fillStyle = 'rgba(35,44,52,.3)'; c.beginPath(); c.ellipse(145, 240, 100, 45, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#beb7a1'; c.beginPath(); c.ellipse(130, 243, 92, 35, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7eddb'; c.beginPath(); c.moveTo(77, 230); c.lineTo(101, 91); c.lineTo(159, 91); c.lineTo(183, 230); c.closePath(); c.fill();
    c.fillStyle = '#c83b35'; c.beginPath(); c.moveTo(91, 150); c.lineTo(169, 150); c.lineTo(175, 183); c.lineTo(85, 183); c.closePath(); c.fill();
    c.fillStyle = '#c83b35'; c.beginPath(); c.moveTo(80, 211); c.lineTo(180, 211); c.lineTo(183, 230); c.lineTo(77, 230); c.closePath(); c.fill();
    rect(c, '#723e35', 118, 205, 24, 29);
    rect(c, '#563d3b', 86, 83, 88, 12); rect(c, '#eee2c9', 94, 72, 72, 12);
    rect(c, '#594d48', 101, 30, 58, 43); rect(c, '#ffe78e', 108, 37, 44, 29);
    rect(c, '#faf3df', 127, 36, 6, 31); rect(c, '#faf3df', 107, 48, 46, 5);
    c.fillStyle = '#b72f2e'; c.beginPath(); c.moveTo(90, 31); c.lineTo(130, 5); c.lineTo(170, 31); c.closePath(); c.fill();
    c.fillStyle = '#f9dc91'; c.beginPath(); c.arc(130, 5, 5, 0, Math.PI * 2); c.fill();
  });
}

/** Static harbor dressing. All features outside roads are decorative and have no road collisions. */
export function addHarborWorld(scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[]): void {
  const ts = world.tileSize;
  const add = (key: string, x: number, y: number, depth: number = DEPTH.prop) => {
    const img = scene.add.image(x * ts, y * ts, key).setDepth(depth); objs.push(img); return img;
  };
  const paint = harborTexture(scene, 'centerline', ts, 8, c => rect(c, '#dfbd82', 42, 2, 44, 4));
  const stripe = (start: number, end: number, across: number, vertical: boolean) => {
    const middle = (start + end) / 2;
    const x = (vertical ? across : middle) * ts, y = (vertical ? middle : across) * ts;
    objs.push(scene.add.tileSprite(x, y, (end - start) * ts, 8, paint).setDepth(DEPTH.decal - 2)
      .setRotation(vertical ? Math.PI / 2 : 0));
  };
  for (const y of [9, 21, 38]) for (const [start, end] of [[7, 17], [19, 30], [32, 40]]) stripe(start, end, y, false);
  for (const x of [6, 18, 31, 41]) for (const [start, end] of [[10, 20], [22, 37]]) stripe(start, end, x, true);
  addHarborSuspension(scene, ts, objs);
  const dock = harborTexture(scene, 'dock', 330, 100, c => {
    rect(c, '#795142', 0, 12, 330, 76); for (let x = 4; x < 330; x += 24) rect(c, '#c59060', x, 16, 20, 68);
    rect(c, '#613c33', 0, 10, 330, 7); rect(c, '#613c33', 0, 83, 330, 7);
  });
  add(dock, 25.8, 13); add(dock, 25.8, 30);
  const stall = harborTexture(scene, 'stall', 140, 100, c => {
    rect(c, '#814f37', 8, 12, 124, 80); rect(c, '#fff3d6', 5, 4, 130, 60);
    for (let x = 5; x < 135; x += 26) rect(c, '#dc624a', x, 4, 13, 60);
    rect(c, '#78452d', 12, 72, 116, 16);
    for (let x = 20; x < 120; x += 20) { c.fillStyle = x % 40 ? '#efb841' : '#67a752'; c.beginPath(); c.arc(x, 76, 7, 0, 7); c.fill(); }
  });
  for (const x of [8, 9.5, 11, 12.5]) add(stall, x, 18);
  for (const x of [8, 11, 13.5]) add(stall, x, 16.5);
  add(stall, 34, 16);
  const iceCream = harborTexture(scene, 'icecream', 150, 105, c => {
    rect(c, '#fbe7bf', 10, 20, 130, 65); rect(c, '#dc786b', 5, 13, 140, 20);
    rect(c, '#86c6cb', 17, 40, 116, 28); rect(c, '#71473b', 17, 83, 116, 8);
    c.fillStyle = '#f6b0b2'; c.beginPath(); c.arc(75, 20, 17, Math.PI, 0); c.fill();
    c.fillStyle = '#71473b'; for (const x of [28, 120]) { c.beginPath(); c.arc(x, 94, 10, 0, 7); c.fill(); }
  });
  add(iceCream, 31.5, 18);
  const palm = harborTexture(scene, 'palm', 148, 148, c => {
    c.fillStyle = 'rgba(73,60,44,.18)'; c.beginPath(); c.ellipse(89, 86, 54, 38, 0.55, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#946446'; c.lineWidth = 10; c.beginPath(); c.moveTo(92, 111); c.quadraticCurveTo(59, 91, 69, 68); c.stroke();
    for (let i = 0; i < 7; i++) {
      c.save(); c.translate(68, 68); c.rotate(i * 2 * Math.PI / 7);
      c.fillStyle = i % 2 ? '#39855c' : '#589d62'; c.beginPath(); c.moveTo(0, 0);
      c.quadraticCurveTo(31, -30, 60, 0); c.quadraticCurveTo(37, -8, 8, 10); c.fill(); c.restore();
    }
  });
  for (const [i, [x, y]] of [[28, 10.5], [42, 12], [29, 15], [41.75, 15.5], [28.5, 24], [43, 26], [42.1, 32], [29, 34.5], [35, 38.5]].entries()) {
    add(palm, x, y, DEPTH.prop + 1).setRotation(i * 0.8);
  }
  const lookout = harborTexture(scene, 'lifeguard', 153, 117, c => {
    rect(c, 'rgba(81,63,52,.23)', 17, 16, 119, 92);
    rect(c, '#8b5445', 12, 13, 120, 82);
    rect(c, '#fce6b3', 15, 16, 114, 76);
    rect(c, '#d55349', 20, 19, 104, 44);
    rect(c, '#9ed0cc', 26, 67, 92, 20);
    rect(c, '#fff2db', 66, 27, 12, 29); rect(c, '#fff2db', 57, 35, 30, 12);
    for (let i = 0; i < 3; i++) rect(c, '#c19674', 49, 93 + i * 7, 40, 5);
  });
  add(lookout, 39, 16, DEPTH.prop + 1);
  addHarborScenery(scene, world, objs, harborTexture);
}

/** Sand tile source for WorldBuilder's normal atlas index 5 (Dirt). */
export function harborSandTile(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#e8c68c'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < 34; i++) {
    const x = (i * 73 + 19) % size, y = (i * 47 + 13) % size;
    c.fillStyle = i % 2 ? 'rgba(255,240,195,.35)' : 'rgba(156,113,67,.13)';
    c.fillRect(x, y, 3, 2);
  }
  return canvas;
}

/** Two-tile-wide causeways have curbs along the outside edges. */
export function harborRoadTile(size: number, mask: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const c = canvas.getContext('2d')!;
  rect(c, '#535862', 0, 0, size, size);
  for (let i = 0; i < 78; i++) {
    const x = (i * 83 + 5) % size, y = (i * 31 + 37) % size;
    rect(c, i % 2 ? '#5b6069' : '#4e535d', x, y, 3, 2);
  }
  const edges = [[ROAD_N, 0, 0, size, 7], [ROAD_E, size - 7, 0, 7, size],
    [ROAD_S, 0, size - 7, size, 7], [ROAD_W, 0, 0, 7, size]];
  for (const [side, x, y, w, h] of edges) if (!(mask & side)) rect(c, '#aaa49a', x, y, w, h);
  return canvas;
}
