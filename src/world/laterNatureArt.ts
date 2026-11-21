import { bodyGrad, ellipse, fillStroke, hash, poly, radial, rr, star, type Ctx } from '../art/draw';
import type { QueuedMap } from '../config/queuedMaps';

type Point = readonly [number, number];
type Outline = readonly Point[];
type NatureMap = 'brickworks' | 'mushroom' | 'tundra' | 'volcano';
type Paint = string | CanvasGradient;

const INK = '#282732';
const GOLD = '#ffdc75';
const SNOW = '#f3fcf4';
const BASALT = '#4d3e4d';
const EMBER = '#ff8046';

function disk(c: Ctx, x: number, y: number, rx: number, ry: number, fill: Paint, edge: string | null = INK): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, fill, edge, 2);
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: Paint, r = 4, edge: string | null = INK): void {
  rr(c, x, y, w, h, r);
  fillStroke(c, fill, edge, 2);
}

function face(c: Ctx, points: Outline, fill: Paint, edge: string | null = INK): void {
  poly(c, points.flatMap(([x, y]) => [x, y]));
  fillStroke(c, fill, edge, 2);
}

function stroke(c: Ctx, points: Outline, color: string, width = 2): void {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = width;
  c.stroke();
}

function octagon(x: number, y: number, w: number, h: number, k: number): Outline {
  return [[x + k, y], [x + w - k, y], [x + w, y + k], [x + w, y + h - k],
    [x + w - k, y + h], [x + k, y + h], [x, y + h - k], [x, y + k]];
}

function ovalOutline(x: number, y: number, rx: number, ry: number): Outline {
  return Array.from({ length: 20 }, (_, i) => {
    const angle = i * Math.PI / 10;
    return [x + rx * Math.cos(angle), y + ry * Math.sin(angle)] as const;
  });
}

const ROUNDED = ovalOutline(100, 80, 85, 62);
const QUARRY = octagon(12, 21, 176, 118, 9);
const KILN = octagon(19, 13, 162, 134, 26);
const CLUSTER = octagon(9, 18, 182, 124, 29);
const LODGE = octagon(15, 23, 170, 114, 12);
const DEPOT = octagon(12, 18, 176, 124, 6);
const CALDERA: Outline = [[49, 18], [130, 12], [171, 34], [188, 69], [177, 124], [123, 145], [55, 143], [14, 112], [12, 63]];

export function laterNatureFootprint(map: QueuedMap, style: number): Outline {
  switch (map) {
    case 'brickworks': return style === 6 || style === 9 ? KILN : QUARRY;
    case 'mushroom': return style === 0 || style === 2 || style === 5 || style === 9 ? ROUNDED : CLUSTER;
    case 'tundra': return style === 1 || style === 5 || style === 7 ? ROUNDED : LODGE;
    case 'volcano': return style === 1 || style === 3 || style === 8 || style === 9 ? CALDERA : DEPOT;
    default: return QUARRY;
  }
}

function screw(c: Ctx, x: number, y: number, r = 3): void {
  disk(c, x, y, r, r, '#bfd2ce', '#3d4650');
  stroke(c, [[x - r / 2, y + r / 2], [x + r / 2, y - r / 2]], '#51616b', 1);
}

function studs(c: Ctx, x: number, y: number, nx: number, ny: number, spacing: number, radius = 6): void {
  for (let row = 0; row < ny; row++) for (let col = 0; col < nx; col++) {
    const sx = x + col * spacing, sy = y + row * spacing;
    disk(c, sx, sy, radius, radius, '#ffffff37', '#2d292a6e');
    disk(c, sx + 0.5, sy + 0.5, radius - 2, radius - 2, '#0b172a26', null);
    stroke(c, [[sx - 2, sy - radius + 2], [sx + 2, sy - radius + 2]], '#fff8b6a6', 1.5);
  }
}

function girder(c: Ctx, x: number, y: number, length: number, color: string): void {
  rect(c, x, y, length, 18, color, 2);
  for (let step = 4; step < length - 8; step += 14) {
    stroke(c, [[x + step, y + 14], [x + step + 7, y + 4], [x + step + 14, y + 14]], '#453c3e', 2);
  }
}

