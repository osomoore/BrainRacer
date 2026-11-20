import type Phaser from 'phaser';

type Context = CanvasRenderingContext2D;
export function undergroundTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Context) => void): string {
  const name = `underground_${key}`;
  if (!scene.textures.exists(name)) {
    const texture = scene.textures.createCanvas(name, w, h);
    if (!texture) throw new Error(`Could not allocate Underground texture ${name}`);
    draw(texture.getContext());
    texture.refresh();
  }
  return name;
}

export function block(c: Context, color: string, x: number, y: number, width: number, height: number): void {
  c.fillStyle = color; c.fillRect(x, y, width, height);
}

function oval(c: Context, color: string | CanvasGradient, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

function polygon(c: Context, color: string, points: number[]): void {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath(); c.fill();
}

export function glow(c: Context, x: number, y: number, r: number, rgb: string, strength = .65): void {
  const gradient = c.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, `rgba(${rgb},${strength})`);
  gradient.addColorStop(.35, `rgba(${rgb},${strength * .45})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  oval(c, gradient, x, y, r, r);
}

function crystal(c: Context, violet: boolean): void {
  glow(c, 76, 76, 75, violet ? '198,97,255' : '51,239,255');
  oval(c, '#191a35', 76, 104, 54, 19);
  const palette = violet ? ['#7b48b5', '#da82ff', '#573780', '#ffe1ff'] : ['#197ba7', '#39edfa', '#37509e', '#d2ffff'];
  for (const [x, y, size, angle] of [[46, 97, 47, -.51], [75, 100, 76, .1], [102, 101, 51, .61], [85, 110, 31, .64]]) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(size / 70, size / 70);
    polygon(c, palette[0], [-16, 0, -16, -48, 2, -70, 16, -50, 16, -10, 7, 3]);
    polygon(c, palette[1], [-16, -48, 2, -70, 7, -48, 4, -8, -16, 0]);
    polygon(c, palette[2], [7, -48, 16, -50, 16, -10, 7, 3, 4, -8]);
    polygon(c, palette[3], [-12, -47, 2, -66, 7, -48, 1, -53]);
    c.restore();
  }
}

const drawings: Record<string, (c: Context) => void> = {
  crystal: c => crystal(c, false),
  'violet-crystal': c => crystal(c, true),
  mushroom: c => {
    glow(c, 76, 75, 71, '101,252,151');
    for (const [x, y, s] of [[39, 99, .72], [75, 92, 1], [109, 111, .67]]) {
      oval(c, '#203645', x, y + 8, 24 * s, 13 * s);
      block(c, '#a0d5bd', x - 5 * s, y - 22 * s, 10 * s, 30 * s);
      oval(c, '#73dbab', x, y - 22 * s, 24 * s, 15 * s);
      oval(c, '#a2fbb8', x - 2 * s, y - 28 * s, 19 * s, 13 * s);
      oval(c, '#fff0ae', x - 6 * s, y - 31 * s, 4 * s, 3 * s);
    }
  },
  stalagmite: c => {
    oval(c, '#141229', 79, 107, 67, 18);
    for (const [x, y, s] of [[50, 109, .82], [87, 114, 1.12], [112, 111, .58]]) {
      polygon(c, '#5a4a70', [x - 27 * s, y, x - 16 * s, y - 23 * s, x - 4 * s, y - 68 * s, x + 8 * s, y - 52 * s, x + 23 * s, y]);
      polygon(c, '#3d3557', [x - 4 * s, y - 67 * s, x + 7 * s, y - 15 * s, x + 23 * s, y, x + 8 * s, y - 52 * s]);
    }
  },
  fissure: c => {
    glow(c, 76, 76, 73, '255,97,61', .48);
    const shape = [10, 109, 27, 79, 62, 81, 71, 48, 92, 53, 127, 28, 121, 57, 82, 65, 75, 101, 41, 95];
    polygon(c, '#692947', shape);
    polygon(c, '#ff7e51', [15, 105, 30, 84, 65, 87, 74, 53, 91, 58, 124, 34, 115, 55, 80, 62, 71, 95, 37, 92]);
    polygon(c, '#ffd581', [33, 87, 66, 89, 76, 54, 78, 61, 70, 93]);
  },
  lantern: c => {
    glow(c, 76, 76, 74, '255,190,83');
    block(c, '#4e3b4a', 69, 65, 14, 58);
    oval(c, '#191828', 76, 118, 20, 9);
    block(c, '#523d40', 61, 54, 30, 42);
    block(c, '#ffc56f', 66, 59, 20, 28);
    block(c, '#fff5bb', 70, 63, 12, 18);
    for (const x of [64, 75, 86]) block(c, '#785046', x, 57, 2, 31);
  },
  floodlight: c => {
    polygon(c, 'rgba(180,209,255,.21)', [76, 73, 140, 14, 150, 129]);
    glow(c, 80, 73, 69, '161,205,255', .46);
    block(c, '#1c2439', 30, 52, 35, 43); block(c, '#545b78', 61, 49, 21, 48);
    block(c, '#c6f4ff', 74, 53, 11, 40);
    for (const y of [58, 69, 80]) block(c, '#59718a', 72, y, 15, 3);
  },
  elevator: c => {
    glow(c, 77, 77, 71, '147,132,255', .34);
    block(c, '#131428', 19, 19, 114, 114); block(c, '#62577a', 24, 24, 104, 10);
    block(c, '#463a59', 24, 118, 104, 10);
    for (const x of [27, 115]) block(c, '#9693b4', x, 27, 8, 98);
    block(c, '#302a46', 39, 40, 74, 73);
    for (let x = 43; x < 111; x += 10) block(c, '#666383', x, 48, 3, 57);
    block(c, '#f9b87b', 47, 102, 58, 5); block(c, '#91ffed', 69, 29, 14, 4);
  },
  chute: c => {
    polygon(c, '#45354b', [16, 22, 136, 22, 121, 79, 100, 127, 53, 127, 29, 78]);
    polygon(c, '#79637b', [21, 27, 131, 27, 108, 87, 96, 116, 55, 116, 38, 85]);
    polygon(c, '#282032', [36, 31, 117, 31, 100, 79, 88, 105, 62, 105, 48, 72]);
    for (const [x, y] of [[67, 87], [79, 76], [63, 59], [87, 48], [92, 68]]) {
      polygon(c, '#e49a65', [x - 9, y, x - 5, y - 9, x + 7, y - 6, x + 9, y + 3, x + 1, y + 6]);
    }
  },
  'ore-bin': c => {
    for (const [x, y] of [[18, 41], [77, 64]]) {
      block(c, '#20192a', x - 4, y - 4, 63, 58); block(c, '#897083', x, y, 56, 49);
      block(c, '#413353', x + 5, y + 5, 46, 35);
      for (const [dx, dy] of [[15, 14], [27, 22], [41, 30], [23, 30], [36, 12]]) {
        polygon(c, '#bdcfe8', [x + dx - 6, y + dy, x + dx, y + dy - 7, x + dx + 5, y + dy - 1, x + dx + 3, y + dy + 4]);
      }
      block(c, '#c2a1a5', x + 2, y + 42, 52, 5);
    }
  },
  portal: c => {
    glow(c, 76, 64, 63, '127,112,255', .4);
    oval(c, '#120e20', 76, 83, 53, 41);
    for (const x of [26, 110]) {
      block(c, '#3b2638', x, 47, 15, 68); block(c, '#a97460', x + 3, 47, 8, 59);
      block(c, '#74728b', x - 2, 100, 19, 10);
    }
    block(c, '#704a46', 20, 41, 112, 15); block(c, '#b48463', 20, 41, 112, 5);
    block(c, '#c791ff', 47, 53, 58, 3);
  },
  vent: c => {
    oval(c, '#181629', 76, 79, 55, 39); oval(c, '#5e5368', 76, 75, 49, 33); oval(c, '#242439', 76, 75, 40, 25);
    for (const x of [53, 65, 77, 89, 101]) block(c, '#6f6884', x, 55, 4, 40);
  },
  steam: c => {
    glow(c, 74, 75, 61, '187,221,255', .46);
    for (const [x, y, rx] of [[43, 89, 20], [76, 60, 29], [95, 83, 31], [64, 97, 25]]) {
      oval(c, 'rgba(211,231,249,.21)', x, y, rx, rx * .71);
    }
  },
  pool: c => {
    glow(c, 76, 77, 76, '47,225,205', .32);
    oval(c, '#132432', 76, 77, 69, 47); oval(c, '#206075', 76, 76, 60, 39);
    oval(c, '#248b93', 75, 75, 55, 32); oval(c, '#43a698', 62, 65, 32, 18);
    for (const [x, y] of [[53, 55], [85, 72], [64, 91]]) block(c, '#a7fff1', x, y, 18, 2);
  },
  barrier: c => {
    block(c, '#16192a', 9, 63, 134, 28); block(c, '#53486a', 11, 65, 130, 16);
    for (let x = 14; x < 130; x += 22) polygon(c, '#e8b575', [x, 65, x + 10, 65, x + 19, 81, x + 9, 81]);
    for (const x of [13, 68, 121]) block(c, '#8f849b', x, 75, 12, 19);
  },
  chevron: c => {
    for (const x of [53, 73, 93]) polygon(c, 'rgba(136,240,255,.65)', [x - 12, 53, x, 53, x + 19, 76, x, 99, x - 12, 99, x + 6, 76]);
  },
  ember: c => {
    glow(c, 76, 76, 27, '255,242,126');
    oval(c, '#fff1a4', 76, 76, 4, 6);
  },
  'lava-bubble': c => {
    glow(c, 76, 76, 62, '255,205,110', .62);
    c.strokeStyle = 'rgba(255,229,132,.8)'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(76, 76, 28, 19, .24, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#fff3aa'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(76, 76, 19, 12, .24, Math.PI, Math.PI * 1.6); c.stroke();
  },
  basalt: c => {
    glow(c, 76, 76, 69, '255,208,107', .46);
    polygon(c, '#b94b48', [23, 67, 48, 53, 81, 30, 119, 46, 135, 83, 116, 107, 73, 115, 27, 101]);
    polygon(c, '#3f2e48', [29, 70, 80, 41, 112, 53, 126, 82, 110, 100, 74, 106, 34, 94]);
    polygon(c, '#68506a', [29, 70, 80, 41, 112, 53, 98, 70, 71, 61, 52, 83]);
    polygon(c, '#614458', [52, 83, 71, 61, 98, 70, 110, 100, 74, 106]);
  },
};

export function undergroundArt(scene: Phaser.Scene): (name: string) => string {
  return name => undergroundTexture(scene, name, 152, 152, drawings[name]);
}
