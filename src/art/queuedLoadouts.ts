import type Phaser from 'phaser';
import { UNLOCK_VEHICLES } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import { bodyGrad, ellipse, fillStroke, glossHighlight, makeCanvas, poly, rr, star, type Ctx } from './draw';

const INK = '#293248';
type VehiclePaint = (c: Ctx, coat: CanvasGradient, accent: string) => void;
type GuidePaint = (c: Ctx) => void;

function box(c: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string | CanvasGradient,
  outline = 2): void {
  rr(c, x, y, w, h, radius);
  fillStroke(c, color, outline ? INK : null, outline);
}

function oval(c: Ctx, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient,
  outline = 0): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, color, outline ? INK : null, outline);
}

function shape(c: Ctx, pts: number[], color: string | CanvasGradient, outline = 2): void {
  poly(c, pts);
  fillStroke(c, color, outline ? INK : null, outline);
}

function stroke(c: Ctx, color: string, width: number): void {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

function line(c: Ctx, pts: number[], color: string, width = 2): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  stroke(c, color, width);
}

function tires(c: Ctx, rear: number, front: number, size = 16): void {
  for (const x of [rear, front]) {
    for (const y of [3, 41]) {
      box(c, x - size / 2, y, size, 8, 2.5, '#2b3243');
      for (const offset of [-4, 0, 4]) box(c, x + offset - 0.5, y + 1, 1, 5.5, 0, '#737c99', 0);
    }
  }
}

function tracks(c: Ctx, x: number, width: number, trim: string): void {
  for (const y of [2, 38]) {
    box(c, x, y, width, 12, 4, '#30394f');
    for (let dx = 4; dx < width - 4; dx += 8) box(c, x + dx, y + 2, 3, 8, 0, trim, 0);
  }
}

function glass(c: Ctx, x: number, y: number, w: number, h: number, radius: number): void {
  box(c, x, y, w, h, radius, bodyGrad(c, x, y, w, h, '#baf8fa', '#3b5b83'), 1.8);
  glossHighlight(c, x + w * 0.47, y + 3, w * 0.26, 1.6, 0.63);
}

function lights(c: Ctx, x = 91, r = 3.5, color = '#fff2a7'): void {
  for (const y of [16, 36]) oval(c, x, y, r, r * 0.7, color, 1.1);
}

function stud(c: Ctx, x: number, y: number, trim: string, r = 4): void {
  oval(c, x, y + 1, r, r * 0.73, '#233051', 1);
  oval(c, x, y, r, r * 0.6, trim, 1.1);
  line(c, [x - r * 0.3, y - 1, x + r * 0.25, y - 1], '#ffffff88', 0.8);
}

function snow(c: Ctx, x: number, y: number, radius: number, color: string): void {
  for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
    line(c, [x - dx, y - dy, x + dx, y + dy], color, 1.7);
  }
}

function blossom(c: Ctx, x: number, y: number, scale: number, color: string): void {
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    oval(c, x + 3 * scale * Math.cos(angle), y + 3 * scale * Math.sin(angle), 2.3 * scale, 2.3 * scale, color);
  }
  oval(c, x, y, 2 * scale, 2 * scale, '#e7a673');
}

