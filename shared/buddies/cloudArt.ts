import { bodyGrad, ellipse, fillStroke, glossHighlight, type Ctx } from '../art/draw';

const INK = '#25324d';
export const CLOUD_EDGE = '#665187';

export function smile(c: Ctx, x: number, y: number, r: number, width: number) {
  c.beginPath();
  c.moveTo(x - r * 0.5, y - r);
  c.quadraticCurveTo(x + r, y, x - r * 0.5, y + r);
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}

/** Paint a single scalloped silhouette, including its soft reflected underside. */
export function cloud(c: Ctx, x: number, y: number, w: number, h: number, light: string, dark: string) {
  c.save();
  c.translate(x, y);
  c.scale(w / 100, h / 80);
  c.beginPath();
  c.moveTo(21, 66);
  c.bezierCurveTo(-1, 65, -4, 39, 13, 33);
  c.bezierCurveTo(12, 20, 24, 13, 36, 18);
  c.bezierCurveTo(40, -2, 68, -3, 75, 17);
  c.bezierCurveTo(89, 15, 99, 27, 94, 40);
  c.bezierCurveTo(109, 52, 98, 70, 83, 70);
  c.bezierCurveTo(77, 82, 57, 81, 50, 74);
  c.bezierCurveTo(41, 82, 26, 77, 21, 66);
  c.closePath();
  fillStroke(c, bodyGrad(c, 0, 0, 100, 80, light, dark), CLOUD_EDGE, 2.2);
  glossHighlight(c, 56, 17, 11, 4, 0.55);
  glossHighlight(c, 23, 34, 7, 3, 0.47);
  c.restore();
}

export function paintCloudPuff(c: Ctx): void {
  cloud(c, 5, 4, 81, 72, '#fffdf4', '#a6d5f6');
  for (const x of [32, 59]) {
    ellipse(c, x, 44, 4, 5);
    fillStroke(c, INK, null);
    glossHighlight(c, x - 1, 42, 1.3, 1.3, 0.9);
    ellipse(c, x + (x < 45 ? -5 : 5), 54, 5, 3);
    fillStroke(c, '#fbabce', null);
  }
  c.save();
  c.translate(45.5, 53);
  c.rotate(Math.PI / 2);
  smile(c, 0, 0, 7, 3);
  c.restore();
}
