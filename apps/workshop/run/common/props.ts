/**
 * Run scene kit: baked prop library (side view unless noted). Each function returns a PartSpec; add it with
 * `prop(scene, parent, P.tree(), x, groundY)`. Origins are bottom-centre (ground contact) unless stated.
 * Colours come from PAL; everything has the same thick ink outline as the cars so scenes read at a glance.
 */
import { PAL, circ, darken, ell, eyes, fl, lighten, line, ol, poly, rr, spec, vGradient } from './draw';

const C = PAL;
const hash = (s: string): number => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const wob = (seed: number, i: number): number => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;

export const P = {
  roadWarning: (kind: 'hill' | 'snow' | 'height' | 'bridge') => spec(`warning:${kind}`, 142, 218, (g) => {
    ol(g, C.woodDark, rr(63, 101, 16, 110, 5), 4);
    ol(g, C.yellow, poly([[71, 8], [134, 71], [71, 134], [8, 71]]), 6);
    if (kind === 'height') {
      line(g, 47, 35, 95, 35, 6);
      line(g, 47, 107, 95, 107, 6);
      line(g, 71, 49, 71, 93, 7);
      fl(g, C.ink, poly([[57, 57], [71, 42], [85, 57]]));
      fl(g, C.ink, poly([[57, 85], [71, 100], [85, 85]]));
    } else if (kind === 'hill') {
      fl(g, C.ink, poly([[36, 87], [99, 50], [106, 87]]));
      line(g, 48, 66, 77, 48, 7);
      fl(g, C.ink, poly([[64, 41], [88, 42], [79, 62]]));
    } else if (kind === 'snow') {
      for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) {
        const x = Math.cos(a) * 30, y = Math.sin(a) * 30;
        line(g, 71 - x, 71 - y, 71 + x, 71 + y, 7);
      }
    } else {
      line(g, 37, 52, 37, 90, 7);
      line(g, 105, 52, 105, 90, 7);
      g.beginPath();
      g.moveTo(37, 60); g.quadraticCurveTo(71, 107, 105, 60);
      g.lineWidth = 7; g.strokeStyle = C.ink; g.stroke();
    }
  }),
  /** Bolted striped edge, with the origin on the lower face. */
  clearanceBar: (w: number) => spec(`clearanceBar:${w}`, w + 8, 42, (g) => {
    ol(g, C.yellow, rr(4, 4, w, 32, 6), 4);
    for (let x = 10; x + 48 < w; x += 52) {
      fl(g, C.ink, poly([[x, 6], [x + 24, 6], [x + 43, 34], [x + 19, 34]]));
    }
  }, 4, 38),
  snowChunk: () => spec('snowChunk', 53, 44, (g) => {
    ol(g, '#e5f7ff', poly([[3, 29], [8, 15], [21, 4], [43, 8], [48, 24], [39, 38], [14, 39]]), 3);
    fl(g, '#a9d6ee', poly([[8, 28], [24, 32], [45, 23], [39, 37], [14, 38]]));
  }, 26, 22),
  // ------------------------------------------------------------------ backdrop pieces
  sky: (a: string, b: string) => spec(`sky:${a}:${b}`, 8, 256, (g) => { g.fillStyle = vGradient(g, 256, a, b); g.fillRect(0, 0, 8, 256); }, 0, 0),
  /** Seamless rolling hills strip (tile horizontally). Origin bottom-left. */
  hills: (color: string, h: number, waves: number, seed = 1) => spec(`hills:${color}:${h}:${waves}:${seed}`, 1024, h + 8, (g) => {
    g.beginPath(); g.moveTo(0, h + 8);
    for (let x = 0; x <= 1024; x += 16) {
      const t = (x / 1024) * Math.PI * 2;
      const y = h * 0.5 + Math.sin(t * waves + seed) * h * 0.28 + Math.sin(t * waves * 2 + seed * 2) * h * 0.12;
      g.lineTo(x, y);
    }
    g.lineTo(1024, h + 8); g.closePath(); g.fillStyle = color; g.fill();
  }, 0, h + 8),
  cloud: () => spec('cloud', 280, 120, (g) => {
    fl(g, '#fff', (c) => { c.moveTo(40, 100); c.arc(70, 80, 36, 0, 7); c.moveTo(130, 70); c.arc(130, 62, 52, 0, 7); c.moveTo(200, 84); c.arc(200, 74, 40, 0, 7); c.moveTo(240, 100); c.arc(230, 90, 26, 0, 7); });
    fl(g, '#fff', rr(40, 76, 200, 34, 17));
  }, 140, 60),
  moon: () => spec('moon', 140, 140, (g) => {
    fl(g, '#fff6c8', circ(70, 70, 54)); fl(g, '#f0e2a0', circ(50, 56, 10)); fl(g, '#f0e2a0', circ(86, 88, 14));
  }, 70, 70),
  stars: () => spec('stars', 512, 256, (g) => {
    for (let i = 0; i < 60; i++) fl(g, '#fff', circ(wob(3, i) * 512, wob(5, i) * 256, 1.5 + wob(7, i) * 2));
  }, 0, 0),
  sun: () => spec('sun', 160, 160, (g) => { fl(g, 'rgba(255,230,120,0.4)', circ(80, 80, 78)); fl(g, '#ffe36a', circ(80, 80, 52)); }, 80, 80),
  /** Tileable ground (texture 256x256, top edge = ground line). */
  ground: (top: string, body: string, dark: string) => spec(`ground:${top}:${body}`, 256, 256, (g) => {
    fl(g, body, (c) => c.rect(0, 0, 256, 256));
    for (let i = 0; i < 14; i++) fl(g, dark, ell(wob(2, i) * 256, 40 + wob(4, i) * 200, 10 + wob(6, i) * 10, 4 + wob(8, i) * 4));
    fl(g, top, (c) => c.rect(0, 0, 256, 34));
    fl(g, darken(top, 0.12), (c) => c.rect(0, 22, 256, 12));
    g.fillStyle = C.ink; g.fillRect(0, 34, 256, 5);
    g.fillStyle = lighten(top, 0.3);
    for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 6, 5 + (i % 3) * 5, 14, 4);
  }, 0, 0),

  // ------------------------------------------------------------------ plants
  tree: (canopy: string = C.green) => spec(`tree:${canopy}`, 220, 340, (g) => {
    ol(g, C.wood, rr(96, 190, 30, 140, 8));
    ol(g, canopy, circ(110, 100, 78)); ol(g, canopy, circ(60, 150, 50)); ol(g, canopy, circ(160, 150, 50));
    fl(g, canopy, circ(110, 120, 70)); fl(g, lighten(canopy, 0.25), circ(86, 80, 22));
  }),
  pine: (snow = false) => spec(`pine:${snow}`, 180, 320, (g) => {
    ol(g, C.woodDark, rr(78, 250, 26, 62, 6));
    for (const [y, w, h] of [[170, 150, 110], [100, 124, 100], [30, 96, 90]] as const) {
      ol(g, '#2c8a4a', poly([[90, y], [90 + w / 2, y + h], [90 - w / 2, y + h]]));
      if (snow) fl(g, C.snow, poly([[90, y + 3], [90 + w / 4, y + h * 0.42], [90 + w / 8, y + h * 0.36], [90, y + h * 0.5], [90 - w / 8, y + h * 0.36], [90 - w / 4, y + h * 0.42]]));
    }
  }),
  bush: (color: string = '#4cb34f') => spec(`bush:${color}`, 160, 90, (g) => {
    ol(g, color, circ(50, 56, 32)); ol(g, color, circ(100, 54, 34)); ol(g, color, circ(76, 40, 36));
    fl(g, lighten(color, 0.25), circ(64, 30, 10));
  }),
  flower: (c: string) => spec(`flower:${c}`, 30, 50, (g) => {
    line(g, 15, 46, 15, 22, 4, '#2f8a3f'); for (let i = 0; i < 5; i++) fl(g, c, circ(15 + Math.cos(i * 1.256) * 8, 18 + Math.sin(i * 1.256) * 8, 6)); fl(g, C.yellow, circ(15, 18, 5));
  }, 15, 46),
  fence: () => spec('fence', 160, 100, (g) => {
    ol(g, C.wood, rr(4, 40, 152, 14, 4)); ol(g, C.wood, rr(4, 68, 152, 14, 4));
    for (const x of [14, 70, 126]) ol(g, C.wood, rr(x, 20, 20, 74, 6));
  }),
  reeds: () => spec('reeds', 90, 90, (g) => { for (let i = 0; i < 5; i++) { line(g, 10 + i * 17, 84, 14 + i * 15, 20 + (i % 2) * 14, 6, '#3f9a45'); ol(g, '#7a4a24', rr(8 + i * 15, 8 + (i % 2) * 12, 12, 24, 5), 3); } }),

  // ------------------------------------------------------------------ buildings and set pieces
  barn: () => spec('barn', 400, 340, (g) => {
    ol(g, C.red, poly([[20, 330], [20, 120], [200, 20], [380, 120], [380, 330]]));
    fl(g, darken(C.red, 0.15), poly([[200, 20], [380, 120], [380, 140], [200, 40]]));
    ol(g, '#fff', rr(130, 170, 140, 160, 6)); line(g, 130, 170, 270, 330, 8, C.red); line(g, 270, 170, 130, 330, 8, C.red);
    ol(g, '#fff', circ(200, 110, 26)); fl(g, '#6b4a2a', circ(200, 110, 14));
  }),
  house: (lit: number, wall: string = '#f2d9a0', roof: string = '#c4524a') => spec(`house:${lit}:${wall}:${roof}`, 300, 320, (g) => {
    ol(g, wall, rr(20, 130, 260, 182, 8));
    ol(g, roof, poly([[0, 140], [150, 30], [300, 140]]));
    ol(g, '#8a5a30', rr(122, 214, 56, 98, 8));
    const win = (x: number, y: number, on: boolean) => { ol(g, on ? '#ffe36a' : '#3a4a7a', rr(x, y, 64, 56, 6)); line(g, x + 32, y, x + 32, y + 56, 4); line(g, x, y + 28, x + 64, y + 28, 4); };
    win(36, 150, (lit & 1) > 0); win(200, 150, (lit & 2) > 0);
    if (lit & 4) { g.fillStyle = 'rgba(255,230,120,0.25)'; g.fillRect(122, 214, 56, 98); }
  }),
  store: () => spec('store', 360, 300, (g) => {
    ol(g, '#ffe9b0', rr(10, 80, 340, 214, 8));
    ol(g, '#2b8cff', poly([[0, 90], [20, 30], [340, 30], [360, 90]]));
    for (let i = 0; i < 6; i++) fl(g, i % 2 ? '#fff' : '#2b8cff', poly([[i * 60, 90], [i * 60 + 20, 30], [i * 60 + 80, 30], [i * 60 + 60, 90]]));
    ol(g, '#8a5a30', rr(150, 160, 70, 134, 8)); ol(g, '#bfe6ff', rr(36, 130, 90, 80, 6)); ol(g, '#bfe6ff', rr(240, 130, 90, 80, 6));
  }),
  tractor: () => spec('tractor', 280, 220, (g) => {
    ol(g, C.green, rr(60, 80, 150, 70, 14)); ol(g, C.green, rr(120, 20, 80, 70, 10)); ol(g, '#bfe6ff', rr(130, 32, 56, 40, 6));
    ol(g, '#333', circ(80, 150, 56)); ol(g, '#888', circ(80, 150, 22)); ol(g, '#333', circ(220, 170, 34)); ol(g, '#888', circ(220, 170, 14));
    ol(g, '#444', rr(232, 70, 10, 50, 4), 3);
  }, 140, 212),
  gasPump: () => spec('gas', 90, 180, (g) => { ol(g, C.red, rr(10, 20, 70, 150, 10)); ol(g, '#bfe6ff', rr(22, 36, 46, 34, 4)); ol(g, '#444', rr(60, 90, 24, 8, 3), 3); fl(g, C.yellow, circ(45, 120, 14)); }),
  signpost: (color: string = C.blue, arrow = true) => spec(`sign:${color}:${arrow}`, 110, 170, (g) => {
    ol(g, C.woodDark, rr(48, 70, 14, 96, 4)); ol(g, color, rr(6, 6, 98, 76, 14));
    if (arrow) { fl(g, '#fff', poly([[24, 38], [60, 38], [60, 24], [88, 44], [60, 64], [60, 50], [24, 50]])); }
  }),
  umbrella: () => spec('umbrella', 200, 200, (g) => {
    line(g, 100, 190, 100, 60, 8, C.woodDark);
    ol(g, C.red, (c) => { c.moveTo(10, 80); c.quadraticCurveTo(100, -30, 190, 80); c.closePath(); });
    for (const x of [58, 100, 142]) fl(g, '#fff', poly([[x - 12, 56], [x + 12, 56], [x + 18, 80], [x - 18, 80]]));
  }),
  sandcastle: () => spec('castle', 120, 110, (g) => { ol(g, '#f4d58a', rr(10, 50, 100, 50, 6)); for (const x of [10, 44, 78]) ol(g, '#f4d58a', rr(x, 30, 24, 28, 3), 4); ol(g, '#f4d58a', rr(44, 8, 32, 50, 4), 4); }, 60, 100),
  bucket: () => spec('bucket', 60, 60, (g) => { ol(g, C.blue, poly([[6, 12], [54, 12], [46, 52], [14, 52]]), 4); line(g, 6, 12, 54, 12, 5, '#fff'); }, 30, 52),
  shovel: () => spec('shovel', 30, 100, (g) => { line(g, 15, 10, 15, 70, 6, C.woodDark); ol(g, C.red, rr(4, 66, 22, 28, 8), 4); }, 15, 90),
  towel: () => spec('towel', 100, 40, (g) => { ol(g, C.pink, rr(4, 8, 92, 26, 5), 4); for (const x of [24, 48, 72]) fl(g, '#fff', (c) => c.rect(x, 10, 8, 22)); }, 50, 34),
  beachBall: () => spec('ball', 50, 50, (g) => { ol(g, '#fff', circ(25, 25, 20), 4); g.save(); g.beginPath(); circ(25, 25, 18)(g); g.clip(); fl(g, C.red, (c) => c.rect(0, 0, 18, 50)); fl(g, C.blue, (c) => c.rect(32, 0, 18, 50)); g.restore(); }, 25, 46),
  mileSign: (n: number) => spec(`mile:${n}`, 80, 130, (g) => { ol(g, C.woodDark, rr(34, 50, 12, 76, 4), 4); ol(g, C.green, rr(4, 4, 72, 56, 10), 4); for (let i = 0; i < n; i++) fl(g, '#fff', circ(18 + (i % 3) * 22, 20 + Math.floor(i / 3) * 20, 7)); }),
  hay: () => spec('hay', 130, 120, (g) => {
    ol(g, C.hay, rr(8, 12, 114, 100, 22)); line(g, 8, 44, 122, 44, 4, C.hayDark); line(g, 8, 82, 122, 82, 4, C.hayDark);
    ol(g, C.hay, rr(8, 12, 114, 100, 22), 5); fl(g, C.hayDark, circ(36, 62, 8));
  }),
  haystack: () => spec('haystack', 340, 220, (g) => {
    ol(g, C.hay, (c) => { c.moveTo(10, 212); c.quadraticCurveTo(20, 20, 170, 16); c.quadraticCurveTo(320, 20, 330, 212); c.closePath(); });
    for (let i = 0; i < 14; i++) line(g, 40 + wob(2, i) * 260, 60 + wob(4, i) * 140, 52 + wob(2, i) * 260, 78 + wob(4, i) * 140, 5, C.hayDark);
  }),
  /** Top-view hay bale. Origin centre. */
  hayTop: () => spec('hayTop', 130, 80, (g) => { ol(g, C.hay, rr(6, 6, 118, 68, 14)); line(g, 40, 8, 40, 72, 4, C.hayDark); line(g, 90, 8, 90, 72, 4, C.hayDark); }, 65, 40),
  cone: () => spec('cone', 60, 80, (g) => { ol(g, C.orange, poly([[30, 6], [50, 70], [10, 70]]), 4); fl(g, '#fff', poly([[24, 30], [36, 30], [40, 44], [20, 44]])); ol(g, '#555', rr(2, 66, 56, 10, 3), 3); }, 30, 72),
  flag: (color: string = C.red) => spec(`flag:${color}`, 90, 190, (g) => { line(g, 20, 186, 20, 14, 7, '#555'); ol(g, color, poly([[22, 14], [84, 32], [22, 54]]), 4); }, 20, 184),
  flagPole: () => spec('pole', 14, 190, (g) => line(g, 7, 186, 7, 14, 7, '#555'), 7, 184),
  checker: () => spec('checker', 140, 120, (g) => {
    line(g, 10, 112, 10, 10, 7, '#555'); line(g, 130, 112, 130, 10, 7, '#555');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) fl(g, (r + c) % 2 ? '#222' : '#fff', (x) => x.rect(10 + c * 12, 10 + r * 12, 12, 12)); g.strokeStyle = C.ink; g.lineWidth = 3; g.strokeRect(10, 10, 120, 36);
  }, 70, 112),
  ramp: (len: number, h: number) => spec(`ramp:${len}:${h}`, len + 20, h + 24, (g) => {
    ol(g, C.wood, poly([[8, h + 14], [len + 8, h + 14], [len + 8, 10]]));
    for (let i = 1; i < 6; i++) line(g, 8 + (len * i) / 6, h + 14, 8 + (len * i) / 6, 10 + (h * (6 - i)) / 6 + 6, 4, C.woodDark);
    ol(g, C.woodDark, rr(8, h + 4, len, 12, 3), 3);
  }, 8, h + 14),
  crate: (c: string = C.wood) => spec(`crate:${c}`, 90, 90, (g) => { ol(g, c, rr(6, 6, 78, 78, 10)); line(g, 6, 28, 84, 28, 4, darken(c, 0.3)); fl(g, '#fff', rr(28, 40, 34, 30, 4)); }, 45, 84),
  melon: () => spec('melon', 80, 80, (g) => { ol(g, '#2f9a47', ell(40, 42, 34, 28)); for (const x of [22, 40, 58]) line(g, x, 20, x, 62, 4, '#1f6a30'); }, 40, 70),
  sheep: () => spec('sheep', 140, 100, (g) => {
    for (const x of [40, 100]) line(g, x, 70, x, 94, 8);
    ol(g, '#fff', circ(50, 48, 28)); ol(g, '#fff', circ(86, 46, 30)); ol(g, '#fff', circ(68, 36, 28)); ol(g, '#3a3a3a', ell(118, 50, 16, 20)); eyes(g, 120, 44, 4, 4);
  }, 70, 94),

  // ------------------------------------------------------------------ rocks, water, bridges
  rock: (w: number, h: number, seed = 1) => spec(`rock:${w}:${h}:${seed}`, w + 20, h + 20, (g) => {
    const pts: [number, number][] = [[6, h + 10]];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([10 + t * w, 10 + h * (1 - Math.sin(t * Math.PI) * (0.82 + wob(seed, i) * 0.2))]); }
    pts.push([w + 14, h + 10]);
    ol(g, C.stone, poly(pts)); fl(g, lighten(C.stone, 0.3), ell(w * 0.35 + 10, h * 0.35 + 10, w * 0.14, h * 0.1, -0.4));
    line(g, w * 0.6, h * 0.4, w * 0.7, h * 0.7, 3, C.stoneDark);
  }, (w + 20) / 2, h + 10),
  /** Boulder with a high round middle. */
  boulder: (w: number, h: number) => spec(`boulder:${w}:${h}`, w + 24, h + 20, (g) => {
    ol(g, C.stone, (c) => { c.moveTo(6, h + 10); c.quadraticCurveTo(w * 0.1, 10, (w + 24) / 2, 8); c.quadraticCurveTo(w * 0.95, 10, w + 18, h + 10); c.closePath(); });
    fl(g, lighten(C.stone, 0.3), ell(w * 0.4, h * 0.3, w * 0.12, h * 0.09, -0.5)); line(g, w * 0.62, h * 0.35, w * 0.72, h * 0.65, 4, C.stoneDark);
  }, (w + 24) / 2, h + 10),
  log: (len: number, d: number) => spec(`log:${len}:${d}`, len + 30, d + 16, (g) => {
    ol(g, '#a66a35', rr(10, 8, len, d, d / 2)); line(g, 24, d * 0.45, len - 20, d * 0.45, 4, '#7a4a24'); line(g, 40, d * 0.75, len - 40, d * 0.75, 4, '#7a4a24');
    ol(g, '#e0b27a', ell(len + 6, 8 + d / 2, d * 0.32, d / 2 - 2)); g.strokeStyle = '#a66a35'; g.lineWidth = 3; g.beginPath(); g.ellipse(len + 6, 8 + d / 2, d * 0.17, d * 0.3, 0, 0, 7); g.stroke();
  }, (len + 30) / 2, d + 8),
  lily: () => spec('lily', 90, 30, (g) => { ol(g, '#3fb85a', ell(45, 15, 38, 10), 4); fl(g, C.pink, circ(60, 10, 6)); }, 45, 22),
  /** Round log end for rolling (circle with rings). */
  logRound: (d: number) => spec(`logRound:${d}`, d + 12, d + 12, (g) => { ol(g, '#a66a35', circ(d / 2 + 6, d / 2 + 6, d / 2)); g.strokeStyle = '#7a4a24'; g.lineWidth = 4; for (const k of [0.65, 0.35]) { g.beginPath(); g.arc(d / 2 + 6, d / 2 + 6, d / 2 * k, 0, 7); g.stroke(); } }, (d + 12) / 2, (d + 12) / 2),
  /** Stone arch bridge across the road. under = clearance height; ends at the ground. */
  arch: (under: number, w: number) => spec(`arch:${under}:${w}`, w + 60, under + 190, (g) => {
    const top = 28, sy = under + 190, cx = (w + 60) / 2;
    ol(g, '#c9b79a', (c) => { c.moveTo(0, sy - 8); c.lineTo(0, top); c.lineTo(w + 60, top); c.lineTo(w + 60, sy - 8); c.lineTo(cx + w / 2, sy - 8); c.lineTo(cx + w / 2, sy - under + 20); c.quadraticCurveTo(cx + w / 2, sy - under - 4, cx + w / 2 - 20, sy - under - 4); c.lineTo(cx - w / 2 + 20, sy - under - 4); c.quadraticCurveTo(cx - w / 2, sy - under - 4, cx - w / 2, sy - under + 20); c.lineTo(cx - w / 2, sy - 8); c.closePath(); });
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) line(g, 6 + i * (w / 11 + 5), top + 6 + r * 26, 6 + i * (w / 11 + 5), top + 26 + r * 26, 2, '#a89678');
    for (let r = 1; r < 4; r++) line(g, 0, top + r * 26, w + 60, top + r * 26, 2, '#a89678');
    ol(g, '#a89678', rr(-6, top - 14, w + 72, 20, 6), 4);
  }, (w + 60) / 2, under + 190 - 8),
  /** Plank for plank bridges (origin centre). */
  plank: (len: number, style: 'wood' | 'rope' | 'stick') => spec(`plank:${len}:${style}`, len + 10, 34, (g) => {
    if (style === 'wood') { ol(g, C.wood, rr(5, 6, len, 22, 4), 4); line(g, 5 + len * 0.3, 8, 5 + len * 0.3, 26, 2, C.woodDark); }
    else if (style === 'rope') { ol(g, '#d7b27a', rr(5, 8, len, 14, 7), 4); line(g, 5 + len * 0.5, 9, 5 + len * 0.5, 21, 3, '#9a7a4a'); }
    else { ol(g, '#8a5a30', rr(5, 8, len, 12, 6), 4); ol(g, '#8a5a30', rr(5 + len * 0.1, 14, len * 0.8, 8, 4), 3); }
  }, (len + 10) / 2, 17),
  postTall: () => spec('post', 30, 130, (g) => ol(g, C.woodDark, rr(4, 4, 22, 120, 6), 4), 15, 124),

  // ------------------------------------------------------------------ creatures and people
  duck: (s = 1, color: string = C.yellow) => spec(`duck:${s}:${color}`, 90 * s, 80 * s, (g) => {
    g.scale(s, s);
    ol(g, color, ell(40, 52, 30, 20)); ol(g, color, circ(62, 28, 17)); ol(g, C.orange, poly([[76, 28], [92, 32], [76, 38]]), 3); eyes(g, 64, 24, 4, 0);
    ol(g, '#e6b82a', ell(30, 54, 15, 10, -0.3), 3); ol(g, C.orange, rr(32, 70, 20, 5, 2), 2);
  }, 45 * s, 74 * s),
  frog: () => spec('frog', 70, 50, (g) => { ol(g, '#3fb84a', ell(35, 32, 26, 15)); ol(g, '#3fb84a', circ(22, 16, 10)); ol(g, '#3fb84a', circ(48, 16, 10)); eyes(g, 35, 15, 3, 13); line(g, 22, 36, 48, 36, 3, '#1f7a2a'); }, 35, 44),
  pigeon: () => spec('pigeon', 80, 70, (g) => { ol(g, '#9aa4b2', ell(38, 40, 26, 18)); ol(g, '#9aa4b2', circ(60, 24, 12)); ol(g, C.orange, poly([[70, 24], [82, 28], [70, 31]]), 3); eyes(g, 62, 21, 3, 0); ol(g, '#7e8896', ell(26, 40, 14, 9, 0.3), 3); line(g, 36, 56, 36, 64, 3); line(g, 46, 56, 46, 64, 3); }, 40, 64),
  squirrel: () => spec('squirrel', 80, 90, (g) => { ol(g, '#c0703a', ell(18, 50, 16, 30, -0.4)); ol(g, '#c0703a', ell(40, 56, 18, 24)); ol(g, '#c0703a', circ(46, 30, 14)); ol(g, '#c0703a', poly([[40, 20], [44, 6], [50, 20]]), 3); eyes(g, 50, 28, 3, 0); fl(g, '#fff', ell(42, 62, 9, 14)); }, 40, 84),
  fish: () => spec('fish', 70, 40, (g) => { ol(g, C.orange, ell(30, 20, 24, 13), 4); ol(g, C.orange, poly([[50, 20], [68, 6], [68, 34]]), 4); eyes(g, 18, 17, 3, 0); }, 35, 20),
  turtle: () => spec('turtle', 140, 80, (g) => { ol(g, '#4aa05a', circ(124, 42, 14)); ol(g, '#3a8a4a', (c) => { c.moveTo(14, 70); c.quadraticCurveTo(40, 0, 84, 8); c.quadraticCurveTo(116, 12, 120, 70); c.closePath(); }); eyes(g, 128, 38, 3, 0); ol(g, '#4aa05a', rr(30, 62, 22, 14, 6), 3); ol(g, '#4aa05a', rr(84, 62, 22, 14, 6), 3); }, 70, 74),
  crab: () => spec('crab', 90, 60, (g) => { ol(g, C.red, circ(18, 18, 12), 4); ol(g, C.red, circ(72, 18, 12), 4); ol(g, C.red, ell(45, 38, 26, 16)); eyes(g, 45, 22, 4, 8); for (const x of [26, 36, 54, 64]) line(g, x, 48, x + (x < 45 ? -6 : 6), 56, 3, C.red); }, 45, 54),
  gull: () => spec('gull', 90, 60, (g) => { ol(g, '#fff', ell(40, 34, 28, 14), 4); ol(g, '#fff', circ(66, 22, 11), 4); ol(g, C.orange, poly([[75, 22], [88, 26], [75, 29]]), 3); eyes(g, 68, 19, 3, 0); ol(g, '#cfd6df', ell(28, 30, 22, 8, -0.3), 3); line(g, 38, 46, 38, 54, 3, C.orange); line(g, 48, 46, 48, 54, 3, C.orange); }, 45, 54),
  puppy: (asleep = true) => spec(`puppy:${asleep}`, 120, 70, (g) => {
    ol(g, '#d9a066', ell(54, 46, 40, 20)); ol(g, '#d9a066', circ(92, 38, 18)); ol(g, '#a86a30', ell(80, 34, 7, 14, 0.4), 3); ol(g, '#a86a30', ell(102, 32, 6, 12, -0.2), 3); fl(g, C.ink, circ(100, 40, 4));
    if (asleep) { line(g, 90, 34, 98, 34, 3); } else eyes(g, 94, 34, 3, 0);
  }, 60, 64),
  snowman: (hat = true) => spec(hat ? 'snowman' : 'snowman:bare', 140, 230, (g) => {
    ol(g, C.snow, circ(70, 176, 48)); ol(g, C.snow, circ(70, 110, 34)); ol(g, C.snow, circ(70, 62, 26));
    fl(g, C.ink, circ(62, 58, 3)); fl(g, C.ink, circ(78, 58, 3)); ol(g, C.orange, poly([[70, 64], [96, 68], [70, 72]]), 3);
    for (const y of [100, 120]) fl(g, C.ink, circ(70, y, 4));
    line(g, 34, 106, 8, 84, 5, C.woodDark); line(g, 106, 106, 132, 84, 5, C.woodDark);
    if (hat) { ol(g, '#333', rr(48, 18, 44, 10, 3), 3); ol(g, '#333', rr(54, -2, 32, 24, 4), 3); }
  }, 70, 224),
  hat: () => spec('hat', 70, 50, (g) => { ol(g, '#333', rr(4, 34, 62, 10, 4), 3); ol(g, '#333', rr(14, 6, 42, 34, 4), 3); fl(g, C.red, (c) => c.rect(14, 28, 42, 8)); }, 35, 44),
  /** Person (farmer, marshal, shopkeeper, kid...). */
  person: (shirt: string, hat: string | null = null, arm: 'down' | 'up' | 'wave' = 'down') => spec(`person:${shirt}:${hat}:${arm}`, 100, 190, (g) => {
    line(g, 40, 130, 38, 182, 10); line(g, 62, 130, 64, 182, 10);
    ol(g, shirt, rr(26, 64, 50, 74, 14)); ol(g, '#ffd1a1', circ(51, 40, 24));
    if (arm === 'down') { line(g, 28, 74, 18, 120, 9, shirt); line(g, 74, 74, 84, 120, 9, shirt); }
    else if (arm === 'up') { line(g, 28, 74, 14, 20, 9, shirt); line(g, 74, 74, 88, 20, 9, shirt); }
    else { line(g, 28, 74, 18, 120, 9, shirt); line(g, 74, 74, 92, 36, 9, shirt); }
    eyes(g, 51, 38, 4, 8); line(g, 44, 50, 58, 50, 3);
    if (hat) { ol(g, hat, rr(22, 8, 58, 16, 6), 4); ol(g, hat, rr(32, -4, 38, 20, 6), 4); }
  }, 50, 182),
  grandpa: () => spec('grandpa', 100, 110, (g) => { ol(g, '#ffd1a1', circ(50, 62, 30)); ol(g, '#a0c4ff', poly([[18, 50], [50, 4], [82, 50], [60, 40], [40, 40]]), 4); fl(g, '#fff', circ(70, 14, 8)); eyes(g, 50, 60, 4, 10); ol(g, '#fff', ell(50, 88, 18, 12), 3); }, 50, 100),
  marshalCard: (color: string) => spec(`card:${color}`, 70, 90, (g) => { ol(g, color === 'rainbow' ? '#fff' : color, rr(4, 4, 62, 76, 8), 4); if (color === 'rainbow') ['#e8434a', '#ff9a3c', '#ffd23f', '#2fb84f', '#2b8cff', '#a35cff'].forEach((c, i) => fl(g, c, (x) => x.rect(8 + i * 9, 8, 9, 68))); }, 35, 84),
  balloon: (color: string) => spec(`balloon:${color}`, 70, 150, (g) => {
    line(g, 35, 90, 33, 144, 3, '#555');
    const col: string | CanvasGradient = color === 'rainbow' ? (() => { const gr = g.createLinearGradient(0, 0, 70, 0); ['#e8434a', '#ffd23f', '#2fb84f', '#2b8cff', '#a35cff'].forEach((c, i) => gr.addColorStop(i / 4, c)); return gr; })() : color;
    ol(g, col, ell(35, 46, 26, 34), 4); fl(g, 'rgba(255,255,255,0.5)', ell(25, 34, 6, 10, -0.5)); ol(g, color === 'rainbow' ? '#a35cff' : color, poly([[30, 84], [40, 84], [35, 92]]), 3);
  }, 35, 144),
  bunting: (len: number, color: string) => spec(`bunting:${len}:${color}`, len, 80, (g) => {
    g.strokeStyle = C.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(len / 2, 50, len, 6); g.stroke();
    const cols = color === 'rainbow' ? ['#e8434a', '#ffd23f', '#2fb84f', '#2b8cff', '#a35cff'] : [color, '#fff'];
    for (let i = 1; i < len / 40; i++) { const t = (i * 40) / len, x = t * len, y = 6 + 2 * 22 * (1 - Math.pow(2 * t - 1, 2)); ol(g, cols[i % cols.length], poly([[x - 14, y], [x + 14, y], [x, y + 30]]), 3); }
  }, 0, 0),
  floatWagon: (color: string) => spec(`float:${color}`, 300, 240, (g) => {
    ol(g, color === 'rainbow' ? '#ffd23f' : color, rr(20, 120, 260, 70, 14)); for (const x of [70, 230]) { ol(g, '#333', circ(x, 196, 28)); ol(g, '#aaa', circ(x, 196, 10)); }
    for (let i = 0; i < 4; i++) ol(g, ['#e8434a', '#ffd23f', '#2fb84f', '#2b8cff'][i], circ(60 + i * 62, 100, 30));
    fl(g, 'rgba(255,255,255,0.4)', circ(52, 90, 8));
  }, 150, 224),
  band: () => spec('band', 120, 190, (g) => { ol(g, '#2b8cff', rr(30, 64, 60, 76, 14)); ol(g, '#ffd1a1', circ(60, 40, 24)); ol(g, '#ffd23f', rr(48, 8, 24, 36, 6), 4); eyes(g, 60, 38, 4, 8); ol(g, '#ffd23f', rr(70, 90, 40, 24, 8), 3); line(g, 48, 138, 46, 182, 10); line(g, 72, 138, 74, 182, 10); }, 60, 182),
  stroller: () => spec('stroller', 120, 110, (g) => { ol(g, '#ff9ecf', (c) => { c.moveTo(14, 60); c.quadraticCurveTo(14, 20, 60, 20); c.lineTo(90, 20); c.lineTo(90, 64); c.closePath(); }); line(g, 90, 30, 108, 8, 6); for (const x of [30, 80]) { ol(g, '#444', circ(x, 88, 14), 4); } }, 60, 104),
  window: (lit: boolean) => spec(`win:${lit}`, 70, 80, (g) => { ol(g, lit ? '#ffe36a' : '#2a3560', rr(4, 4, 62, 72, 8), 4); line(g, 35, 4, 35, 76, 4); line(g, 4, 40, 66, 40, 4); if (lit) fl(g, 'rgba(255,240,150,0.25)', circ(35, 40, 40)); }, 35, 76),
  zzz: () => spec('zzz', 60, 70, (g) => { g.fillStyle = '#fff'; g.strokeStyle = C.ink; g.lineWidth = 4; g.font = 'bold 36px Arial'; g.strokeText('z', 8, 60); g.fillText('z', 8, 60); g.font = 'bold 26px Arial'; g.strokeText('z', 30, 36); g.fillText('z', 30, 36); }, 30, 35),
  note: () => spec('note', 40, 56, (g) => { ol(g, C.ink, ell(14, 44, 10, 8, -0.4), 2); line(g, 22, 42, 22, 8, 5); ol(g, C.ink, poly([[22, 8], [36, 16], [22, 24]]), 2); }, 20, 28),
  heart: () => spec('heart', 50, 46, (g) => { ol(g, C.pink, (c) => { c.moveTo(25, 42); c.bezierCurveTo(-8, 20, 6, -4, 25, 12); c.bezierCurveTo(44, -4, 58, 20, 25, 42); c.closePath(); }, 3); }, 25, 23),
  exclaim: () => spec('exclaim', 50, 90, (g) => { ol(g, C.yellow, rr(14, 6, 22, 52, 8), 4); ol(g, C.yellow, circ(25, 74, 10), 4); }, 25, 45),
  star: (c: string = C.yellow, r = 16) => spec(`star:${c}:${r}`, r * 2 + 8, r * 2 + 8, (g) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r; pts.push([r + 4 + Math.cos(a) * rad, r + 4 + Math.sin(a) * rad]); }
    ol(g, c, poly(pts), 3);
  }, r + 4, r + 4),
  leaf: (c: string = '#4cb34f') => spec(`leaf:${c}`, 30, 20, (g) => { ol(g, c, ell(15, 10, 12, 6, 0.4), 2); }, 15, 10),
  bubble: () => spec('bubble', 40, 40, (g) => { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.fill(); g.stroke(); }, 20, 20),
  rope: (len: number) => spec(`rope:${len}`, len, 20, (g) => { line(g, 4, 10, len - 4, 10, 8, C.ink); line(g, 4, 10, len - 4, 10, 4, '#d7b27a'); }, 0, 10),
  /** Ice patch lying on the ground (flat ellipse). */
  ice: (w: number) => spec(`ice:${w}`, w + 20, 40, (g) => { ol(g, '#bfeaff', ell((w + 20) / 2, 20, w / 2, 12), 3); fl(g, '#fff', ell((w + 20) / 2 - w * 0.2, 16, w * 0.12, 3)); }, (w + 20) / 2, 22),
  /** Soft snow drift. */
  snowbank: (w: number, h: number) => spec(`bank:${w}:${h}`, w + 20, h + 12, (g) => { ol(g, C.snow, (c) => { c.moveTo(6, h + 8); c.quadraticCurveTo(w * 0.2, 6, w * 0.5, 10); c.quadraticCurveTo(w * 0.85, 6, w + 12, h + 8); c.closePath(); }, 4); }, (w + 20) / 2, h + 8),
  /** Tow-truck-less pull: a hook/rope end. */
  hook: () => spec('hook', 40, 40, (g) => { g.strokeStyle = C.ink; g.lineWidth = 6; g.beginPath(); g.arc(20, 18, 10, 0.5, 5.5); g.stroke(); }, 20, 20),
  /** Soft box for delivery (colour variants). */
  box: (c: string) => spec(`box:${c}`, 90, 90, (g) => { ol(g, c, rr(6, 6, 78, 78, 12)); fl(g, darken(c, 0.2), (x) => x.rect(38, 6, 14, 78)); fl(g, lighten(c, 0.35), rr(14, 14, 18, 8, 4)); }, 45, 84),
  /** Pond lily / duck-pond for fog scenes etc. is done with pools (side.ts). */
  hubcap: () => spec('hubcap', 40, 40, (g) => { ol(g, '#cfd6df', circ(20, 20, 16), 3); fl(g, '#9aa4b2', circ(20, 20, 6)); }, 20, 20),
  bandage: () => spec('bandage', 70, 30, (g) => { ol(g, '#ffd9b0', rr(4, 4, 62, 22, 8), 3); fl(g, '#e8b88a', rr(24, 6, 22, 18, 3)); }, 35, 15),
  fuel: () => spec('fuel', 90, 70, (g) => { ol(g, '#fff', (c) => { c.moveTo(6, 60); c.arc(45, 60, 39, Math.PI, 0); c.closePath(); }, 4); line(g, 45, 58, 28, 30, 5, C.red); fl(g, C.ink, circ(45, 58, 5)); ol(g, C.red, rr(10, 44, 14, 14, 3), 2); }, 45, 60),
  dust: () => spec('dust', 60, 60, (g) => { fl(g, 'rgba(255,255,255,0.8)', circ(30, 30, 26)); }, 30, 30),
  card: (c: string) => spec(`pcard:${c}`, 60, 60, (g) => { ol(g, c, rr(6, 6, 48, 48, 8), 3); }, 30, 30),
  hash,
} as const;