const VEHICLES = {
  brickBuggy(c, coat, accent) {
    tires(c, 20, 76, 20);
    shape(c, [6, 12, 37, 12, 37, 7, 81, 7, 81, 11, 96, 11, 96, 41, 81, 41, 81, 45, 37, 45, 37, 40, 6, 40], coat);
    box(c, 37, 15, 33, 22, 2, '#30404e');
    box(c, 44, 18, 13, 15, 2, '#9dc8a5');
    glass(c, 64, 15, 9, 22, 2);
    for (const y of [18, 34]) for (const x of [17, 28, 83]) stud(c, x, y, accent, 3.3);
    lights(c, 92, 2.6);
  },
  studCoupe(c, coat, accent) {
    tires(c, 21, 78);
    shape(c, [6, 13, 18, 8, 75, 8, 75, 12, 94, 12, 94, 40, 75, 40, 75, 44, 18, 44, 6, 39], coat);
    glass(c, 31, 15, 43, 22, 4);
    for (const y of [12, 40]) {
      box(c, 22, y - 1, 53, 2, 0, accent, 0);
      stud(c, 15, y + (26 - y) * 0.33, accent, 3.5);
    }
    stud(c, 83, 25, accent, 5.5);
    lights(c);
  },
  quarryTruck(c, coat, accent) {
    tires(c, 18, 83, 19);
    box(c, 4, 8, 92, 36, 4, coat);
    box(c, 8, 12, 46, 28, 2, '#686573');
    for (const x of [18, 35]) {
      box(c, x - 6, 15, 13, 10, 1, '#7f7781');
      box(c, x, 25, 13, 10, 1, '#a99f90');
      stud(c, x + 6, 30, accent, 3.5);
    }
    glass(c, 62, 13, 21, 26, 2);
    for (const y of [11, 39]) box(c, 58, y, 32, 2, 0, accent, 0);
    lights(c);
  },
  toadstoolKart(c, coat, accent) {
    tires(c, 22, 72, 19);
    oval(c, 47, 26, 42, 20, '#dec8a4', 2.4);
    oval(c, 39, 26, 31, 22, coat, 2.4);
    for (const [x, y, r] of [[20, 21, 5], [36, 13, 4], [37, 36, 7], [55, 28, 5]]) oval(c, x, y, r, r * 0.8, accent);
    glass(c, 67, 15, 18, 22, 7);
    for (const y of [16, 36]) oval(c, 84, y, 3, 2, '#fff2a7');
  },
  sporeCoupe(c, coat, accent) {
    tires(c, 20, 76);
    shape(c, [7, 19, 22, 10, 67, 7, 88, 12, 97, 26, 88, 40, 67, 45, 22, 42, 7, 33], coat);
    for (const [x, y, r] of [[18, 24, 5], [27, 16, 3], [28, 34, 4], [73, 13, 3], [75, 39, 3]]) oval(c, x, y, r, r, accent);
    glass(c, 36, 13, 37, 26, 11);
    blossom(c, 85, 26, 1, accent);
    lights(c, 90, 2.7);
  },
  capWagon(c, coat, accent) {
    tires(c, 18, 79, 17);
    box(c, 4, 8, 91, 36, 11, '#eec7a7');
    oval(c, 40, 26, 35, 21, coat, 2.4);
    for (const [x, y, r] of [[18, 19, 5], [23, 35, 4], [39, 24, 8], [50, 12, 3], [57, 36, 5]]) oval(c, x, y, r, r * 0.75, accent);
    glass(c, 73, 12, 13, 28, 6);
    lights(c);
  },
  skiSled(c, coat, accent) {
    tracks(c, 13, 48, '#71879e');
    for (const y of [6, 45]) {
      line(c, [58, y, 86, y, 95, y + (26 - y) * 0.35], INK, 4.7);
      line(c, [58, y, 86, y, 95, y + (26 - y) * 0.35], accent, 2.1);
    }
    shape(c, [5, 15, 32, 13, 58, 14, 83, 21, 89, 26, 83, 31, 58, 38, 32, 39, 5, 37], coat);
    box(c, 27, 18, 32, 16, 4, '#223750');
    glass(c, 53, 17, 14, 18, 4);
    snow(c, 76, 26, 5.4, '#f8ffff');
  },
  iceCoupe(c, coat, accent) {
    tires(c, 23, 77);
    shape(c, [5, 18, 20, 8, 68, 7, 87, 15, 97, 26, 87, 37, 68, 45, 20, 44, 5, 34], coat);
    shape(c, [12, 18, 21, 10, 33, 19, 27, 26, 33, 35, 21, 42, 12, 34], accent, 0);
    shape(c, [35, 15, 65, 11, 77, 26, 65, 41, 35, 37, 29, 26],
      bodyGrad(c, 29, 11, 48, 30, '#e8ffff', '#366da6'));
    line(c, [35, 16, 41, 25, 34, 31], '#d6fcff', 1.8);
    snow(c, 85, 26, 5.5, '#f8ffff');
  },
  glacierCrawler(c, coat, accent) {
    tracks(c, 4, 91, '#a8bdd3');
    box(c, 6, 9, 90, 34, 7, coat);
    box(c, 12, 13, 39, 26, 3, '#c5dfef');
    for (const x of [18, 27, 36, 45]) line(c, [x, 15, x, 37], '#6a859e', 1.6);
    glass(c, 56, 13, 24, 26, 6);
    for (const y of [16, 36]) box(c, 86, y - 3, 10, 6, 1.7, accent, 1.3);
  },
  cinderBuggy(c, coat, accent) {
    tires(c, 17, 77, 21);
    shape(c, [4, 18, 16, 7, 35, 12, 65, 11, 83, 6, 96, 14, 96, 38, 83, 46, 65, 41, 35, 40, 16, 45, 4, 34], coat);
    box(c, 35, 15, 30, 22, 6, '#392c49');
    box(c, 42, 19, 11, 15, 4, '#b96d66');
    glass(c, 61, 14, 8, 24, 3);
    for (const y of [15, 37]) {
      line(c, [9, y, 16, y + 1, 21, y + (26 - y) * 0.53, 30, y], accent, 2.7);
      oval(c, 86, y + (26 - y) / 3, 5, 3.5, '#ffcd6e', 1.6);
    }
  },
  magmaGT(c, coat, accent) {
    tires(c, 22, 79);
    shape(c, [6, 15, 23, 9, 71, 9, 93, 14, 97, 26, 93, 38, 71, 43, 23, 43, 6, 37], coat);
    shape(c, [10, 14, 26, 14, 36, 26, 26, 38, 10, 38, 18, 26], '#702c42', 0);
    glass(c, 37, 15, 34, 22, 8);
    for (const y of [12, 40]) line(c, [15, y, 28, y + (26 - y) * 0.32, 35, y, 73, y, 81, 26, 94, 26], accent, 1.7);
    lights(c, 90);
  },
  basaltHauler(c, coat, accent) {
    tracks(c, 8, 83, '#897993');
    shape(c, [4, 15, 16, 8, 80, 8, 96, 14, 96, 38, 80, 44, 16, 44, 4, 37], coat);
    box(c, 12, 13, 44, 26, 5, '#483750');
    for (const [x, y] of [[22, 20], [32, 30], [43, 19]]) {
      shape(c, [x - 6, y - 2, x - 2, y - 6, x + 6, y - 4, x + 7, y + 3, x + 1, y + 6, x - 6, y + 4], '#755772', 1);
      line(c, [x - 2, y - 3, x, y, x + 4, y], accent, 1.2);
    }
    glass(c, 59, 13, 25, 26, 5);
    lights(c, 91);
  },
  waferKart(c, coat, accent) {
    tires(c, 20, 80, 17);
    box(c, 5, 10, 91, 32, 4, coat);
    box(c, 8, 13, 83, 26, 2, '#e7b578', 1.3);
    for (const x of [12, 18, 24, 30, 70, 76, 82, 88]) line(c, [x, 15, x, 37], '#af7455', 1.1);
    for (const y of [17, 23, 29, 35]) line(c, [10, y, 91, y], '#ad7458', 1.1);
    oval(c, 47, 26, 18, 12, accent, 1.3);
    glass(c, 47, 17, 18, 18, 5);
    lights(c, 89);
  },
  gumdropGT(c, coat, accent) {
    tires(c, 22, 79);
    oval(c, 50, 26, 46, 22, coat, 2.5);
    for (const [x, y] of [[13, 23], [20, 17], [21, 33], [34, 14], [36, 33], [72, 14], [75, 35], [84, 27]]) {
      oval(c, x, y, 1.5, 1.5, '#fff3eb');
    }
    box(c, 7, 16, 12, 20, 5, accent, 1.4);
    glass(c, 38, 13, 36, 26, 12);
    lights(c, 92);
  },
  sundaeVan(c, coat, accent) {
    tires(c, 19, 80, 19);
    box(c, 4, 5, 92, 42, 11, coat);
    for (const y of [10, 40]) line(c, [13, y, 83, y], accent, 3.5);
    oval(c, 38, 26, 27, 15, '#fff2d8', 1.8);
    shape(c, [21, 26, 38, 15, 39, 37], '#d89a5e', 1.2);
    oval(c, 43, 25, 12, 10, '#fe9eb8', 1.4);
    oval(c, 50, 25, 3, 3, '#e15584');
    glass(c, 68, 12, 16, 28, 6);
    lights(c, 92);
  },
  joustKart(c, coat, accent) {
    tires(c, 19, 75, 18);
    shape(c, [5, 13, 32, 8, 54, 13, 74, 12, 97, 20, 97, 32, 74, 40, 54, 39, 32, 44, 5, 39], coat);
    line(c, [8, 16, 56, 16, 87, 22], accent, 2.5);
    line(c, [8, 36, 56, 36, 87, 30], accent, 2.5);
    box(c, 32, 17, 28, 18, 5, '#4e375b');
    glass(c, 57, 16, 12, 20, 4);
    shape(c, [72, 19, 82, 19, 89, 26, 82, 33, 72, 33], accent, 1.2);
    line(c, [77, 21, 77, 31], '#a46349', 1.5);
  },
  heraldCoupe(c, coat, accent) {
    tires(c, 22, 76);
    oval(c, 49, 26, 45, 21, coat, 2.4);
    for (const y of [12, 40]) line(c, [18, y + (26 - y) * 0.32, 38, y, 68, y, 85, y + (26 - y) * 0.38], accent, 2.3);
    glass(c, 32, 15, 39, 22, 10);
    shape(c, [75, 20, 84, 19, 91, 26, 84, 33, 75, 32], '#f9db82', 1.3);
    line(c, [81, 22, 81, 30], '#a56b4a', 1.3);
    line(c, [77, 26, 86, 26], '#a56b4a', 1.3);
  },
  timberCoach(c, coat, accent) {
    tires(c, 17, 81, 19);
    box(c, 4, 9, 92, 34, 5, coat);
    for (const y of [15, 21, 28, 35]) line(c, [7, y, 55, y], '#75495a', 1.2);
    for (const x of [27, 53, 83]) box(c, x - 2, 10, 4, 32, 1.8, accent, 1.4);
    glass(c, 61, 14, 22, 24, 4);
    lights(c);
  },
  runwayRacer(c, coat, accent) {
    tires(c, 24, 77);
    shape(c, [5, 19, 19, 8, 70, 11, 93, 18, 98, 26, 93, 34, 70, 41, 19, 44, 5, 33], coat);
    shape(c, [44, 14, 71, 19, 91, 26, 70, 33, 44, 38, 57, 26], accent, 1.3);
    glass(c, 39, 17, 34, 18, 9);
    for (const y of [15, 37]) for (const x of [13, 23, 33]) box(c, x, y, 5, 2, 0.7, '#ffffff', 0);
  },
  jetBuggy(c, coat, accent) {
    tires(c, 18, 79, 18);
    for (const y of [5, 37]) {
      box(c, 4, y, 28, 10, 4.5, '#768bb0');
      box(c, 8, y + 2, 15, 6, 3, '#a1c2dd', 1.2);
    }
    shape(c, [7, 17, 34, 15, 26, 6, 47, 7, 68, 18, 85, 17, 98, 26, 85, 35, 68, 34, 47, 45, 26, 46, 34, 37, 7, 35], coat);
    for (const y of [13, 39]) line(c, [34, y, 47, y + (26 - y) * 0.12, 60, y + (26 - y) * 0.48], accent, 2.6);
    glass(c, 51, 17, 32, 18, 8);
    oval(c, 91, 26, 3.5, 3.5, '#e9ffff', 1);
  },
  bagTug(c, coat, accent) {
    tires(c, 21, 81, 19);
    box(c, 6, 8, 91, 36, 6, coat);
    box(c, 10, 11, 43, 30, 3, '#617187');
    for (const [x, y, color] of [[13, 15, '#cb6a76'], [32, 14, '#cbd9f1'], [25, 29, '#e3a76f']] as const) {
      box(c, x, y, 15, 10, 2, color, 1.1);
      line(c, [x + 3, y + 1, x + 3, y + 9], '#75456990', 1.2);
    }
    glass(c, 57, 12, 27, 28, 4);
    for (const y of [13, 37]) box(c, 90, y, 6, 3, 1, accent, 0);
  },
  springRacer(c, coat, accent) {
    tires(c, 18, 79, 18);
    shape(c, [4, 15, 18, 8, 40, 9, 49, 15, 79, 10, 95, 17, 97, 26, 95, 35, 79, 42, 49, 37, 40, 43, 18, 44, 4, 37], coat);
    box(c, 10, 17, 34, 18, 6, '#544666');
    line(c, [13, 26, 17, 19, 21, 33, 26, 19, 31, 33, 36, 19, 40, 26], accent, 2.2);
    glass(c, 47, 15, 30, 22, 8);
    lights(c, 90);
  },
  sockBuggy(c, coat, accent) {
    tires(c, 23, 79, 20);
    c.beginPath();
    c.moveTo(6, 15);
    c.quadraticCurveTo(32, 9, 53, 12);
    c.bezierCurveTo(87, 7, 96, 17, 96, 26);
    c.bezierCurveTo(96, 39, 81, 44, 54, 40);
    c.quadraticCurveTo(32, 42, 6, 37);
    c.closePath();
    fillStroke(c, coat, INK, 2.1);
    for (const x of [11, 17, 23]) line(c, [x, 17, x, 35], accent, 2.4);
    box(c, 29, 15, 34, 22, 6, '#5e4665');
    glass(c, 56, 17, 14, 18, 5);
    for (const y of [17, 35]) line(c, [75, y, 85, y + (26 - y) * 0.27, 91, 26], accent, 1.5);
  },
  toyTruck(c, coat, accent) {
    tires(c, 18, 79, 19);
    box(c, 4, 8, 92, 36, 4, coat);
    box(c, 9, 12, 48, 28, 3, '#eec79b');
    for (const [x, y, color] of [[13, 17, '#e57a78'], [33, 17, '#6caad1'], [27, 27, '#8ca863']] as const) {
      box(c, x, y, 15, 9, 1.5, color, 1.1);
      stud(c, x + 7.5, y + 4, accent, 2.4);
    }
    glass(c, 62, 12, 22, 28, 4);
    lights(c);
  },
} satisfies Record<string, VehiclePaint>;

