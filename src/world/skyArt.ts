import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, lin, makeCanvas, poly, radial, rr, type Ctx } from '../art/draw';
import { Rng } from '../core/rng';

export function skyTexture(scene: Phaser.Scene, name: string, w: number, h: number, paint: (ctx: Ctx) => void): string {
  const key = `sky-${name}`;
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, w, h);
    paint(ctx);
    done();
  }
  return key;
}

export function box(c: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

export function line(c: Ctx, color: string, w: number, ...points: number[]): void {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.lineWidth = w;
  c.strokeStyle = color;
  c.stroke();
}

export function cloudBank(scene: Phaser.Scene, variant: number): string {
  return skyTexture(scene, `cloud-bank-${variant}`, 540, 276, c => {
    const rng = new Rng(821 + variant);
    for (let i = 0; i < 19; i++) {
      const x = rng.range(70, 467);
      const y = 130 + rng.range(-45, 55) + Math.abs(x - 270) * .16;
      const rx = rng.range(47, 73), ry = rng.range(31, 67);
      c.save();
      c.translate(x, y);
      c.scale(rx, ry);
      ellipse(c, 0, 0, 1, 1);
      fillStroke(c, radial(c, -.09, -.26, .02, 1.16, [
        [0, '#fffbf7'], [.43, '#edf4ff'], [.74, '#d6e4f8cc'], [1, '#c8d7f400'],
      ]), null);
      c.restore();
    }
  });
}

/** Riveted blue floatstone and bright brass uprights. Rotation points the outer lip away from the pad. */
export function railTexture(scene: Phaser.Scene): string {
  return skyTexture(scene, 'edge-rail', 128, 45, c => {
    box(c, lin(c, 0, 0, 0, 45, [[0, '#595d97'], [.4, '#3b4578'], [1, '#8c9bd200']]), 0, 6, 128, 39);
    box(c, '#7688ad', 0, 9, 128, 6);
    box(c, '#6b5069', 0, 1, 128, 7);
    box(c, '#ffd98a', 0, 0, 128, 3);
    for (const x of [5, 37, 69, 101]) {
      box(c, '#3b4e72', x, 1, 8, 22);
      box(c, '#d8a267', x + 1, 1, 2, 19);
      box(c, '#fff2aa', x + 3, 2, 4, 4);
      line(c, '#53578b', 3, x + 6, 18, x + 25, 33);
    }
  });
}

/** Bright canvas airships with gondolas, ribs, tail fins and striped envelope panels. */
export function dirigibleTexture(scene: Phaser.Scene, variant: number): string {
  const colors = [
    ['#ffe7a9', '#bd6364', '#ef9780', '#6b5779'],
    ['#caf7f3', '#4c8ab0', '#7bcbd7', '#46567f'],
    ['#f4c7ff', '#776ac5', '#d099dd', '#574888'],
  ];
  const [light, dark, fabric, trim] = colors[variant % colors.length];
  return skyTexture(scene, `dirigible-${variant}`, 480, 232, c => {
    ellipse(c, 234, 119, 213, 90);
    fillStroke(c, bodyGrad(c, 22, 28, 426, 180, light, dark), trim, 5);
    c.save();
    ellipse(c, 234, 119, 210, 86);
    c.clip();
    for (const y of [74, 118, 160]) {
      c.beginPath(); c.moveTo(16, 117); c.quadraticCurveTo(209, y, 451, 113);
      c.strokeStyle = y === 118 ? '#fff3c5' : fabric; c.lineWidth = y === 118 ? 12 : 19; c.stroke();
    }
    for (const x of [72, 122, 174, 227, 278, 330, 381, 421]) {
      c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + 32, 111, x, 211);
      c.strokeStyle = '#713d6855'; c.lineWidth = 3; c.stroke();
    }
    c.restore();
    for (const y of [25, 207]) {
      poly(c, [26, 117, 35, y, 85, y, 112, 117]);
      fillStroke(c, bodyGrad(c, 20, y, 100, 92, fabric, trim), trim, 4);
    }
    rr(c, 173, 95, 145, 43, 19); fillStroke(c, '#6b4568', '#4b3b61', 5);
    rr(c, 190, 99, 108, 30, 12); fillStroke(c, bodyGrad(c, 190, 99, 108, 30, '#fff5d3', '#6594b9'), '#b18281', 3);
    for (const x of [214, 242, 270]) line(c, '#806482', 2, x, 100, x, 128);
    for (const y of [74, 163]) {
      rr(c, 113, y - 11, 46, 22, 10); fillStroke(c, fabric, trim, 3);
      ellipse(c, 110, y, 8, 22); fillStroke(c, '#eff6ffb0', null);
    }
    ellipse(c, 423, 117, 8, 11); fillStroke(c, '#fff4a9', '#a67a77', 2);
  });
}