function stack(c: Ctx, x: number, y: number, r: number, color: string, center = '#3a3239'): void {
  disk(c, x, y, r, r, color);
  disk(c, x, y, r * 0.7, r * 0.7, '#d6ae92', null);
  disk(c, x, y, r * 0.51, r * 0.51, center, '#32242b');
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) screw(c, x + dx * r * 0.83, y + dy * r * 0.83, 2);
}

function brickBuilding(c: Ctx, style: number, outline: Outline): void {
  face(c, outline, '#81564a');
  if (outline === KILN) {
    rect(c, 41, 25, 118, 110, '#d28453', 18);
    for (const x of [49, 141]) for (const y of [49, 108]) screw(c, x, y, 4);
    stack(c, 100, 80, 43, style === 9 ? '#db7354' : '#ba5441', '#f68b46');
    disk(c, 100, 80, 13, 13, '#ffc56a', null);
    for (let y = 40; y < 125; y += 15) for (const x of [29, 168]) {
      rect(c, x - 3, y, 7, 10, GOLD, 2);
    }
    return;
  }
  const roof = ['#ce704d', '#549a84', '#e2b650', '#577f9f', '#cf805c', '#b19464', '#b85f4a', '#78a85f', '#a87699'];
  face(c, octagon(20, 29, 160, 102, 7), bodyGrad(c, 20, 29, 160, 102, roof[style % roof.length], '#674752'));
  if (style === 7 || style === 8) {
    for (const y of [47, 82]) girder(c, 29, y, 142, style === 7 ? GOLD : '#d68463');
    rect(c, 83, 66, 34, 43, '#588a85', 4);
    studs(c, 91, 76, 2, 2, 17, 5);
    for (const x of [30, 169]) stack(c, x, 118, 8, '#8b9b92');
    return;
  }
  for (const x of [32, 101]) {
    rect(c, x, 39, 62, 64, roof[(style + (x === 32 ? 0 : 2)) % roof.length], 4);
    if (style === 2 || style === 5) girder(c, x + 4, 55, 54, '#d5a867');
    else studs(c, x + 14, 52, 3, 3, 17);
    for (let dx = 8; dx < 56; dx += 11) rect(c, x + dx, 111, 6, 10, '#fed892', 2);
  }
}

function cap(c: Ctx, x: number, y: number, rx: number, ry: number, light: string, dark: string, seed: number): void {
  disk(c, x, y, rx, ry, bodyGrad(c, x - rx, y - ry, 2 * rx, 2 * ry, light, dark));
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + hash(seed, i) * 0.4;
    const distance = 0.35 + hash(i, seed, 8) * 0.38;
    const dot = (0.08 + hash(i, seed, 9) * 0.12) * Math.min(rx, ry);
    const dx = x + Math.cos(angle) * rx * distance, dy = y + Math.sin(angle) * ry * distance;
    disk(c, dx, dy, dot, dot, '#fff0bc', '#8c4c6c66');
    disk(c, dx - dot * 0.2, dy - dot * 0.2, dot * 0.45, dot * 0.36, '#fffcee', null);
  }
  c.beginPath();
  c.ellipse(x, y, rx * 0.86, ry * 0.86, 0, 3.6, 5);
  c.strokeStyle = '#ffe0bd88';
  c.lineWidth = 2;
  c.stroke();
}

function lamp(c: Ctx, x: number, y: number, color = GOLD, r = 7): void {
  disk(c, x, y, r * 2.2, r * 2.2, radial(c, x, y, 0, r * 2.2, [[0, color], [1, '#fff4b000']]), null);
  disk(c, x, y, r, r, '#634a52');
  disk(c, x, y, r * 0.65, r * 0.65, color, null);
  disk(c, x - r / 4, y - r / 4, r * 0.24, r * 0.24, '#fffaf0', null);
}

const CAP_COLORS = ['#f08876', '#dea257', '#b989d8', '#ce6593', '#92ba79', '#fbaf8a'];

