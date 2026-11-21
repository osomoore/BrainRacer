import type Phaser from 'phaser';
import { lin, type Ctx } from '../art/draw';

export function underwaterTexture(scene: Phaser.Scene, name: string, w: number, h: number, draw: (c: Ctx) => void): string {
  const key = `underwater_world_${name}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) throw new Error(`Unable to allocate underwater texture ${key}`);
  draw(texture.getContext());
  texture.refresh();
  return key;
}

/** Translucent floor and glass skin with curved cross braces over straight roadways. */
export function paintTube(c: Ctx, w: number, h: number): void {
  c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#305d75ca'], [.4, '#2a638747'], [.6, '#2a638747'], [1, '#305d75ca']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#c8dcd68c';
  for (let x = 31; x < w; x += 128) c.fillRect(x, h / 2 - 1.5, 45, 3);
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
