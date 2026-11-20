import type Phaser from 'phaser';
import { UNLOCK_VEHICLES } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import { bodyGrad, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';

const INK = '#14223d';

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  const { ctx, done } = makeCanvas(scene, key, w, h);
  paint(ctx);
  done();
}

function box(c: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string | CanvasGradient, stroke = 2): void {
  rr(c, x, y, w, h, radius);
  fillStroke(c, color, INK, stroke);
}

function oval(c: Ctx, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, stroke = 0): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, color, stroke ? INK : null, stroke);
}

function line(c: Ctx, color: string, width: number): void {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}

function glass(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  oval(c, x, y, rx, ry, bodyGrad(c, x - rx, y - ry, rx * 2, ry * 2, '#a3efff', '#294775'), 2.3);
  glossHighlight(c, x - rx * 0.2, y - ry * 0.53, rx * 0.56, ry * 0.16, 0.62);
}

function chassisTires(c: Ctx, front: number, rear: number, wide = false): void {
  for (const x of [rear, front]) {
    for (const y of [2, 42]) {
      box(c, x, y, wide ? 22 : 16, 8, 3, '#293249');
      for (const xOffset of [4, 8, 12]) {
        c.fillStyle = '#7484a6';
        c.fillRect(x + xOffset, y + 2, 2, 4);
      }
    }
  }
}

const vehiclePainters = {
  mantaRacer(c, coat, accent) {
    chassisTires(c, 69, 19);
    c.beginPath();
    c.moveTo(96, 26);
    c.bezierCurveTo(91, 12, 70, 13, 51, 12);
    c.quadraticCurveTo(30, 8, 14, 3);
    c.quadraticCurveTo(17, 14, 29, 21);
    c.lineTo(5, 24);
    c.lineTo(5, 28);
    c.lineTo(29, 31);
    c.quadraticCurveTo(17, 38, 14, 49);
    c.quadraticCurveTo(30, 44, 51, 40);
    c.bezierCurveTo(70, 39, 91, 40, 96, 26);
    c.closePath();
    fillStroke(c, coat, INK, 2.7);
    glass(c, 59, 26, 22, 10);
    for (const y of [14, 38]) {
      oval(c, 31, y, 5, 2.5, accent);
      oval(c, 82, y + (26 - y) / 3, 5, 1.7, accent);
    }
  },
  bubbleSub(c, coat, accent) {
    for (const y of [2, 42]) {
      box(c, 18, y, 57, 8, 4, '#3e6783');
      for (const x of [25, 37, 49, 61]) box(c, x, y + 1, 5, 6, 2, '#77a4b4', 1);
    }
    poly(c, [26, 20, 10, 10, 5, 11, 8, 26, 5, 41, 10, 42, 26, 32]);
    fillStroke(c, '#cf9351', INK, 2);
    oval(c, 55, 26, 41, 21, coat, 2.7);
    oval(c, 65, 26, 20, 17, '#f7d9a3', 2.4);
    glass(c, 65, 26, 16, 13);
    for (const y of [20, 32]) oval(c, 31, y, 4, 4, accent, 1.8);
    oval(c, 91, 26, 3, 5, '#fffbb8', 1.5);
  },
  coralBuggy(c, coat, accent) {
    chassisTires(c, 72, 8, true);
    poly(c, [6, 16, 21, 9, 40, 13, 56, 9, 81, 9, 97, 17, 97, 35, 81, 43, 56, 43, 40, 39, 21, 43, 6, 36]);
    fillStroke(c, coat, INK, 2.5);
    box(c, 31, 14, 34, 24, 7, '#462b52');
    for (const y of [18, 28]) box(c, 40, y, 13, 7, 3, '#d7889a', 1.5);
    box(c, 60, 13, 6, 26, 3, '#a9e7f0');
    for (const y of [17, 35]) oval(c, 87, y, 5, 4, accent, 1.5);
    for (const [x, y] of [[14, 22], [14, 30], [21, 26], [77, 24], [77, 30]]) oval(c, x, y, 2, 2, '#ffd6bf');
  },
  stingrayGT(c, coat, accent) {
    chassisTires(c, 72, 13);
    poly(c, [3, 24, 23, 21, 24, 10, 64, 7, 89, 12, 97, 26, 89, 40, 64, 45, 24, 42, 23, 31, 3, 28]);
    fillStroke(c, coat, INK, 2.5);
    for (const y of [11, 35]) {
      poly(c, [34, y + 4, 68, y - 1, 86, y + 4, 74, y + 6]);
      fillStroke(c, accent, null);
    }
    glass(c, 58, 26, 20, 10);
    box(c, 10, 12, 9, 28, 4, '#2c6d9a');
    for (const y of [19, 33]) oval(c, 89, y, 3.5, 2.5, '#f2ffff', 1.2);
  },
  nautilusVan(c, coat, accent) {
    chassisTires(c, 73, 11);
    box(c, 4, 5, 92, 42, 16, coat, 2.7);
    for (const x of [13, 28, 44]) {
      for (const y of [8, 39]) box(c, x, y, 10, 5, 2, accent, 1.4);
    }
    oval(c, 40, 26, 25, 14, '#f6c7a8', 1.7);
    c.beginPath();
    c.moveTo(17, 27);
    c.bezierCurveTo(23, 13, 59, 10, 61, 24);
    c.bezierCurveTo(64, 39, 29, 41, 28, 28);
    c.bezierCurveTo(27, 20, 49, 17, 51, 24);
    c.bezierCurveTo(53, 29, 41, 33, 38, 27);
    line(c, '#af617e', 2.6);
    glass(c, 78, 26, 11, 16);
    for (const y of [14, 38]) oval(c, 91, y, 3, 3, '#fff5b6', 1.5);
  },
} satisfies Record<string, (c: Ctx, coat: CanvasGradient, accent: string) => void>;

