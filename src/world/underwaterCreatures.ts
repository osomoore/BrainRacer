import { bodyGrad, ellipse, fillStroke, poly, radial, type Ctx } from '../art/draw';

const OUTLINE = '#17415b';

export function paintManta(c: Ctx): void {
  c.beginPath();
  c.moveTo(132, 98);
  c.bezierCurveTo(101, 95, 69, 116, 11, 99);
  c.bezierCurveTo(83, 104, 93, 86, 133, 87);
  c.closePath();
  fillStroke(c, '#386a91', OUTLINE, 3);
  c.beginPath();
  c.moveTo(88, 92);
  c.bezierCurveTo(136, 83, 132, 34, 191, 12);
  c.bezierCurveTo(177, 35, 237, 62, 234, 94);
  c.bezierCurveTo(231, 127, 176, 150, 190, 178);
  c.bezierCurveTo(133, 161, 134, 107, 88, 92);
  c.closePath();
  fillStroke(c, bodyGrad(c, 90, 20, 141, 160, '#9c9cce', '#345d92'), OUTLINE, 4);
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(121, 93);
    c.quadraticCurveTo(158, 92 + side * 34, 185, 93 + side * 61);
    c.strokeStyle = '#abcee4';
    c.lineWidth = 3;
    c.stroke();
    ellipse(c, 218, 93 + side * 15, 8, 5);
    fillStroke(c, '#d0faff', OUTLINE, 2);
    ellipse(c, 221, 93 + side * 15, 3, 3);
    fillStroke(c, OUTLINE, null);
  }
  ellipse(c, 173, 93, 34, 15);
  fillStroke(c, '#536b9a', null);
}

export function paintTurtle(c: Ctx): void {
  for (const side of [-1, 1]) {
    c.save();
    c.translate(0, 71);
    c.scale(1, side);
    c.beginPath();
    c.moveTo(111, 12);
    c.quadraticCurveTo(110, 49, 158, 63);
    c.quadraticCurveTo(162, 37, 135, 18);
    c.closePath();
    fillStroke(c, '#70b594', OUTLINE, 4);
    ellipse(c, 52, 28, 23, 12);
    fillStroke(c, '#429981', OUTLINE, 4);
    c.restore();
  }
  ellipse(c, 155, 71, 25, 18);
  fillStroke(c, '#9cd5a0', OUTLINE, 4);
  ellipse(c, 87, 71, 58, 42);
  fillStroke(c, bodyGrad(c, 35, 28, 111, 90, '#c9d780', '#378779'), OUTLINE, 5);
  for (const [x, y] of [[63, 49], [100, 45], [82, 71], [116, 69], [62, 91], [100, 95]]) {
    const points = [-2, -1, 0, 1, 2, 3].flatMap(i => [x + Math.cos(i * Math.PI / 3) * 15, y + Math.sin(i * Math.PI / 3) * 13]);
    poly(c, points);
    fillStroke(c, '#358e77b0', '#d1e3a59c', 2);
  }
  for (const y of [61, 81]) {
    ellipse(c, 169, y, 4, 4);
    fillStroke(c, '#123b49', '#daf2bc', 1.4);
  }
}

export function paintJelly(c: Ctx): void {
  for (const [x, endX, endY] of [[32, 25, 106], [42, 33, 113], [56, 53, 109], [66, 78, 104]]) {
    c.beginPath();
    c.moveTo(x, 56);
    c.bezierCurveTo(x - 14, 76, endX + 13, 82, endX, endY);
    c.lineCap = 'round';
    c.strokeStyle = '#e78ee5ac';
    c.lineWidth = 4;
    c.stroke();
  }
  c.beginPath();
  c.moveTo(15, 54);
  c.bezierCurveTo(12, 28, 29, 13, 48, 13);
  c.bezierCurveTo(71, 13, 86, 35, 84, 54);
  c.quadraticCurveTo(78, 68, 65, 61);
  c.quadraticCurveTo(53, 69, 46, 62);
  c.quadraticCurveTo(31, 70, 24, 61);
  c.quadraticCurveTo(15, 63, 15, 54);
  c.closePath();
  fillStroke(c, radial(c, 38, 30, 4, 62, [[0, '#ffe3f9'], [.55, '#d399eadc'], [1, '#7f73d6b8']]), '#cba5ffbf', 3);
  ellipse(c, 38, 25, 10, 4);
  fillStroke(c, '#fff0f6', null);
}

export function paintSchoolFish(c: Ctx, coat: string, mark: string): void {
  poly(c, [20, 15, 3, 3, 4, 28, 20, 20]);
  fillStroke(c, mark, OUTLINE, 2);
  ellipse(c, 30, 16, 18, 12);
  fillStroke(c, coat, OUTLINE, 2);
  c.beginPath();
  c.moveTo(28, 6);
  c.quadraticCurveTo(22, 16, 29, 26);
  c.strokeStyle = mark;
  c.lineWidth = 5;
  c.stroke();
  ellipse(c, 40, 13, 2, 2);
  fillStroke(c, OUTLINE, null);
}
