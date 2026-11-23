/**
 * Dino Lab scene kit, layer 2: the pictures. Every drawing is registered with `def()` (paint.ts) and only
 * baked when a scene first asks for it via `image(scene, key, ...)`.
 *
 * Origins: props stand on their origin (ground contact, bottom centre) unless noted. Everything faces +x;
 * flip with scaleX = -1. Particle textures (`p:*`) are centred. Keys with `:` have variants.
 *
 * Groups: sky/background, ground and walls, plants, rocks and props, water, particles, critters.
 */
import {
  INK, blob, bakeRng, darken, def, eye, arcEye, lighten, oval, poly, rrect, smile, star, stroke, vgrad, type G,
} from './paint';

// ================================================================== sky / background
def('px', 4, 4, 0, 0, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); });

/** Vertical gradient strip, stretch it over the sky. Key: `sky:<top>:<bottom>` (hex without #). */
export function skyKey(top: string, bottom: string): string {
  const k = `sky:${top}:${bottom}`;
  def(k, 8, 256, 0, 0, (g) => { g.fillStyle = vgrad(g, 0, 256, `#${top}`, `#${bottom}`); g.fillRect(0, 0, 8, 256); });
  return k;
}

def('cloud', 260, 150, 130, 75, (g) => {
  g.fillStyle = '#ffffff';
  for (const [x, y, r] of [[-70, 12, 34], [-30, -10, 44], [20, -18, 48], [64, 4, 38], [0, 20, 40]] as const) { g.beginPath(); g.arc(130 + x, 80 + y, r, 0, 6.3); g.fill(); }
});

def('sun', 260, 260, 130, 130, (g) => {
  g.fillStyle = '#ffe36b';
  for (let i = 0; i < 12; i++) {
    g.save(); g.translate(130, 130); g.rotate((i * Math.PI) / 6);
    g.beginPath(); g.moveTo(-14, -90); g.lineTo(0, -126); g.lineTo(14, -90); g.closePath(); g.fill(); g.restore();
  }
  g.beginPath(); g.arc(130, 130, 84, 0, 6.3); g.fillStyle = '#fff2a8'; g.fill();
  g.beginPath(); g.arc(130, 130, 70, 0, 6.3); g.fillStyle = '#ffd23f'; g.fill();
});

/** Rolling hills / mountains / mesas strip, origin bottom-left. Key: `far:<kind>` kind = hills | peaks | mesas | dunes. */
function farStrip(kind: string, fillA: string, fillB: string, topCap?: string): void {
  def(`far:${kind}`, 1024, 320, 0, 320, (g) => {
    g.translate(0, 320);
    const rnd = bakeRng(kind.length * 977 + 5);
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? fillB : fillA;
      g.beginPath(); g.moveTo(0, 0);
      const base = layer ? -120 : -190;
      g.lineTo(0, base);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const x = (1024 / steps) * i;
        const hgt = base - (kind === 'peaks' ? 100 + rnd() * 100 : kind === 'mesas' ? 40 + rnd() * 50 : 30 + rnd() * 40);
        if (kind === 'peaks') { g.lineTo(x - 64, hgt); g.lineTo(x, base + (layer ? 0 : 20)); }
        else if (kind === 'mesas') { g.lineTo(x - 90, hgt); g.lineTo(x - 30, hgt); g.lineTo(x - 10, base); }
        else g.quadraticCurveTo(x - 64, hgt, x, base - 20 * rnd());
      }
      g.lineTo(1024, 0); g.closePath(); g.fill();
      if (topCap && kind === 'peaks' && layer === 0) {
        g.fillStyle = topCap;
        for (let i = 0; i < 4; i++) { const x = 128 + i * 256; g.beginPath(); g.moveTo(x - 40, -250); g.lineTo(x, -300); g.lineTo(x + 40, -250); g.lineTo(x + 14, -262); g.lineTo(x, -246); g.lineTo(x - 14, -262); g.closePath(); g.fill(); }
      }
    }
  });
}
farStrip('hills', '#8fd36b', '#6fbf55');
farStrip('peaks', '#9fb4d6', '#8197c4', '#ffffff');
farStrip('mesas', '#e39b6a', '#c9794c');
farStrip('dunes', '#f6d98d', '#eec36a');
farStrip('forest', '#4c9b57', '#3b8248');

/** Ground edge strip: tile it horizontally (tileSprite, 512 wide). Origin = top-left; the grass lip sits on the ground line. */
export function edgeKey(top: string, body: string, tuft = true): string {
  const k = `edge:${top}:${body}:${tuft ? 1 : 0}`;
  def(k, 512, 64, 0, 0, (g) => {
    g.fillStyle = `#${body}`; g.fillRect(0, 16, 512, 48);
    g.fillStyle = `#${top}`; g.fillRect(0, 0, 512, 22);
    if (tuft) for (let x = 0; x < 512; x += 32) { g.beginPath(); g.arc(x + 16, 18, 18, 0, Math.PI); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.08)'; for (let x = 10; x < 512; x += 64) { g.beginPath(); g.ellipse(x, 44, 14, 6, 0, 0, 6.3); g.fill(); }
    g.fillStyle = INK; g.fillRect(0, 0, 512, 0);
  });
  return k;
}