function mushroomBuilding(c: Ctx, style: number, outline: Outline): void {
  face(c, outline, outline === ROUNDED ? '#73516c' : '#85625d');
  if (outline === ROUNDED) {
    cap(c, 100, 80, 83, 60, CAP_COLORS[style % 6], '#803c73', style);
    if (style === 9 || style === 2) {
      disk(c, 100, 80, 28, 28, '#644968');
      disk(c, 100, 80, 21, 21, bodyGrad(c, 79, 59, 42, 42, '#c2f0d7', '#498e9c'), '#fadcaa');
      for (const [x, y] of [[100, 60], [80, 80], [120, 80], [100, 100]]) screw(c, x, y, 2);
      stroke(c, [[92, 65], [86, 76], [89, 84]], '#e6f8c9', 3);
    }
    return;
  }
  if (style === 4 || style === 8) {
    for (let x = 30; x < 171; x += 8) stroke(c, [[x, 48], [x, 112]], '#cda98755', 2);
    for (const x of [54, 100, 146]) {
      cap(c, x, 80, 33, 45, CAP_COLORS[(style + x) % 6], '#79537e', x);
      lamp(c, x, 124, GOLD, 6);
    }
    return;
  }
  cap(c, 56, 68, 32, 34, CAP_COLORS[(style + 1) % 6], '#6f4768', 4);
  cap(c, 147, 81, 33, 40, CAP_COLORS[(style + 3) % 6], '#6f4768', 9);
  cap(c, 100, 84, 47, 52, CAP_COLORS[style % 6], '#944d73', 8);
  for (const x of [42, 158]) lamp(c, x, 120, '#99edc2', 6);
}

function iceGem(c: Ctx, x: number, y: number, w: number, h: number, lit = '#a7f0f4', shadow = '#447da5'): void {
  face(c, [[x, y - h], [x + w, y - h / 3], [x + w * 0.73, y + h * 0.76],
    [x - w * 0.67, y + h], [x - w, y - h / 4]], shadow);
  face(c, [[x, y - h], [x + w, y - h / 3], [x - w / 4, y + h * 0.48], [x - w, y - h / 4]], lit, null);
  face(c, [[x, y - h], [x - w / 4, y + h * 0.48], [x - w, y - h / 4]], '#ffffff61', null);
  stroke(c, [[x - w * 0.7, y - h / 4], [x, y - h * 0.75]], '#fffdfa94', 1.5);
}

function tundraBuilding(c: Ctx, style: number, outline: Outline): void {
  face(c, outline, '#557993');
  if (outline === ROUNDED) {
    disk(c, 100, 80, 82, 59, bodyGrad(c, 18, 19, 164, 120, SNOW, '#7db5cd'), '#50728f');
    for (const y of [39, 57, 80, 103, 121]) {
      const width = 79 * Math.sqrt(1 - ((y - 80) / 60) ** 2);
      stroke(c, [[100 - width, y], [100, y + 4], [100 + width, y]], '#4b87a678', 2);
      for (let x = (y % 2 ? 11 : 20); x < width - 5; x += 23) {
        for (const sign of [-1, 1]) stroke(c, [[100 + x * sign, y - 12], [100 + x * sign, y + 2]], '#4b87a678', 2);
      }
    }
    disk(c, 100, 80, 21, 20, '#7395a2');
    disk(c, 100, 80, 16, 15, style === 7 ? '#f2cf83' : '#48748c', '#eff5ef');
    stroke(c, [[90, 80], [100, 72], [110, 80], [100, 88], [90, 80]], '#eaf5e9', 2);
    return;
  }
  const ridge = style === 3 || style === 8 || style === 9 ? 101 : 76;
  const roof = ['#a96a63', '#78aeb8', '#8f82a1', '#5d8398', '#bc815a', '#a77c89', '#597981', '#d38c69', '#717ba0', '#90566b'][style % 10];
  rect(c, 22, 30, 156, 100, roof, 6);
  for (const offset of [0, 1]) {
    const y = offset ? 124 : 35;
    face(c, [[26, y], [174, y], [173, ridge], [28, ridge]], offset ? '#adced7' : SNOW, null);
    for (let x = 37; x < 174; x += 15) stroke(c, [[x, y], [x, ridge]], '#5d8f9d51', 2);
  }
  stroke(c, [[26, ridge], [173, ridge]], roof, 8);
  if (style === 9 || style === 6) {
    rect(c, 78, 44, 47, 70, roof, 8);
    rect(c, 83, 49, 37, 60, '#3f6278', 6);
    for (let y = 57; y < 107; y += 12) stroke(c, [[88, y], [115, y]], '#dbf6e8', 2);
  } else {
    stack(c, 141, 54, 12, '#a97468');
    for (const x of [46, 78, 111, 143]) rect(c, x - 9, 110, 18, 10, '#ffdb88', 3);
  }
}

