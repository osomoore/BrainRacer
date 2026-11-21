import { bodyGrad, ellipse, fillStroke, hash, poly, rr, star, type Ctx } from '../art/draw';
import type { QueuedMap } from '../config/queuedMaps';

type Point = readonly [number, number];
type BuiltMap = 'candy' | 'castle' | 'airport' | 'house';
type Paint = (c: Ctx, style: number) => void;

const INK = '#312c40';
const METAL = '#40586b';
const GOLD = '#ffd576';
const CREAM = '#fff0d4';
const SWEETS = ['#ff779a', '#ffc169', '#8bdcb7', '#9eb2ff', '#df8cdb', '#ffed79'] as const;
const CLOTH = ['#d95d7e', '#4ca5ab', '#d49a56', '#8886c9', '#79a66a', '#c5739f'] as const;

function rect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, edge: string | null = INK, width = 2): void {
  rr(c, x, y, w, h, r);
  fillStroke(c, fill, edge, width);
}

function oval(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, edge: string | null = INK, width = 2): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, fill, edge, width);
}

function shape(c: Ctx, fill: string | CanvasGradient, points: number[], edge: string | null = INK, width = 2): void {
  poly(c, points);
  fillStroke(c, fill, edge, width);
}

function path(c: Ctx, color: string, width: number, ...points: number[]): void {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.lineJoin = c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

function arc(c: Ctx, x: number, y: number, r: number, from: number, to: number, color: string, width: number): void {
  c.beginPath();
  c.arc(x, y, r, from, to);
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

function inPlace(c: Ctx, x: number, y: number, angle: number, scale: number, draw: () => void): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(scale, scale);
  draw();
  c.restore();
}

function chromed(c: Ctx, x: number, y: number, w: number, h: number, r = 7): void {
  rect(c, x, y, w, h, r, bodyGrad(c, x, y, w, h, '#effcfc', '#6c97af'), METAL, 2);
}

function markStar(c: Ctx, x: number, y: number, size: number, color = GOLD): void {
  star(c, x, y, size, size * .49);
  fillStroke(c, color, INK, 1.3);
}

function chamfer(x: number, y: number, w: number, h: number, corner: number): readonly Point[] {
  return [[x + corner, y], [x + w - corner, y], [x + w, y + corner], [x + w, y + h - corner],
    [x + w - corner, y + h], [x + corner, y + h], [x, y + h - corner], [x, y + corner]];
}

function roundPlan(x: number, y: number, rx: number, ry: number): readonly Point[] {
  return Array.from({ length: 16 }, (_, i): Point => {
    const angle = i * Math.PI / 8;
    return [x + rx * Math.cos(angle), y + ry * Math.sin(angle)];
  });
}

const CANDY_PLANS = [
  chamfer(14, 25, 172, 110, 14), roundPlan(100, 80, 80, 58), chamfer(10, 30, 180, 100, 21),
  chamfer(23, 20, 154, 120, 12), roundPlan(100, 80, 80, 58), chamfer(12, 28, 176, 104, 24),
  chamfer(12, 26, 176, 108, 14), roundPlan(100, 80, 82, 59), chamfer(12, 23, 176, 114, 16),
  roundPlan(100, 80, 88, 66),
];
const CASTLE_PLANS = [
  roundPlan(100, 80, 70, 63), chamfer(14, 26, 172, 108, 10), chamfer(12, 28, 176, 104, 9),
  chamfer(14, 32, 172, 96, 12), chamfer(15, 22, 170, 116, 12), chamfer(13, 31, 174, 98, 12),
  chamfer(6, 18, 188, 124, 12), chamfer(13, 22, 174, 116, 11), chamfer(16, 25, 168, 110, 14),
  chamfer(6, 10, 188, 140, 14),
];
const AIRPORT_PLANS = [
  chamfer(9, 24, 182, 112, 18), chamfer(13, 31, 174, 98, 10), chamfer(14, 21, 172, 118, 10),
  roundPlan(100, 80, 78, 61), chamfer(11, 24, 178, 112, 10), chamfer(13, 24, 174, 112, 17),
  roundPlan(100, 80, 79, 62), chamfer(10, 24, 180, 112, 13), chamfer(15, 25, 170, 110, 12),
  chamfer(6, 14, 188, 132, 22),
];
const HOUSE_PLANS = [
  chamfer(12, 26, 176, 108, 16), chamfer(20, 18, 160, 124, 13), chamfer(16, 25, 168, 110, 23),
  chamfer(12, 28, 176, 104, 10), chamfer(12, 28, 176, 104, 12), roundPlan(100, 80, 81, 59),
  chamfer(13, 22, 174, 116, 15), chamfer(12, 26, 176, 108, 10), roundPlan(100, 80, 85, 61),
  chamfer(10, 17, 180, 126, 23),
];
const PLANS: Record<BuiltMap, readonly (readonly Point[])[]> = {
  candy: CANDY_PLANS, castle: CASTLE_PLANS, airport: AIRPORT_PLANS, house: HOUSE_PLANS,
};

function isBuiltMap(map: QueuedMap): map is BuiltMap {
  return map === 'candy' || map === 'castle' || map === 'airport' || map === 'house';
}

export function laterBuiltFootprint(map: QueuedMap, style: number): readonly Point[] {
  return isBuiltMap(map) ? (PLANS[map][style] ?? PLANS[map][0]) : [];
}

function candyDisk(c: Ctx, x: number, y: number, r: number, tint: string): void {
  oval(c, x, y, r, r, CREAM, '#7b4262', 2);
  for (let i = 0; i < 7; i++) {
    inPlace(c, x, y, i * Math.PI * 2 / 7, r, () => {
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(.17, -.69, .81, -.53);
      c.arc(0, 0, .97, -.58, -.17);
      c.quadraticCurveTo(.39, -.34, 0, 0);
      c.fillStyle = tint;
      c.fill();
    });
  }
  arc(c, x, y, r - 3, 3.5, 4.8, '#ffffffaa', 2.5);
}

function sprinkles(c: Ctx, x: number, y: number, w: number, h: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const px = x + w * hash(i, 8), py = y + h * hash(i, 9);
    inPlace(c, px, py, hash(i, 10) * Math.PI, 1, () => {
      path(c, '#823f552f', 5, -2, 1, 4, 1);
      path(c, SWEETS[i % SWEETS.length], 3, -3, 0, 3, 0);
    });
  }
}

