import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';
import { QUEUED_BOSS_PARTS } from './queuedBossKeys';
import { ROCK_MONSTER_RIG } from './rockMonster';

type World = keyof typeof QUEUED_BOSS_PARTS;
type Rig = Record<keyof typeof ROCK_MONSTER_RIG, number>;
type Paint = (c: Ctx, palette: Palette) => void;
type Palette = readonly [light: string, shade: string, ink: string, accent: string];

function boss(map: World, name: string, objectName: string, tint: number, color: string, rig: Partial<Rig> = {}) {
  const tex = QUEUED_BOSS_PARTS[map];
  const headX = rig.headX ?? 112;
  return { name, objectName, head: tex.head, tint, color,
    rig: { ...ROCK_MONSTER_RIG, footX: -104, headX, eyeFwd: headX + 66, eyeSide: 35, ...rig, tex } };
}

export const QUEUED_BOSSES = {
  brickworks: boss('brickworks', 'Puff Golem', 'puff-golem', 0xc5f68f, '#e1ff91', { armX: 30, armY: 83 }),
  mushroom: boss('mushroom', 'Spore Queen', 'spore-queen', 0xff92cf, '#ffc3ec', { armX: 23, armY: 74 }),
  tundra: boss('tundra', 'Yeti', 'yeti', 0x9bdbff, '#e2f6ff', { armY: 88 }),
  volcano: boss('volcano', 'Lava Monster', 'lava-monster', 0xff7153, '#ffd161', { armY: 83 }),
  candy: boss('candy', 'Killer Cone', 'killer-cone', 0xff8cd2, '#ffc1fb', { armX: 42, armY: 64, footX: -69, footY: 44 }),
  castle: boss('castle', 'Wooden Horse', 'wooden-horse', 0xffbd72, '#ffe48e', { armX: 24, armY: 69, headX: 130 }),
  airport: boss('airport', 'Giant Helicopter', 'giant-helicopter', 0x70dcff, '#a8f2ff', { armX: 38, armY: 75, footX: -75, footY: 60 }),
  house: boss('house', 'House Cat', 'house-cat', 0xffad73, '#ffe4ac', { armX: 36, armY: 72, footX: -90, footY: 63 }),
} satisfies Record<World, ReturnType<typeof boss>>;

function box(c: Ctx, x: number, y: number, w: number, h: number, radius: number, fill: string | CanvasGradient,
  ink: string | null = null, stroke = 5): void {
  rr(c, x, y, w, h, radius);
  fillStroke(c, fill, ink, stroke);
}

function oval(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient,
  ink: string | null = null, stroke = 5): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, fill, ink, stroke);
}

function shape(c: Ctx, pts: number[], fill: string | CanvasGradient, ink: string | null = null, stroke = 5): void {
  poly(c, pts);
  fillStroke(c, fill, ink, stroke);
}

function stroke(c: Ctx, color: string, width: number): void {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

function line(c: Ctx, pts: number[], color: string, width: number): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  stroke(c, color, width);
}

function coat(c: Ctx, p: Palette, w: number, h: number): CanvasGradient {
  return bodyGrad(c, 0, 0, w, h, p[0], p[1]);
}

function eyes(c: Ctx, iris: string, ink: string, x = 111): void {
  for (const y of [37, 107]) {
    oval(c, x, y, 17, 13, '#fff6d9', ink, 3.5);
    oval(c, x + 5, y, 8, 9, iris);
    oval(c, x + 7, y - 3, 3, 3, '#ffffff');
  }
}

function smile(c: Ctx, ink: string, x = 139): void {
  c.beginPath();
  c.moveTo(x, 58);
  c.quadraticCurveTo(x + 17, 72, x, 86);
  stroke(c, ink, 4);
}

function plate(c: Ctx, p: Palette, x: number, y: number, w: number, h: number): void {
  box(c, x, y, w, h, 4, '#356851', p[2]);
  shape(c, [x, y, x + w, y, x + w - 14, y + h - 16, x, y + h - 16],
    bodyGrad(c, x, y, w, h, p[0], p[1]), p[2], 3.5);
  line(c, [x + 8, y + h - 23, x + w - 22, y + h - 23], '#ddf79b', 2.5);
}

