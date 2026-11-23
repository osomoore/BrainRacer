/** Dino skin: base colour + patterns (spots, tiger stripes, leaf camo, glow). Shared by side and top parts. */
import type { Model } from '../../core/types';
import { drawShapes, ellipsePath, OL, OUTLINE, type Shape } from '../bake';
import { type Pt, artRng, hashStr, mix, tubeOutline } from '../geom';
import { EXTRA, type ExtraLook, SKIN, type SkinLook } from './looks';

type G = CanvasRenderingContext2D;
export type PatternKind = 'none' | 'camo' | 'stripes' | 'glow';
export interface SkinSpec { look: SkinLook; pattern: PatternKind; ex: ExtraLook | null; key: string }
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function skinSpec(m: Model): SkinSpec {
  const look = SKIN[m.color] ?? SKIN['color.orange'];
  const extra = EXTRA[m.extra] ?? null;
  const ex = extra?.kind === 'feathers' ? { ...extra, c1: look.accent } : extra;
  const pattern: PatternKind = ex && (ex.kind === 'camo' || ex.kind === 'stripes' || ex.kind === 'glow') ? ex.kind : 'none';
  return { look, pattern, ex, key: `${m.color}:${m.extra}` };
}

export function crestFill(sk: SkinSpec, start: number, end: number, topView = false): (g: G) => void {
  return (g) => {
    const color = g.createLinearGradient(topView ? start : 0, topView ? 0 : start, topView ? end : 0, topView ? 0 : end);
    color.addColorStop(0, mix(sk.look.accent, sk.look.belly, 0.45));
    color.addColorStop(0.46, sk.look.accent);
    color.addColorStop(1, sk.look.main);
    g.fillStyle = color;
    g.fillRect(-300, -300, 600, 600);
  };
}

/** Keep the head's silhouette outside the neck and soften the line where the two overlap. */
export function drawHeadJoint(g: G, path: Shape['path'], fill: (g: G) => void, color: string, x: number, y: number, radius: number, blendNeck = false): void {
  const seam = g.createRadialGradient(x, y, radius * 0.25, x, y, radius);
  seam.addColorStop(0, `${color}00`);
  seam.addColorStop(0.68, `${color}55`);
  seam.addColorStop(1, OUTLINE);
  g.save();
  g.beginPath();
  path(g);
  g.strokeStyle = seam;
  g.lineWidth = OL * 2;
  g.stroke();
  g.clip();
  fill(g);
  const shade = g.createRadialGradient(x, y, 0, x, y, radius * 1.3);
  shade.addColorStop(0, `${color}88`);
  shade.addColorStop(1, `${color}00`);
  g.fillStyle = shade;
  g.fillRect(x - radius * 1.3, y - radius * 1.3, radius * 2.6, radius * 2.6);
  if (blendNeck) {
    // The neck cap already fills this area. Let its color show through at the cheek.
    const overlap = radius * 0.82;
    const feather = g.createRadialGradient(x, y, 0, x, y, overlap);
    feather.addColorStop(0, '#000c');
    feather.addColorStop(0.42, '#0008');
    feather.addColorStop(1, '#0000');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = feather;
    g.fillRect(x - overlap, y - overlap, overlap * 2, overlap * 2);
  }
  g.restore();
}

export function drawHeadFeathers(g: G, look: ExtraLook, x: number, y: number, angle: number, spread: number, length: number, width: number): void {
  const colors = [look.c3, look.c2, look.c1];
  drawShapes(g, colors.map((fill, i) => {
    const a = angle + (1 - i) * spread;
    const reach = length * (1 - i * 0.09);
    return {
      path: (c) => ellipsePath(c, x + Math.cos(a) * reach * 0.85, y + Math.sin(a) * reach * 0.85, reach, width, a),
      fill,
    };
  }), 4);
}