function gumdrop(c: Ctx, x: number, y: number, r: number, color: string): void {
  oval(c, x, y, r, r, bodyGrad(c, x - r, y - r, r * 2, r * 2, color, '#986492'), '#864977', 1.5);
  arc(c, x, y, r * .65, 3.5, 4.9, '#ffffffb0', Math.max(2, r / 5));
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39, d = r * (.27 + hash(i, 5) * .53);
    oval(c, x + Math.cos(a) * d, y + Math.sin(a) * d, .8, .8, CREAM, null);
  }
}

function candyBuilding(c: Ctx, style: number): void {
  const accent = SWEETS[style % SWEETS.length];
  switch (style) {
    case 1:
    case 4:
      oval(c, 100, 81, 67, 50, style === 1 ? '#a95d37' : '#8b5063', INK, 3);
      oval(c, 100, 76, 66, 42, style === 1 ? '#fbc376' : '#d67e9c', '#854153', 3);
      oval(c, 100, 77, 52, 35, style === 1 ? '#fc94b5' : '#ffdc8a', '#a35769');
      oval(c, 100, 78, 23, 17, '#66394b', '#b4686b', 4);
      sprinkles(c, 57, 49, 86, 12, 32);
      sprinkles(c, 57, 97, 86, 12, 22);
      break;
    case 2:
      rect(c, 22, 41, 156, 77, 15, '#96376b', INK, 3);
      for (let i = 0; i < 6; i++) rect(c, 29 + i * 24, 49, 18, 61, 6, SWEETS[i], '#b75473', 1.5);
      rect(c, 28, 63, 144, 34, 12, '#fff1c4', '#b75473', 2);
      for (const x of [54, 100, 146]) candyDisk(c, x, 80, 14, '#ed5982');
      break;
    case 3:
      rect(c, 37, 36, 126, 86, 12, '#9e573a', '#54333c', 3);
      for (let y = 47; y < 115; y += 22) for (let x = 45; x < 154; x += 24) {
        rect(c, x, y, 16, 13, 3, '#c47a51', '#7d4436', 1);
      }
      path(c, CREAM, 5, 45, 107, 100, 54, 155, 107);
      gumdrop(c, 100, 58, 17, '#65d6a5');
      break;
    case 5:
      rect(c, 25, 38, 150, 84, 18, '#66354b', '#4d2b39', 3);
      for (let y = 44; y < 114; y += 24) for (let x = 34; x < 165; x += 27) {
        rect(c, x, y, 23, 19, 4, '#9f5d59', '#4d263c', 1.5);
        path(c, '#e4a17c', 2, x + 4, y + 5, x + 18, y + 5);
      }
      path(c, '#f5b7d5', 13, 32, 111, 91, 76, 161, 50);
      path(c, CREAM, 2, 36, 108, 93, 75, 158, 51);
      break;
    case 6:
      for (let i = 0; i < 3; i++) {
        const x = 25 + i * 51;
        rect(c, x, 40, 47, 77, 12, '#ffeccf', '#95546b', 2);
        for (let j = 0; j < 8; j++) gumdrop(c, x + 10 + (j % 2) * 19, 67 + Math.floor(j / 2) * 12, 6, SWEETS[(j + i) % 6]);
        rect(c, x + 3, 39, 41, 18, 6, SWEETS[(i * 2 + 4) % 6], '#95546b');
      }
      break;
    case 7:
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        gumdrop(c, 100 + Math.cos(angle) * 44, 80 + Math.sin(angle) * 31, 19, SWEETS[i]);
      }
      oval(c, 100, 80, 26, 22, '#ffcf79', '#9a5a76', 2);
      markStar(c, 100, 80, 17);
      break;
    case 8:
      for (const x of [52, 100, 148]) {
        shape(c, '#d38a4f', [x - 16, 67, x + 16, 67, x, 119], '#8e4a49', 2);
        path(c, '#ffc276', 2, x - 11, 81, x + 7, 94, x - 5, 105);
        oval(c, x, 63, 21, 21, SWEETS[(x + 1) % 6], '#8e4a64', 2.5);
        arc(c, x, 63, 15, 3.4, 5, '#ffffffab', 3);
      }
      break;
    case 9:
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const tint = SWEETS[i % 6];
        gumdrop(c, 100 + 70 * Math.cos(angle), 80 + 47 * Math.sin(angle), 10, tint);
      }
      oval(c, 100, 80, 51, 45, '#e7a25f', '#ae6475', 3);
      path(c, '#ffe3ad', 3, 51, 85, 70, 117, 129, 118, 148, 86);
      candyDisk(c, 100, 73, 43, '#e75588');
      candyDisk(c, 100, 73, 25, '#9396eb');
      gumdrop(c, 100, 73, 9, '#6adab0');
      break;
    default:
      rect(c, 24, 37, 152, 84, 10, '#ca7d50', '#87515e', 3);
      rect(c, 29, 43, 142, 63, 18, '#fff0d0', '#a75f65');
      for (const x of [41, 63, 84, 105, 126, 148]) oval(c, x, 103, 13, 10 + x % 3, CREAM, null);
      sprinkles(c, 38, 48, 123, 47, 53);
      candyDisk(c, 100, 75, 25, accent);
  }
}

function shield(c: Ctx, x: number, y: number, s: number, color: string): void {
  inPlace(c, x, y, 0, s, () => {
    shape(c, color, [-18, -22, 18, -22, 16, 6, 9, 16, 0, 23, -9, 16, -16, 6], '#4d3544', 3);
    path(c, '#ffffff75', 2, -12, -15, 12, -15);
    markStar(c, 0, -1, 11);
  });
}