export const palette = PAL;

/** Top-view props (origin centre), shared by the stage kit and shape export. */
export const T = {
  mirror: () => spec('t:mirror', 58, 50, (g) => {
    ol(g, '#42536b', rr(24, 22, 12, 25, 5), 3);
    ol(g, '#bceeff', rr(6, 6, 46, 25, 9), 4);
    line(g, 13, 14, 30, 14, 4, C.white);
  }, 30, 45),
  hayTop: () => spec('t:hay', 130, 84, (g) => { ol(g, PAL.hay, rr(6, 6, 118, 72, 16)); line(g, 44, 8, 44, 76, 4, PAL.hayDark); line(g, 86, 8, 86, 76, 4, PAL.hayDark); fl(g, 'rgba(255,255,255,0.35)', rr(14, 12, 40, 8, 4)); }, 65, 42),
  cone: () => spec('t:cone', 56, 56, (g) => { ol(g, PAL.orange, circ(28, 28, 22), 4); fl(g, '#fff', circ(28, 28, 13)); ol(g, PAL.orange, circ(28, 28, 7), 3); }, 28, 28),
  treeTop: (d: number, c: string = '#3fae4a') => spec(`t:tree:${d}:${c}`, d + 30, d + 30, (g) => {
    fl(g, 'rgba(0,0,0,0.18)', circ(d / 2 + 22, d / 2 + 22, d / 2));
    ol(g, c, circ(d / 2 + 12, d / 2 + 12, d / 2)); fl(g, darken(c, 0.15), circ(d / 2 + 24, d / 2 + 26, d * 0.3)); fl(g, '#6ed46c', circ(d * 0.36, d * 0.34, d * 0.14)); fl(g, '#8fe48a', circ(d * 0.62, d * 0.3, d * 0.07));
  }, (d + 30) / 2 - 4, (d + 30) / 2 - 4),
  wall: (len: number, th: number) => spec(`t:wall:${len}:${th}`, len + 16, th + 16, (g) => { ol(g, '#c97b5a', rr(8, 8, len, th, 8)); for (let i = 1; i < len / 50; i++) line(g, 8 + i * 50, 10, 8 + i * 50, th + 6, 2, '#a85c40'); }, (len + 16) / 2, (th + 16) / 2),
  squirrelTop: () => spec('t:squirrel', 60, 60, (g) => { ol(g, '#c0703a', circ(30, 30, 14), 3); ol(g, '#c0703a', circ(44, 30, 9), 3); ol(g, '#c0703a', (c) => c.ellipse(14, 34, 14, 8, 0.4, 0, 7), 3); }, 30, 30),
  duckTop: (s = 1) => spec(`t:duck:${s}`, 60 * s, 60 * s, (g) => { g.scale(s, s); ol(g, PAL.yellow, (c) => c.ellipse(28, 30, 20, 14, 0, 0, 7), 3); ol(g, PAL.yellow, circ(46, 30, 10), 3); fl(g, PAL.orange, poly([[54, 27], [62, 30], [54, 33]])); fl(g, PAL.ink, circ(48, 26, 2)); fl(g, PAL.ink, circ(48, 34, 2)); }, 30 * s, 30 * s),
  puddle: (w: number, h: number) => spec(`t:pond:${w}:${h}`, w + 16, h + 16, (g) => { ol(g, '#5fc8ff', (c) => c.ellipse((w + 16) / 2, (h + 16) / 2, w / 2, h / 2, 0, 0, 7), 4); fl(g, 'rgba(255,255,255,0.4)', (c) => c.ellipse((w + 16) / 2 - w * 0.2, (h + 16) / 2 - h * 0.15, w * 0.15, h * 0.06, -0.3, 0, 7)); }, (w + 16) / 2, (h + 16) / 2),
};