export function skyRoof(scene: Phaser.Scene, style: number): string {
  const palette = ['#66bbc8', '#d592a1', '#b09bd4', '#70b9ae', '#ddae7f', '#8798ce'];
  const roof = palette[style % palette.length];
  return skyTexture(scene, `roof-${style}`, 284, 284, c => {
    rr(c, 13, 18, 254, 254, 34); fillStroke(c, '#373d6366', null);
    rr(c, 15, 12, 249, 249, 29); fillStroke(c, '#53658c', '#46527c', 5);
    rr(c, 23, 16, 231, 225, 24); fillStroke(c, bodyGrad(c, 26, 16, 222, 220, '#f9ebdc', roof), '#fbddb0', 5);
    rr(c, 44, 31, 190, 190, 28); fillStroke(c, roof, '#568293', 4);
    for (const [x, y] of [[65, 57], [212, 57], [65, 195], [212, 195]]) {
      ellipse(c, x, y, 15, 15); fillStroke(c, '#fce5b7', '#785e81', 3);
      ellipse(c, x, y, 8, 8); fillStroke(c, '#81cdd5', '#5a89a8', 2);
    }
    for (const y of [45, 77, 109, 141, 173, 205]) {
      box(c, '#f9dda8', 13, y, 11, 7); box(c, '#b5dcde', 253, y, 12, 7);
    }
    for (const x of [54, 91, 128, 165, 202]) {
      box(c, '#394c77', x, 241, 19, 13);
      box(c, '#a7e1e4', x + 2, 243, 15, 5);
    }
  });
}

export function skyBridgeDeck(scene: Phaser.Scene, length: number, height: number, lifting: boolean): string {
  return skyTexture(scene, `bridge-deck-${length}-${height}-${lifting}`, length, height + 28, c => {
    box(c, '#40517a', 0, 27, length, height + 1);
    box(c, '#b6a8c4', 0, 11, length, height);
    box(c, '#596380', 0, 23, length, height - 46);
    box(c, '#68728c', 0, 29, length, height - 58);
    for (let x = 14; x < length - 15; x += 49) box(c, '#ead7a6', x, height / 2 - 2, 24, 4);
    for (const y of [11, height - 20]) {
      box(c, '#8d6978', 0, y, length, 14);
      box(c, '#f3c980', 0, y, length, 4);
      for (let x = 12; x < length; x += 29) {
        box(c, '#a38190', x, y, 7, 14);
        box(c, '#fff2ab', x + 1, y + 1, 5, 4);
        line(c, '#454e77', 3, x + 5, y + 12, x + 22, y + 30);
      }
    }
    if (lifting) {
      box(c, '#ae8477', 0, 19, 14, height - 38);
      box(c, '#e5ba7e', length - 8, 22, 8, height - 44);
      for (let y = 28; y < height - 23; y += 22) {
        ellipse(c, 7, y, 3, 3); fillStroke(c, '#fff5bc', null);
      }
    } else {
      for (const y of [4, height + 12]) {
        line(c, '#f5cf8d', 4, 6, y, length * .5, y + (y < 10 ? 33 : -33), length - 6, y);
        for (const x of [25, length - 25]) {
          rr(c, x - 10, y - 3, 20, 18, 4); fillStroke(c, '#bd8a74', '#734e6e', 3);
          box(c, '#ffe6a3', x - 3, y - 1, 6, 5);
        }
      }
    }
  });
}
