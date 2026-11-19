import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { fillStroke, makeCanvas, OUTLINE, star, type Ctx } from './draw';

const K = TEX.farm;

/** frame 0..2 = walk, 3 = tumble. */
type Pose = 0 | 1 | 2 | 3;

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, c: string, lw = 2.5, rot = 0): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fillStroke(ctx, c, lw ? OUTLINE : null, lw);
}

/** Four legs peeking out of the body. Walk: diagonal pairs swing along x. Tumble: splayed outwards. */
function legs(ctx: Ctx, pose: Pose, xs: [number, number], cy: number, spread: number, rx: number, ry: number, c: string): void {
  const swing = pose === 0 ? 5 : pose === 1 ? 0 : -5;
  xs.forEach((x, i) => {
    for (const side of [-1, 1]) {
      if (pose === 3) {
        const a = side * (0.6 + i * 0.5) + (i ? 0.5 : -0.4);
        oval(ctx, x + Math.cos(a) * 3 + (i ? -3 : 4), cy + side * (spread + 6), rx + 2, ry, c, 2.5, side * (0.5 + 0.3 * i));
      } else {
        const phase = ((i + (side > 0 ? 1 : 0)) % 2 ? 1 : -1) * swing;
        oval(ctx, x + phase, cy + side * spread, rx, ry, c, 2.5);
      }
    }
  });
}

function eyes(ctx: Ctx, pose: Pose, x: number, cy: number, dy: number, r = 3.2): void {
  for (const side of [-1, 1]) {
    if (pose === 3) {
      star(ctx, x, cy + side * dy, r * 1.9, r * 0.8, 5, 0.3);
      fillStroke(ctx, '#ffd93a', OUTLINE, 1.3);
    } else {
      oval(ctx, x, cy + side * dy, r, r, '#ffffff', 1.4);
      oval(ctx, x + 0.8, cy + side * dy, r * 0.55, r * 0.55, '#1b2233', 0);
    }
  }
}

function drawCow(ctx: Ctx, pose: Pose): void {
  legs(ctx, pose, [24, 52], 26, 22, 7, 4.2, '#f4f1ea');
  oval(ctx, 5, 26, 3, 2, '#2b2b33', 2);   // tail tuft
  oval(ctx, 38, 26, 33, 17, '#fbf9f3', 3);
  for (const [x, y, rx, ry] of [[28, 17, 9, 6], [46, 33, 8, 7], [20, 31, 6, 5], [52, 18, 5, 4]]) oval(ctx, x, y, rx, ry, '#33323c', 0);
  for (const side of [-1, 1]) {
    oval(ctx, 64, 26 + side * 15, 6, 3.2, '#33323c', 2, side * 0.5);
    oval(ctx, 69, 26 + side * 10, 3.2, 2.2, '#f6ecd0', 1.8);   // horn
  }
  oval(ctx, 72, 26, 13, 12, '#fbf9f3', 3);
  oval(ctx, 80, 26, 6.5, 9, '#f6a3b3', 2.5);
  oval(ctx, 82, 23, 1.2, 1.2, '#8d3f55', 0); oval(ctx, 82, 29, 1.2, 1.2, '#8d3f55', 0);
  eyes(ctx, pose, 70, 26, 8.5);
}

function drawSheep(ctx: Ctx, pose: Pose): void {
  legs(ctx, pose, [20, 40], 24, 20, 5, 3.6, '#3d3338');
  oval(ctx, 49, 24, 8.5, 7.5, '#3d3338', 2.5);
  for (const side of [-1, 1]) oval(ctx, 46, 24 + side * 8, 4.5, 2.8, '#5a4a50', 2, side * 0.6);
  const puffs: [number, number, number][] = [[12, 24, 11], [18, 12, 11], [18, 36, 11], [28, 8, 10], [28, 40, 10], [30, 24, 14], [40, 14, 9], [40, 34, 9], [8, 16, 7], [8, 32, 7]];
  for (const [x, y, r] of puffs) oval(ctx, x, y, r, r, '#f7f4ea', 3);
  for (const [x, y, r] of puffs) oval(ctx, x, y, r - 1.5, r - 1.5, '#fffdf6', 0);
  oval(ctx, 53, 24, 10, 9, '#3d3338', 2.5);
  oval(ctx, 44, 24, 5, 7, '#f7f4ea', 0);
  eyes(ctx, pose, 57, 24, 5, 2.6);
}

function drawPig(ctx: Ctx, pose: Pose): void {
  legs(ctx, pose, [18, 40], 21, 17, 6, 4, '#f08ea6');
  // curly tail
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(5, 21, 3.5, 0.5, 5.2); ctx.stroke();
  oval(ctx, 28, 21, 25, 14, '#f9a9bc', 3);
  oval(ctx, 22, 15, 10, 5, '#fcc3d0', 0);
  for (const side of [-1, 1]) oval(ctx, 46, 21 + side * 10, 6, 4, '#ee8aa2', 2.2, side * 0.7);
  oval(ctx, 51, 21, 11, 11, '#f9a9bc', 3);
  oval(ctx, 60, 21, 5, 6.5, '#f27c98', 2.5);
  oval(ctx, 61.5, 19, 1.1, 1.3, '#8a2f4b', 0); oval(ctx, 61.5, 23, 1.1, 1.3, '#8a2f4b', 0);
  eyes(ctx, pose, 53, 21, 6.5, 2.6);
}