/** A tapered paddle with the same leading edge and webbing in both projections. */
export function flipperBlade(sk: SkinSpec, blade: { x: number; y: number; angle: number; length: number; width: number; far?: boolean }): Shape {
  const { x, y, angle, length, width, far } = blade;
  const orient = (g: G) => {
    g.translate(x, y);
    g.rotate(angle);
    g.scale(length, width);
  };
  return {
    path: (g) => {
      g.save();
      orient(g);
      g.moveTo(0, -0.24);
      g.bezierCurveTo(0.33, -0.56, 0.8, -0.53, 0.97, -0.23);
      g.bezierCurveTo(1.1, 0, 0.88, 0.46, 0.67, 0.52);
      g.bezierCurveTo(0.42, 0.61, 0.24, 0.33, 0, 0.23);
      g.quadraticCurveTo(-0.11, 0, 0, -0.24);
      g.closePath();
      g.restore();
    },
    fill: (g) => {
      g.save();
      orient(g);
      const wash = g.createLinearGradient(0, 0.3, 0.78, -0.39);
      wash.addColorStop(0, sk.look.dark);
      wash.addColorStop(0.55, sk.look.main);
      wash.addColorStop(1, sk.look.light);
      g.fillStyle = wash;
      g.fillRect(-0.2, -0.65, 1.4, 1.3);
      if (far) {
        g.fillStyle = 'rgba(30,0,40,0.22)';
        g.fillRect(-0.2, -0.65, 1.4, 1.3);
      }
      g.restore();
    },
    detail: (g) => {
      g.save();
      orient(g);
      g.strokeStyle = sk.look.dark;
      g.globalAlpha = 0.58;
      g.lineWidth = 0.041;
      g.beginPath();
      g.moveTo(0.15, 0.01);
      g.quadraticCurveTo(0.53, 0.22, 0.78, 0.13);
      g.moveTo(0.42, 0.14);
      g.quadraticCurveTo(0.61, 0.29, 0.72, 0.33);
      g.stroke();
      g.restore();
    },
  };
}

/** The fan's scalloped rim and softer inner membrane in either view. */
export function drawFrill(g: G, x: number, y: number, rx: number, ry: number, look: ExtraLook): void {
  const lobes = 8;
  const step = Math.PI * 2 / lobes;
  const rim = (angle: number, radius = 1) => ({
    x: x + Math.cos(angle) * rx * radius,
    y: y + Math.sin(angle) * ry * radius,
  });
  drawShapes(g, [{
    path: (c) => {
      const start = rim(0);
      c.moveTo(start.x, start.y);
      for (let i = 0; i < lobes; i++) {
        const lip = rim((i + 0.5) * step, 1.29);
        const end = rim((i + 1) * step);
        c.quadraticCurveTo(lip.x, lip.y, end.x, end.y);
      }
      c.closePath();
    },
    fill: look.c1,
    detail: (c) => {
      const light = c.createRadialGradient(x + rx * 0.24, y, 0, x, y, Math.max(rx, ry) * 1.12);
      light.addColorStop(0.24, look.c2);
      light.addColorStop(0.82, look.c1);
      light.addColorStop(1, look.c3);
      c.fillStyle = light;
      c.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.4);
      c.strokeStyle = look.c2;
      c.lineWidth = 3.5;
      c.globalAlpha = 0.52;
      for (let i = 0; i < lobes; i++) {
        const start = rim((i + 0.5) * step, 0.40);
        const end = rim((i + 0.5) * step, 0.92);
        c.beginPath();
        c.moveTo(start.x, start.y);
        c.quadraticCurveTo(start.x, end.y, end.x, end.y);
        c.stroke();
      }
    },
  }], OL);
}

