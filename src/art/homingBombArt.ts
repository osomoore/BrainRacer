import type Phaser from 'phaser';
import { makeCanvas, ellipse, fillStroke, radial, star } from './draw';
import { TEX } from '../core/assetKeys';

/** Large outlined cartoon bomb and a separate animated fuse glow. */
export function ensureBombArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEX.homingBomb)) {
    const { ctx: c, done } = makeCanvas(scene, TEX.homingBomb, 220, 220);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, 112, 180, 82, 23); c.fill();
    c.lineWidth = 14; c.lineCap = 'round'; c.strokeStyle = '#e5b777'; c.beginPath(); c.moveTo(110, 60); c.quadraticCurveTo(130, 27, 155, 29); c.stroke();
    c.fillStyle = '#7d8991'; c.fillRect(90, 48, 43, 23);
    ellipse(c, 110, 122, 76, 72);
    fillStroke(c, radial(c, 86, 90, 2, 100, [[0, '#899baa'], [0.4, '#3b4b59'], [1, '#121a24']]), '#0c121b', 6);
    c.fillStyle = '#ffdf79'; ellipse(c, 85, 119, 10, 15); c.fill(); ellipse(c, 135, 119, 10, 15); c.fill();
    c.strokeStyle = '#101722'; c.lineWidth = 7; c.beginPath(); c.moveTo(68, 99); c.lineTo(95, 108); c.moveTo(152, 99); c.lineTo(125, 108); c.stroke();
    c.strokeStyle = '#0c121b'; c.lineWidth = 5; c.beginPath(); c.arc(110, 147, 20, 0.15, Math.PI - 0.15); c.stroke();
    c.fillStyle = '#ff9b24'; star(c, 157, 29, 19, 8, 7); c.fill();
    c.fillStyle = '#fff39a'; star(c, 157, 29, 10, 4, 6); c.fill();
    done();
  }
  if (!scene.textures.exists(TEX.homingBombGlow)) {
    const { ctx: c, done } = makeCanvas(scene, TEX.homingBombGlow, 160, 160);
    c.fillStyle = radial(c, 80, 80, 0, 80, [[0, 'rgba(255,245,150,0.95)'], [0.2, 'rgba(255,145,28,0.8)'], [1, 'rgba(255,60,0,0)']]);
    c.fillRect(0, 0, 160, 160); done();
  }
}