/** Cliff / rock wall tile, 256 x 256 (tileSprite). Key `wall:<kind>`: cliff | red | ice | dirt. */
function wallTile(kind: string, a: string, b: string, line: string): void {
  def(`wall:${kind}`, 256, 256, 0, 0, (g) => {
    const rnd = bakeRng(kind.charCodeAt(0) * 31);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, i * 64, 256, 64); }
    g.strokeStyle = line; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const x = Math.round(rnd() * 240) + 8, y = Math.round(rnd() * 3) * 64; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + 12, y + 30); g.lineTo(x - 4, y + 56); g.stroke(); }
    if (kind === 'ice') { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { const x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y - 30); g.stroke(); } }
  });
}
wallTile('cliff', '#b99a73', '#a98a64', '#7a5f40');
wallTile('red', '#e0845a', '#cf7048', '#9b4a2c');
wallTile('ice', '#cfeaff', '#b8dcf7', '#8fb8dc');
wallTile('dirt', '#a8744a', '#97653e', '#6e4426');

/** Thick ground cap for cliffs / ledges (tile 256 x 64). */
export function capKey(top: string): string {
  const k = `cap:${top}`;
  def(k, 256, 64, 0, 0, (g) => {
    g.fillStyle = `#${top}`; g.fillRect(0, 0, 256, 30);
    for (let x = 0; x < 256; x += 32) { g.beginPath(); g.arc(x + 16, 28, 16, 0, Math.PI); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 2); g.lineTo(256, 2); g.stroke();
  });
  return k;
}

// ================================================================== plants
/** Fern clump, origin bottom centre. Key `fern:<leaves>` e.g. fern:7 (thick) / fern:3 (thin). */
export function fernKey(n: number): string {
  const k = `fern:${n}`;
  def(k, 220, 210, 110, 206, (g) => {
    const greens = ['#3f9f4a', '#52b85a', '#2f8a3f'];
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : -1.15 + (2.3 * i) / (n - 1);
      g.save(); g.translate(110, 206); g.rotate(a);
      const len = 150 - Math.abs(a) * 22;
      g.beginPath(); g.ellipse(0, -len / 2, 16, len / 2, 0, 0, 6.3); g.fillStyle = greens[i % 3]; g.fill();
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
      for (let t = 1; t < 6; t++) {
        const y = -len * (t / 6.2), w = 16 + (6 - t) * 3;
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * w, y, 11, 6, s * 0.7, 0, 6.3); g.fillStyle = greens[(i + 1) % 3]; g.fill(); g.lineWidth = 2.5; g.stroke(); }
      }
      g.restore();
    }
  });
  return k;
}

def('flowers', 240, 170, 120, 166, (g) => {
  for (const x of [-80, -50, 50, 84]) { g.save(); g.translate(120 + x, 166); g.rotate(x / 220); g.beginPath(); g.ellipse(0, -36, 12, 38, 0, 0, 6.3); g.fillStyle = '#3f9f4a'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); }
  const fl: [number, number, number][] = [[-84, -100, 24], [-46, -128, 28], [-4, -112, 24], [40, -134, 28], [84, -104, 24], [-24, -150, 20], [66, -156, 18]];
  for (const [x, y, r] of fl) {
    g.beginPath(); g.moveTo(120 + x, 166); g.lineTo(120 + x, 166 + y); g.strokeStyle = '#2f8a3f'; g.lineWidth = 6; g.stroke();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; oval(g, 120 + x + Math.cos(a) * r * 0.62, 166 + y + Math.sin(a) * r * 0.62, r * 0.46, r * 0.46, '#a45cff', 3); }
    oval(g, 120 + x, 166 + y, r * 0.36, r * 0.36, '#ffd23f', 3);
  }
});

def('bush', 300, 190, 150, 186, (g) => {
  const cols = ['#4fbf5a', '#63d06a', '#3da34a'];
  [[-90, -50, 56], [90, -50, 56], [-40, -82, 66], [44, -86, 64], [0, -50, 60], [0, -120, 44]].forEach(([x, y, r], i) => oval(g, 150 + x, 186 + y, r, r * 0.85, cols[i % 3], 4));
  for (const [x, y] of [[-70, -90], [20, -130], [80, -70], [-10, -60]] as const) oval(g, 150 + x, 186 + y, 7, 7, '#ff7aa8', 2);
});

/** Tall grass blade clump, origin bottom centre (tile many, scaleY by level). */
export function grassKey(shade: number): string {
  const k = `grass:${shade}`;
  const cols = ['#5cc15a', '#47ad4b', '#76d46a'];
  def(k, 150, 300, 75, 298, (g) => {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const bx = 75 + (i - (n - 1) / 2) * 15, lean = (i - (n - 1) / 2) * 7, hgt = 230 + ((i * 37 + shade * 53) % 60);
      g.beginPath(); g.moveTo(bx - 10, 298); g.quadraticCurveTo(bx + lean * 0.2, 298 - hgt * 0.5, bx + lean, 298 - hgt);
      g.quadraticCurveTo(bx + lean * 0.5 + 6, 298 - hgt * 0.5, bx + 10, 298); g.closePath();
      g.fillStyle = cols[(i + shade) % 3]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1f6a34'; g.stroke();
    }
  });
  return k;
}

def('trunk', 150, 700, 75, 696, (g) => {
  g.beginPath(); g.moveTo(8, 696); g.quadraticCurveTo(50, 560, 42, 80); g.lineTo(108, 80); g.quadraticCurveTo(100, 560, 142, 696); g.closePath();
  g.fillStyle = '#9c6b3f'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = '#6e4626'; g.lineWidth = 4;
  for (const [x, y] of [[62, 600], [84, 460], [60, 330], [86, 210], [64, 130]] as const) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 30, x - 2, y - 60); g.stroke(); }
});