function lava(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  disk(c, x, y, rx, ry, bodyGrad(c, x - rx, y - ry, rx * 2, ry * 2, '#ffdc65', '#e6413a'), '#391e28');
  for (const [dx, dy, sc] of [[-0.4, -0.04, 0.23], [0.29, 0.3, 0.15], [0.22, -0.34, 0.28]]) {
    disk(c, x + dx * rx, y + dy * ry, rx * sc, ry * sc, '#ffe684', '#dc543a');
  }
}

function volcanoBuilding(c: Ctx, style: number, outline: Outline): void {
  face(c, outline, '#453642');
  if (outline === CALDERA) {
    for (let i = 0; i < outline.length; i++) {
      const first = outline[i], next = outline[(i + 1) % outline.length];
      const color = ['#7b595a', '#996769', '#563f53', '#604453'][i % 4];
      face(c, [first, next, [100 + (next[0] - 100) * 0.56, 76 + (next[1] - 76) * 0.56],
        [100 + (first[0] - 100) * 0.56, 76 + (first[1] - 76) * 0.56]], color, null);
    }
    lava(c, 100, 77, style === 9 ? 49 : 41, style === 9 ? 34 : 29);
    for (const [x, y, mx, my, bx, by] of [[78, 98, 69, 116, 46, 123], [141, 79, 157, 82, 171, 96], [121, 55, 129, 40, 148, 32]]) {
      stroke(c, [[x, y], [mx, my], [bx, by]], '#b3393b', 7);
      stroke(c, [[x, y], [mx, my], [bx, by]], '#ff9f50', 3);
    }
    return;
  }
  face(c, octagon(18, 24, 164, 112, 6), bodyGrad(c, 18, 24, 164, 112, '#947274', '#493949'));
  if (style === 6 || style === 7) {
    for (const x of [61, 139]) {
      stack(c, x, 75, 32, '#ae695d', '#6d342e');
      lava(c, x, 75, 16, 16);
    }
    girder(c, 42, 110, 115, '#ba7952');
    return;
  }
  for (const y of [43, 116]) {
    for (let x = 27; x < 165; x += 15) {
      face(c, [[x, y], [x + 9, y], [x + 17, y + 10], [x + 8, y + 10]], '#f1ac5e', null);
    }
  }
  rect(c, 31, 62, 138, 45, '#342c39', 7);
  for (let x = 39; x < 160; x += 14) {
    rect(c, x, 68, 9, 33, '#625468', 1);
    stroke(c, [[x + 2, 73], [x + 2, 94]], '#e09b6c', 1.5);
  }
  for (const x of [35, 165]) stack(c, x, 53, 12, '#aa7062', '#f58952');
}

type BuildingPainter = (c: Ctx, style: number, outline: Outline) => void;
const BUILDINGS: Record<NatureMap, BuildingPainter> = {
  brickworks: brickBuilding, mushroom: mushroomBuilding, tundra: tundraBuilding, volcano: volcanoBuilding,
};

function isNature(map: QueuedMap): map is NatureMap {
  return Object.hasOwn(BUILDINGS, map);
}

export function laterNatureBuilding(c: Ctx, map: QueuedMap, style: number): void {
  if (isNature(map)) BUILDINGS[map](c, style, laterNatureFootprint(map, style));
}

type PropPainter = (c: Ctx) => void;

function slab(c: Ctx, x: number, y: number, w: number, h: number, color: string, cols: number, rows: number): void {
  rect(c, x, y, w, h, color, 4);
  studs(c, x + 11, y + 11, cols, rows, 16, 5);
}

function caution(c: Ctx, x: number, y: number): void {
  face(c, [[x, y - 15], [x + 16, y + 13], [x - 16, y + 13]], GOLD);
  stroke(c, [[x, y - 6], [x, y + 3]], '#413342', 3);
  disk(c, x, y + 8, 1.6, 1.6, '#413342', null);
}

function pine(c: Ctx, x: number, y: number, r: number): void {
  for (let i = 0; i < 3; i++) {
    const size = r * (1 - i * 0.23);
    star(c, x - i * 1.5, y - i * 2, size, size * 0.68, 8);
    fillStroke(c, ['#365b60', '#5e8c89', SNOW][i], '#335863', 1.5);
  }
}

