import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, lin, radial, rr, type Ctx } from '../art/draw';

export function underwaterTexture(scene: Phaser.Scene, name: string, w: number, h: number, draw: (c: Ctx) => void): string {
  const key = `underwater_world_${name}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) throw new Error(`Unable to allocate underwater texture ${key}`);
  draw(texture.getContext());
  texture.refresh();
  return key;
}

export function paintDome(c: Ctx, base: string, glass: string, glint: string): void {
  ellipse(c, 137, 143, 111, 105);
  fillStroke(c, '#112e48', '#12374e', 5);
  ellipse(c, 127, 124, 115, 110);
  fillStroke(c, bodyGrad(c, 12, 14, 230, 220, '#90d8d2', base), '#174756', 5);
  for (let i = 0; i < 18; i++) {
    c.save();
    c.translate(127, 124);
    c.rotate(i * Math.PI / 9);
    rr(c, 99, -7, 11, 14, 3);
    fillStroke(c, i % 3 ? '#276371' : '#ffdc9b', null);
    c.restore();
  }
  ellipse(c, 127, 122, 94, 91);
  fillStroke(c, radial(c, 98, 77, 10, 145, [[0, glint], [0.42, glass], [1, base]]), '#a5ded0', 4);
  c.lineWidth = 4;
  c.strokeStyle = '#e5ffef8f';
  c.beginPath();
  c.ellipse(127, 122, 82, 80, 0, 3.55, 5.07);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#d4ffef44';
  c.beginPath();
  c.ellipse(127, 122, 52, 90, -0.35, 0, Math.PI * 2);
  c.ellipse(127, 122, 65, 90, 0.87, 0, Math.PI * 2);
  c.stroke();
  for (const [x, y] of [[72, 86], [85, 74], [89, 88], [159, 161], [175, 149]]) {
    ellipse(c, x, y, 5, 6);
    fillStroke(c, '#f8e8a9', null);
  }
}

/** Glass skin with curved cross braces. Paint only where the roadway is straight. */
export function paintTube(c: Ctx, w: number, h: number, deck: boolean): void {
  if (deck) {
    c.fillStyle = '#294d63';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8dcd68c';
    for (let x = 31; x < w; x += 128) c.fillRect(x, h / 2 - 1.5, 45, 3);
  }
  for (const flip of [false, true]) {
    c.save();
    if (flip) { c.translate(0, h); c.scale(1, -1); }
    c.fillStyle = lin(c, 0, 0, 0, h * 0.21, [[0, '#4da39c55'], [0.25, '#81e9da73'], [1, '#316f7900']]);
    c.fillRect(0, 0, w, h * 0.21);
    c.fillStyle = '#b1ffed';
    c.fillRect(0, 9, w, 2);
    c.fillStyle = '#88ead84a';
    c.fillRect(0, 18, w, 4);
    c.restore();
  }
  for (let x = 28; x < w; x += 128) {
    const brace = () => {
      c.beginPath();
      c.moveTo(x, 2);
      c.bezierCurveTo(x + 44, h * 0.24, x + 44, h * 0.76, x, h - 2);
    };
    brace();
    c.lineWidth = 10;
    c.strokeStyle = '#1a565e8c';
    c.stroke();
    brace();
    c.lineWidth = 4;
    c.strokeStyle = '#b5ffe690';
    c.stroke();
  }
}

export function paintKelp(c: Ctx): void {
  for (const [x, y, sway] of [[39, 132, 19], [65, 147, -30], [91, 147, 37], [83, 135, -24], [121, 142, 19]]) {
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - sway, y - 45, x + sway, 61, x + sway / 2, 17);
    c.bezierCurveTo(x + sway * 1.8, 57, x - sway * 0.7, y - 33, x + 8, y);
    c.closePath();
    fillStroke(c, bodyGrad(c, 25, 9, 114, 140, '#78b96c', '#267a70'), '#296663', 2);
  }
}

export function paintCoral(c: Ctx, color: string): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const [ox, oy, tilt] of [[43, 107, -0.37], [103, 106, 0.41], [77, 124, 0.05]]) {
    c.save();
    c.translate(ox, oy);
    c.rotate(tilt);
    c.strokeStyle = '#203a59';
    for (const width of [16, 12]) {
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(0, 20);
      c.quadraticCurveTo(-6, -20, 3, -61);
      c.moveTo(-2, 4);
      c.quadraticCurveTo(-29, -9, -29, -35);
      c.moveTo(-1, -11);
      c.quadraticCurveTo(23, -29, 21, -46);
      c.stroke();
      c.strokeStyle = color;
    }
    c.restore();
  }
  ellipse(c, 75, 136, 59, 12);
  fillStroke(c, '#23445b', '#426278', 3);
}