function tower(c: Ctx, x: number, y: number, r: number, roof: string): void {
  oval(c, x, y, r, r, '#795d62', '#483e4a', 2.5);
  oval(c, x, y, r - 4, r - 4, '#b99483', '#efd1ad', 3);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    inPlace(c, x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3), a, 1, () => {
      rect(c, -4, -4, 8, 8, 1, '#e0c1a3', '#705561', 1.2);
    });
  }
  const crown = r * .63;
  const hex = roundPlan(x, y, crown, crown).filter((_, i) => i % 2 === 0).flat();
  shape(c, roof, hex, '#4a3a4b', 2);
  shape(c, '#ffffff42', [x - crown, y, x - crown * .69, y - crown * .69, x, y - crown, x, y], null);
  oval(c, x, y, 3, 3, GOLD, '#5b424c', 1);
}

function slate(c: Ctx, x: number, y: number, w: number, h: number, roof: string): void {
  rect(c, x, y, w, h, 3, roof, '#55404f', 2.5);
  rect(c, x + 2, y + 2, w - 4, h / 2, 2, '#ffc4ae33', null);
  for (let j = 8; j < h; j += 8) {
    path(c, '#2c2c4655', 1.5, x + 2, y + j, x + w - 2, y + j);
    for (let i = 9 + 5 * ((j / 8) % 2); i < w - 3; i += 13) {
      path(c, '#2c2c4655', 1, x + i, y + j - 5, x + i, y + j);
    }
  }
  path(c, '#ffe5bc9c', 3, x + 3, y + h / 2, x + w - 3, y + h / 2);
}

function castleBuilding(c: Ctx, style: number): void {
  const roof = ['#99536c', '#608575', '#526e8b', '#9b574b', '#76659f'][style % 5];
  switch (style) {
    case 0:
      tower(c, 100, 80, 53, roof);
      for (const [x, y] of [[62, 43], [139, 44], [139, 117], [61, 116]]) tower(c, x, y, 14, roof);
      shield(c, 100, 79, .75, '#9f4b67');
      break;
    case 1:
      slate(c, 37, 42, 126, 75, roof);
      for (const x of [56, 144]) path(c, '#e1c3a2', 6, x - 10, 52, x, 43, x + 10, 52);
      rect(c, 87, 62, 26, 25, 3, '#baa08e', '#513b45');
      break;
    case 2:
      slate(c, 28, 41, 144, 78, roof);
      for (const x of [46, 146]) rect(c, x, 48, 12, 64, 2, '#c2a384', '#654b4e');
      shield(c, 100, 80, .8, '#8d5b6a');
      break;
    case 3:
      for (const x of [27, 94]) slate(c, x, 45, 57, 62, roof);
      rect(c, 109, 70, 51, 42, 6, '#523a3d', '#d8a987', 3);
      oval(c, 135, 93, 18, 11, '#ec9560', '#795153');
      oval(c, 135, 93, 9, 5, GOLD, null);
      break;
    case 4:
      slate(c, 47, 34, 106, 93, roof);
      slate(c, 28, 65, 144, 40, '#546681');
      tower(c, 100, 80, 23, '#91739b');
      break;
    case 5:
      rect(c, 30, 45, 140, 70, 8, '#95836d', INK);
      for (const x of [57, 84, 113, 142]) rect(c, x - 9, 51, 18, 53, 2, '#e1c191', '#8f7368', 1.5);
      slate(c, 46, 56, 108, 43, roof);
      break;
    case 6:
      rect(c, 28, 47, 144, 65, 10, '#5e5061', '#58444d', 3);
      for (const x of [33, 167]) tower(c, x, 80, 24, '#7e5966');
      rect(c, 62, 47, 76, 65, 6, '#564350', '#d3b698', 4);
      for (let x = 69; x < 135; x += 10) path(c, '#b7a18c', 4, x, 52, x, 108);
      break;
    case 7:
      slate(c, 36, 43, 128, 78, roof);
      tower(c, 102, 77, 36, '#9a738d');
      path(c, '#f3cba3', 4, 92, 82, 112, 82);
      path(c, '#f3cba3', 4, 102, 70, 102, 92);
      break;
    case 8:
      rect(c, 36, 39, 128, 80, 12, '#6f9a67', '#5c5360', 3);
      path(c, '#e8ceac', 8, 44, 79, 155, 79);
      path(c, '#e8ceac', 8, 101, 46, 101, 111);
      oval(c, 101, 79, 23, 23, '#dabc9a', '#826975', 2);
      oval(c, 101, 79, 17, 17, '#69b7bd', '#e9d7bb', 2);
      markStar(c, 101, 79, 12, '#c7f3e9');
      break;
    default:
      rect(c, 34, 29, 132, 102, 9, '#776576', '#594957', 3);
      rect(c, 42, 37, 116, 86, 7, '#bb9b85', '#e5c4a1', 3);
      for (const x of [37, 163]) for (const y of [38, 122]) tower(c, x, y, 26, '#9e4d69');
      slate(c, 68, 50, 64, 58, '#526c91');
      tower(c, 100, 79, 22, '#88608c');
      shield(c, 100, 79, .53, '#a95164');
  }
}

function glass(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x, y, w, h, 8, bodyGrad(c, x, y, w, h, '#b7f5e7', '#447c9b'), METAL, 2.5);
  for (let i = x + 12; i < x + w - 4; i += 15) path(c, '#d8fff1aa', 1.5, i, y + 3, i, y + h - 3);
  path(c, '#effcfab0', 2, x + 9, y + 6, x + w - 9, y + 6);
}

function jet(c: Ctx, color: string): void {
  shape(c, color, [-42, -3, -28, -6, -22, -20, -14, -20, -15, -7, -2, -7,
    -8, -37, 1, -37, 16, -7, 30, -7, 40, -3, 44, 0, 40, 3, 30, 7, 16, 7, 1, 37, -8, 37,
    -2, 7, -15, 7, -14, 20, -22, 20, -28, 6, -42, 3], METAL, 2);
  for (const y of [-17, 17]) rect(c, 5, y - 3, 12, 6, 3, '#67abbe', METAL, 1.2);
  path(c, '#4d839c', 3, 29, -3, 34, 0, 29, 3);
  path(c, '#fff9e3', 2, -19, -3, 23, -3);
}

