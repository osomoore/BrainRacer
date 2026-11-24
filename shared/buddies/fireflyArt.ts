import { bodyGrad, ellipse, fillStroke, radial, type Ctx } from '../art/draw';

const INK = '#1b2530';

function dot(c: Ctx, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, edge: string | null = null, width = 2): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, color, edge, width);
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

export function paintFirefly(c: Ctx): void {
  dot(c, 20, 30, 20, 21, radial(c, 20, 30, 2, 20, [[0, '#f8ffa5'], [0.6, '#b5ef7466'], [1, '#b5ef7400']]));
  for (const y of [17, 41]) {
    c.save();
    c.translate(27, y);
    c.rotate((y - 29) / 27);
    dot(c, 0, 0, 15, 7, bodyGrad(c, -12, -6, 24, 12, '#e9fff6', '#75c6c3'), INK, 2);
    line(c, [-9, 0, 4, 0], '#f3ffed', 1.3);
    c.restore();
  }
  dot(c, 16, 29, 11, 9, bodyGrad(c, 9, 22, 16, 16, '#fffed3', '#a3d853'), '#466656');
  dot(c, 30, 29, 9, 10, '#39796d', INK);
  dot(c, 40, 29, 11, 11, bodyGrad(c, 31, 20, 17, 18, '#b0da83', '#4f9d79'), INK);
  for (const y of [23, 35]) {
    line(c, [43, y, 50, y + (y - 29) * 0.7, 55, y - 3], INK, 1.8);
    dot(c, 44, y + (29 - y) * 0.43, 2.1, 2.3, INK);
  }
  line(c, [45, 28, 47, 29, 45, 30], '#fdf9ba', 1.5);
  dot(c, 12, 26, 3, 2.2, '#fffef2');
}