/** Fill callback for the current clipped path. */
export function skinFill(sk: SkinSpec, box: Box, seed: number, belly = false): (g: G) => void {
  return (g) => {
    const { look: L } = sk;
    const gr = g.createLinearGradient(0, box.y0, 0, box.y1);
    gr.addColorStop(0, L.light); gr.addColorStop(0.35, L.main); gr.addColorStop(1, belly ? L.belly : L.dark);
    g.fillStyle = gr;
    g.fillRect(box.x0 - 4, box.y0 - 4, box.x1 - box.x0 + 8, box.y1 - box.y0 + 8);
    const w = box.x1 - box.x0, h = box.y1 - box.y0;
    const rng = artRng(hashStr(sk.key) ^ seed);
    const mottles = Math.max(6, Math.min(65, Math.round(w * h / 650)));
    const mottleColors = [L.light, L.dark, mix(L.accent, L.main, 0.60)];
    g.save();
    for (let i = 0; i < mottles; i++) {
      const x = box.x0 + rng() * w, y = box.y0 + rng() * h, radius = 2.6 + rng() * 6.2;
      g.globalAlpha = 0.12 + rng() * 0.12;
      g.fillStyle = mottleColors[i % mottleColors.length];
      g.beginPath();
      g.ellipse(x, y, radius, radius * (0.45 + rng() * 0.42), rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (L.spots) {
      g.fillStyle = L.accent;
      const n = Math.max(3, Math.min(14, Math.round((w * h) / 2600)));
      for (let i = 0; i < n; i++) { g.beginPath(); g.arc(box.x0 + rng() * w, box.y0 + rng() * h, 5 + rng() * 7, 0, 6.3); g.fill(); }
    }
    const ex = sk.ex;
    if (sk.pattern === 'stripes' && ex) {
      g.fillStyle = ex.c1;
      for (let x = box.x0 - 6; x < box.x1; x += Math.max(20, h / 3)) {
        const len = h * (0.5 + rng() * 0.35), wd = 11;
        g.beginPath(); g.moveTo(x, box.y0 - 4); g.lineTo(x + wd, box.y0 - 4); g.quadraticCurveTo(x + wd * 0.5 + 5, box.y0 + len * 0.5, x + 3, box.y0 + len); g.quadraticCurveTo(x - 2, box.y0 + len * 0.4, x, box.y0 - 4); g.fill();
      }
    } else if (sk.pattern === 'camo' && ex) {
      g.save();
      const scale = Math.max(10, Math.min(19, h / 7));
      const shade = mix(L.dark, '#304a24', 0.55);
      for (let j = 0, y = box.y0; y <= box.y1 + scale; j++, y += scale * 0.7) {
        g.lineWidth = 1.6;
        g.strokeStyle = j % 2 ? L.dark : shade;
        for (let x = box.x0 - (j % 2) * scale * 0.5; x <= box.x1 + scale; x += scale) {
          g.globalAlpha = 0.24 + rng() * 0.17;
          g.beginPath();
          g.moveTo(x - scale * 0.48, y);
          g.quadraticCurveTo(x, y + scale * (0.5 + rng() * 0.3), x + scale * 0.48, y);
          g.stroke();
        }
      }
      g.restore();
      const n = Math.max(4, Math.min(18, Math.round((w * h) / 2000)));
      for (let i = 0; i < n; i++) {
        const x = box.x0 + rng() * w, y = box.y0 + rng() * h, length = 9 + rng() * 8;
        g.save();
        g.translate(x, y);
        g.rotate(rng() * 3);
        g.fillStyle = i % 2 ? ex.c1 : ex.c2;
        g.beginPath();
        g.moveTo(-length, 0);
        g.quadraticCurveTo(-length * 0.1, -length * 0.77, length, 0);
        g.quadraticCurveTo(length * 0.16, length * 0.68, -length, 0);
        g.fill();
        g.strokeStyle = i % 2 ? '#a5ca6b' : ex.c3;
        g.globalAlpha = 0.55;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(-length * 0.67, 0);
        g.quadraticCurveTo(0, -2, length * 0.72, 0);
        g.stroke();
        g.restore();
      }
    } else if (sk.pattern === 'glow' && ex) {
      const n = Math.max(3, Math.min(9, Math.round((w * h) / 4200)));
      for (let i = 0; i < n; i++) {
        const x = box.x0 + 8 + rng() * (w - 16), y = box.y0 + 8 + rng() * (h - 16);
        const rg = g.createRadialGradient(x, y, 1, x, y, 15);
        rg.addColorStop(0, ex.c3); rg.addColorStop(0.35, ex.c1); rg.addColorStop(1, 'rgba(200,255,60,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, 15, 0, 6.3); g.fill();
      }
    }
  };
}


/** Shapes for a tube (polyline with per-point half widths): body polygon + two round caps. */
export function tubeShapes(pts: readonly Pt[], hw: readonly number[], fill: (g: G) => void): Shape[] {
  const out = tubeOutline(pts, hw);
  const a = pts[0], b = pts[pts.length - 1];
  const ra = hw[0], rb = hw[hw.length - 1];
  return [
    { path: (g) => { g.moveTo(out[0].x, out[0].y); for (const p of out) g.lineTo(p.x, p.y); g.closePath(); }, fill },
    { path: (g) => { g.moveTo(a.x + ra, a.y); g.arc(a.x, a.y, ra, 0, 6.3); }, fill },
    { path: (g) => { g.moveTo(b.x + rb, b.y); g.arc(b.x, b.y, rb, 0, 6.3); }, fill },
  ];
}
