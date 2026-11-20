import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ellipse, fillStroke, lin, makeCanvas, poly, radial, type Ctx } from './draw';

// Rig coordinates are in local pixels with the head facing +x.
export const ROCK_MONSTER_RIG = {
  headX: 138, eyeFwd: 196, eyeSide: 42,
  armX: 29, armY: 94, footX: -126, footY: 63,
} as const;

const EDGE = '#1a172c';
const rocky = (c: Ctx, pts: number[], w: number, h: number) => {
  poly(c, pts);
  fillStroke(c, lin(c, 0, 0, w, h, [[0, '#9489a9'], [0.38, '#6d6486'], [1, '#35304e']]), EDGE, 7);
};

function facet(c: Ctx, pts: number[], color: string): void {
  poly(c, pts); c.fillStyle = color; c.fill();
}

function crack(c: Ctx, pts: number[], color: string, w: number): void {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
}

function crystal(c: Ctx, x: number, y: number, size: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(size, size);
  poly(c, [-11, 18, -16, -9, -2, -31, 13, -14, 17, 12, 1, 22]);
  fillStroke(c, '#25a5be', '#141b37', 3);
  facet(c, [-16, -9, -2, -31, 3, -10, 1, 22, -11,18], '#54e8ef');
  facet(c, [-2, -31, 13, -14, 3, -10, -8,-11], '#c8ffff');
  c.restore();
}

export function ensureRockMonsterArt(scene: Phaser.Scene): void {
  const key = TEX.rockMonster;
  const draw = (name: string, w: number, h: number, paint: (c: Ctx) => void) => {
    if (scene.textures.exists(name)) return;
    const { ctx, done } = makeCanvas(scene, name, w, h);
    paint(ctx); done();
  };
  draw(key.body, 288, 213, c => {
    rocky(c, [10,87, 39,37, 111,17, 182,20, 237,38, 279,83, 275,140, 238,181, 168,201, 89,194, 31,163, 12,132], 288, 213);
    facet(c, [39,37, 111,17, 182,20, 168,55, 76,83, 10,87], '#8e86a5');
    facet(c, [111,17, 168,55, 238,61, 237,38, 182,20], '#a39bb9');
    facet(c, [31,163, 89,194, 168,201, 151,164, 58,139], '#433957');
    facet(c, [58,139, 93,105, 162,99, 205,139, 151,164], '#635674');
    facet(c, [151,164, 205,139, 266,142, 238,181, 168,201], '#493e61');
    crack(c, [142,34, 125,64, 84,79, 75,106, 43,121], '#252238', 6);
    crack(c, [125,64, 144,84, 140,98], '#252238', 4);
    crack(c, [125,65, 85,80, 78,101], '#66e9eb', 2.5);
    crack(c, [163,192, 153,166, 171,139, 159,116], '#2d2841', 5);
    crack(c, [153,166, 164,150, 171,139], '#52dfea', 2);
    crystal(c, 49, 51, 1.03, -0.6); crystal(c, 75, 31, 0.62, 0.31);
    crystal(c, 44, 145, 0.75, -2.2); crystal(c, 63, 166, 0.56, 2.8);
  });
  draw(key.head, 180, 145, c => {
    rocky(c, [9,39, 28,15, 88,11, 140,22, 170,42, 175,87, 155,120, 102,133, 40,126, 9,102], 180, 145);
    facet(c, [9,39, 28,15, 88,11, 122,37, 75,53, 33,47], '#a196b4');
    facet(c, [88,11, 140,22, 170,42, 144,54, 122,37], '#78738f');
    facet(c, [40,126, 58,102, 101,88, 155,120, 102,133], '#413955');
    crack(c, [57,28, 73,45, 68,62, 87,70], '#4c4562', 4);
    crack(c, [145,47, 156,67, 150,91], '#211a36', 9);
    crack(c, [145,52, 153,67, 150,86], '#b3a4d2', 5);
    for (const y of [31, 113]) {
      c.fillStyle = radial(c, 102, y, 0, 32, [[0, 'rgba(72,255,249,0.68)'], [1, 'rgba(72,255,249,0)']]);
      c.fillRect(70, y - 32, 64, 64);
      ellipse(c, 102, y, 16, 13); fillStroke(c, '#4cdded', '#252039', 4);
      ellipse(c, 108, y - 1, 7, 8); fillStroke(c, '#e6ffff', null);
    }
  });
  draw(key.arm, 207, 110, c => {
    rocky(c, [7,44, 27,22, 64,19, 83,32, 115,28, 131,42, 104,71, 77,73, 50,84, 12,77], 160, 130);
    rocky(c, [104,34, 134,12, 174,13, 198,29, 198,72, 178,91, 126,93, 106,74], 220, 130);
    facet(c, [134,12, 174,13, 198,29, 170,48, 133,49, 104,34], '#9189a7');
    facet(c, [133,49, 170,48, 198,29, 198,72, 178,91, 150,76], '#59516f');
    crack(c, [179,23, 168,42, 169,64, 154,77], '#302841', 5);
    crack(c, [167,44, 169,64, 161,72], '#6af0f6', 2.5);
    for (const y of [38, 54, 71]) crack(c, [193,y, 183,y + 1], '#37334c', 3);
  });
  draw(key.foot, 120, 92, c => {
    rocky(c, [7,41, 21,20, 49,14, 68,28, 105,30, 114,53, 98,73, 53,80, 19,69], 120, 90);
    facet(c, [21,20, 49,14, 68,28, 105,30, 83,48, 49,56, 7,41], '#857c9e');
    for (const y of [39, 52, 65]) crack(c, [106,y, 91,y + 2], '#37334c', 4);
  });
  draw(key.beam, 64, 64, c => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, '#42cdff00'], [0.23, '#2b99e7b0'], [0.43, '#5affec'],
      [0.5, '#efffff'], [0.57, '#5affec'], [0.77, '#2b99e7b0'], [1, '#42cdff00']]);
    c.fillRect(0, 0, 64, 64);
  });
  draw(key.glow, 128, 128, c => {
    c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#ffffff'], [0.26, '#7affed'], [0.55,'#2ba8ff78'], [1, '#2ba8ff00']]);
    c.fillRect(0, 0, 128, 128);
  });
}