function wood(c: Ctx, p: Palette, w: number, h: number, points: number[]): void {
  shape(c, points, coat(c, p, w, h), p[2], 6);
  c.save();
  poly(c, points);
  c.clip();
  for (let y = 14; y < h; y += 23) {
    c.beginPath();
    c.moveTo(6, y);
    c.bezierCurveTo(w * 0.25, y - 16, w * 0.54, y + 11, w - 5, y);
    stroke(c, '#8b502e95', 2.5);
  }
  c.restore();
}

function waffle(c: Ctx, points: number[], p: Palette, w: number, h: number): void {
  shape(c, points, bodyGrad(c, 0, 0, w, h, '#ffdf8b', '#bb662e'), p[2], 5);
  c.save();
  poly(c, points);
  c.clip();
  for (let x = -h; x < w + h; x += 22) {
    line(c, [x, 0, x + h, h], '#924e29a0', 2.5);
    line(c, [x, 0, x - h, h], '#924e29a0', 2.5);
  }
  c.restore();
}

function scoop(c: Ctx, p: Palette, x: number, y: number, rx: number, ry: number): void {
  oval(c, x, y, rx, ry, bodyGrad(c, x - rx, y - ry, rx * 2, ry * 2, p[0], p[1]), p[2]);
  const colors = ['#fbfd9f', '#ab52ba', '#704788', '#96f6dd', '#ffffff'];
  for (const [i, dx, dy] of [[0, -0.53, -0.41], [1, -0.2, 0.42], [2, -0.57, 0.28],
    [3, 0.24, -0.36], [4, 0.6, 0.29], [1, 0.72, -0.2]]) {
    const px = x + rx * dx, py = y + ry * dy;
    line(c, [px - 3, py + (i % 2 ? -3 : 2), px + 4, py - (i % 2 ? -3 : 2)], colors[i], 4);
  }
}

function lavaRock(c: Ctx, p: Palette, w: number, h: number, pts: number[], fissure: number[]): void {
  shape(c, pts, coat(c, p, w, h), p[2], 6);
  line(c, fissure, '#e64a44', 12);
  line(c, fissure, p[3], 5);
}

function catStripes(c: Ctx, x: number, center: number, scale: number): void {
  for (const dir of [-1, 1]) {
    c.save();
    c.translate(x, center);
    c.scale(scale, scale * dir);
    for (const dx of [-27, 0, 27]) {
      shape(c, [dx - 5, -60, dx + 9, -56, dx + 15, -20, dx + 3, -33], '#a3483f');
    }
    c.restore();
  }
}