function apron(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x, y, w, h, 6, '#526474', '#dce6df', 2);
  for (let dx = x + 10; dx < x + w - 6; dx += 13) path(c, GOLD, 2.5, dx - 4, y + h - 9, dx + 2, y + h - 3);
}

function airportBuilding(c: Ctx, style: number): void {
  switch (style) {
    case 0:
      glass(c, 28, 40, 144, 39);
      apron(c, 24, 87, 152, 36);
      for (const x of [47, 86, 125]) {
        chromed(c, x, 72, 19, 26, 4);
        rect(c, x + 3, 94, 23, 8, 2, '#ffda82', METAL);
      }
      break;
    case 1:
      chromed(c, 27, 44, 146, 67, 8);
      glass(c, 34, 51, 132, 51);
      for (const x of [57, 92, 127]) oval(c, x, 75, 9, 9, '#a7e6e1', '#618ea5');
      break;
    case 2:
      for (const x of [28, 102]) {
        chromed(c, x, 35, 70, 80, 11);
        for (let y = 42; y < 90; y += 9) path(c, '#5a8094', 1.5, x + 6, y, x + 64, y);
        apron(c, x + 5, 92, 60, 30);
      }
      break;
    case 3:
      oval(c, 100, 80, 50, 47, '#526c80', '#c4e4e5', 4);
      oval(c, 100, 80, 33, 33, '#77aeb6', '#c4e4e5', 2);
      path(c, CREAM, 6, 88, 65, 88, 95);
      path(c, CREAM, 6, 112, 65, 112, 95);
      path(c, CREAM, 6, 88, 80, 112, 80);
      break;
    case 4:
      apron(c, 26, 37, 149, 85);
      inPlace(c, 100, 78, 0, 1.05, () => jet(c, '#b7eddf'));
      break;
    case 5:
      chromed(c, 28, 38, 144, 84, 12);
      for (const x of [38, 97]) {
        rect(c, x, 53, 51, 53, 6, '#536b7e', METAL);
        for (let y = 60; y < 106; y += 7) path(c, '#a9c2be', 2, x + 3, y, x + 47, y);
      }
      break;
    case 6:
      oval(c, 100, 80, 55, 48, '#567380', '#cce8e1', 4);
      oval(c, 100, 80, 37, 37, '#9fd8e3', METAL, 4);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        path(c, '#58778a', 3, 100 + 26 * Math.cos(a), 80 + 26 * Math.sin(a), 100 + 36 * Math.cos(a), 80 + 36 * Math.sin(a));
      }
      oval(c, 100, 80, 20, 20, '#daf8ee', METAL);
      path(c, METAL, 3, 87, 82, 109, 75, 116, 63);
      oval(c, 108, 75, 4, 4, '#ff9e6d', METAL);
      break;
    case 7:
      glass(c, 26, 37, 148, 59);
      rect(c, 34, 76, 132, 44, 7, '#779da6', METAL);
      for (const x of [51, 100, 149]) {
        rect(c, x - 12, 89, 24, 20, 3, '#98dbd9', METAL);
        path(c, GOLD, 3, x - 8, 114, x + 8, 114);
      }
      break;
    case 8:
      apron(c, 31, 35, 138, 89);
      for (const x of [49, 91, 132]) {
        rect(c, x - 12, 55, 27, 32, 4, '#799aa9', CREAM, 1.5);
        oval(c, x + 1, 78, 8, 6, GOLD, METAL);
      }
      break;
    default:
      apron(c, 19, 34, 162, 96);
      for (const x of [30, 168]) for (const y of [45, 111]) oval(c, x, y, 4, 4, '#8ef9fa', METAL);
      inPlace(c, 100, 78, -.18, 1.45, () => jet(c, '#f9ead1'));
      path(c, '#ef7a70', 4, 58, 87, 139, 72);
  }
}

function stitch(c: Ctx, x: number, y: number, w: number, h: number): void {
  c.save();
  c.setLineDash([4, 4]);
  rr(c, x, y, w, h, 8);
  c.strokeStyle = '#fff0d990';
  c.lineWidth = 1.7;
  c.stroke();
  c.restore();
}

function sofa(c: Ctx, color: string): void {
  rect(c, 25, 43, 150, 80, 18, '#68465d', INK, 3);
  rect(c, 30, 36, 140, 26, 9, color, INK, 2.5);
  for (const x of [43, 101]) {
    rect(c, x, 64, 55, 48, 9, color, INK);
    stitch(c, x + 4, 68, 47, 39);
  }
  for (const x of [25, 158]) rect(c, x, 53, 17, 65, 8, color, INK);
  rect(c, 55, 71, 25, 23, 6, '#ffd279', '#68465d', 2);
  markStar(c, 68, 82, 7, CREAM);
  rect(c, 117, 73, 25, 23, 6, '#bb92dc', '#68465d', 2);
  path(c, '#f0d2ec', 2, 121, 91, 137, 77);
}

function book(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  rect(c, x, y, w, h, 4, color, '#573749', 2);
  rect(c, x + 5, y + h - 6, w - 8, 4, 1, CREAM, null);
  path(c, '#512d5a80', 3, x + 5, y + 3, x + 5, y + h - 4);
  path(c, '#f9dfa180', 2, x + 10, y + 7, x + w - 5, y + 7);
}