export function drawUnderwaterLoadouts(scene: Phaser.Scene): void {
  for (const id of Object.keys(vehiclePainters) as (keyof typeof vehiclePainters)[]) {
    const { colors: [light, dark, accent], spec } = UNLOCK_VEHICLES[id];
    bake(scene, TEX.unlockVehicles[id], spec.length * 2, spec.width * 2, c => {
      c.scale(spec.length * 2 / 100, spec.width * 2 / 52);
      vehiclePainters[id](c, bodyGrad(c, 8, 5, 86, 42, light, dark), accent);
    });
  }
  bake(scene, TEX.unlockGuides.jelly, 58, 58, c => {
    for (const [x, endX, endY, color] of [[15, 11, 46, '#ff87c6'], [23, 22, 52, '#ae8dff'],
      [30, 32, 54, '#ff87c6'], [38, 44, 49, '#ae8dff']] as const) {
      c.beginPath();
      c.moveTo(x, 32);
      c.bezierCurveTo(x - 5, 40, endX + 8, 42, endX, endY);
      line(c, INK, 6);
      line(c, color, 3.4);
    }
    c.beginPath();
    c.moveTo(5, 30);
    c.bezierCurveTo(5, 17, 13, 7, 29, 7);
    c.bezierCurveTo(45, 7, 53, 17, 53, 30);
    c.quadraticCurveTo(49, 41, 41, 35);
    c.quadraticCurveTo(34, 41, 29, 35);
    c.quadraticCurveTo(22, 41, 16, 35);
    c.quadraticCurveTo(8, 39, 5, 30);
    c.closePath();
    fillStroke(c, bodyGrad(c, 6, 9, 47, 29, '#ffd1f2', '#bc6add'), INK, 2.6);
    glossHighlight(c, 21, 15, 8, 2.5, 0.7);
    for (const x of [21, 37]) {
      oval(c, x, 25, 2.4, 3.5, INK);
      oval(c, x - 0.5, 24, 0.8, 1, '#fff3fc');
    }
    for (const x of [15, 43]) oval(c, x, 29, 3, 1.6, '#ff84bf');
    c.beginPath();
    c.arc(29, 28, 3.5, 0.15, Math.PI - 0.15);
    line(c, INK, 1.8);
  });
}

function sharkTire(c: Ctx, x: number, y: number): void {
  box(c, x, y, 62, 43, 11, bodyGrad(c, x, y, 62, 43, '#485d78', '#202a3c'), 6);
  for (const offset of [11, 22, 33, 44]) {
    c.beginPath();
    c.moveTo(x + offset, y + 5);
    c.lineTo(x + offset + 5, y + 37);
    line(c, '#647a95', 4);
  }
}