def('canopy', 720, 380, 360, 190, (g) => {
  const cols = ['#43b04f', '#58c75d', '#35993f'];
  const blobs: [number, number, number][] = [[-200, 30, 100], [200, 30, 100], [-110, -50, 120], [110, -60, 120], [0, -90, 120], [-60, 60, 110], [80, 70, 100], [-250, 80, 70], [250, 80, 70]];
  blobs.forEach(([x, y, r], i) => oval(g, 360 + x, 190 + y, r * 1.1, r * 0.82, cols[i % 3], 5));
  for (const [x, y] of [[-150, -20], [100, -90], [30, 40], [-60, -110], [190, 20]] as const) oval(g, 360 + x, 190 + y, 22, 14, '#7ee07a', 0);
});

/** Fruit, centred; `fruit:<hex>`. */
export function fruitKey(color: string): string {
  const k = `fruit:${color}`;
  def(k, 84, 92, 42, 46, (g) => {
    oval(g, 42, 52, 30, 33, `#${color}`, 4);
    oval(g, 31, 40, 7, 10, lighten(`#${color}`, 0.6), 0, -0.5);
    g.beginPath(); g.moveTo(42, 20); g.quadraticCurveTo(44, 10, 48, 6); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    blob(g, [[50, 14], [66, 4], [74, 16], [58, 22]], '#3da34a', 3);
  });
  return k;
}
export const FRUIT = fruitKey('ff8a2a');

def('palm', 420, 580, 210, 576, (g) => {
  g.beginPath(); g.moveTo(180, 576); g.quadraticCurveTo(190, 340, 250, 150); g.lineTo(282, 160); g.quadraticCurveTo(230, 350, 238, 576); g.closePath();
  g.fillStyle = '#b98650'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = '#8a5f33'; g.lineWidth = 4;
  for (let y = 520; y > 200; y -= 44) { g.beginPath(); g.moveTo(190 + (576 - y) * 0.07, y); g.lineTo(236 + (576 - y) * 0.07, y - 6); g.stroke(); }
  for (const [a, len] of [[-2.7, 170], [-2.1, 150], [-1.5, 120], [-0.9, 150], [-0.3, 170], [0.3, 140]] as const) {
    g.save(); g.translate(266, 158); g.rotate(a + 0.15);
    blob(g, [[0, 0], [len * 0.4, -26], [len, 0], [len * 0.4, 26]], '#3fae52', 4);
    g.restore();
  }
  oval(g, 252, 176, 14, 14, '#7a4a22', 3); oval(g, 276, 180, 14, 14, '#7a4a22', 3);
});

def('cactus', 130, 280, 65, 276, (g) => {
  rrect(g, 44, 40, 42, 236, 20, '#4fae5a', 5);
  rrect(g, 0, 110, 28, 70, 12, '#4fae5a', 5); rrect(g, 0, 160, 62, 28, 12, '#4fae5a', 5);
  rrect(g, 102, 80, 28, 70, 12, '#4fae5a', 5); rrect(g, 70, 130, 60, 28, 12, '#4fae5a', 5);
  g.strokeStyle = '#2e7a3a'; g.lineWidth = 3; for (const x of [58, 65, 72]) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x, 260); g.stroke(); }
  oval(g, 65, 34, 10, 8, '#ff7aa8', 3);
});

// ================================================================== rocks, stumps, props
/** Boulder, origin bottom centre. Keys rock:a (big) rock:b rock:c. */
function rock(key: string, w: number, h: number, base: string): void {
  def(key, w, h, w / 2, h - 4, (g) => {
    blob(g, [[8, h - 6], [w * 0.08, h * 0.45], [w * 0.3, h * 0.1], [w * 0.62, h * 0.06], [w * 0.92, h * 0.4], [w - 8, h - 6]], base, 5);
    g.fillStyle = lighten(base, 0.3); g.beginPath(); g.ellipse(w * 0.38, h * 0.28, w * 0.14, h * 0.07, -0.4, 0, 6.3); g.fill();
    g.strokeStyle = darken(base, 0.35); g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.6, h * 0.3); g.lineTo(w * 0.66, h * 0.55); g.lineTo(w * 0.58, h * 0.78); g.stroke();
  });
}
rock('rock:a', 320, 250, '#a9a9b8'); rock('rock:b', 240, 190, '#b8a898'); rock('rock:c', 170, 130, '#9d9db0'); rock('rock:d', 200, 150, '#c2b0a0');

def('pebble', 48, 42, 24, 21, (g) => { oval(g, 24, 22, 18, 15, '#a8a8b8', 4); oval(g, 18, 16, 5, 3, '#d4d4e0', 0); });

def('stump', 230, 170, 115, 166, (g) => {
  rrect(g, 24, 40, 182, 126, 28, '#a8723f', 5);
  oval(g, 115, 44, 92, 30, '#d6a066', 5);
  g.strokeStyle = '#a8723f'; g.lineWidth = 3; g.beginPath(); g.ellipse(115, 44, 56, 16, 0, 0, 6.3); g.stroke(); g.beginPath(); g.ellipse(115, 44, 26, 8, 0, 0, 6.3); g.stroke();
});

def('log', 440, 150, 220, 146, (g) => {
  rrect(g, 20, 20, 360, 122, 40, '#9c6a3b', 5);
  g.strokeStyle = '#6e4626'; g.lineWidth = 4; for (const y of [50, 82, 112]) { g.beginPath(); g.moveTo(60, y); g.lineTo(150, y + 4); g.moveTo(200, y - 4); g.lineTo(320, y); g.stroke(); }
  oval(g, 372, 82, 52, 62, '#d6a066', 5);
  g.strokeStyle = '#a8723f'; g.lineWidth = 3.5; g.beginPath(); g.ellipse(372, 82, 32, 40, 0, 0, 6.3); g.stroke(); g.beginPath(); g.ellipse(372, 82, 14, 18, 0, 0, 6.3); g.stroke();
  poly(g, [[60, 20], [74, 4], [92, 20]], '#4fae5a', 3);
});

