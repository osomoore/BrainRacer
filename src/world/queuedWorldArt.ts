import { bodyGrad, ellipse, fillStroke, poly, rr, type Ctx } from '../art/draw';
import type { QueuedMap } from '../config/queuedMaps';

export type Palette = {
  floor: readonly [string, string, string, string, string, string];
  road: string;
  curb: string;
  lane: string;
  shade: string;
  light: string;
  colors: readonly string[];
};

export const QUEUED_PALETTES: Record<QueuedMap, Palette> = {
  brickworks: {
    floor: ['#2f7396', '#6b9760', '#b0a079', '#729f56', '#be9769', '#a47750'],
    road: '#927454', curb: '#62472f', lane: '#f4cb86', shade: '#293941', light: '#fff1b0',
    colors: ['#bc6645', '#62a466', '#d7ae64', '#5a8d9e', '#a09572', '#a66980'],
  },
  mushroom: {
    floor: ['#165b79', '#537974', '#9f7196', '#74866a', '#ae8ca9', '#a18191'],
    road: '#66556f', curb: '#403957', lane: '#f4cfc5', shade: '#343354', light: '#fff0c8',
    colors: ['#e87268', '#ef9e5b', '#aa7ec0', '#eeb076', '#b8c45e', '#e47e9a'],
  },
  tundra: {
    floor: ['#417e9a', '#b6d3d4', '#bad4e0', '#82acbb', '#dae9e4', '#8dc6d7'],
    road: '#698995', curb: '#e3f2ee', lane: '#eff8e8', shade: '#385061', light: '#f4faf4',
    colors: ['#e89773', '#9cc6da', '#d7dbcb', '#78a6a7', '#dca968', '#a6abc7'],
  },
  volcano: {
    floor: ['#cb502e', '#4e3b47', '#63565e', '#674555', '#795653', '#795048'],
    road: '#4b4550', curb: '#241f30', lane: '#ffc076', shade: '#302739', light: '#ffd089',
    colors: ['#b66a47', '#946052', '#ca915b', '#8d676f', '#a37265', '#77586c'],
  },
  candy: {
    floor: ['#a36e9c', '#91b97a', '#d29ba9', '#bf9b9e', '#e8c1a9', '#dcbc94'],
    road: '#af718b', curb: '#754a61', lane: '#ffedca', shade: '#863e5f', light: '#ffefdc',
    colors: ['#ee8b9f', '#a5c7f0', '#ffd184', '#c7afe4', '#92d5b4', '#df946f'],
  },
  castle: {
    floor: ['#39617b', '#879071', '#aea498', '#9a7d65', '#b9ab8d', '#a48369'],
    road: '#a3907e', curb: '#695a51', lane: '#f0d5aa', shade: '#574453', light: '#eaddb9',
    colors: ['#bcab8d', '#a1a6a6', '#aeb48c', '#c2a591', '#a1a6b9', '#ccb892'],
  },
  airport: {
    floor: ['#27445a', '#748a72', '#809393', '#495d67', '#a2ada5', '#717f85'],
    road: '#43515c', curb: '#2f4050', lane: '#f5d486', shade: '#3a5065', light: '#d5e9df',
    colors: ['#8fb7bd', '#acbac5', '#c5c9a9', '#80a8bb', '#b8a2a1', '#9aafa7'],
  },
  house: {
    floor: ['#3b3438', '#b08160', '#ce995c', '#75718c', '#d0a283', '#aa795d'],
    road: '#5d7b85', curb: '#334a5c', lane: '#e6cea2', shade: '#744962', light: '#fff0ce',
    colors: ['#b47384', '#86a7bc', '#d4ab73', '#ca9876', '#a8ab78', '#bb91b7'],
  },
};

export function box(c: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function oval(c: Ctx, color: string | CanvasGradient, x: number, y: number, rx: number, ry: number, outline: string | null = null) {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, color, outline, 2.5);
}

function rounded(c: Ctx, color: string, x: number, y: number, w: number, h: number, r: number, outline: string | null = null) {
  rr(c, x, y, w, h, r);
  fillStroke(c, color, outline, 2.5);
}

