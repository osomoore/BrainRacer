import type Phaser from 'phaser';
import { UNLOCK_VEHICLES } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import { bodyGrad, ellipse, fillStroke, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';

const INK = '#1b2530';
const BARK = '#382831';
const LEAF = '#25463e';

function dot(c: Ctx, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, edge: string | null = null, width = 2): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, color, edge, width);
}

function box(c: Ctx, x: number, y: number, w: number, h: number, r: number, color: string | CanvasGradient, edge = INK): void {
  rr(c, x, y, w, h, r);
  fillStroke(c, color, edge, 2);
}

function line(c: Ctx, points: number[], color: string, width: number): void {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

function leaf(c: Ctx, x: number, y: number, s: number, angle: number, light: string, dark: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(-14, 0);
  c.bezierCurveTo(-4, -14, 10, -10, 19, 0);
  c.bezierCurveTo(7, 11, -6, 12, -14, 0);
  fillStroke(c, bodyGrad(c, -12, -7, 30, 16, light, dark), LEAF, 1.5);
  line(c, [-11, 0, 14, 0], '#e2ffa185', 1.2);
  c.restore();
}

function cabin(c: Ctx, x: number, y: number, w: number, h: number, r = 5): void {
  box(c, x, y, w, h, r, bodyGrad(c, x, y, w, h, '#c4f3f0', '#397281'));
  line(c, [x + 4, y + 5, x + w * 0.58, y + 5], '#f4ffe4af', 1.8);
}

const VEHICLES = ['leafRacer', 'twigBuggy', 'acornCoupe', 'mossRover', 'barkWagon'] as const;

function drawForestVehicle(scene: Phaser.Scene, id: typeof VEHICLES[number]): void {
  const { spec, colors } = UNLOCK_VEHICLES[id];
  const { ctx: c, done } = makeCanvas(scene, TEX.unlockVehicles[id], spec.length * 2, spec.width * 2);
  c.scale(spec.length / 50, spec.width / 26);
  const [light, dark, accent] = colors;
  const paint = bodyGrad(c, 4, 7, 89, 39, light, dark);
  const chunky = id === 'mossRover' || id === 'twigBuggy';
  for (const y of [3, 49]) {
    for (const x of [22, 78]) {
      box(c, x - 10, y === 3 ? y : y - 8, chunky ? 23 : 19, 8, 2.5, '#293647');
      line(c, [x - 5, y === 3 ? 5 : 46, x + 5, y === 3 ? 5 : 46], '#81949b', 1.5);
    }
  }

  switch (id) {
    case 'leafRacer':
      c.beginPath();
      c.moveTo(5, 26);
      c.bezierCurveTo(25, -1, 78, 1, 97, 26);
      c.bezierCurveTo(75, 50, 25, 55, 5, 26);
      fillStroke(c, paint, INK, 2.6);
      line(c, [8, 26, 88, 26], accent, 2);
      for (const y of [10, 42]) {
        line(c, [25, 26, 40, y, 57, y], '#c8f284', 1.3);
        line(c, [65, 26, 77, y + (26 - y) * 0.38], '#c8f284', 1.3);
      }
      cabin(c, 39, 16, 29, 20, 9);
      break;
    case 'twigBuggy':
      poly(c, [7, 14, 26, 8, 71, 9, 93, 16, 97, 26, 93, 36, 71, 43, 26, 44, 7, 38]);
      fillStroke(c, paint, INK, 2.6);
      box(c, 32, 13, 37, 26, 7, '#37433c');
      box(c, 38, 17, 13, 18, 4, accent);
      cabin(c, 56, 14, 9, 24, 3);
      for (const y of [12, 40]) {
        line(c, [11, y + (26 - y) * 0.35, 29, y, 73, y, 88, y + (26 - y) * 0.32], BARK, 5);
        line(c, [11, y + (26 - y) * 0.35, 29, y, 73, y, 88, y + (26 - y) * 0.32], '#dfb176', 2.3);
      }
      leaf(c, 82, 25, 0.48, -0.45, '#d9fb89', '#6a973f');
      break;
    case 'acornCoupe':
      c.beginPath();
      c.moveTo(7, 26);
      c.bezierCurveTo(4, 2, 76, -2, 97, 26);
      c.bezierCurveTo(76, 54, 4, 50, 7, 26);
      fillStroke(c, paint, INK, 2.6);
      c.beginPath();
      c.moveTo(43, 8);
      c.quadraticCurveTo(-2, 6, 8, 33);
      c.quadraticCurveTo(16, 46, 43, 44);
      c.quadraticCurveTo(28, 26, 43, 8);
      fillStroke(c, '#875334', BARK, 2);
      for (const [x, y] of [[17, 19], [26, 13], [29, 25], [17, 31], [28, 37]]) {
        line(c, [x - 4, y - 2, x, y + 2, x + 4, y - 2], '#dea464', 2.4);
      }
      cabin(c, 43, 13, 29, 26, 10);
      line(c, [80, 19, 88, 26, 80, 33], '#ffcf89', 1.5);
      break;
    case 'mossRover':
      box(c, 6, 7, 88, 38, 7, paint);
      box(c, 77, 9, 20, 34, 6, '#51776a');
      box(c, 7, 11, 33, 30, 5, '#376354');
      for (const [x, y, s] of [[18, 20, .49], [29, 16, .4], [23, 31, .65], [34, 29, .37]]) {
        leaf(c, x, y, s, (x - y) / 20, '#c2ec7c', '#5b9e45');
      }
      cabin(c, 45, 12, 29, 28);
      for (const y of [20, 26, 32]) line(c, [82, y, 91, y], INK, 2);
      break;
    case 'barkWagon':
      box(c, 5, 5, 91, 42, 8, paint);
      box(c, 11, 10, 57, 32, 5, '#c3946d');
      for (const y of [16, 24, 31, 37]) {
        line(c, [14, y, 35, y - 2, 48, y + 1, 65, y - 1], '#815643', 1.6);
      }
      for (const x of [18, 37, 56]) {
        box(c, x, 8, 8, 7, 2, '#ffe2a0');
        box(c, x, 37, 8, 7, 2, '#ffe2a0');
      }
      cabin(c, 70, 10, 17, 32);
      break;
  }

  for (const y of [18, 34]) {
    dot(c, id === 'acornCoupe' || id === 'leafRacer' ? 89 : 92, y, 3.1, 3.1, '#fff5ad', INK, 1.3);
    dot(c, id === 'leafRacer' ? 13 : 10, y, 2.6, 2.6, '#ff9a71', INK, 1.3);
  }
  done();
}

export function drawForestLoadouts(scene: Phaser.Scene): void {
  for (const id of VEHICLES) drawForestVehicle(scene, id);
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): void {
  const { ctx, done } = makeCanvas(scene, key, w, h);
  paint(ctx);
  done();
}

function branch(c: Ctx, points: number[], width: number): void {
  line(c, points, BARK, width + 7);
  line(c, points, '#946142', width);
  line(c, points, '#d39a67', width * 0.25);
}

function crown(c: Ctx, x: number, y: number, size: number): void {
  dot(c, x, y, size, size * 0.77, bodyGrad(c, x - size, y - size, size * 2, size * 1.5, '#93c969', '#35684e'), LEAF, 5);
  leaf(c, x + size * .17, y - size * .27, size / 36, -.35, '#d9ee7e', '#6ba650');
}

function drawTreeBody(c: Ctx): void {
  branch(c, [171, 105, 93, 107, 40, 57, 26, 23], 19);
  branch(c, [125, 104, 76, 122, 28, 159, 15, 193], 25);
  branch(c, [166, 100, 144, 55, 157, 16, 177, 8], 22);
  branch(c, [172, 117, 144, 167, 161, 201], 23);
  poly(c, [48, 66, 83, 40, 132, 27, 181, 49, 224, 44, 269, 82, 278, 125, 239, 162, 199, 166, 151, 192, 98, 185, 50, 156, 35, 113]);
  fillStroke(c, bodyGrad(c, 41, 35, 237, 153, '#b78758', '#684333'), BARK, 7);
  for (const [x, y, rx, ry] of [[155, 110, 70, 57], [155, 110, 52, 42], [157, 112, 30, 24]]) {
    ellipse(c, x, y, rx, ry);
    c.strokeStyle = '#674133';
    c.lineWidth = 4;
    c.stroke();
  }
  line(c, [49, 96, 94, 82, 122, 92, 150, 111], '#e2aa73', 5);
  line(c, [165, 132, 191, 138, 223, 131, 246, 112], '#db9d64', 4);

  for (const [x, y, size] of [[67, 66, 29], [74, 146, 31], [108, 42, 35], [108, 174, 31], [110, 101, 48], [153, 70, 36], [147, 137, 41], [163, 101, 33]]) {
    crown(c, x, y, size);
  }
  for (const [x, y, angle] of [[42, 82, -.64], [58, 163, .8], [113, 27, -.8], [120, 126, .22], [175, 123, .6], [154, 62, -.43]]) {
    leaf(c, x, y, .76, angle, '#cfee80', '#69a650');
  }
}

function drawTreeHead(c: Ctx): void {
  // With the rig's (0.25, 0.5) origin, (90, 30 / 114) aligns with the eye beams.
  branch(c, [61, 66, 46, 30, 20, 14], 12);
  branch(c, [59, 78, 41, 112, 24, 130], 12);
  crown(c, 31, 41, 26);
  crown(c, 36, 109, 26);
  c.beginPath();
  c.moveTo(51, 17);
  c.bezierCurveTo(85, 6, 145, 16, 153, 47);
  c.bezierCurveTo(161, 74, 160, 113, 132, 125);
  c.bezierCurveTo(102, 141, 50, 141, 40, 109);
  c.quadraticCurveTo(26, 68, 51, 17);
  fillStroke(c, bodyGrad(c, 40, 14, 120, 110, '#d9aa6b', '#8b573b'), BARK, 6);
  line(c, [65, 19, 63, 55, 72, 78, 62, 112, 73, 131], '#986443', 5);
  line(c, [119, 23, 132, 43, 121, 66, 133, 91, 119, 125], '#b47951', 4);
  crown(c, 45, 68, 22);
  for (const y of [30, 114]) {
    dot(c, 90, y, 15, 13, '#fff4b4', BARK, 3.5);
    dot(c, 94, y, 8, 8, '#57864a', '#364f39', 2);
    dot(c, 97, y - 3, 3, 3, '#fffbe4');
    line(c, [73, y - 11, 79, y - 17, 91, y - 17], '#5b4232', 4.5);
    dot(c, 110, y + (72 - y) * 0.33, 7, 4, '#f5a878');
  }
  dot(c, 106, 72, 13, 10, '#db9e63', BARK, 3.2);
  c.beginPath();
  c.moveTo(127, 52);
  c.quadraticCurveTo(153, 72, 127, 93);
  c.quadraticCurveTo(136, 72, 127, 52);
  fillStroke(c, '#583731', BARK, 3.5);
  dot(c, 139, 72, 4, 8, '#ed9873');
}

export function drawForestBoss(scene: Phaser.Scene): void {
  const tex = TEX.walkingTree;
  bake(scene, tex.body, 288, 213, drawTreeBody);
  bake(scene, tex.head, 180, 144, drawTreeHead);
  bake(scene, tex.arm, 187, 110, c => {
    branch(c, [23, 93, 67, 58, 105, 47, 155, 27], 26);
    branch(c, [142, 36, 155, 16, 171, 11], 8);
    branch(c, [134, 38, 160, 44, 179, 37], 9);
    branch(c, [100, 50, 113, 29, 106, 17], 11);
    leaf(c, 117, 17, .75, .31, '#d0ee80', '#679f48');
    leaf(c, 154, 16, .48, -.6, '#9bce69', '#679f48');
  });
  bake(scene, tex.foot, 168, 112, c => {
    branch(c, [145, 76, 105, 57, 76, 62, 51, 45, 20, 34], 26);
    branch(c, [68, 53, 37, 68, 13, 63], 12);
    branch(c, [56, 47, 46, 25, 55, 12], 12);
    branch(c, [78, 63, 55, 85, 32, 91], 11);
    leaf(c, 45, 22, .53, -1.5, '#bce47e', '#638b59');
  });
  bake(scene, tex.beam, 64, 64, c => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, '#91f84800'], [0.27, '#91f848a8'], [0.43, '#caff73'],
      [0.5, '#ffffe1'], [0.57, '#caff73'], [0.73, '#91f848a8'], [1, '#91f84800']]);
    c.fillRect(0, 0, 64, 64);
  });
  bake(scene, tex.glow, 128, 128, c => {
    c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#ffffea'], [0.25, '#ebff95'], [0.6, '#93f96987'], [1, '#93f96900']]);
    c.fillRect(0, 0, 128, 128);
  });
}
