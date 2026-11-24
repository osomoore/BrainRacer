import { bodyGrad, ellipse, fillStroke, poly, rr, star, type Ctx } from '../art/draw';

const INK = '#293248';

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

function snow(c: Ctx, x: number, y: number, radius: number, color: string): void {
  for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
    line(c, [x - dx, y - dy, x + dx, y + dy], color, 1.7);
  }
}

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

export const QUEUED_BUDDY_PAINTERS = {
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
} satisfies Record<string, (ctx: Ctx) => void>;
