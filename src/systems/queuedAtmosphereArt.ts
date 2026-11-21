import type Phaser from 'phaser';
import { ellipse, lin, makeCanvas, poly, radial, star, type Ctx } from '../art/draw';
import type { QueuedMap } from '../config/queuedMaps';
import { TEX } from '../core/assetKeys';
import { Rng } from '../core/rng';

const WIDTH = 512, HEIGHT = 288;

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): string {
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, w, h);
    paint(ctx);
    done();
  }
  return key;
}

function dust(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color;
  ellipse(c, x, y, r, r);
  c.fill();
}

function haze(c: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.scale(rx, ry);
  c.fillStyle = radial(c, 0, 0, 0, 1, [[0, color], [.46, color], [1, `${color.slice(0, 7)}00`]]);
  c.fillRect(-1, -1, 2, 2);
  c.restore();
}

/** Evenly spread imperfect lines of flecks across a wide tapered front. */
function flecks(rng: Rng, count: number, draw: (x: number, y: number, fade: number) => void): void {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2), radius = Math.sqrt(rng.next());
    draw(256 + Math.cos(angle) * radius * 219, 144 + Math.sin(angle) * radius * 110, 1 - radius * .74);
  }
}

const PAINT: Record<QueuedMap, (c: Ctx, rng: Rng) => void> = {
  tundra(c, rng) {
    haze(c, 265, 140, 238, 103, '#ecfaff65');
    haze(c, 221, 118, 175, 49, '#d1eef850');
    haze(c, 291, 181, 194, 37, '#e6f9ff45');
    flecks(rng, 160, (x, y, fade) => {
      const length = rng.range(4, 30), weight = rng.range(.45, 1.4);
      c.globalAlpha = fade;
      c.lineWidth = weight;
      c.strokeStyle = lin(c, x - length, y, x, y, [[0, '#d8f5ff00'], [.8, '#effaff'], [1, '#ffffff']]);
      c.beginPath();
      c.moveTo(x - length, y + 1);
      c.lineTo(x, y);
      c.stroke();
    });
    c.globalAlpha = 1;
  },
  mushroom(c, rng) {
    // Slow, bulbous clouds with bright circular spores caught in the billows.
    for (const [x, y, rx, ry, ink] of [
      [134, 148, 120, 61, '#f1bbd48c'], [215, 133, 109, 77, '#d99ce98a'],
      [284, 157, 97, 54, '#fdd2a389'], [352, 118, 91, 53, '#d3b2f18c'],
      [394, 165, 88, 59, '#a6ecd66a'], [242, 206, 123, 46, '#c5b2ed62'],
    ] as const) haze(c, x, y, rx, ry, ink);
    flecks(rng, 90, (x, y, fade) => {
      const r = rng.range(1.1, 4.5);
      c.globalAlpha = fade;
      dust(c, x, y, r + 2.6, '#ffcf7e45');
      dust(c, x + .5, y - .5, r, rng.pick(['#fff7d4', '#efc8ff', '#c4ffe1']));
      if (r > 3) dust(c, x + 1, y - 1.5, 1.4, '#ffffff');
    });
    c.globalAlpha = 1;
  },
  volcano(c, rng) {
    haze(c, 240, 144, 230, 104, '#211825a0');
    haze(c, 196, 124, 168, 58, '#41303f82');
    haze(c, 330, 167, 151, 61, '#713e4a70');
    flecks(rng, 96, (x, y, fade) => {
      c.globalAlpha = fade;
      const ember = rng.chance(.26), r = rng.range(.8, 3.4);
      if (ember) {
        haze(c, x, y, r * 3.3, r * 2.7, '#ff6e4a9b');
        dust(c, x, y, r, rng.pick(['#ffab54', '#ffdc89', '#ed694e']));
      } else {
        dust(c, x, y, r, rng.pick(['#645765', '#99818a', '#d5a39c']));
      }
    });
    c.globalAlpha = 1;
  },
  brickworks(c, rng) {
    haze(c, 274, 147, 232, 96, '#d9b47a60');
    haze(c, 177, 138, 122, 54, '#f7d79f50');
    flecks(rng, 55, (x, y, fade) => {
      const size = rng.int(2, 9);
      c.globalAlpha = fade;
      c.fillStyle = rng.pick(['#f2cb87', '#b78667', '#d2a26f']);
      c.fillRect(Math.round(x), Math.round(y), size, size);
      c.fillStyle = '#fff1bd';
      c.fillRect(Math.round(x), Math.round(y), size, 1.5);
    });
    c.globalAlpha = 1;
  },
  candy(c, rng) {
    haze(c, 233, 139, 209, 77, '#f7b5e674');
    haze(c, 331, 166, 139, 71, '#ebd7f06e');
    flecks(rng, 51, (x, y, fade) => {
      c.globalAlpha = fade;
      c.fillStyle = rng.pick(['#fbffeb', '#ffd994', '#fb97b8', '#baf0ed', '#c5a5ed']);
      star(c, x, y, rng.range(3.5, 9.5), 2, 4, rng.range(0, Math.PI));
      c.fill();
    });
    c.globalAlpha = 1;
  },
  castle(c, rng) {
    c.strokeStyle = '#f2ddae75';
    c.lineWidth = 1.3;
    for (let i = 0; i < 14; i++) {
      const x = rng.range(45, 350), y = rng.range(47, 232);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 50, y + 12, x + rng.range(65, 104), y - 3);
      c.stroke();
    }
    flecks(rng, 36, (x, y, fade) => {
      const leaf = rng.range(4, 9);
      c.save();
      c.translate(x, y);
      c.rotate(rng.range(-.7, .8));
      c.globalAlpha = fade;
      c.fillStyle = rng.pick(['#d9ba65', '#c48653', '#d5d199']);
      c.beginPath();
      c.moveTo(-leaf, 0);
      c.quadraticCurveTo(0, -leaf, leaf, 0);
      c.quadraticCurveTo(0, leaf, -leaf, 0);
      c.fill();
      c.restore();
    });
  },
  airport(c) {
    haze(c, 250, 152, 246, 68, '#d7e6ef79');
    haze(c, 176, 107, 141, 47, '#fffffdb8');
    haze(c, 299, 119, 154, 48, '#f9fcfdac');
    haze(c, 338, 154, 161, 50, '#e9f5f3a4');
    haze(c, 191, 180, 141, 30, '#eaf4f297');
  },
  house(c, rng) {
    haze(c, 262, 154, 219, 89, '#e9c78e65');
    c.fillStyle = lin(c, 123, 75, 386, 205, [[0, '#fff7c900'], [.42, '#ffd99427'], [.66, '#fff4ce28'], [1, '#ffe5a500']]);
    poly(c, [38, 60, 116, 47, 460, 169, 413, 235]);
    c.fill();
    flecks(rng, 57, (x, y, fade) => {
      c.globalAlpha = fade;
      const r = rng.range(.7, 3.2);
      dust(c, x + .8, y + .7, r, '#9a715a89');
      dust(c, x, y, r, rng.pick(['#ffefb3', '#fffbe1', '#ffcf9a']));
    });
    c.globalAlpha = 1;
  },
};

export function queuedWeatherTexture(scene: Phaser.Scene, map: QueuedMap): string {
  return bake(scene, TEX.queuedFeature.mover(`${map}-weather`), WIDTH, HEIGHT,
    c => PAINT[map](c, new Rng(0x7a11)));
}

export function snowTrackTexture(scene: Phaser.Scene): string {
  return bake(scene, TEX.queuedFeature.mover('tundra-snow-track'), 34, 16, c => {
    c.fillStyle = lin(c, 0, 0, 0, 16, [[0, '#e9f5fa00'], [.16, '#f5feffdf'], [.34, '#577c94ca'],
      [.64, '#40637aa5'], [.83, '#e0f4facb'], [1, '#e9f4fa00']]);
    c.fillRect(0, 0, 34, 16);
    for (let x = 3; x < 34; x += 6) {
      c.fillStyle = '#30567861';
      poly(c, [x, 4, x + 2, 4, x + 5, 7, x + 5, 10, x + 3, 11, x + 3, 7]);
      c.fill();
    }
  });
}