function houseBuilding(c: Ctx, style: number): void {
  switch (style) {
    case 0:
      sofa(c, '#bd668e');
      break;
    case 1:
      rect(c, 41, 27, 118, 101, 8, '#8f5a48', '#4e3644', 3);
      rect(c, 49, 34, 102, 89, 11, '#eee4be', '#6b5b71', 2);
      for (const x of [54, 104]) rect(c, x, 37, 42, 20, 7, '#fff6d7', '#a1908d', 1.5);
      rect(c, 50, 61, 100, 59, 9, '#61aebc', '#555174', 2);
      stitch(c, 54, 66, 92, 49);
      for (const x of [66, 100, 134]) markStar(c, x, 91, 10, '#fbe18a');
      break;
    case 2:
      rect(c, 47, 33, 106, 93, 19, '#ab7d61', '#59424f', 3);
      rect(c, 50, 36, 100, 31, 12, '#eac379', '#694858', 2.5);
      rect(c, 59, 69, 82, 48, 15, '#d19e6c', '#6e4851', 2);
      stitch(c, 64, 74, 72, 38);
      break;
    case 3:
      for (const [x, y, angle, color] of [[54, 66, -.29, '#a77acc'], [108, 54, .13, '#f38b79'], [125, 89, -.2, '#5eb5a5']] as const) {
        inPlace(c, x, y, angle, 1, () => book(c, -32, -22, 65, 47, color));
      }
      break;
    case 4:
      rect(c, 23, 39, 154, 82, 9, '#825a54', '#534251', 3);
      for (let i = 0; i < 11; i++) {
        const w = 12 + (i % 3) * 2, h = 43 + (i % 4) * 6;
        book(c, 29 + i * 13, 77 - h / 2, w, h, CLOTH[i % 6]);
      }
      break;
    case 5:
      oval(c, 100, 80, 65, 45, '#a17a57', '#513e50', 3);
      oval(c, 100, 80, 58, 39, '#d6ae77', '#f4cb8e', 3);
      for (const x of [72, 128]) {
        oval(c, x, 79, 19, 17, '#fcf1d5', '#9e7787');
        oval(c, x, 79, 13, 12, '#edb1a8', '#ac7f95', 1.5);
        oval(c, x, 79, 8, 7, '#b7656f', null);
      }
      break;
    case 6:
      rect(c, 26, 36, 148, 89, 18, '#855e86', '#493a50', 3);
      rect(c, 32, 43, 114, 74, 14, '#583b61', '#d9a98f', 2.5);
      rect(c, 38, 48, 102, 64, 13, '#abc8a6', '#352f49', 2);
      for (const [x, y, w, h] of [[48, 55, 20, 12], [91, 53, 35, 12], [74, 78, 22, 17], [113, 88, 14, 15], [46, 95, 20, 9]]) {
        rect(c, x, y, w, h, 2, '#75a6a2', null);
      }
      for (const y of [60, 96]) oval(c, 159, y, 8, 8, '#efd79f', INK);
      break;
    case 7:
      chromed(c, 27, 40, 146, 80, 10);
      rect(c, 37, 49, 126, 62, 7, '#f4d1be', '#73495d');
      for (const [x, y, r] of [[67, 69, 17], [126, 69, 12], [71, 93, 11], [128, 92, 15]]) {
        oval(c, x, y, r, r, '#61546b', '#493849');
        arc(c, x, y, r * .7, 0, Math.PI * 1.84, '#df7b79', 2.5);
      }
      break;
    case 8:
      oval(c, 100, 80, 69, 50, '#e5bc92', '#94515f', 3);
      oval(c, 100, 81, 57, 35, '#fac497', '#95566d', 2);
      oval(c, 100, 81, 28, 18, '#ab6e75', '#965969', 1.5);
      oval(c, 100, 89, 12, 8, '#ffe4a7', null);
      for (const x of [85, 100, 115]) oval(c, x, 74, 4, 4, '#ffe4a7', null);
      break;
    default:
      sofa(c, '#56afad');
      rect(c, 73, 22, 54, 39, 8, '#9b876e', '#6c4a56', 2.5);
      oval(c, 100, 41, 19, 15, '#f0b78a', '#864e60', 2);
      oval(c, 104, 41, 12, 10, '#c6846e', null);
      oval(c, 96, 38, 4, 4, '#eaa480', null);
  }
}

const BUILDINGS: Record<BuiltMap, Paint> = {
  candy: candyBuilding, castle: castleBuilding, airport: airportBuilding, house: houseBuilding,
};

const BASES = {
  candy: ['#fff3cd', '#e999ab', '#a45176'],
  castle: ['#e0c5a6', '#ac8c82', '#6d515d'],
  airport: ['#d6e5df', '#8da5ad', '#516d80'],
  house: ['#efd0a1', '#ba9284', '#79596e'],
};

export function laterBuiltBuilding(c: Ctx, map: QueuedMap, style: number): void {
  if (!isBuiltMap(map)) return;
  const footprint = laterBuiltFootprint(map, style).flat();
  const [light, dark, edge] = BASES[map];
  shape(c, '#27283a35', footprint.map((value, i) => value + (i % 2 ? 5 : 3)), null);
  shape(c, bodyGrad(c, 12, 15, 176, 121, light, dark), footprint, edge, 3);
  const inset = footprint.map((value, i) => i % 2 ? 80 + (value - 80) * .93 : 100 + (value - 100) * .95);
  shape(c, light, inset, '#fff7df80', 2);
  c.save();
  poly(c, footprint);
  c.clip();
  BUILDINGS[map](c, style);
  c.restore();
}

type Icon = (c: Ctx) => void;

function wrappedSweet(c: Ctx, color: string): void {
  shape(c, '#ffcb91', [-20, -10, -39, -23, -36, 22, -18, 11], '#984971', 2);
  shape(c, '#ffcb91', [20, -10, 39, -23, 36, 22, 18, 11], '#984971', 2);
  for (const x of [-1, 1]) {
    path(c, '#e18b8a', 2, x * 34, -14, x * 24, -6);
    path(c, '#e18b8a', 2, x * 34, 12, x * 24, 6);
  }
  oval(c, 0, 0, 24, 19, color, '#984971', 2.5);
  arc(c, -1, -1, 13, 3.45, 4.95, '#fff1cf', 4);
}