export function drawLandshark(scene: Phaser.Scene): void {
  const { body, head, foot, arm, beam, glow } = TEX.landshark;
  bake(scene, foot, 74, 55, c => sharkTire(c, 6, 6));
  bake(scene, arm, 135, 112, c => {
    c.beginPath();
    c.moveTo(109, 61);
    c.bezierCurveTo(89, 28, 44, 17, 7, 8);
    c.quadraticCurveTo(28, 56, 48, 80);
    c.quadraticCurveTo(82, 99, 109, 61);
    c.closePath();
    fillStroke(c, bodyGrad(c, 9, 8, 104, 76, '#8bedf3', '#2f6d99'), INK, 6);
    c.beginPath();
    c.moveTo(19, 21);
    c.quadraticCurveTo(60, 41, 79, 59);
    line(c, '#b3f2fa', 4);
  });
  bake(scene, body, 352, 216, c => {
    // Fixed front tires sit ahead of the pectoral fins. The separate foot sprites supply the rear pair.
    for (const y of [17, 156]) sharkTire(c, 225, y);
    c.beginPath();
    c.moveTo(327, 108);
    c.bezierCurveTo(300, 47, 233, 42, 179, 53);
    c.quadraticCurveTo(115, 65, 84, 96);
    c.quadraticCurveTo(57, 83, 16, 39);
    c.quadraticCurveTo(13, 83, 39, 108);
    c.quadraticCurveTo(15, 132, 15, 177);
    c.quadraticCurveTo(52, 137, 84, 120);
    c.quadraticCurveTo(116, 153, 179, 163);
    c.bezierCurveTo(233, 174, 300, 169, 327, 108);
    c.closePath();
    fillStroke(c, bodyGrad(c, 15, 38, 315, 140, '#a7f5f2', '#317fa9'), INK, 7);
    for (const y of [69, 147]) {
      c.beginPath();
      c.moveTo(157, y + (108 - y) / 2);
      c.quadraticCurveTo(203, y - 5, 249, y);
      line(c, '#a7eff3', 5);
    }
    c.beginPath();
    c.moveTo(237, 98);
    c.quadraticCurveTo(212, 77, 152, 68);
    c.quadraticCurveTo(183, 93, 153, 134);
    c.quadraticCurveTo(213, 130, 237, 98);
    c.closePath();
    fillStroke(c, bodyGrad(c, 153, 68, 84, 66, '#70dcec', '#3a6898'), INK, 6);
    c.beginPath();
    c.moveTo(182, 81);
    c.quadraticCurveTo(204, 86, 221, 98);
    line(c, '#a7f4f6', 4);
  });
  bake(scene, head, 184, 144, c => {
    c.beginPath();
    c.moveTo(8, 21);
    c.bezierCurveTo(61, 2, 106, 10, 140, 30);
    c.bezierCurveTo(162, 44, 178, 59, 179, 72);
    c.bezierCurveTo(178, 85, 162, 100, 140, 114);
    c.bezierCurveTo(106, 134, 61, 142, 8, 123);
    c.bezierCurveTo(38, 105, 38, 39, 8, 21);
    c.closePath();
    fillStroke(c, bodyGrad(c, 8, 12, 171, 122, '#b0eff5', '#4da0c1'), INK, 6);
    c.beginPath();
    c.moveTo(134, 33);
    c.quadraticCurveTo(172, 50, 176, 72);
    c.quadraticCurveTo(172, 94, 134, 111);
    c.quadraticCurveTo(150, 72, 134, 33);
    c.closePath();
    fillStroke(c, '#d3f7f4', null);
    c.beginPath();
    c.moveTo(144, 53);
    c.quadraticCurveTo(166, 72, 144, 91);
    line(c, '#22527b', 5);
    for (const y of [30, 114]) {
      oval(c, 86, y, 20, 14, '#f9ffff', 3.4);
      // Pupil centres match the twin-beam origins at +45, +/-42 from the head pivot.
      oval(c, 91, y, 9, 10, '#235480');
      oval(c, 93, y, 5.2, 6.4, INK);
      oval(c, 94, y - 3, 2.7, 2.7, '#ffffff');
      oval(c, 124, y + (72 - y) * 0.13, 8, 4, '#f18bb9');
    }
    for (const x of [53, 63, 73]) {
      for (const sign of [-1, 1]) {
        c.beginPath();
        c.moveTo(x - 4, 72 + sign * 42);
        c.quadraticCurveTo(x + 3, 72 + sign * 34, x, 72 + sign * 26);
        line(c, '#367294', 3);
      }
    }
  });
  bake(scene, beam, 64, 64, c => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, '#38bef000'], [0.26, '#38bef0a0'],
      [0.43, '#7ff5fa'], [0.5, '#efffff'], [0.57, '#7ff5fa'], [0.74, '#38bef0a0'], [1, '#38bef000']]);
    c.fillRect(0, 0, 64, 64);
  });
  bake(scene, glow, 128, 128, c => {
    c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#ffffff'], [0.26, '#7ff5fa'],
      [0.55, '#38bef078'], [1, '#38bef000']]);
    c.fillRect(0, 0, 128, 128);
  });
}