function face(c: Ctx, y: number, cheek: string): void {
  for (const x of [22, 36]) {
    oval(c, x, y, 2.4, 3.4, INK);
    oval(c, x - 0.6, y - 1.25, 0.8, 1, '#ffffff');
    oval(c, x + (x < 29 ? -4 : 4), y + 5, 3.4, 1.7, cheek);
  }
  c.beginPath();
  c.moveTo(25, y + 4);
  c.quadraticCurveTo(29, y + 10, 33, y + 4);
  stroke(c, INK, 1.7);
}

const GUIDES = {
  puffCub(c) {
    box(c, 12, 36, 12, 14, 2, '#519859', 2.4);
    box(c, 34, 36, 12, 14, 2, '#519859', 2.4);
    box(c, 8, 14, 42, 28, 3, '#61b068', 2.5);
    shape(c, [7, 15, 14, 7, 43, 7, 50, 15, 43, 20, 14, 20], '#b2e375', 2.1);
    box(c, 24, 25, 10, 12, 2, '#ffcd58', 1.4);
    for (const x of [16, 42]) box(c, x - 3.5, 24, 7, 7, 1.4, '#ffe7a9', 1.5);
    line(c, [26, 31, 29, 34, 32, 31], '#904f45', 1.3);
    for (const y of [26, 32]) box(c, 4, y, 5, 2, 1, '#d6eea7', 0);
  },
  sporeSprout(c) {
    box(c, 15, 25, 28, 25, 10, '#ffe3b1', 2.3);
    c.beginPath();
    c.moveTo(5, 27);
    c.bezierCurveTo(8, 10, 16, 6, 29, 6);
    c.bezierCurveTo(41, 6, 51, 13, 53, 27);
    c.quadraticCurveTo(30, 34, 5, 27);
    c.closePath();
    fillStroke(c, '#e87fa7', INK, 2.3);
    for (const [x, y, r] of [[18, 17, 3], [29, 12, 4], [40, 20, 5]]) oval(c, x, y, r, r * 0.7, '#fff0cb');
    face(c, 37, '#f6a9b1');
  },
  squareSnowman(c) {
    box(c, 12, 28, 34, 24, 4, '#d8efff', 2.3);
    box(c, 15, 9, 28, 23, 4, '#f3fdff', 2.3);
    box(c, 12, 27, 34, 8, 2, '#a367da', 2);
    box(c, 35, 32, 7, 12, 1, '#a367da', 1.7);
    for (const x of [22, 36]) box(c, x - 1.3, 17, 2.6, 3.7, 0.8, INK, 0);
    shape(c, [27, 21, 36, 22, 29, 25, 26, 23], '#f3a148', 1.2);
    for (const y of [41, 47]) oval(c, 27, y, 1.9, 1.9, '#8660ba');
    snow(c, 48, 14, 5, '#6fc8ed');
  },
  ember(c) {
    shape(c, [11, 38, 11, 27, 17, 21, 18, 30, 23, 23, 29, 5, 36, 19, 46, 24, 50, 38, 43, 47, 29, 52, 15, 47],
      bodyGrad(c, 6, 6, 43, 48, '#ffc36c', '#e45c61'), 2.4);
    oval(c, 29, 37, 15, 11, '#ffe093');
    face(c, 34, '#f59776');
  },
  sugarSprite(c) {
    star(c, 29, 29, 24, 17, 6);
    fillStroke(c, '#f482bb', INK, 2.4);
    oval(c, 29, 29, 16, 15, '#ffcfdb', 1.5);
    for (const [x, y] of [[17, 17], [30, 10], [42, 19], [43, 41], [22, 46]]) line(c, [x - 1, y, x + 2, y + 1], '#fff99e', 2.5);
    face(c, 28, '#ee9abf');
  },
  crownSquire(c) {
    shape(c, [10, 30, 48, 30, 47, 41, 41, 49, 29, 55, 17, 48, 11, 42], '#799bd8', 2.4);
    oval(c, 29, 29, 17, 14, '#ffe1b2', 2.1);
    shape(c, [10, 8, 21, 15, 29, 5, 37, 15, 48, 8, 45, 25, 13, 25], '#f4c56a', 2.4);
    oval(c, 29, 18, 4, 3.6, '#e87890', 1.6);
    face(c, 31, '#efaaad');
  },
  paperPlane(c) {
    shape(c, [5, 31, 53, 8, 39, 49, 28, 39, 23, 49, 19, 36], '#c5dcfa', 2.4);
    shape(c, [5, 31, 53, 8, 27, 29, 39, 49, 53, 8, 19, 36], '#f5faff', 1.9);
    line(c, [19, 36, 27, 29, 53, 8], '#748ab2', 1.8);
    oval(c, 35, 29, 1.8, 2.1, '#5778a8');
    oval(c, 43, 21, 1.8, 2.1, '#5778a8');
    line(c, [39, 28, 41, 27, 42, 24], '#5778a8', 1.4);
  },
  yarnBall(c) {
    c.beginPath();
    c.moveTo(17, 43);
    c.bezierCurveTo(13, 54, 5, 52, 6, 43);
    stroke(c, INK, 4.7);
    stroke(c, '#bf8adc', 2.8);
    oval(c, 30, 28, 21, 21, '#bc89e6', 2.4);
    for (const y of [15, 20, 38, 43]) {
      c.beginPath();
      c.moveTo(16, y);
      c.quadraticCurveTo(33, y - 7, 45, y + 1);
      stroke(c, '#e5bbf6', 2.4);
    }
    face(c, 27, '#f4acdb');
  },
} satisfies Record<string, GuidePaint>;

export function drawQueuedLoadouts(scene: Phaser.Scene): void {
  for (const id of Object.keys(VEHICLES) as (keyof typeof VEHICLES)[]) {
    const { spec, colors: [light, dark, accent] } = UNLOCK_VEHICLES[id];
    const { ctx, done } = makeCanvas(scene, TEX.unlockVehicles[id], spec.length * 2, spec.width * 2);
    ctx.scale(spec.length * 2 / 100, spec.width * 2 / 52);
    VEHICLES[id](ctx, bodyGrad(ctx, 4, 4, 92, 44, light, dark), accent);
    done();
  }
  // GuideBuddy keeps these upright in each player's camera.
  for (const id of Object.keys(GUIDES) as (keyof typeof GUIDES)[]) {
    const { ctx, done } = makeCanvas(scene, TEX.unlockGuides[id], 58, 58);
    GUIDES[id](ctx);
    done();
  }
}