function polygon(c: Ctx, color: string | CanvasGradient, points: number[], outline: string | null = null) {
  poly(c, points);
  fillStroke(c, color, outline, 2);
}

function line(c: Ctx, color: string, width: number, points: number[]): void {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

function bevel(c: Ctx, x: number, y: number, w: number, h: number, color: string, shade: string, drop = 11): void {
  box(c, shade, x, y, w, h + drop);
  box(c, color, x, y, w - 5, h);
  box(c, '#ffffff33', x, y, w - 5, 3);
  box(c, '#171a2b55', x + w - 11, y + 3, 6, h - 3);
  box(c, '#12182750', x + 4, y + h, w - 8, 3);
}

function windows(c: Ctx, p: Palette, y: number, n = 4): void {
  for (let i = 0; i < n; i++) {
    const x = 27 + (146 / n) * (i + 0.5);
    rounded(c, p.shade, x - 11, y, 22, 12, 2);
    box(c, p.light, x - 8, y + 2, 7, 7);
    box(c, p.light, x + 1, y + 2, 7, 7);
  }
}

function mushroomTower(c: Ctx, x: number, y: number, width: number, height: number, color: string, p: Palette): void {
  c.save();
  c.translate(x, y);
  c.scale(width / 100, height / 100);
  rounded(c, '#f0bd9e', -18, -57, 36, 57, 10, p.shade);
  rounded(c, p.shade, -8, -26, 16, 25, 5);
  oval(c, '#ffdf9c', -6, -42, 5, 6, p.shade);
  oval(c, '#a35b71', 0, -64, 47, 12, p.shade);
  c.beginPath();
  c.moveTo(-49, -64);
  c.quadraticCurveTo(-30, -103, 7, -99);
  c.quadraticCurveTo(36, -97, 49, -64);
  c.bezierCurveTo(24, -53, -23, -51, -49, -64);
  fillStroke(c, bodyGrad(c, -51, -99, 102, 45, color, '#8e527b'), p.shade, 4);
  for (const [dx, dy, radius] of [[-24, -75, 8], [8, -86, 10], [30, -72, 6]]) oval(c, '#ffe6b9', dx, dy, radius, radius * 0.65);
  c.restore();
}

function mushroomBuildings(c: Ctx, style: number, p: Palette, color: string): void {
  if (style === 1 || style === 7) {
    rounded(c, '#dca991', 39, 71, 123, 75, 22, p.shade);
    oval(c, '#ffdbad', 100, 111, 80, 34, p.shade);
    for (const x of [40, 66, 134, 159]) rounded(c, '#a25e72', x, 87, 9, 42, 4, p.shade);
    mushroomTower(c, 100, 133, 191, 128, color, p);
    for (const x of [27, 174]) oval(c, '#ffe2a3', x, 121, 9, 11, p.shade);
    return;
  }
  if (style === 4 || style === 8) {
    rounded(c, '#cdafa3', 31, 75, 138, 69, 22, p.shade);
    oval(c, bodyGrad(c, 20, 18, 160, 117, '#fff2bc', color), 100, 74, 79, 54, p.shade);
    for (const x of [-46, -23, 0, 23, 46]) {
      line(c, '#ac6d84', 3, [100 + x / 2, 28, 100 + x, 70, 100 + x * 0.65, 114]);
    }
    oval(c, '#ffd99a', 100, 78, 85, 9, p.shade);
    rounded(c, '#665065', 83, 110, 34, 32, 9);
    for (const x of [51, 148]) oval(c, '#fff0a4', x, 115, 7, 9, p.shade);
    return;
  }
  mushroomTower(c, 44, 137, 72, style === 2 ? 112 : 89, p.colors[(style + 3) % 6], p);
  mushroomTower(c, 155, 135, 76, style === 2 ? 101 : 105, p.colors[(style + 2) % 6], p);
  mushroomTower(c, 100, 149, style === 9 ? 110 : 96, style === 6 ? 113 : 141, color, p);
  if (style === 9) {
    line(c, p.shade, 4, [101, 19, 101, 6]);
    polygon(c, '#ffef9a', [105, 6, 140, 10, 138, 26, 105, 20], p.shade);
    for (const x of [47, 156]) oval(c, '#ffd886', x, 138, 14, 7, p.shade);
  }
}

function paintLandmark(c: Ctx, map: QueuedMap, style: number, p: Palette, color: string): void {
  switch (map) {
    case 'brickworks':
      bevel(c, 9, 61, 183, 74, '#b18a63', p.shade);
      for (const x of [19, 65, 116, 157]) bevel(c, x, 83, 23, 31, color, p.shade, 6);
      if (style === 6 || style === 9) {
        const mast = style === 9 ? 87 : 36;
        bevel(c, mast, 16, 26, 104, '#d68053', p.shade);
        bevel(c, 19, 19, 166, 18, '#ecc872', p.shade, 8);
        for (let x = 26; x < 176; x += 19) box(c, '#ad5b4b', x, 21, 10, 12);
        line(c, p.shade, 4, [151, 43, 151, 73]);
        bevel(c, 130, 75, 41, 21, '#58a79b', p.shade, 7);
      } else {
        for (const [x, y, w, h] of [[26, 41, 48, 55], [73, 16, 58, 82], [130, 34, 48, 59]]) {
          bevel(c, x, y, w, h, p.colors[(style + x) % 6], p.shade);
          for (const side of [x + 5, x + 22]) box(c, '#fff2a9', side, y + 12, 8, 14);
        }
      }
      for (const x of [26, 70, 116, 161]) box(c, '#ffe9a8', x, 120, 14, 7);
      return;
    case 'mushroom':
      mushroomBuildings(c, style, p, color);
      return;
    case 'tundra':
      if (style === 6 || style === 9) {
        bevel(c, 14, 63, 175, 74, color, p.shade);
        for (const [x, ridge, w] of [[9, 44, 64], [67, 13, 69], [128, 37, 63]]) {
          polygon(c, '#a1c3d4', [x, ridge + 42, x + w / 2, ridge, x + w, ridge + 42, x + w, 111, x, 113], p.shade);
          polygon(c, '#f0faf2', [x, ridge + 42, x + w / 2, ridge, x + w / 2, 98, x, 113]);
        }
        windows(c, p, 116);
      } else {
        for (const [x, y, w] of [[51, 87, 42], [145, 85, 45], [100, 68, 53]]) {
          oval(c, p.shade, x, y + 16, w, 38);
          oval(c, bodyGrad(c, x - w, y - 36, w * 2, 79, '#e8f8ee', color), x, y, w, 43, '#6f94a8');
          line(c, '#8bb2c7', 2, [x - w * 0.75, y, x, y + 7, x + w * 0.75, y]);
        }
        rounded(c, '#638a9c', 78, 93, 44, 42, 13, p.shade);
        rounded(c, '#ffe5a4', 93, 112, 15, 21, 5, p.shade);
      }
      return;
    case 'volcano':
      if (style === 6 || style === 8) {
        bevel(c, 11, 63, 179, 64, color, p.shade);
        for (const [x, y, w] of [[31, 34, 55], [113, 15, 59]]) {
          rounded(c, '#6f4852', x, y, w, 98 - y, 12, p.shade);
          oval(c, '#e69653', x + w / 2, y + 10, w / 2 - 3, 14, p.shade);
          oval(c, '#ffe884', x + w / 2, y + 12, w / 3 - 3, 8, p.shade);
        }
      } else {
        polygon(c, '#806072', [11, 124, 24, 62, 74, 39, 106, 16, 177, 49, 190, 122, 148, 145, 45, 145], p.shade);
        rounded(c, p.shade, 37, 73, 128, 62, 22);
        rounded(c, '#e39868', 45, 80, 112, 42, 16);
        rounded(c, '#392e43', 54, 89, 94, 34, 13);
        for (const x of [67, 99, 131]) oval(c, '#ffd282', x, 99, 6, 8);
      }
      windows(c, p, 125, 3);
      return;
    case 'candy':
      if (style === 6 || style === 9) {
        rounded(c, '#b6776e', 15, 64, 170, 76, 16, p.shade);
        rounded(c, '#f6cfb1', 21, 44, 158, 76, 12, p.shade);
        for (const x of [26, 72, 118]) {
          rounded(c, p.colors[(style + x) % 6], x, 65, 37, 48, 7, p.shade);
          oval(c, '#fff0aa', x + 18, 87, 8, 11);
        }
        for (const x of [43, 100, 157]) {
          oval(c, color, x, 44, 25, 28, p.shade);
          c.beginPath(); c.ellipse(x, 44, 14, 16, 0, 0.25, 5.6);
          c.strokeStyle = '#fff2c1'; c.lineWidth = 4; c.stroke();
        }
      } else {
        rounded(c, color, 12, 40, 175, 95, 26, p.shade);
        rounded(c, '#ffe0bc', 30, 61, 140, 62, 23, p.shade);
        for (const [i, x] of [45, 83, 120, 155].entries()) {
          oval(c, p.colors[(style + i) % 6], x, 52 + (i % 2) * 4, 25, 27, p.shade);
          oval(c, '#ffffff87', x - 7, 45, 8, 5);
        }
        rounded(c, '#aa6678', 82, 91, 35, 40, 12, p.shade);
      }
      return;
    case 'castle':
      bevel(c, 13, 50, 174, 95, color, p.shade, 8);
      if (style === 7 || style === 9) {
        for (const x of [28, 81, 134]) {
          bevel(c, x, x === 81 ? 29 : 53, 36, 63, '#cfb18f', p.shade, 9);
          for (const sx of [x, x + 14, x + 28]) box(c, '#ead0a6', sx, x === 81 ? 24 : 48, 9, 12);
          rounded(c, '#773c53', x + 9, 69, 18, 32, 4, p.shade);
        }
        rounded(c, '#515066', 80, 99, 43, 42, 15, p.shade);
      } else {
        polygon(c, '#813d55', [16, 55, 52, 21, 100, 40, 146, 19, 182, 53, 164, 121, 34, 121], p.shade);
        for (const x of [42, 82, 122]) {
          rounded(c, '#d3ab91', x, 62, 30, 48, 13, p.shade);
          line(c, '#bd6b70', 4, [x + 15, 65, x + 15, 105]);
        }
      }
      return;
    case 'airport':
      bevel(c, 11, 55, 177, 84, color, p.shade);
      if (style === 6 || style === 9) {
        rounded(c, '#546f80', 23, 34, 152, 76, 31, p.shade);
        for (let x = 42; x < 172; x += 17) box(c, '#b1d1d4', x, 62, 10, 28);
        bevel(c, 82, 48, 36, 63, '#a9b5a9', p.shade);
        oval(c, '#668990', 100, 43, 33, 19, p.shade);
        oval(c, '#dbead5', 100, 33, 30, 15, p.shade);
        line(c, p.shade, 3, [100, 30, 106, 8, 122, 8]);
      } else {
        for (const x of [24, 105]) {
          rounded(c, '#769999', x, 32, 70, 98, 17, p.shade);
          for (const y of [45, 63, 81]) box(c, '#d2ded0', x + 9, y, 51, 4);
          rounded(c, '#465b72', x + 8, 92, 53, 31, 5, p.shade);
          box(c, '#f8d38c', x + 11, 117, 47, 4);
        }
      }
      return;
    case 'house':
      if (style === 6 || style === 9) {
        rounded(c, '#736080', 11, 28, 177, 111, 20, p.shade);
        rounded(c, '#a88395', 21, 42, 158, 85, 12, p.shade);
        rounded(c, '#443b63', 35, 53, 130, 62, 7, p.shade);
        for (const [x, y, i] of [[45, 67, 0], [81, 73, 2], [125, 60, 5], [131, 94, 3]]) {
          bevel(c, x, y, 23, 11, p.colors[i], p.shade, 4);
        }
        line(c, '#f7dea6', 3, [84, 29, 69, 12, 61, 13]);
        line(c, '#f7dea6', 3, [116, 29, 136, 8]);
      } else {
        rounded(c, '#c1a97c', 18, 35, 164, 108, 17, p.shade);
        for (const [x, y, i] of [[44, 68, 1], [96, 59, 0], [145, 75, 3], [76, 115, 4], [133, 114, 5]]) {
          rounded(c, p.colors[i], x - 20, y - 17, 38, 29, style === 8 ? 12 : 4, p.shade);
          oval(c, '#ffeed5', x - 2, y - 5, 7, 5);
        }
        roundKnob(c, 101, 31, p);
      }
      return;
  }
}

function roundKnob(c: Ctx, x: number, y: number, p: Palette): void {
  rounded(c, p.shade, x - 21, y - 19, 42, 24, 9);
  rounded(c, p.light, x - 14, y - 14, 28, 15, 7, p.shade);
}

/** All roof art uses a 200 × 160 coordinate system and scales to the lot footprint. */
export function paintQueuedBuilding(c: Ctx, map: QueuedMap, style: number): void {
  const p = QUEUED_PALETTES[map], color = p.colors[style % p.colors.length];
  oval(c, '#22203338', 104, 126, 93, 31);
  if ((style >= 6 && (map !== 'castle' || style !== 6)) || (map === 'mushroom' && style !== 0 && style !== 3)) {
    paintLandmark(c, map, style, p, color);
    return;
  }
  switch (map) {
    case 'brickworks': {
      bevel(c, 10, 41, 181, 93, p.floor[5], p.shade);
      for (let x = 15; x < 186; x += 21) {
        box(c, '#49342855', x, 113, 2, 28);
        box(c, '#ffdb9a65', x + 5, 125, 10, 8);
      }
      const layers = style % 2 === 0 ? 3 : 2;
      for (let i = 0; i < layers; i++) {
        const size = 165 - i * 40;
        bevel(c, 18 + i * 20, 28 - i * 9, size, 73 - 13 * i, i === 0 ? color : p.colors[(style + i + 1) % 6], p.shade);
      }
      const studs = 7 - layers;
      for (let x = 0; x < studs; x++) box(c, '#ffe4a865', 100 - 12 * (studs - 1) + 24 * x - 5, 31, 10, 10);
      windows(c, p, 121);
      return;
    }
    case 'mushroom': {
      const grad = bodyGrad(c, 61, 83, 77, 52, '#fff0c8', '#c99789');
      rr(c, 42, 76, 115, 67, 18);
      fillStroke(c, grad, p.shade, 4);
      oval(c, '#784c69', 99, 81, 87, 30, p.shade);
      c.beginPath();
      c.moveTo(9, 77);
      c.bezierCurveTo(20, 29, 47, 10, 100, 10);
      c.bezierCurveTo(157, 10, 176, 38, 191, 78);
      c.bezierCurveTo(162, 106, 31, 107, 9, 77);
      fillStroke(c, bodyGrad(c, 12, 10, 175, 96, color, '#934d7d'), p.shade, 4);
      for (const [x, y, rx, ry] of [[62, 41, 14, 11], [118, 30, 19, 12], [149, 67, 14, 9], [96, 71, 12, 8], [29, 67, 9, 7]]) {
        oval(c, '#ffe8caac', x, y, rx, ry);
      }
      rounded(c, '#925467', 88, 111, 26, 32, 11);
      oval(c, p.light, 65, 117, 9, 10, '#925467');
      oval(c, p.light, 135, 117, 9, 10, '#925467');
      return;
    }
    case 'tundra': {
      if (style % 3 === 1) {
        oval(c, '#b4ced8', 99, 91, 88, 53, p.shade);
        oval(c, bodyGrad(c, 15, 15, 175, 100, '#f1fbf7', color), 99, 70, 88, 55, p.shade);
        for (const y of [42, 65, 87]) line(c, '#759caf77', 2, [34, y, 58, y + 4, 140, y + 4, 165, y]);
        rounded(c, '#e3f2ef', 77, 82, 43, 60, 14, p.shade);
        rounded(c, p.shade, 88, 107, 23, 32, 10);
      } else {
        bevel(c, 16, 49, 172, 85, color, p.shade);
        polygon(c, '#729aad', [8, 47, 99, 14, 194, 49, 187, 108, 101, 92, 12, 112], p.shade);
        polygon(c, '#e6f5f4', [14, 44, 99, 14, 92, 86, 12, 103], '#a1c4d0');
        polygon(c, '#bcd7dc', [99, 14, 188, 49, 188, 98, 92, 86], '#a1c4d0');
        bevel(c, 137, 31, 23, 28, '#b38274', p.shade, 4);
        windows(c, p, 117);
        for (const x of [24, 61, 85, 109, 152, 177]) polygon(c, '#e0f4f8', [x, 106, x + 5, 117, x + 8, 103]);
      }
      return;
    }
    case 'volcano': {
      if (style % 3 === 0) {
        polygon(c, '#573845', [8, 128, 22, 83, 49, 71, 62, 33, 113, 18, 149, 46, 165, 77, 193, 102, 184, 139, 61, 147], p.shade);
        polygon(c, '#8a5d55', [21, 122, 39, 88, 72, 65, 68, 35, 115, 25, 114, 60, 136, 74, 104, 99, 86, 143]);
        polygon(c, '#a56858', [114, 60, 115, 25, 146, 46, 160, 74, 179, 104, 154, 113, 136, 74]);
        oval(c, '#392737', 104, 45, 43, 23, '#b47658');
        oval(c, '#e87e3a', 106, 46, 30, 13);
        line(c, '#fa8440', 9, [111, 48, 124, 71, 111, 94, 124, 116, 113, 143]);
        line(c, '#ffcb67', 3, [111, 48, 124, 71, 111, 94, 124, 116, 113, 143]);
      } else {
        bevel(c, 9, 45, 184, 87, color, p.shade);
        for (const x of [40, 73, 120, 155]) {
          line(c, p.shade, 13, [x, 103, x, 41, x + 8, 31]);
          line(c, '#e6a36b', 4, [x - 3, 100, x - 3, 42, x + 5, 32]);
          oval(c, '#de873f', x + 8, 29, 9, 5, p.shade);
        }
        windows(c, p, 117);
      }
      return;
    }
    case 'candy': {
      polygon(c, '#c77d70', [16, 71, 185, 71, 167, 143, 36, 143], p.shade);
      for (let x = 32; x < 175; x += 13) line(c, '#ffbf93', 3, [x, 94, 100 + (x - 100) * 0.78, 136]);
      oval(c, color, 100, 78, 92, 34, p.shade);
      oval(c, color, 102, 56, 72, 32, p.shade);
      oval(c, bodyGrad(c, 32, 10, 115, 55, p.light, color), 105, 34, 49, 25, p.shade);
      oval(c, '#c15a62', 102, 19, 13, 12, p.shade);
      line(c, '#935b55', 3, [104, 15, 110, 4, 119, 3]);
      for (const [i, x, y] of [[0, 31, 74], [1, 57, 51], [2, 84, 73], [3, 146, 71], [4, 127, 53], [5, 160, 64]]) {
        line(c, p.colors[(i + style + 1) % 6], 5, [x, y, x + 9, y - 4 + (i % 2) * 8]);
      }
      return;
    }
    case 'castle': {
      if (style === 6) {
        bevel(c, 0, 45, 200, 92, color, p.shade, 24);
        for (let x = 5; x < 190; x += 25) bevel(c, x, 29, 16, 26, '#d7c4a5', p.shade, 11);
        for (const y of [91, 114, 133]) {
          line(c, '#655b5770', 2, [1, y, 195, y]);
          for (let x = 14 + (y % 2) * 14; x < 195; x += 27) box(c, '#655b5770', x, y, 2, 21);
        }
        return;
      }
      bevel(c, 12, 42, 177, 94, color, p.shade);
      for (const y of [85, 100, 114, 129]) {
        line(c, '#655b5755', 2, [16, y, 185, y]);
        for (let x = 28 + (y % 2) * 13; x < 180; x += 24) box(c, '#655b5755', x, y, 2, 13);
      }
      bevel(c, 41, 20, 119, 73, p.colors[(style + 2) % 6], p.shade);
      for (let x = 42; x < 145; x += 22) bevel(c, x, 17, 13, 10, color, p.shade, 4);
      for (const x of [23, 177]) {
        oval(c, '#746664', x, 91, 23, 23, p.shade);
        oval(c, color, x, 47, 23, 38, p.shade);
        polygon(c, '#aa635b', [x - 23, 42, x, 8, x + 23, 42], p.shade);
        box(c, p.light, x - 3, 55, 6, 17);
      }
      rounded(c, '#5e4144', 83, 105, 34, 38, 12);
      line(c, '#ba8b68', 2, [92, 115, 92, 140, 110, 140, 110, 116]);
      return;
    }
    case 'airport': {
      bevel(c, 9, 43, 183, 92, '#82989c', p.shade);
      rounded(c, color, 12, 16, 174, 96, 14, p.shade);
      rounded(c, '#527384', 21, 44, 155, 37, 8, p.shade);
      for (let x = 31; x <= 164; x += 18) box(c, '#b4d6d5', x, 50, 11, 24);
      for (const x of [20, 153]) {
        bevel(c, x, 84, 27, 35, '#d3d5ba', p.shade, 4);
        box(c, '#f7d68b', x + 9, 104, 10, 18);
      }
      if (style % 3 === 0) {
        rounded(c, '#bcc3b9', 83, 52, 35, 70, 6, p.shade);
        oval(c, '#43677b', 100, 43, 41, 28, p.shade);
        oval(c, '#b7d4d2', 100, 31, 38, 18, p.shade);
        line(c, p.shade, 2, [100, 29, 104, 9, 118, 9]);
      }
      windows(c, p, 123, 3);
      return;
    }
    case 'house': {
      if (style === 0 || style === 4) {
        rounded(c, '#775363', 12, 16, 175, 125, 13, p.shade);
        rounded(c, '#f3dab9', 20, 25, 158, 106, 11);
        rounded(c, color, 60, 28, 116, 99, 8, p.shade);
        rounded(c, '#f8d5dc', 25, 36, 32, 34, 7, p.shade);
        rounded(c, '#f8d5dc', 25, 77, 32, 34, 7, p.shade);
        for (const x of [81, 116, 150]) for (const y of [47, 79, 108]) box(c, '#ffede266', x - 12, y - 12, 24, 24);
      } else if (style === 1 || style === 5) {
        for (let i = 0; i < 3; i++) {
          bevel(c, 14 + i * 11, 65 - i * 18, 174 - i * 17, 65, p.colors[(style + i) % 6], p.shade);
          box(c, p.light, 21 + i * 11, 123 - i * 18, 146 - i * 17, 7);
        }
        oval(c, '#ffffff44', 100, 53, 26, 15);
      } else if (style === 2) {
        rounded(c, p.shade, 23, 40, 154, 110, 18);
        rounded(c, color, 26, 16, 148, 93, 15, p.shade);
        rounded(c, '#f1caab', 54, 36, 92, 67, 14, p.shade);
        rounded(c, color, 17, 62, 35, 67, 10, p.shade);
        rounded(c, color, 150, 62, 35, 67, 10, p.shade);
      } else {
        oval(c, '#965d48', 100, 101, 48, 46, p.shade);
        for (const x of [59, 138]) {
          oval(c, '#cd9170', x, 42, 25, 27, p.shade);
          oval(c, '#eab297', x, 44, 14, 16);
        }
        oval(c, color, 99, 77, 58, 47, p.shade);
        oval(c, '#f1bf9e', 99, 94, 30, 19);
        for (const x of [78, 121]) oval(c, p.shade, x, 72, 5, 7);
        oval(c, p.shade, 100, 87, 8, 5);
      }
      return;
    }
  }
}

export function paintQueuedScenery(c: Ctx, map: QueuedMap, style: number): void {
  const p = QUEUED_PALETTES[map], color = p.colors[style % p.colors.length];
  oval(c, '#25304635', 50, 79, 36, 11);
  switch (map) {
    case 'brickworks':
      bevel(c, 40, 47, 19, 32, '#9a6c46', p.shade, 3);
      bevel(c, 23, 27, 54, 25, color, p.shade, 9);
      bevel(c, 32, 13, 38, 25, style % 2 ? '#9ddba4' : '#86b752', p.shade, 8);
      return;
    case 'mushroom':
      rounded(c, p.light, 40, 39, 20, 41, 8, p.shade);
      oval(c, p.shade, 50, 43, 36, 13);
      c.beginPath();
      c.moveTo(14, 44);
      c.quadraticCurveTo(21, 8, 50, 8);
      c.quadraticCurveTo(79, 8, 86, 44);
      c.quadraticCurveTo(49, 59, 14, 44);
      fillStroke(c, color, p.shade, 2.5);
      for (const [x, y] of [[36, 32], [54, 20], [65, 38]]) oval(c, p.light, x, y, 6, 4);
      return;
    case 'tundra':
      if (style < 2) {
        box(c, '#78665b', 45, 67, 10, 15);
        polygon(c, '#466f76', [50, 12, 24, 50, 34, 48, 18, 73, 82, 73, 67, 47, 77, 50], p.shade);
        polygon(c, '#e7f5ef', [50, 13, 27, 46, 48, 38, 61, 44, 73, 46, 57, 19]);
        polygon(c, '#adced0', [33, 54, 20, 70, 48, 66, 61, 70, 79, 70, 68, 54, 52, 61]);
      } else {
        oval(c, '#334555', 49, 54, 20, 29, '#274154');
        oval(c, '#e4eee1', 48, 63, 13, 18);
        for (const x of [42, 56]) oval(c, '#edf6eb', x, 42, 4, 6);
        polygon(c, '#e8ab60', [46, 47, 56, 48, 49, 54]);
        oval(c, '#e8ab60', 39, 81, 7, 4);
        oval(c, '#e8ab60', 60, 81, 7, 4);
      }
      return;
    case 'volcano':
      polygon(c, style % 2 ? '#7a5664' : '#594653', [14, 77, 23, 47, 40, 33, 42, 12, 64, 17, 83, 48, 86, 78, 49, 86], p.shade);
      polygon(c, style % 2 ? '#cb7d68' : '#9a736f', [25, 48, 46, 18, 55, 36, 42, 69, 18, 77]);
      line(c, '#fca04d', 3, [57, 33, 57, 50, 69, 59, 64, 74]);
      return;
    case 'candy':
      line(c, '#fff1d4', 8, [49, 80, 49, 34]);
      oval(c, color, 49, 37, 25, 27, p.shade);
      c.beginPath();
      c.ellipse(49, 36, 16, 17, 0, 0, Math.PI * 1.75);
      c.strokeStyle = '#fff0db';
      c.lineWidth = 3;
      c.stroke();
      oval(c, '#fff4dc', 49, 37, 6, 5);
      return;
    case 'castle':
      if (style === 0) {
        box(c, '#b5a08a', 26, 40, 48, 39);
        box(c, '#6e5a54', 28, 68, 44, 10);
        for (const x of [26, 44, 62]) box(c, '#d0bea7', x, 29, 12, 15);
      } else {
        line(c, '#6b5147', 5, [40, 79, 40, 18]);
        polygon(c, style === 1 ? '#a9575c' : '#548082', [42, 20, 76, 26, 66, 38, 42, 38], p.shade);
        line(c, '#ead4a7', 2, [44, 23, 67, 28]);
      }
      return;
    case 'airport':
      rounded(c, '#a69578', 26, 37, 50, 43, 6, p.shade);
      rounded(c, color, 23, 28, 53, 34, 5, p.shade);
      for (const x of [31, 48, 64]) box(c, '#e4e7c9', x, 31, 5, 25);
      return;
    case 'house':
      if (style === 0) {
        bevel(c, 23, 41, 54, 24, color, p.shade, 7);
        bevel(c, 35, 24, 37, 24, p.colors[3], p.shade, 7);
        oval(c, '#ffe5b0', 51, 35, 8, 6);
      } else {
        rounded(c, color, 22, 28, 57, 39, 16, p.shade);
        oval(c, p.light, 51, 47, 17, 9);
        for (const x of [29, 72]) oval(c, p.shade, x, 68, 9, 7);
      }
      return;
  }
}

export function paintQueuedPlane(c: Ctx, color: string, shade: string, light: string): void {
  polygon(c, color, [96, 50, 81, 41, 59, 40, 35, 9, 22, 10, 37, 41, 17, 42, 8, 30, 3, 30, 8, 50, 3, 70, 8, 70,
    17, 58, 37, 59, 22, 90, 35, 91, 59, 60, 81, 59], shade);
  rounded(c, '#e5e9e3', 15, 41, 80, 18, 9, shade);
  polygon(c, shade, [86, 44, 90, 50, 86, 56, 80, 55, 82, 50, 80, 45]);
  line(c, light, 2, [27, 50, 73, 50]);
}