function log(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x, y, w, h, '#976951', 5);
  stroke(c, [[x + 4, y + h / 2], [x + w - 6, y + h / 2]], '#d0a578', 2);
  for (const cx of [x + 5, x + w - 5]) disk(c, cx, y + h / 2, 4, h * 0.32, '#efc88f', '#694f4e');
}

function flowers(c: Ctx, x: number, y: number, r: number, color: string): void {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    disk(c, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.69, r * 0.69, color, '#655070');
  }
  disk(c, x, y, r * 0.57, r * 0.57, GOLD, '#624663');
}

function lily(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, r, 0.51, Math.PI * 2 - 0.08);
  c.closePath();
  fillStroke(c, color, '#2f5a63', 2);
  stroke(c, [[x - r * 0.76, y], [x - r * 0.21, y + r * 0.19], [x, y]], '#c0dfba', 1.5);
}

function cairn(c: Ctx, x: number, y: number, r: number, color: string): void {
  const outline = octagon(x - r, y - r * 0.75, r * 2, r * 1.5, r * 0.51);
  face(c, outline, color);
  face(c, [outline[0], outline[1], [x + r * 0.28, y], outline[5], outline[7]],
    '#e9a79b49', null);
}

function placard(c: Ctx, color: string): void {
  rect(c, 27, 28, 46, 43, '#56434a', 7);
  rect(c, 31, 32, 38, 35, color, 6);
  caution(c, 50, 49);
}

const BRICK_PROPS: readonly PropPainter[] = [
  c => { slab(c, 14, 36, 72, 30, '#d47450', 4, 1); slab(c, 26, 22, 43, 30, '#edb54f', 2, 1); },
  c => { for (const x of [32, 67]) stack(c, x, 50, 15, '#ad6f60', '#da9d79'); },
  c => {
    rect(c, 16, 30, 68, 40, '#5e5f60', 8);
    girder(c, 20, 40, 60, GOLD);
    for (const x of [23, 77]) for (const y of [34, 66]) screw(c, x, y);
  },
  c => {
    rect(c, 20, 20, 60, 60, '#666362', 8);
    disk(c, 50, 50, 25, 25, '#ad754f');
    for (let i = 0; i < 5; i++) {
      c.save(); c.translate(50, 50); c.rotate(i * Math.PI * 0.4);
      face(c, [[0, 0], [20, -7], [20, 5], [11, 10]], '#d6a679');
      c.restore();
    }
    screw(c, 50, 50, 5);
  },
  c => placard(c, '#e2a566'),
  c => {
    for (const [x, y] of [[30, 57], [61, 59], [53, 31]]) {
      slab(c, x - 13, y - 13, 27, 27, '#ad765a', 1, 1);
      stroke(c, [[x - 8, y - 9], [x + 8, y + 8]], '#f1bc85', 2);
    }
  },
  c => {
    rect(c, 17, 28, 66, 43, '#b08b61', 4);
    for (let x = 25; x < 77; x += 10) stroke(c, [[x, 31], [x, 68]], '#624b45', 3);
    for (const y of [38, 60]) rect(c, 18, y, 64, 5, '#deb884', 1);
  },
  c => {
    disk(c, 50, 50, 30, 30, '#674a4a');
    disk(c, 50, 50, 22, 22, '#af764e');
    disk(c, 50, 50, 9, 9, '#4c3f48');
    for (const [x, y] of [[50, 31], [69, 50], [50, 69], [31, 50]]) screw(c, x, y);
  },
  c => {
    for (const [x, y] of [[28, 49], [48, 32], [69, 47], [49, 66]]) {
      slab(c, x - 12, y - 12, 24, 24, '#77a464', 1, 1);
      rect(c, x - 7, y - 7, 14, 14, '#a9c773', 2, null);
    }
  },
  c => { rect(c, 22, 25, 56, 50, '#525b5e', 7); lamp(c, 50, 50, '#ffb15f', 15); },
  c => {
    rect(c, 17, 33, 66, 39, '#b97961', 5);
    rect(c, 23, 39, 54, 27, '#3c4343', 5);
    for (const [x, y] of [[36, 49], [53, 47], [64, 56], [45, 59]]) cairn(c, x, y, 9, '#de9870');
  },
  c => {
    rect(c, 15, 39, 70, 22, '#b99462', 4);
    for (const x of [26, 49, 72]) {
      disk(c, x, 50, 10, 10, GOLD);
      disk(c, x, 50, 4, 4, '#383943');
    }
  },
];