const CANDY_PROPS: readonly Icon[] = [
  c => { path(c, '#9e5e7f', 7, 0, 9, 0, 37); path(c, CREAM, 3, -1, 9, -1, 37); candyDisk(c, 0, -10, 25, '#f4719a'); },
  c => wrappedSweet(c, '#e77da9'),
  c => { oval(c, 0, 0, 28, 27, '#e7a758', '#954a61', 2.5); oval(c, 0, -2, 24, 22, '#eb89ae', '#984c65'); oval(c, 0, -2, 10, 8, '#91586e', '#bb6d69'); sprinkles(c, -16, -20, 32, 8, 19); sprinkles(c, -15, 11, 30, 6, 13); },
  c => { shape(c, '#d88a52', [-16, -4, 16, -4, 0, 36], '#954e61', 2.5); path(c, GOLD, 2, -12, 7, 8, 17, -4, 25); gumdrop(c, 0, -14, 22, '#95ead0'); },
  c => { rect(c, -32, -21, 64, 42, 6, '#613449', '#482b37'); for (const x of [-23, -6, 11]) for (const y of [-15, 2]) rect(c, x, y, 13, 13, 3, '#a9695c', '#472739'); },
  c => { rect(c, -23, -25, 46, 54, 10, '#f2c2c4', '#a44e76', 2.5); for (let i = 0; i < 6; i++) gumdrop(c, -11 + i % 2 * 22, -13 + Math.floor(i / 2) * 14, 6, SWEETS[i]); rect(c, -22, -26, 44, 12, 4, '#db779c', '#a44e76'); },
  c => { path(c, '#8a4f75', 13, -16, 28, -16, -12, -7, -23, 10, -23, 21, -13); path(c, CREAM, 9, -16, 28, -16, -12, -7, -23, 10, -23, 21, -13); for (const [x, y] of [[-16, 19], [-16, 4], [-16, -10], [-7, -23], [9, -23], [19, -15]]) path(c, '#ee7093', 4, x - 3, y - 2, x + 3, y + 2); },
  c => { rect(c, -29, -20, 58, 40, 10, '#ef945e', '#9a5265'); oval(c, 0, -6, 24, 12, '#ffa6ba', '#a25a70'); oval(c, 0, 6, 24, 11, '#e28bba', '#a25a70'); path(c, CREAM, 4, -19, 2, 19, 2); },
  c => { oval(c, 0, 0, 27, 27, '#ebc38f', '#a7756a'); for (const [x, y] of [[-11, 10], [12, 13], [0, -15], [-14, -6], [11, -8]]) oval(c, x, y, 3.5, 3.5, '#996060', null); },
  c => { shape(c, '#be7853', [-22, -7, 22, -7, 12, 23, -12, 23], '#854960'); candyDisk(c, 0, -11, 23, '#ab90df'); markStar(c, 0, -13, 9); },
  c => { oval(c, 0, 0, 32, 26, '#eab4a8', '#a66376'); for (const [x, y, i] of [[-16, 0, 0], [2, -10, 1], [16, 6, 2]]) gumdrop(c, x, y, 11, SWEETS[i]); },
  c => { oval(c, 0, 0, 29, 26, '#927393', '#623e5b'); for (let i = 0; i < 8; i++) { const a = Math.PI * i / 4; oval(c, 17 * Math.cos(a), 14 * Math.sin(a), 5, 5, '#fff6de', null); } gumdrop(c, 0, 0, 10, '#f3adcf'); },
];

function banner(c: Ctx, color: string): void {
  shape(c, color, [-20, -30, 21, -30, 21, 28, 0, 17, -20, 28], '#4d3544', 2.5);
  path(c, '#b58b6a', 6, -28, -30, 28, -30);
  path(c, '#edc991', 2, -29, -31, 29, -31);
  markStar(c, 0, -7, 13);
}

function wheel(c: Ctx, color: string): void {
  oval(c, 0, 0, 23, 23, color, '#563e47', 2.5);
  oval(c, 0, 0, 18, 18, '#70524b', '#f2bf8b', 2);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    path(c, '#d9a677', 3, 0, 0, 17 * Math.cos(a), 17 * Math.sin(a));
  }
  oval(c, 0, 0, 5, 5, '#dfb881', '#55424c', 1.5);
}

const CASTLE_PROPS: readonly Icon[] = [
  c => tower(c, 0, 0, 27, '#985884'),
  c => { oval(c, 0, 0, 29, 29, '#ac8e81', '#5d4a5b', 2.5); oval(c, 0, 0, 22, 22, '#69b5b1', '#dfc7a3', 4); oval(c, 0, 0, 7, 7, '#c3f0d7', '#75a4a9'); },
  c => shield(c, 0, 0, 1.3, '#9d536a'),
  c => banner(c, '#507887'),
  c => wheel(c, '#ac794d'),
  c => { rect(c, -30, -19, 60, 38, 7, '#965b4c', '#553e4a'); for (const x of [-24, 16]) rect(c, x, -19, 7, 38, 2, '#d6b184', '#5e4a55'); rect(c, -5, -1, 10, 9, 2, GOLD, '#684c51'); },
  c => { for (const [x, y] of [[-13, -10], [13, -7], [0, 13]]) { oval(c, x, y, 13, 13, '#927553', '#513c46'); oval(c, x, y, 9, 9, '#b8885b', '#c6a797'); path(c, '#765644', 1.5, x, y - 7, x, y + 7); } },
  c => { rect(c, -23, -25, 46, 50, 8, '#ba9690', '#594856'); for (const y of [-13, 7]) for (const x of [-11, 11]) oval(c, x, y, 8, 7, '#73996b', '#516462'); },
  c => { oval(c, 0, 0, 23, 25, '#a79b94', '#5b4b56'); oval(c, 0, -2, 15, 16, '#6b5262', '#d4b399'); oval(c, 0, -3, 10, 10, '#f1a16c', '#7c5261'); oval(c, 0, -3, 5, 6, GOLD, null); },
  c => { rect(c, -30, -16, 60, 32, 7, '#c09b67', '#645050'); for (let x = -22; x <= 23; x += 8) path(c, '#f1d29a', 2, x - 6, 12, x + 6, -12); rect(c, -6, -17, 12, 34, 3, '#bd9259', '#8f7051'); },
  c => { slate(c, -29, -20, 58, 40, '#a66466'); path(c, '#d9ab8d', 3, 0, -18, 0, 18); },
  c => { oval(c, 0, 0, 26, 26, '#c5ab91', '#5a4c57'); shield(c, 0, 0, .8, '#667ea0'); },
];