function drawHorse(ctx: Ctx, pose: Pose): void {
  legs(ctx, pose, [32, 62], 22, 16, 9, 3.6, '#8c5530');
  // tail
  ctx.beginPath(); ctx.moveTo(18, 22); ctx.quadraticCurveTo(8, 12, 2, 18); ctx.quadraticCurveTo(8, 24, 2, 30); ctx.quadraticCurveTo(10, 30, 18, 22); ctx.closePath();
  fillStroke(ctx, '#3a2314', OUTLINE, 2.5);
  oval(ctx, 46, 22, 34, 12, '#b37240', 3);
  oval(ctx, 40, 17, 22, 5, '#c98a55', 0);
  oval(ctx, 80, 22, 11, 8, '#b37240', 3);           // neck / head base
  oval(ctx, 89, 22, 14, 9.5, '#b37240', 3);          // head
  oval(ctx, 99, 22, 4, 6.5, '#d99a62', 0);
  oval(ctx, 101, 19.5, 1.1, 1.1, '#3a2314', 0); oval(ctx, 101, 24.5, 1.1, 1.1, '#3a2314', 0);
  rr(ctx, 52, 20, 26, 4, '#3a2314');                  // mane along the neck
  for (const side of [-1, 1]) oval(ctx, 78, 22 + side * 8, 3, 4.5, '#8c5530', 2, side * 0.3);
  eyes(ctx, pose, 91, 22, 7, 2.6);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); fillStroke(ctx, c, OUTLINE, 2.5);
}

function drawChicken(ctx: Ctx, pose: Pose): void {
  const sw = pose === 0 ? 2 : pose === 1 ? 0 : -2;
  for (const side of [-1, 1]) oval(ctx, 14 + (side > 0 ? sw : -sw), 14 + side * 5, 3.5, 2, '#f2a22c', 1.8);
  // tail feathers
  for (const a of [-0.5, 0, 0.5]) oval(ctx, 4, 14 + a * 10, 4.5, 2.6, '#e9e4da', 1.8, a);
  oval(ctx, 14, 14, 11, 10, '#fffdf8', 2.8);
  for (const side of [-1, 1]) oval(ctx, 12, 14 + side * 8, 6.5, 3, '#ece6da', 1.8, side * -0.3);
  oval(ctx, 25, 14, 6, 6, '#fffdf8', 2.5);
  oval(ctx, 30, 14, 3, 2.4, '#f2a22c', 1.6);
  oval(ctx, 24, 14, 4, 2.2, '#e63229', 1.6);          // comb
  eyes(ctx, pose, 26, 14, 4.4, 1.6);
}

function drawDuck(ctx: Ctx, pose: Pose): void {
  const sw = pose === 0 ? 2 : pose === 1 ? 0 : -2;
  for (const side of [-1, 1]) oval(ctx, 14 + (side > 0 ? sw : -sw), 13 + side * 6, 3.5, 2.2, '#f2891f', 1.6);
  ctx.beginPath(); ctx.moveTo(4, 13); ctx.lineTo(0, 9); ctx.lineTo(3, 13); ctx.lineTo(0, 17); ctx.closePath(); fillStroke(ctx, '#fbe36a', OUTLINE, 1.8);
  oval(ctx, 14, 13, 12, 9, '#fde86f', 2.8);
  for (const side of [-1, 1]) oval(ctx, 13, 13 + side * 6, 6, 3, '#f1cf45', 1.8, side * -0.3);
  oval(ctx, 25, 13, 6.5, 6.5, '#fde86f', 2.5);
  oval(ctx, 30.5, 13, 3.4, 3.8, '#f58b1f', 1.7);
  eyes(ctx, pose, 25, 13, 4.5, 1.7);
}

interface AnimalSpec { frames: readonly string[]; tumble: string; w: number; h: number; draw: (ctx: Ctx, pose: Pose) => void }
const ANIMALS: AnimalSpec[] = [
  { frames: K.cow, tumble: K.cowTumble, w: 88, h: 52, draw: drawCow },
  { frames: K.sheep, tumble: K.sheepTumble, w: 64, h: 48, draw: drawSheep },
  { frames: K.pig, tumble: K.pigTumble, w: 64, h: 42, draw: drawPig },
  { frames: K.horse, tumble: K.horseTumble, w: 104, h: 44, draw: drawHorse },
  { frames: K.chicken, tumble: K.chickenTumble, w: 32, h: 28, draw: drawChicken },
  { frames: K.duck, tumble: K.duckTumble, w: 32, h: 26, draw: drawDuck },
];

export function drawFarmAnimals(scene: Phaser.Scene): void {
  for (const a of ANIMALS) {
    for (let f = 0; f < 3; f++) {
      const { ctx, done } = makeCanvas(scene, a.frames[f], a.w, a.h);
      a.draw(ctx, f as Pose);
      done();
    }
    const { ctx, done } = makeCanvas(scene, a.tumble, a.w, a.h);
    ctx.translate(a.w / 2, a.h / 2); ctx.rotate(0.3); ctx.scale(0.86, 0.86); ctx.translate(-a.w / 2, -a.h / 2);
    a.draw(ctx, 3);
    done();
  }
}