const MUSHROOM_PROPS: readonly PropPainter[] = [
  c => cap(c, 50, 50, 30, 28, '#ef7c71', '#a34769', 2),
  c => {
    cap(c, 31, 58, 17, 16, '#f8b66d', '#a55b65', 6);
    cap(c, 66, 57, 17, 17, '#ce9bd3', '#885c98', 9);
    cap(c, 50, 34, 22, 21, '#de739a', '#a74771', 3);
  },
  c => { lily(c, 50, 50, 29, '#8cbd7d'); flowers(c, 41, 43, 7, '#e587b1'); },
  c => { for (const [x, y, r] of [[32, 57, 10], [62, 59, 9], [51, 35, 15]]) lamp(c, x, y, '#baf098', r); },
  c => {
    for (const [x, y, r] of [[31, 54, 8], [56, 36, 9], [65, 63, 8]]) flowers(c, x, y, r, '#b79ad4');
  },
  c => {
    for (const [x, y, r] of [[28, 52, 12], [59, 65, 16], [60, 34, 14]]) {
      lily(c, x, y, r, '#6cac8b'); disk(c, x - 5, y + 4, 3, 2, '#dbfaf2', null);
    }
  },
  c => {
    cairn(c, 32, 51, 15, '#9b819d'); cairn(c, 65, 57, 15, '#97779a');
    iceGem(c, 51, 43, 16, 23, '#bce8bc', '#519486');
  },
  c => {
    disk(c, 50, 50, 26, 25, '#71878e');
    disk(c, 50, 50, 20, 19, '#3a8d9a');
    disk(c, 50, 50, 14, 13, '#61c4ba');
    lamp(c, 50, 50, '#c6f3c7', 6);
  },
  c => {
    rect(c, 26, 26, 48, 48, '#a3846d', 8);
    for (const x of [36, 50, 64]) stroke(c, [[x, 28], [x, 72]], '#d1b190', 2);
    for (const [x, y] of [[36, 36], [64, 36], [36, 64], [64, 64]]) lamp(c, x, y, GOLD, 5);
  },
  c => {
    for (const [x, y] of [[37, 36], [60, 36], [50, 56]]) {
      face(c, [[x, y + 16], [x - 10, y + 1], [x, y - 12], [x + 10, y - 1]], '#6cac87');
      stroke(c, [[x, y - 7], [x, y + 8]], '#badc9f');
    }
  },
  c => {
    log(c, 19, 36, 63, 31);
    cap(c, 32, 39, 13, 12, '#f1ac6d', '#ac6663', 15);
    cap(c, 64, 56, 17, 14, '#d09bce', '#795f99', 14);
  },
  c => {
    for (const [x, y] of [[35, 43], [63, 59]]) {
      disk(c, x, y, 16, 14, '#c79c83');
      disk(c, x, y, 11, 9, '#e6bd9d');
      disk(c, x, y, 5, 4, '#b98c79');
    }
  },
];

function snowball(c: Ctx, x: number, y: number, radius: number): void {
  disk(c, x, y, radius, radius, bodyGrad(c, x - radius, y - radius, radius * 2, radius * 2, SNOW, '#91bfd0'), '#60899b');
}