const ART = {
  brickworks: {
    palette: ['#b7df77', '#4a9860', '#1e413c', '#fff1a6'],
    body(c, p) {
      plate(c, p, 17, 25, 243, 161);
      plate(c, p, 40, 48, 111, 58);
      plate(c, p, 137, 90, 93, 62);
      for (const [x, y] of [[64, 64], [91, 64], [178, 105], [204, 105], [60, 134]]) {
        box(c, x, y, 17, 12, 1, '#5f9b54');
        box(c, x, y, 17, 4, 1, '#d0ee8e');
      }
    },
    head(c, p) {
      plate(c, p, 12, 15, 152, 111);
      for (const y of [20, 91]) {
        box(c, 82, y, 51, 30, 5, '#305f4d', p[2], 3);
        box(c, 102, y + 5, 24, 19, 3, '#ffdd7b');
        box(c, 114, y + 5, 10, 19, 2, '#fff4ba');
      }
      // A brass bellows nozzle and three vents distinguish this smiling block engine.
      box(c, 127, 55, 45, 34, 8, '#d98e42', p[2], 4);
      box(c, 149, 57, 26, 30, 6, '#ffdc78', p[2], 4);
      smile(c, p[2], 153);
      for (const y of [60, 71, 82]) box(c, 37, y, 23, 4, 0, '#34634b');
    },
    arm(c, p) { plate(c, p, 13, 38, 145, 57); plate(c, p, 105, 15, 90, 67); },
    foot(c, p) { plate(c, p, 7, 8, 104, 75); box(c, 51, 22, 38, 9, 1, '#d8f092'); },
  },
  mushroom: {
    palette: ['#f895bf', '#ae335e', '#58264a', '#fff0c9'],
    body(c, p) {
      oval(c, 146, 111, 125, 77, '#e7be95', p[2], 6);
      for (const [x, y, w] of [[65, 67, 45], [118, 52, 43], [183, 82, 69], [77, 141, 50], [160, 143, 66]]) {
        oval(c, x, y, w, w * 0.66, coat(c, p, 288, 213), p[2], 6);
        oval(c, x - w * 0.31, y - w * 0.14, w * 0.21, w * 0.14, p[3]);
        oval(c, x + w * 0.36, y + w * 0.14, w * 0.14, w * 0.1, '#ffd394');
      }
    },
    head(c, p) {
      oval(c, 109, 72, 62, 60, '#f4c9a3', p[2], 6);
      c.beginPath();
      c.moveTo(7, 73);
      c.bezierCurveTo(9, 23, 48, 10, 122, 13);
      c.bezierCurveTo(102, 34, 91, 107, 120, 131);
      c.bezierCurveTo(47, 135, 7, 117, 7, 73);
      c.closePath();
      fillStroke(c, coat(c, p, 180, 145), p[2], 6);
      for (const [x, y, r] of [[41, 38, 12], [68, 99, 13], [25, 79, 8]]) oval(c, x, y, r, r * 0.75, p[3]);
      shape(c, [62, 58, 75, 48, 81, 61, 98, 48, 98, 65, 112, 72, 96, 80, 98, 96, 81, 83, 75, 96, 62, 85],
        '#ffd46f', '#8d5339', 3);
      oval(c, 83, 72, 6, 7, '#e47c9e');
      eyes(c, '#a03d74', p[2], 118);
      smile(c, p[2]);
    },
    arm(c, p) {
      oval(c, 86, 61, 69, 20, '#e7be95', p[2]);
      oval(c, 146, 53, 45, 36, coat(c, p, 207, 110), p[2]);
      oval(c, 130, 40, 12, 8, p[3]);
      oval(c, 159, 58, 7, 5, p[3]);
    },
    foot(c, p) { oval(c, 61, 50, 47, 32, '#e7be95', p[2]); oval(c, 71, 47, 34, 23, '#f6d5b7'); },
  },
  tundra: {
    palette: ['#f2fbff', '#7caed3', '#395271', '#b9eeff'],
    body(c, p) {
      shape(c, [17, 86, 23, 49, 39, 57, 57, 26, 84, 38, 111, 15, 135, 25, 176, 14, 202, 33, 228, 30,
        239, 49, 266, 62, 274, 94, 262, 124, 275, 151, 244, 171, 230, 192, 195, 181, 163, 202, 122, 186,
        83, 196, 67, 172, 40, 174, 40, 150, 16, 131, 24, 108], coat(c, p, 288, 213), p[2], 6);
      for (const [x, y] of [[63, 67], [98, 103], [62, 137], [162, 134], [177, 66], [209, 109]]) {
        line(c, [x, y - 11, x + 12, y, x, y + 10], '#ffffffbe', 5);
      }
    },
    head(c, p) {
      for (const y of [25, 117]) {
        const side = y < 72 ? -1 : 1;
        shape(c, [89, y + side * 5, 68, y + side * 17, 42, y + side * 17, 52, y + side * 7,
          52, y - side * 9, 82, y - side * 12], '#83ddf2', p[2]);
      }
      shape(c, [14, 44, 42, 20, 78, 14, 107, 20, 148, 42, 164, 65, 164, 83, 148, 103,
        112, 124, 74, 132, 40, 116, 13, 99, 22, 75], coat(c, p, 180, 145), p[2], 5);
      oval(c, 121, 72, 35, 43, '#acd7e9', '#5c839c', 3.5);
      eyes(c, '#2d83a8', p[2], 117);
      oval(c, 146, 73, 9, 15, '#dff9ff', p[2], 2.5);
      smile(c, p[2], 145);
    },
    arm(c, p) {
      shape(c, [9, 52, 29, 30, 51, 36, 69, 20, 92, 30, 114, 20, 136, 32, 162, 21, 189, 32, 198, 51,
        183, 75, 157, 81, 143, 69, 115, 86, 91, 77, 63, 89, 54, 74, 28, 81], coat(c, p, 207, 110), p[2]);
      oval(c, 176, 49, 20, 20, '#8bc2dc', p[2], 3);
    },
    foot(c, p) {
      oval(c, 61, 43, 49, 33, coat(c, p, 120, 92), p[2]);
      for (const y of [27, 43, 59]) oval(c, 92, y, 10, 7, p[3], p[2], 2.5);
    },
  },
  volcano: {
    palette: ['#624865', '#322b43', '#2a1b31', '#ffd86c'],
    body(c, p) {
      lavaRock(c, p, 288, 213, [13, 84, 35, 44, 88, 22, 148, 15, 237, 39, 270, 85, 265, 137,
        228, 174, 165, 193, 90, 184, 43, 157, 16, 126], [48, 71, 82, 79, 101, 112, 145, 93, 158, 130, 213, 139, 235, 154]);
      for (const [x, y, rx, ry] of [[71, 120, 11, 7], [182, 80, 14, 8], [205, 105, 7, 6], [119, 149, 10, 6]]) {
        oval(c, x, y, rx, ry, '#f98458');
        oval(c, x, y - 2, rx * 0.55, ry * 0.55, p[3]);
      }
    },
    head(c, p) {
      lavaRock(c, p, 180, 145, [12, 52, 40, 23, 85, 11, 124, 24, 161, 42, 173, 73, 156, 104, 116, 125,
        75, 132, 29, 110, 11, 95], [29, 41, 58, 49, 59, 75, 85, 88]);
      eyes(c, '#bd4932', p[2], 116);
      oval(c, 146, 72, 16, 19, '#f8784e', p[2], 3);
      smile(c, p[2]);
    },
    arm(c, p) {
      lavaRock(c, p, 207, 110, [12, 49, 40, 27, 86, 35, 119, 22, 157, 13, 190, 36, 190, 68, 163, 82,
        104, 70, 60, 89, 21, 77], [107, 43, 127, 56, 148, 45, 164, 53, 177, 43]);
    },
    foot(c, p) {
      lavaRock(c, p, 120, 92, [13, 28, 39, 15, 75, 10, 102, 31, 105, 56, 74, 75, 31, 73, 11, 51],
        [32, 28, 49, 39, 65, 35, 85, 52]);
    },
  },
  candy: {
    palette: ['#fff1f7', '#f07bad', '#793c69', '#ffbeeb'],
    body(c, p) {
      waffle(c, [16, 104, 210, 35, 262, 37, 273, 178, 193, 178], p, 288, 213);
      oval(c, 187, 106, 68, 76, '#a785cd', p[2], 6);
      scoop(c, p, 206, 99, 65, 67);
    },
    head(c, p) {
      scoop(c, p, 81, 77, 69, 57);
      scoop(c, p, 118, 70, 53, 56);
      eyes(c, '#a33c78', p[2], 117);
      smile(c, p[2], 140);
    },
    arm(c, p) {
      waffle(c, [12, 76, 143, 20, 165, 73], p, 207, 110);
      scoop(c, p, 165, 47, 29, 28);
    },
    foot(c, p) {
      waffle(c, [9, 51, 94, 14, 105, 69], p, 120, 92);
      scoop(c, p, 93, 45, 19, 28);
    },
  },
  castle: {
    palette: ['#ddaa70', '#9f5d3e', '#4e342e', '#f7d783'],
    body(c, p) {
      shape(c, [60, 80, 12, 85, 19, 107, 16, 131, 70, 135], '#c58148', p[2]);
      wood(c, p, 288, 213, [37, 64, 99, 41, 235, 43, 269, 77, 266, 134, 225, 170, 92, 167, 37, 141]);
      shape(c, [127, 42, 177, 43, 182, 168, 131, 168], '#a74857', p[2], 4);
      line(c, [139, 45, 144, 161], p[3], 3.5);
      line(c, [165, 45, 171, 160], p[3], 3.5);
      shape(c, [145, 86, 163, 86, 168, 103, 155, 117, 143, 104], '#ffda84', '#703d39', 3);
    },
    head(c, p) {
      wood(c, p, 180, 145, [12, 42, 29, 12, 54, 37, 73, 31, 107, 37, 122, 46, 159, 47, 169, 61,
        169, 87, 161, 101, 124, 102, 105, 111, 67, 110, 42, 109, 28, 131, 10, 111, 24, 83, 24, 55]);
      eyes(c, '#703f4b', p[2], 107);
      box(c, 143, 50, 16, 48, 5, '#c7715c', p[2], 3);
      for (const y of [61, 85]) oval(c, 155, y, 4, 4, '#f6d18a');
      for (const y of [60, 83]) oval(c, 164, y, 3, 3, '#593329');
    },
    arm(c, p) {
      wood(c, p, 207, 110, [12, 30, 93, 36, 143, 51, 190, 42, 194, 70, 147, 82, 89, 69, 12, 65]);
      oval(c, 52, 49, 16, 16, '#b37d59', p[2], 4);
      oval(c, 52, 49, 5, 5, p[3]);
    },
    foot(c, p) {
      wood(c, p, 120, 92, [12, 28, 63, 20, 90, 34, 108, 35, 109, 62, 84, 74, 54, 59, 15, 65]);
      box(c, 83, 35, 25, 25, 4, '#9a5248', p[2], 3);
    },
  },
  airport: {
    palette: ['#fef1df', '#ef694f', '#373e60', '#6deaff'],
    body(c, p) {
      shape(c, [188, 68, 63, 93, 22, 68, 14, 78, 28, 109, 13, 137, 21, 146, 67, 122, 186, 138],
        '#e76748', p[2], 6);
      oval(c, 172, 106, 94, 59, coat(c, p, 288, 213), p[2], 6);
      line(c, [94, 106, 241, 106], '#fff0cd', 9);
      // A soft rotor disc and two blades read at the same scale as the fuselage.
      oval(c, 163, 105, 112, 91, '#b5e9ff21', '#c2f1ff85', 2);
      c.save();
      c.translate(163, 105);
      c.rotate(-0.73);
      box(c, -102, -11, 204, 22, 8, '#49577a', p[2], 4);
      for (const x of [-99, 85]) box(c, x, -8, 14, 16, 3, '#f4bf48');
      c.restore();
      oval(c, 163, 105, 24, 24, '#e58c61', p[2], 4);
      oval(c, 159, 101, 11, 11, '#fff1c5');
    },
    head(c, p) {
      oval(c, 88, 73, 79, 59, coat(c, p, 180, 145), p[2], 6);
      oval(c, 110, 73, 51, 51, bodyGrad(c, 60, 24, 112, 101, '#a0fbff', '#347ea6'), p[2], 5);
      line(c, [98, 24, 103, 74, 98, 122], '#fff3db', 6);
      line(c, [104, 74, 158, 74], '#fff3db', 6);
      eyes(c, '#266287', p[2], 118);
      for (const y of [56, 90]) oval(c, 162, y, 7, 6, '#fff8c2', p[2], 3);
    },
    arm(c, p) {
      box(c, 5, 39, 158, 31, 13, '#bfcbdc', p[2]);
      box(c, 134, 23, 57, 59, 18, '#fa8761', p[2]);
      oval(c, 161, 51, 14, 14, '#eaf7ff', p[2], 3);
    },
    foot(c, p) {
      box(c, 8, 26, 105, 38, 14, '#70819d', p[2]);
      box(c, 13, 31, 92, 9, 3, '#cfecfa');
    },
  },
  house: {
    palette: ['#ffdc9e', '#d68258', '#603d47', '#ffe8b8'],
    body(c, p) {
      c.beginPath();
      c.moveTo(91, 137);
      c.bezierCurveTo(21, 177, 5, 151, 17, 108);
      c.bezierCurveTo(22, 90, 35, 81, 45, 84);
      stroke(c, p[2], 29);
      stroke(c, '#e19465', 19);
      oval(c, 157, 106, 112, 80, coat(c, p, 288, 213), p[2], 6);
      catStripes(c, 112, 106, 1.04);
      for (const y of [47, 165]) oval(c, 211, y, 24, 13, '#ffd89f');
    },
    head(c, p) {
      for (const y of [16, 128]) {
        const side = y < 72 ? 1 : -1;
        shape(c, [41, y - side * 7, 79, y + side * 3, 99, y + side * 32, 51, y + side * 51], '#da895f', p[2]);
        shape(c, [49, y + side, 73, y + side * 10, 85, y + side * 28, 55, y + side * 36], '#f5a4a2');
      }
      oval(c, 90, 72, 75, 56, coat(c, p, 180, 145), p[2], 6);
      catStripes(c, 57, 72, 0.53);
      for (const y of [56, 88]) {
        oval(c, 139, y, 22, 16, '#fff1d2', p[2], 2.5);
        const side = y < 72 ? -1 : 1;
        line(c, [140, y + side * 4, 172, y + side * 19], p[2], 1.6);
        line(c, [145, y, 176, y + side * 9], p[2], 1.6);
      }
      eyes(c, '#47846e', p[2], 111);
      shape(c, [151, 65, 168, 71, 151, 79, 145, 72], '#c37385', p[2], 2.4);
    },
    arm(c, p) {
      oval(c, 95, 55, 83, 31, coat(c, p, 207, 110), p[2]);
      oval(c, 168, 56, 29, 27, '#f7cd99', p[2], 4);
      for (const y of [43, 56, 69]) line(c, [178, y, 184, y + 1], '#a86d65', 2.5);
    },
    foot(c, p) {
      oval(c, 60, 46, 48, 30, coat(c, p, 120, 92), p[2]);
      for (const y of [33, 46, 59]) line(c, [86, y, 95, y + 1], '#a86d65', 3);
    },
  },
} satisfies Record<World, { palette: Palette; body: Paint; head: Paint; arm: Paint; foot: Paint }>;

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): void {
  const { ctx, done } = makeCanvas(scene, key, w, h);
  paint(ctx);
  done();
}

export function drawQueuedBosses(scene: Phaser.Scene): void {
  for (const map of Object.keys(ART) as World[]) {
    const { palette, body, head, arm, foot } = ART[map];
    const { rig, color } = QUEUED_BOSSES[map];
    const { tex } = rig;
    bake(scene, tex.body, 288, 213, c => body(c, palette));
    bake(scene, tex.head, 180, 145, c => head(c, palette));
    bake(scene, tex.arm, 207, 110, c => arm(c, palette));
    bake(scene, tex.foot, 120, 92, c => foot(c, palette));
    bake(scene, tex.beam, 64, 64, c => {
      c.fillStyle = lin(c, 0, 0, 0, 64, [[0, color + '00'], [0.32, color + 'b6'],
        [0.5, '#ffffff'], [0.68, color + 'b6'], [1, color + '00']]);
      c.fillRect(0, 0, 64, 64);
    });
    bake(scene, tex.glow, 128, 128, c => {
      c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#ffffff'], [0.24, color],
        [0.55, color + '78'], [1, color + '00']]);
      c.fillRect(0, 0, 128, 128);
    });
  }
}