/** Giant nut (shell), origin bottom centre: nut:1 hard, nut:2 coconut (hairy), nut:3 rock-hard (stone bands). */
for (const [lv, base] of [[1, '#b9803f'], [2, '#7a4f2a'], [3, '#8a8a9a']] as const) {
  def(`nut:${lv}`, 250, 240, 125, 236, (g) => {
    blob(g, [[125, 6], [210, 60], [236, 150], [180, 232], [70, 232], [14, 150], [40, 60]], base, 6);
    g.strokeStyle = darken(base, 0.35); g.lineWidth = 5; g.beginPath(); g.moveTo(125, 10); g.quadraticCurveTo(95, 120, 125, 230); g.stroke();
    if (lv === 2) { g.lineWidth = 3; for (let i = 0; i < 18; i++) { const x = 50 + ((i * 53) % 150), y = 50 + ((i * 71) % 160); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 12); g.stroke(); } oval(g, 90, 150, 6, 6, '#3a2412', 0); oval(g, 112, 158, 6, 6, '#3a2412', 0); oval(g, 100, 130, 6, 6, '#3a2412', 0); }
    if (lv === 3) { rrect(g, 40, 112, 170, 18, 8, '#c8c8d8', 4); rrect(g, 50, 160, 150, 16, 8, '#c8c8d8', 4); oval(g, 78, 121, 5, 5, INK, 0); oval(g, 172, 121, 5, 5, INK, 0); }
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(84, 78, 22, 12, -0.7, 0, 6.3); g.fill();
  });
}
def('nutHalfL', 130, 240, 130, 236, (g) => { blob(g, [[126, 6], [60, 60], [20, 150], [40, 232], [126, 232]], '#a77238', 6); poly(g, [[126, 24], [70, 80], [40, 150], [56, 214], [126, 214]], '#f3e1b4', 4); });
def('nutHalfR', 130, 240, 0, 236, (g) => { blob(g, [[4, 6], [70, 60], [110, 150], [90, 232], [4, 232]], '#a77238', 6); poly(g, [[4, 24], [60, 80], [90, 150], [74, 214], [4, 214]], '#f3e1b4', 4); });
def('treat', 90, 90, 45, 45, (g) => { oval(g, 45, 45, 34, 34, '#ffc83a', 5); oval(g, 34, 34, 9, 7, '#fff2a8', 0, -0.6); star(g, 52, 52, 12, '#ff8a2a', 2); });

def('nestBack', 320, 90, 160, 86, (g) => { oval(g, 160, 50, 150, 38, '#6e4626', 5); oval(g, 160, 54, 118, 26, '#8a5a30', 0); });
def('nestFront', 320, 80, 160, 76, (g) => {
  g.beginPath(); g.moveTo(10, 24); g.quadraticCurveTo(160, 120, 310, 24); g.quadraticCurveTo(160, 52, 10, 24); g.closePath(); g.fillStyle = '#b07a3e'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = '#7a4f26'; g.lineWidth = 4; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(40 + i * 40, 28); g.quadraticCurveTo(60 + i * 40, 52, 30 + i * 40 + 40, 38); g.stroke(); }
});
def('egg', 70, 90, 35, 88, (g) => {
  blob(g, [[35, 4], [62, 38], [60, 78], [35, 88], [10, 78], [8, 38]], '#fff4d6', 4);
  oval(g, 24, 44, 6, 6, '#ff9a6a', 0); oval(g, 44, 58, 7, 7, '#7ac0ff', 0); oval(g, 36, 30, 5, 5, '#ffcf4a', 0);
});

def('dome', 820, 380, 410, 376, (g) => {
  g.beginPath(); g.moveTo(10, 376); g.quadraticCurveTo(110, 20, 410, 16); g.quadraticCurveTo(710, 20, 810, 376); g.closePath();
  g.fillStyle = '#7fcf5c'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(250, 120, 90, 24, -0.5, 0, 6.3); g.fill();
  for (const [x, y] of [[150, 250], [660, 230], [300, 320], [560, 300]] as const) { oval(g, x, y, 9, 9, '#ff7aa8', 2); oval(g, x, y, 3, 3, '#ffd23f', 0); }
});
def('hole', 260, 210, 130, 105, (g) => { oval(g, 130, 108, 118, 94, '#8a5a30', 6); oval(g, 130, 112, 98, 76, '#1d1226', 0); });
def('glow', 60, 60, 30, 30, (g) => {
  const gr = g.createRadialGradient(30, 30, 2, 30, 30, 28); gr.addColorStop(0, 'rgba(255,255,170,1)'); gr.addColorStop(1, 'rgba(255,255,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 60, 60);
});
def('dirt', 220, 130, 110, 126, (g) => {
  blob(g, [[8, 124], [30, 60], [110, 8], [190, 60], [212, 124]], '#a8744a', 5);
  for (const [x, y] of [[70, 70], [130, 50], [110, 96], [160, 100]] as const) oval(g, x, y, 10, 7, '#8a5c38', 3);
});

def('dune', 760, 230, 380, 226, (g) => {
  g.beginPath(); g.moveTo(0, 226); g.quadraticCurveTo(240, 0, 560, 90); g.quadraticCurveTo(700, 140, 760, 226); g.closePath();
  g.fillStyle = '#f2cf79'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(330, 36); g.quadraticCurveTo(480, 60, 560, 90); g.quadraticCurveTo(700, 140, 760, 226); g.lineTo(520, 226); g.quadraticCurveTo(480, 130, 330, 36); g.closePath(); g.fillStyle = 'rgba(190,130,40,0.35)'; g.fill();
});

def('snowmound', 340, 150, 170, 146, (g) => {
  blob(g, [[6, 146], [40, 70], [130, 16], [250, 40], [334, 146]], '#ffffff', 5);
  g.fillStyle = '#dbeeff'; g.beginPath(); g.ellipse(190, 120, 100, 18, 0, 0, 6.3); g.fill();
});

def('shades', 110, 50, 55, 25, (g) => {
  rrect(g, 4, 6, 44, 30, 12, '#222244', 4); rrect(g, 58, 6, 44, 30, 12, '#222244', 4);
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(48, 14); g.lineTo(58, 14); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(12, 14); g.lineTo(22, 12); g.moveTo(66, 14); g.lineTo(76, 12); g.stroke();
});

def('icicle', 44, 90, 22, 4, (g) => { poly(g, [[4, 4], [40, 4], [24, 84]], '#bfe6ff', 4); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 12); g.lineTo(20, 44); g.stroke(); });