const TUNDRA_PROPS: readonly PropPainter[] = [
  c => pine(c, 50, 50, 32),
  c => { pine(c, 29, 58, 17); pine(c, 64, 61, 18); pine(c, 53, 39, 23); },
  c => { iceGem(c, 35, 55, 13, 17); iceGem(c, 63, 44, 20, 27); },
  c => {
    for (const [x, y, r] of [[29, 57, 12], [54, 61, 18], [65, 36, 13], [42, 40, 10]]) snowball(c, x, y, r);
  },
  c => {
    for (const [x, y] of [[23, 29], [31, 43], [42, 43], [50, 56], [62, 57], [72, 70]]) {
      disk(c, x, y, 4.5, 6, '#608da274', null);
    }
  },
  c => {
    for (const y of [37, 50, 63]) log(c, 19, y - 6, 62, 13);
    stroke(c, [[33, 32], [33, 67]], '#7292a1', 3);
    stroke(c, [[67, 32], [67, 67]], '#7292a1', 3);
  },
  c => {
    for (const y of [38, 63]) stroke(c, [[22, y], [70, y], [81, y - 4]], '#5f483e', 5);
    rect(c, 26, 31, 48, 38, '#bc6857', 6);
    for (let y = 37; y < 66; y += 8) stroke(c, [[31, y], [69, y]], '#e0a075', 2);
  },
  c => {
    rect(c, 29, 29, 42, 42, '#6b9cb8', 9);
    iceGem(c, 50, 50, 12, 15, '#ffc479', '#aa7a62');
    for (const [x, y] of [[33, 33], [67, 33], [33, 67], [67, 67]]) screw(c, x, y);
  },
  c => {
    snowball(c, 49, 54, 24);
    snowball(c, 49, 47, 15);
    disk(c, 49, 44, 9, 9, '#365665');
    disk(c, 49, 44, 6, 6, '#4e7f91');
    rect(c, 59, 40, 12, 13, '#d27860', 3);
  },
  c => {
    disk(c, 50, 50, 31, 28, '#cfdfda');
    iceGem(c, 49, 50, 26, 23);
    stroke(c, [[31, 46], [53, 57], [66, 50]], '#d7f9f5', 2);
  },
  c => {
    rect(c, 19, 34, 62, 33, '#557083', 5);
    rect(c, 24, 38, 53, 24, '#f0ad69', 5);
    for (const x of [34, 54]) face(c, [[x, 42], [x + 11, 50], [x, 58], [x + 5, 50]], '#644957', null);
  },
  c => {
    snowball(c, 50, 50, 29);
    for (const [x, y] of [[39, 37], [58, 34], [61, 57], [41, 61]]) {
      cairn(c, x, y, 8, '#666c86');
    }
  },
];

const VOLCANO_PROPS: readonly PropPainter[] = [
  c => { cairn(c, 50, 50, 30, BASALT); lava(c, 50, 49, 19, 14); },
  c => {
    for (const [x, y, s] of [[32, 56, 13], [68, 55, 14], [52, 32, 18]]) {
      iceGem(c, x, y, s, s + 3, '#b087a0', '#544158');
    }
  },
  c => {
    for (const [x, y, s] of [[32, 47, 12], [57, 32, 10], [63, 60, 17]]) cairn(c, x, y, s, '#835f65');
  },
  c => {
    rect(c, 23, 23, 54, 54, '#634e59', 6);
    for (let y = 31; y < 73; y += 8) stroke(c, [[29, y], [71, y]], '#bca090', 2);
    for (const x of [29, 71]) stroke(c, [[x, 29], [x, 71]], '#473543', 3);
  },
  c => placard(c, '#b47763'),
  c => {
    for (const [x, y, r] of [[34, 50, 18], [63, 56, 20], [57, 35, 10]]) {
      disk(c, x, y, r, r * 0.68, '#815d65');
      disk(c, x - 2, y - 2, r * 0.58, r * 0.31, '#a47a76', null);
    }
  },
  c => {
    stack(c, 50, 50, 25, '#aa7268', '#542e3d');
    lamp(c, 50, 50, '#ffb150', 9);
  },
  c => {
    cairn(c, 50, 50, 32, '#372e3e');
    stroke(c, [[23, 56], [39, 44], [48, 52], [61, 39], [73, 47]], '#9d3d46', 8);
    stroke(c, [[23, 56], [39, 44], [48, 52], [61, 39], [73, 47]], '#ff9753', 3);
  },
  c => {
    for (const [x, y] of [[35, 40], [65, 60]]) {
      rect(c, x - 14, y - 14, 28, 28, '#a76e55', 6);
      disk(c, x, y, 10, 10, '#d49a69'); screw(c, x, y, 4);
    }
  },
  c => {
    rect(c, 15, 35, 70, 29, '#6e4e4f', 7);
    for (const x of [28, 48, 68]) stack(c, x, 49, 10, '#ae7261', '#f58756');
  },
  c => {
    cairn(c, 50, 50, 31, '#77615f');
    for (const [x, y] of [[34, 48], [52, 40], [60, 58]]) flowers(c, x, y, 5, '#d88273');
  },
  c => {
    for (const y of [35, 50, 65]) rect(c, 24, y - 6, 52, 12, '#4c424e', 3);
    for (const x of [32, 68]) stroke(c, [[x, 28], [x, 71]], '#cf966c', 4);
  },
];