function suitcase(c: Ctx, x: number, y: number, color: string): void {
  rect(c, x - 15, y - 12, 30, 24, 4, color, METAL);
  path(c, METAL, 2, x - 4, y - 12, x - 4, y - 16, x + 4, y - 16, x + 4, y - 12);
  path(c, '#ffffff73', 2, x - 10, y - 6, x + 10, y - 6);
}

function beacon(c: Ctx, tint: string): void {
  oval(c, 0, 0, 26, 26, '#577189', '#324c63', 3);
  oval(c, 0, 0, 21, 21, tint, '#d5f3e9', 2.5);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    path(c, '#527487', 3, 19 * Math.cos(a), 19 * Math.sin(a), 22 * Math.cos(a), 22 * Math.sin(a));
  }
  arc(c, 0, 0, 15, 3.4, 5.2, '#ffffffcc', 3);
}

const AIRPORT_PROPS: readonly Icon[] = [
  c => inPlace(c, 0, 0, -.4, .82, () => jet(c, '#e6f2e6')),
  c => { for (const [x, y] of [[-12, -13], [15, 12]]) { rect(c, x - 12, y - 12, 24, 24, 3, '#657a87', METAL); oval(c, x, y, 8, 8, '#f6b365', '#976353'); oval(c, x, y, 3, 3, '#fff3d4', null); } },
  c => { apron(c, -35, -24, 70, 48); suitcase(c, -12, -2, '#d49191'); suitcase(c, 15, 0, '#82aebf'); },
  c => beacon(c, '#88e4e4'),
  c => { chromed(c, -30, -20, 60, 40, 8); glass(c, -24, -14, 47, 28); },
  c => { rect(c, -37, -10, 74, 20, 8, '#708391', METAL, 2.5); for (let x = -27; x <= 26; x += 9) path(c, GOLD, 3, x - 3, 6, x + 3, -6); },
  c => { rect(c, -25, -23, 50, 46, 7, '#748e96', METAL); oval(c, 0, 0, 16, 16, '#4e687a', '#c8ebe3', 2); path(c, CREAM, 3, -5, -8, -5, 8); path(c, CREAM, 3, 5, -8, 5, 8); path(c, CREAM, 3, -5, 0, 5, 0); },
  c => { rect(c, -30, -16, 56, 32, 8, '#e4b568', METAL, 2.5); for (const x of [-22, 9]) for (const y of [-17, 10]) rect(c, x, y, 12, 7, 2, METAL, null); glass(c, -3, -12, 23, 24); },
  c => { oval(c, 0, 0, 27, 25, '#7d9da4', METAL); oval(c, -3, -3, 20, 17, '#c7efdf', METAL); path(c, METAL, 3, -12, 2, 15, -12); oval(c, 5, -6, 4, 4, GOLD, METAL); },
  c => { apron(c, -33, -20, 66, 40); path(c, CREAM, 4, -16, 4, 18, 4, 10, -4); },
  c => { rect(c, -30, -14, 60, 28, 9, '#98bbbb', METAL); for (const x of [-19, 0, 19]) oval(c, x, 0, 6, 6, '#cae9e3', '#6c8a9d'); },
  c => { path(c, METAL, 4, -22, 0, 23, 0); for (const x of [-18, 0, 18]) oval(c, x, 0, 6, 6, x === 0 ? GOLD : '#8de4e9', METAL); },
];

const HOUSE_PROPS: readonly Icon[] = [
  c => { oval(c, 0, 0, 29, 27, '#d6ac73', '#82566e'); oval(c, 0, 0, 24, 22, '#f9dea4', '#8b616a', 2.5); for (const [x, y] of [[-12, -8], [2, -13], [15, 1], [3, 12], [-14, 8]]) oval(c, x, y, 3, 3, '#9f694f', null); },
  c => { oval(c, 7, 0, 30, 27, '#c9a468', '#875960'); oval(c, 20, 0, 12, 10, '#edc780', '#875960'); oval(c, 0, 0, 22, 22, '#f4ba85', '#7c5a6a'); oval(c, 0, 0, 17, 17, '#693f49', '#e5a679'); },
  c => { inPlace(c, 0, 0, -.33, 1, () => book(c, -21, -28, 42, 56, '#b974ab')); markStar(c, 0, -2, 10, '#ffcf76'); },
  c => { for (const [x, y, tint] of [[-15, 7, '#7bb5a6'], [13, 0, '#dc7f8a'], [-2, -15, '#f8c077']] as const) { rect(c, x - 11, y - 10, 22, 20, 3, tint, '#745262'); rect(c, x - 6, y - 5, 12, 10, 2, '#fff0ba', null); } },
  c => { oval(c, 0, 0, 30, 28, '#dfb5b7', '#87576e'); oval(c, 0, 0, 23, 19, '#a46985', '#f0c0aa', 3); oval(c, 0, 6, 9, 6, '#ecb094', null); for (const x of [-8, 0, 8]) oval(c, x, -3, 2.8, 3.4, '#ecb094', null); },
  c => { oval(c, 0, 0, 27, 27, '#d36c88', '#735572', 2.5); oval(c, 0, 0, 19, 19, '#f39baa', '#f6c4b1'); for (const [x, y] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) oval(c, x, y, 2.8, 2.8, '#86536c', null); path(c, '#fee1b5', 2.5, -6, -6, 6, 6); },
  c => { oval(c, 0, 0, 23, 23, '#d9b69d', '#7d6262'); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; oval(c, 15 * Math.cos(a), 15 * Math.sin(a), 7, 7, '#91b487', '#587863', 1.3); } oval(c, 0, 0, 8, 8, '#b3ce8a', '#587863'); },
  c => { oval(c, 0, 0, 28, 28, '#9aa5d4', '#666687', 2); oval(c, 0, 0, 19, 19, '#d3d5ec', '#887281'); oval(c, 0, 0, 6, 6, '#777390', '#f0e2c9'); path(c, '#f5d28a', 4, 0, -26, 0, -32, 20, -37); },
  c => { rect(c, -24, -27, 48, 54, 9, '#b89eaa', '#765468'); for (let y = -18; y <= 19; y += 12) for (const x of [-13, 0, 13]) rect(c, x - 4, y - 4, 8, 8, 2, '#647789', '#754f63', 1); },
  c => { for (const x of [-14, 14]) { rect(c, x - 10, -26, 20, 50, 10, '#a77db8', '#684b75', 2.5); rect(c, x - 6, -9, 12, 17, 4, '#cea5c7', '#784e77', 1.5); } },
  c => { oval(c, 0, 0, 27, 26, '#b7b6d1', '#744f75'); arc(c, 0, 0, 19, .1, Math.PI - .2, '#f7d29a', 6); arc(c, 0, 0, 19, 3.3, 5.9, '#e67887', 7); oval(c, 0, 0, 7, 7, '#f3e1bb', '#987292'); },
  c => { oval(c, 0, 1, 22, 27, '#90ae88', '#665269'); oval(c, -8, -18, 9, 13, '#bcd2a0', '#665269'); oval(c, 9, -18, 9, 13, '#bcd2a0', '#665269'); for (const x of [-8, 8]) oval(c, x, -3, 2, 3, '#584258', null); oval(c, 0, 12, 10, 8, '#eee2b5', null); },
];