def('heat', 140, 240, 70, 120, (g) => {
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 8; g.lineCap = 'round';
  for (const x of [34, 70, 106]) { g.beginPath(); g.moveTo(x, 230); for (let y = 230; y > 10; y -= 20) g.quadraticCurveTo(x + (y % 40 ? 14 : -14), y - 10, x, y - 20); g.stroke(); }
});

def('arrow', 70, 110, 35, 108, (g) => { poly(g, [[22, 4], [48, 4], [48, 56], [66, 56], [35, 106], [4, 56], [22, 56]], '#ffd23f', 5); });

// ================================================================== water
def('water', 512, 256, 0, 0, (g) => {
  g.fillStyle = vgrad(g, 0, 256, '#4db6ff', '#1f7fd6'); g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 4; i++) for (let x = i % 2 ? 40 : 140; x < 512; x += 220) { g.beginPath(); g.ellipse(x, 60 + i * 50, 56, 8, 0, 0, 6.3); g.fill(); }
});
def('waveTop', 512, 48, 0, 36, (g) => {
  g.fillStyle = '#7fd0ff';
  g.beginPath(); g.moveTo(0, 48);
  for (let x = 0; x <= 512; x += 64) g.quadraticCurveTo(x + 16, -6, x + 32, 14), g.quadraticCurveTo(x + 48, 34, x + 64, 14);
  g.lineTo(512, 48); g.closePath(); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 14);
  for (let x = 0; x < 512; x += 64) { g.quadraticCurveTo(x + 16, -8, x + 32, 14); g.quadraticCurveTo(x + 48, 34, x + 64, 14); }
  g.stroke();
});
def('plank', 360, 60, 0, 0, (g) => {
  for (let x = 0; x < 340; x += 60) rrect(g, x, 0, 56, 36, 6, x % 120 ? '#b88650' : '#a8743f', 4);
  rrect(g, 0, 34, 360, 12, 4, '#7a4f26', 4);
});