const PROPS: Record<NatureMap, readonly PropPainter[]> = {
  brickworks: BRICK_PROPS, mushroom: MUSHROOM_PROPS, tundra: TUNDRA_PROPS, volcano: VOLCANO_PROPS,
};

export function laterNatureProp(c: Ctx, map: QueuedMap, style: number): void {
  if (!isNature(map)) return;
  disk(c, 50, 52, 34, 32, '#281c3226', null);
  PROPS[map][style % PROPS[map].length](c);
}

function cloud(c: Ctx, color: string, points: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, size] of points) {
    disk(c, x, y, size, size, radial(c, x, y, 0, size, [[0, color], [1, '#ffffff00']]), null);
  }
}

function glints(c: Ctx, positions: readonly (readonly [number, number, number])[], color: string, tips: number): void {
  for (const [x, y, r] of positions) {
    star(c, x, y, r, r * 0.36, tips);
    fillStroke(c, color, null);
  }
}

function moth(c: Ctx): void {
  for (const y of [31, 69]) {
    disk(c, 43, y, 17, 15, '#d99bbc', '#6f5477');
    disk(c, 45, y, 6, 5, '#ffdfa4', null);
  }
  disk(c, 49, 50, 15, 6, '#899b86');
  disk(c, 65, 50, 7, 6, '#a7bf99');
  for (const y of [38, 62]) stroke(c, [[67, 49], [76, y]], '#e5d9ad');
}

function skier(c: Ctx): void {
  for (const y of [32, 68]) {
    stroke(c, [[14, y], [78, y], [87, y - 4]], '#334761', 7);
    stroke(c, [[22, y - 1], [80, y - 1]], '#edb560', 2);
  }
  for (const y of [36, 64]) stroke(c, [[32, y], [47, y], [47, 50]], '#4d5f80', 8);
  rect(c, 41, 36, 29, 28, '#d95e5b', 10);
  disk(c, 66, 50, 12, 13, '#eab76f');
  rect(c, 67, 40, 8, 20, '#35495c', 4);
  for (const y of [25, 75]) stroke(c, [[27, y], [57, 50 + (y - 50) * 0.39]], '#f4f7e8', 2);
}

const MOTION: Record<NatureMap, readonly PropPainter[]> = {
  brickworks: [
    c => cloud(c, '#f3e0bcbe', [[49, 64, 23], [58, 47, 25], [44, 33, 20], [70, 25, 13]]),
    c => cloud(c, '#dcb38dc2', [[18, 62, 16], [38, 58, 21], [56, 50, 25], [72, 42, 20]]),
    c => glints(c, [[23, 57, 6], [52, 44, 13], [81, 65, 7], [67, 25, 6]], '#ffdb84', 4),
  ],
  mushroom: [
    c => { lamp(c, 50, 50, '#e7ffa3', 12); glints(c, [[32, 30, 6], [68, 65, 7]], '#d7ff99ad', 4); },
    c => cloud(c, '#e2ffc0d9', [[30, 56, 16], [56, 39, 21], [74, 60, 13]]),
    moth,
  ],
  tundra: [
    c => {
      cloud(c, '#e2fcffe7', [[19, 61, 17], [37, 56, 27], [59, 45, 29], [78, 37, 21]]);
      for (const y of [39, 52, 66]) stroke(c, [[20, y + 7], [39, y + 4], [78, y - 4]], '#f2fbf6c5', 2.5);
    },
    c => glints(c, [[25, 62, 6], [49, 42, 13], [72, 61, 8], [73, 26, 6]], SNOW, 6),
    skier,
  ],
  volcano: [
    c => cloud(c, '#bca1acb8', [[49, 68, 21], [54, 50, 21], [40, 36, 24], [67, 29, 20]]),
    c => glints(c, [[24, 59, 6], [48, 51, 11], [78, 63, 7], [69, 32, 6], [32, 34, 5]], EMBER, 4),
    c => {
      for (const x of [35, 50, 65]) stroke(c, [[x - 7, 76], [x + 2, 60], [x - 3, 46], [x + 6, 25]], '#ffd19a7d', 3);
    },
  ],
};

export function laterNatureMotion(c: Ctx, map: QueuedMap, style: number): void {
  if (isNature(map)) MOTION[map][style % MOTION[map].length](c);
}