const PROPS: Record<BuiltMap, readonly Icon[]> = {
  candy: CANDY_PROPS, castle: CASTLE_PROPS, airport: AIRPORT_PROPS, house: HOUSE_PROPS,
};

export function laterBuiltProp(c: Ctx, map: QueuedMap, style: number): void {
  if (!isBuiltMap(map)) return;
  const paint = PROPS[map][style];
  if (!paint) return;
  oval(c, 51, 55, 30, 26, '#30243938', null);
  inPlace(c, 50, 49, 0, 1, () => paint(c));
}

function blades(c: Ctx, tint: string, cloth: boolean): void {
  for (let i = 0; i < 4; i++) {
    inPlace(c, 0, 0, Math.PI / 2 * i, 1, () => {
      path(c, '#775560', 4, 0, 0, 36, 0);
      shape(c, tint, [10, -2, 16, -12, 36, -11, 38, 0], '#765866', 2);
      if (cloth) {
        for (const x of [20, 26, 32]) path(c, '#ad916e', 1.5, x, -9, x - 3, -1);
      } else {
        path(c, '#efe6bc', 2, 19, -8, 34, -8);
      }
    });
  }
  oval(c, 0, 0, 8, 8, GOLD, INK);
}

function radar(c: Ctx): void {
  oval(c, 0, 0, 36, 36, '#406f77', METAL, 2.5);
  for (const r of [10, 20, 29]) {
    arc(c, 0, 0, r, 0, Math.PI * 2, '#85b6a5', 1.5);
  }
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, 33, -1.08, -.12);
  c.closePath();
  c.fillStyle = '#b9f7a98c';
  c.fill();
  path(c, '#dafac6', 2.5, 0, 0, 32, -4);
  for (const [x, y] of [[17, -12], [15, 14], [-14, -8]]) oval(c, x, y, 3, 3, '#e0f4bd', null);
}

function alarm(c: Ctx): void {
  for (const x of [-19, 19]) oval(c, x, -19, 12, 10, '#df929b', '#70455c', 2);
  oval(c, 0, 4, 24, 24, '#a972a4', '#70455c', 2.5);
  oval(c, 0, 4, 18, 18, CREAM, '#9a6984', 2);
  path(c, '#70455c', 3, 0, -6, 0, 4, 8, 8);
  for (const y of [-9, 18]) oval(c, 0, y, 1.8, 1.8, '#70455c', null);
}

const MOTION: Record<BuiltMap, readonly Icon[]> = {
  candy: [
    c => candyDisk(c, 0, 0, 38, '#ec6b93'),
    c => wrappedSweet(c, '#9dafec'),
    c => {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        gumdrop(c, 26 * Math.cos(a), 26 * Math.sin(a), 11, i % 2 ? '#ffde8a' : '#ffae6d');
      }
      markStar(c, 0, 0, 16);
    },
  ],
  castle: [
    c => blades(c, '#ecd29c', true),
    c => banner(c, '#8c5380'),
    c => {
      for (const angle of [-.72, .72]) inPlace(c, 0, 0, angle, 1, () => {
        shape(c, '#dae5d7', [-5, 23, -5, -24, 0, -34, 5, -24, 5, 23], '#6b5362');
        path(c, GOLD, 4, -10, 20, 10, 20);
      });
      shield(c, 0, 0, .85, '#8d618d');
    },
  ],
  airport: [
    radar,
    c => { beacon(c, '#6bbed9'); arc(c, 0, 0, 17, -.6, .8, '#ffd374', 7); },
    c => inPlace(c, 0, 0, 0, .91, () => jet(c, '#fff0d5')),
  ],
  house: [
    c => blades(c, '#bb976e', false),
    c => { oval(c, 0, 0, 30, 30, '#cc7aa2', '#684b75', 2.5); oval(c, 0, 0, 23, 23, '#fbe1a1', '#684b75'); arc(c, 0, 0, 18, 0, 4.3, '#9785cb', 7); oval(c, 0, 0, 7, 7, '#955d89', '#684b75'); },
    alarm,
  ],
};

export function laterBuiltMotion(c: Ctx, map: QueuedMap, style: number): void {
  if (!isBuiltMap(map)) return;
  const paint = MOTION[map][style];
  if (paint) inPlace(c, 50, 50, 0, 1, () => paint(c));
}
