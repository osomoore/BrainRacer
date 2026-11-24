import { bodyGrad, ellipse, fillStroke, glossHighlight, type Ctx } from '../art/draw';

const INK = '#14223d';

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

export function paintJelly(c: Ctx): void {
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
}