// ================================================================== particles (centred)
def('p:leaf', 44, 30, 22, 15, (g) => { blob(g, [[4, 15], [22, 2], [40, 15], [22, 28]], '#58c75d', 3); stroke(g, [[8, 15], [34, 15]], '#2f8a3f', 2.5); });
def('p:dust', 80, 80, 40, 40, (g) => { const gr = g.createRadialGradient(40, 40, 4, 40, 40, 38); gr.addColorStop(0, 'rgba(255,248,230,0.95)'); gr.addColorStop(1, 'rgba(255,248,230,0)'); g.fillStyle = gr; g.fillRect(0, 0, 80, 80); });
def('p:drop', 26, 36, 13, 18, (g) => { blob(g, [[13, 2], [24, 22], [13, 34], [2, 22]], '#5cc0ff', 3); });
def('p:snow', 24, 24, 12, 12, (g) => { g.beginPath(); g.arc(12, 12, 9, 0, 6.3); g.fillStyle = '#fff'; g.fill(); });
def('p:spark', 56, 56, 28, 28, (g) => { poly(g, [[28, 2], [34, 22], [54, 28], [34, 34], [28, 54], [22, 34], [2, 28], [22, 22]], '#fff3a0', 3); });
def('p:star', 50, 50, 25, 25, (g) => { star(g, 25, 26, 21, '#ffd23f', 4); });
def('p:heart', 56, 52, 28, 26, (g) => { g.beginPath(); g.moveTo(28, 48); g.bezierCurveTo(-8, 22, 6, -2, 28, 14); g.bezierCurveTo(50, -2, 64, 22, 28, 48); g.closePath(); g.fillStyle = '#ff5a8a'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); });
def('p:puff', 120, 90, 60, 45, (g) => {
  for (const [x, y, r] of [[34, 52, 24], [62, 38, 30], [90, 54, 24], [60, 62, 26]] as const) oval(g, x, y, r, r, '#fffdf4', 0);
  g.strokeStyle = INK; g.lineWidth = 0;
  for (const [x, y, r] of [[34, 52, 24], [62, 38, 30], [90, 54, 24], [60, 62, 26]] as const) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.strokeStyle = 'rgba(27,27,58,0.35)'; g.lineWidth = 2; g.stroke(); }
});
def('p:feather', 30, 60, 15, 30, (g) => { blob(g, [[15, 2], [28, 30], [15, 58], [2, 30]], '#ffe7a0', 3); stroke(g, [[15, 6], [15, 54]], '#e0a840', 2.5); });
def('p:bubble', 44, 44, 22, 22, (g) => { g.beginPath(); g.arc(22, 22, 17, 0, 6.3); g.fillStyle = 'rgba(190,235,255,0.55)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); oval(g, 16, 15, 4, 3, '#fff', 0); });
def('p:sweat', 26, 38, 13, 19, (g) => { blob(g, [[13, 2], [24, 24], [13, 36], [2, 24]], '#bfe9ff', 3); });
def('p:ring', 160, 50, 80, 25, (g) => { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6; g.beginPath(); g.ellipse(80, 25, 70, 16, 0, 0, 6.3); g.stroke(); });
def('p:question', 56, 84, 28, 42, (g) => {
  g.font = 'bold 76px "Trebuchet MS", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText('?', 28, 46); g.fillStyle = '#ffd23f'; g.fillText('?', 28, 46);
});
def('p:exclaim', 40, 84, 20, 42, (g) => {
  g.font = 'bold 76px "Trebuchet MS", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText('!', 20, 46); g.fillStyle = '#ff5a5f'; g.fillText('!', 20, 46);
});
def('p:snore', 90, 90, 45, 45, (g) => { g.beginPath(); g.arc(45, 45, 34, 0, 6.3); g.fillStyle = 'rgba(200,235,255,0.6)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke(); oval(g, 32, 30, 8, 5, '#ffffff', 0, -0.6); });
def('bulge', 170, 130, 85, 65, (g) => { oval(g, 85, 66, 70, 52, '#fff1c9', 5); oval(g, 62, 44, 18, 9, '#ffffff', 0, -0.5); });
def('p:twig', 70, 14, 35, 7, (g) => { rrect(g, 2, 2, 66, 10, 5, '#8a5a30', 3); });

// ================================================================== critters (feet / bottom centre; facing +x)
export type Mood = 'happy' | 'giggle' | 'sleep' | 'oops' | 'scared';

function critterFace(g: G, x: number, y: number, r: number, mood: Mood): void {
  if (mood === 'giggle') { arcEye(g, x - r * 0.9, y, r * 0.5); arcEye(g, x + r * 0.9, y, r * 0.5); smile(g, x, y + r * 0.9, r * 0.9, true); }
  else if (mood === 'sleep') { arcEye(g, x - r * 0.9, y, r * 0.5, false); arcEye(g, x + r * 0.9, y, r * 0.5, false); oval(g, x, y + r * 1.3, r * 0.3, r * 0.3, '#7a1f3d', 2); }
  else if (mood === 'oops') { eye(g, x - r * 0.9, y, r * 0.55, 0, 0); eye(g, x + r * 0.9, y, r * 0.55, 0, 0); oval(g, x, y + r * 1.4, r * 0.45, r * 0.5, '#7a1f3d', 3); }
  else if (mood === 'scared') { eye(g, x - r * 0.9, y, r * 0.62, 0.6, 0); eye(g, x + r * 0.9, y, r * 0.62, 0.6, 0); oval(g, x, y + r * 1.4, r * 0.35, r * 0.28, '#7a1f3d', 3); }
  else { eye(g, x - r * 0.9, y, r * 0.55, 0.5, 0); eye(g, x + r * 0.9, y, r * 0.55, 0.5, 0); smile(g, x, y + r * 0.7, r * 0.75); }
}

for (const mood of ['happy', 'giggle', 'oops', 'scared', 'sleep'] as const) {
  def(`beetle:${mood}`, 220, 150, 110, 146, (g) => {
    for (const x of [58, 88, 120, 150]) { stroke(g, [[x, 118], [x + (x < 100 ? -12 : 12), 144]], INK, 7); }
    stroke(g, [[168, 70], [186, 36], [196, 30]], INK, 4); stroke(g, [[158, 66], [168, 30], [178, 24]], INK, 4);
    oval(g, 196, 30, 6, 6, '#ffd23f', 3); oval(g, 178, 24, 6, 6, '#ffd23f', 3);
    oval(g, 150, 92, 46, 42, '#ffb347', 5);
    g.beginPath(); g.ellipse(88, 92, 70, 58, 0, Math.PI, 0); g.lineTo(18, 92); g.closePath();
    g.fillStyle = '#e8423a'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    oval(g, 88, 112, 70, 14, '#2a2a4a', 4);
    for (const [x, y] of [[56, 70], [90, 52], [120, 74], [76, 88]] as const) oval(g, x, y, 9, 9, INK, 0);
    critterFace(g, 156, 84, 9, mood);
  });
}

for (const mood of ['happy', 'giggle', 'oops', 'scared'] as const) {
  def(`frog:${mood}`, 180, 150, 90, 146, (g) => {
    oval(g, 40, 126, 30, 16, '#4fae5a', 4); oval(g, 140, 126, 30, 16, '#4fae5a', 4);
    oval(g, 90, 96, 62, 48, '#5fcf6a', 5);
    oval(g, 90, 112, 36, 28, '#d8f7b8', 0);
    oval(g, 56, 52, 22, 22, '#5fcf6a', 5); oval(g, 124, 52, 22, 22, '#5fcf6a', 5);
    if (mood === 'giggle') { arcEye(g, 56, 52, 10); arcEye(g, 124, 52, 10); smile(g, 90, 82, 28, true); }
    else { eye(g, 56, 52, 13, 0.5); eye(g, 124, 52, 13, 0.5); smile(g, 90, 84, 28, mood !== 'happy'); }
  });
}

for (const mood of ['happy', 'giggle', 'oops', 'scared', 'sleep'] as const) {
  def(`lizard:${mood}`, 280, 130, 140, 126, (g) => {
    g.beginPath(); g.moveTo(40, 100); g.quadraticCurveTo(0, 90, 6, 56); g.quadraticCurveTo(30, 90, 70, 84); g.closePath(); g.fillStyle = '#7bd35a'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    for (const x of [90, 190]) { oval(g, x, 112, 14, 16, '#5fb83f', 4); }
    blob(g, [[30, 96], [60, 66], [130, 56], [196, 62], [240, 74], [258, 96], [228, 112], [120, 116]], '#8ae464', 5);
    for (const x of [100, 130, 160]) oval(g, x, 70, 12, 8, '#5fb83f', 0);
    oval(g, 206, 100, 30, 14, '#f7f2a8', 0);
    critterFace(g, 226, 84, 9, mood);
  });
}
for (const mood of ['happy', 'sleep', 'scared'] as const) {
  def(`lizardTop:${mood}`, 280, 120, 140, 60, (g) => {
    g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(20, 54, 0, 64); g.quadraticCurveTo(30, 70, 60, 68); g.closePath(); g.fillStyle = '#7bd35a'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    for (const [x, y, s] of [[100, 24, -1], [100, 96, 1], [180, 24, -1], [180, 96, 1]] as const) { oval(g, x, y, 18, 10, '#5fb83f', 4, s * 0.5); }
    blob(g, [[50, 60], [90, 36], [160, 34], [226, 44], [262, 60], [226, 76], [160, 86], [90, 84]], '#8ae464', 5);
    for (const x of [100, 130, 160]) oval(g, x, 60, 8, 14, '#5fb83f', 0);
    if (mood === 'sleep') { arcEye(g, 236, 46, 5, false); arcEye(g, 236, 74, 5, false); }
    else { oval(g, 236, 46, 7, 7, '#fff', 3); oval(g, 238, 46, 3, 3, INK, 0); oval(g, 236, 74, 7, 7, '#fff', 3); oval(g, 238, 74, 3, 3, INK, 0); }
  });
}
def('hole:top', 160, 120, 80, 60, (g) => { oval(g, 80, 60, 70, 50, '#8a5a30', 6); oval(g, 80, 62, 54, 36, '#1d1226', 0); });

for (const mood of ['happy', 'laugh', 'peck'] as const) {
  def(`bird:${mood}`, 120, 110, 60, 100, (g) => {
    stroke(g, [[48, 86], [46, 100]], '#ff9a3a', 6); stroke(g, [[70, 86], [72, 100]], '#ff9a3a', 6);
    poly(g, [[10, 56], [-6, 48], [4, 74]], '#4aa8ff', 4);
    oval(g, 58, 56, 42, 36, '#5cb8ff', 5);
    oval(g, 70, 70, 24, 18, '#e8f6ff', 0);
    poly(g, [[92, 44], [116, mood === 'peck' ? 58 : 50], [92, 62]], '#ffb347', 4);
    if (mood === 'laugh') { arcEye(g, 76, 40, 6); smile(g, 94, 58, 6, true); }
    else eye(g, 78, 40, 8, 0.6, mood === 'peck' ? 0.5 : 0);
  });
}
def('birdWing', 70, 56, 12, 28, (g) => { blob(g, [[4, 28], [34, 6], [66, 24], [34, 50]], '#3a90e8', 4); });

def('friend:a', 130, 170, 65, 166, (g) => friend(g, '#ff8fb8', false));
def('friend:b', 130, 170, 65, 166, (g) => friend(g, '#ff8fb8', true));
def('friend2:a', 130, 170, 65, 166, (g) => friend(g, '#8f9bff', false));
def('friend2:b', 130, 170, 65, 166, (g) => friend(g, '#8f9bff', true));
function friend(g: G, c: string, up: boolean): void {
  poly(g, [[28, 120], [4, 130], [22, 142]], c, 4);
  oval(g, 56, 104, 30, 36, c, 5); oval(g, 56, 114, 18, 22, lighten(c, 0.5), 0);
  oval(g, 46, 150, 12, 16, darken(c, 0.1), 4); oval(g, 70, 150, 12, 16, darken(c, 0.1), 4);
  stroke(g, [[46, 100], [34, 116]], INK, 12); stroke(g, [[46, 100], [34, 116]], c, 7);
  const ax = up ? 86 : 90, ay = up ? 52 : 82;
  stroke(g, [[68, 96], [ax, ay]], INK, 12); stroke(g, [[68, 96], [ax, ay]], c, 7);
  oval(g, 64, 62, 34, 30, c, 5);
  eye(g, 56, 58, 8, 0.4); eye(g, 78, 58, 8, 0.4); smile(g, 68, 70, 12, true);
  for (const x of [48, 62, 76]) poly(g, [[x - 6, 36], [x, 22], [x + 6, 36]], darken(c, 0.15), 3);
}

// ---- the big silly sniffing dino (friendly, goofy: googly eyes, huge nose, floppy tongue)
const BIG = '#9b6cf0';
def('bigBody', 420, 260, 210, 256, (g) => {
  g.beginPath(); g.moveTo(70, 120); g.quadraticCurveTo(10, 150, 0, 220); g.quadraticCurveTo(60, 190, 110, 170); g.closePath(); g.fillStyle = BIG; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  oval(g, 220, 130, 150, 100, BIG, 5);
  oval(g, 250, 160, 100, 62, '#ffe9a8', 0);
  for (const [x, y, r] of [[150, 80, 14], [200, 60, 16], [258, 62, 14], [310, 90, 12], [120, 120, 10]] as const) oval(g, x, y, r, r * 0.8, '#ffd23f', 3);
  for (const x of [150, 200, 250, 300]) poly(g, [[x - 14, 38], [x, 14], [x + 14, 38]], '#ffd23f', 4);
});
def('bigLeg', 70, 150, 35, 12, (g) => { rrect(g, 8, 4, 54, 120, 24, '#8a5ce0', 5); oval(g, 34, 132, 32, 14, '#8a5ce0', 5); for (const x of [14, 34, 54]) oval(g, x, 142, 5, 5, '#fff', 2); });
for (const m of ['normal', 'sniff', 'lick', 'surprised', 'sneeze', 'shrug', 'laugh'] as const) {
  def(`bigHead:${m}`, 300, 240, 60, 140, (g) => {
    blob(g, [[0, 100], [20, 50], [90, 16], [180, 24], [264, 70], [284, 130], [250, 186], [150, 214], [50, 190]], BIG, 5);
    oval(g, 252, 112, 28, 22, '#ffb8d8', 4);
    oval(g, 246, 106, 7, 9, INK, 0); oval(g, 262, 106, 7, 9, INK, 0);
    const sn = m === 'sniff' || m === 'sneeze';
    if (m === 'lick') { rrect(g, 190, 150, 76, 20, 10, '#ff7aa8', 4); blob(g, [[200, 164], [260, 172], [296, 220], [240, 236], [196, 200]], '#ff6f9c', 4); stroke(g, [[236, 176], [250, 214]], '#d84a78', 3); }
    else smile(g, 190, 150, 40, m === 'surprised' || m === 'laugh' || m === 'sneeze');
    const eyeR = 22;
    if (m === 'laugh' || m === 'sneeze') { arcEye(g, 130, 74, eyeR * 0.8); arcEye(g, 188, 70, eyeR * 0.8); }
    else {
      oval(g, 128, 72, eyeR, eyeR + 2, '#fff', 4); oval(g, 190, 68, eyeR - 2, eyeR, '#fff', 4);
      const dx = m === 'surprised' ? 0 : sn ? 8 : -2;
      oval(g, 128 + dx, 76 + (sn ? 8 : 0), 8, 8, INK, 0); oval(g, 190 + dx + (m === 'shrug' ? 6 : 0), 76 + (sn ? 6 : -2), 7, 7, INK, 0);
    }
    poly(g, [[84, 28], [100, -6], [116, 26]], '#ffd23f', 4); poly(g, [[134, 18], [152, -14], [168, 20]], '#ffd23f', 4);
    if (m === 'sneeze') { for (const [x, y] of [[286, 100], [300, 118], [292, 138]] as const) oval(g, x, y, 6, 6, '#bfe9ff', 2); }
  });
}

// ================================================================== extras: fish, rolling log end, wind
for (const mood of ['happy', 'scared'] as const) {
  def(`fish:${mood}`, 150, 100, 75, 50, (g) => {
    poly(g, [[28, 50], [4, 24], [10, 50], [4, 78]], '#ff8a2a', 4);
    oval(g, 78, 50, 52, 34, '#ffa23a', 5);
    oval(g, 82, 66, 34, 14, '#ffe3a8', 0);
    poly(g, [[70, 20], [90, 4], [98, 24]], '#ff8a2a', 3);
    if (mood === 'scared') { eye(g, 108, 42, 10, 0, 0); oval(g, 126, 58, 7, 9, '#7a1f3d', 3); }
    else { eye(g, 108, 42, 10, 0.5, 0); smile(g, 118, 56, 9); }
  });
}
def('logEnd', 300, 300, 150, 300, (g) => {
  oval(g, 150, 150, 146, 146, '#8a5a30', 6);
  oval(g, 150, 150, 126, 126, '#d6a066', 4);
  g.strokeStyle = '#a8723f'; g.lineWidth = 4; for (const r of [96, 66, 38, 14]) { g.beginPath(); g.arc(150, 150, r, 0, 6.3); g.stroke(); }
  g.strokeStyle = '#8a5a30'; g.beginPath(); g.moveTo(150, 150); g.lineTo(150, 40); g.stroke();
  poly(g, [[136, 10], [150, -8], [166, 10]], '#4fae5a', 3);
});
def('windline', 240, 40, 120, 20, (g) => {
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(10, 22); g.quadraticCurveTo(80, 2, 150, 20); g.quadraticCurveTo(200, 32, 220, 14); g.stroke();
});
def('shade', 420, 90, 210, 45, (g) => { oval(g, 210, 45, 200, 34, 'rgba(40,30,70,0.28)', 0); });

// ================================================================== top-view field props (centred)
def('tuftTop', 140, 90, 70, 45, (g) => { oval(g, 70, 46, 62, 34, 'rgba(60,150,60,0.55)', 0); oval(g, 56, 40, 34, 20, 'rgba(40,120,50,0.5)', 0); });
def('rockTop', 130, 100, 65, 50, (g) => { blob(g, [[10, 56], [26, 22], [70, 8], [112, 26], [120, 64], [84, 90], [34, 88]], '#a9a9b8', 5); oval(g, 52, 34, 20, 10, '#d4d4e0', 0, -0.4); });
def('flowerTop', 44, 44, 22, 22, (g) => { for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; oval(g, 22 + Math.cos(a) * 9, 22 + Math.sin(a) * 9, 7, 7, '#ff9ad0', 2); } oval(g, 22, 22, 6, 6, '#ffd23f', 2); });
