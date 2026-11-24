/** Dino skin: base colour + patterns (spots, tiger stripes, leaf camo, glow). Shared by side and top parts. */
import { Rng } from '../../core/rng';
import type { Model } from '../../core/types';
import { drawShapes, ellipsePath, OL, OUTLINE, type PartSpec, type Shape } from '../bake';
import { type Pt, artRng, hashStr, mix, tubeOutline } from '../geom';
import picks from '../paint/picks.json';
import { EXTRA, type ExtraLook, SKIN, type SkinLook, type TailLook } from './looks';

type G = CanvasRenderingContext2D;
export type PatternKind = 'none' | 'camo' | 'stripes' | 'glow';
export interface SkinSpec { look: SkinLook; pattern: PatternKind; ex: ExtraLook | null; key: string }
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function skinSpec(m: Model): SkinSpec {
  const look = SKIN[m.color] ?? SKIN['color.orange'];
  const extra = EXTRA[m.extra] ?? null;
  const ex = extra && extra.kind !== 'camo'
    ? extra.kind === 'frill'
      ? { ...extra, c1: mix(look.accent, extra.c1, 0.35), c3: look.accent }
      : { ...extra, c1: look.accent }
    : extra;
  const pattern: PatternKind = ex && (ex.kind === 'camo' || ex.kind === 'stripes' || ex.kind === 'glow') ? ex.kind : 'none';
  return { look, pattern, ex, key: `${m.color}:${m.extra}` };
}

export interface PatternedPartSpec extends PartSpec {
  defaultPatternSeed?: number;
  pickedPatternSeed?: number;
  withPatternSeed?: (seed: number) => PartSpec;
}

type SkinPart = Omit<PartSpec, 'draw'> & { draw: (g: G, patternSeed?: number) => void };
const patternPicks: Record<string, { pick: number | string; patternSeed?: number }> = picks;

/** Keep the texture key stable. The shipped vote is fixed for this part and both projections share the default look seed. */
export function patternedPart(sk: SkinSpec, spec: SkinPart): PatternedPartSpec {
  if (!sk.look.spots && sk.pattern === 'none') return spec;
  const defaultPatternSeed = hashStr(sk.key);
  const vote = patternPicks[spec.key];
  const pickedPatternSeed = typeof vote?.pick === 'number' ? vote.patternSeed : undefined;
  const withPatternSeed = (seed: number): PartSpec => ({ ...spec, draw: (g) => spec.draw(g, seed) });
  return { ...withPatternSeed(pickedPatternSeed ?? defaultPatternSeed), defaultPatternSeed, pickedPatternSeed, withPatternSeed };
}

/** Jittered cells spread marks across the part while leaving room for different layouts. */
export function patternMarks(kind: 'camo' | 'glow' | 'spots', box: Box, seed: number, partSalt: number) {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const rng = new Rng(seed ^ partSalt ^ hashStr(kind));
  const spacing = kind === 'camo' ? 29 : kind === 'glow' ? 43 : 40;
  const cols = Math.max(1, Math.ceil(w / spacing));
  const rows = Math.max(1, Math.ceil(h / spacing));
  const size = Math.min(1, Math.min(w, h) / 50);
  return Array.from({ length: cols * rows }, (_, i) => ({
    x: box.x0 + (i % cols + rng.range(0.16, 0.84)) * w / cols,
    y: box.y0 + (Math.floor(i / cols) + rng.range(0.16, 0.84)) * h / rows,
    radius: rng.range(0.65, 1.2) * size,
    angle: Math.PI + rng.range(-Math.PI / 12, Math.PI / 12),
  }));
}

export function stripeMarks(box: Box, seed: number, partSalt: number) {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const rng = new Rng(seed ^ partSalt ^ hashStr('stripes'));
  const count = Math.max(2, Math.round(w / Math.max(23, h / 3)));
  const pitch = w / count;
  return Array.from({ length: count }, (_, i) => ({
    x: box.x0 + (i + rng.range(0.43, 0.57)) * pitch,
    length: h * rng.range(0.47, 0.91),
    width: pitch * rng.range(0.36, 0.49),
    bend: pitch * rng.range(-0.08, 0.08),
  }));
}

export function crestFill(sk: SkinSpec, start: number, end: number, topView = false): (g: G) => void {
  return (g) => {
    const color = g.createLinearGradient(topView ? start : 0, topView ? 0 : start, topView ? end : 0, topView ? 0 : end);
    color.addColorStop(0, mix(sk.look.accent, sk.look.belly, 0.32));
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

/** The paddle tail ends in paired lobes, with the far lobe foreshortened in profile. */
export function paddleFins(sk: SkinSpec, end: Pt, top: boolean): Shape[] {
  return [-1, 1].map((sign) => ({
    path: (g) => {
      const x = end.x + 16;
      const span = top ? 40 : sign < 0 ? 11 : 23;
      g.moveTo(x, end.y);
      g.quadraticCurveTo(x - 22, end.y + sign * span * 0.85, x - 54, end.y + sign * span);
      g.bezierCurveTo(x - 69, end.y + sign * span, x - 52, end.y + sign * span * 0.34, x - 43, end.y);
      g.closePath();
    },
    fill: sign < 0 && !top ? sk.look.dark : mix(sk.look.main, sk.look.accent, 0.42),
  }));
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
export function skinFill(sk: SkinSpec, box: Box, seed: number, patternSeed = hashStr(sk.key)): (g: G) => void {
  return (g) => {
    const { look: L } = sk;
    const gr = g.createLinearGradient(0, box.y0, 0, box.y1);
    gr.addColorStop(0, L.light); gr.addColorStop(0.35, L.main); gr.addColorStop(1, L.dark);
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
      for (const { x, y, radius } of patternMarks('spots', box, patternSeed, seed)) {
        g.beginPath(); g.arc(x, y, 8 * radius, 0, Math.PI * 2); g.fill();
      }
    }
    skinMarks(g, sk, box, seed, patternSeed);
  };
}

/** The belly uses the same seeded motifs, softened toward the belly colour. */
export function skinMarks(g: G, sk: SkinSpec, box: Box, seed: number, patternSeed = hashStr(sk.key), belly = false): void {
  const ex = sk.ex;
  if (!ex) return;
  const color = (mark: string) => belly ? mix(mark, sk.look.belly, 0.43) : mark;
  if (sk.pattern === 'stripes' && !belly) {
    g.fillStyle = ex.c1;
    for (const { x, length, width, bend } of stripeMarks(box, patternSeed, seed)) {
      const y = box.y0 - 4;
      g.beginPath();
      g.moveTo(x - width / 2, y);
      g.lineTo(x + width / 2, y);
      g.quadraticCurveTo(x + width / 2 + bend, y + length * 0.47, x + bend, y + length);
      g.quadraticCurveTo(x - width * 0.7 + bend, y + length * 0.52, x - width / 2, y);
      g.fill();
    }
  } else if (sk.pattern === 'camo') {
    for (const [i, { x, y, radius, angle }] of patternMarks('camo', box, patternSeed, seed).entries()) {
      const length = 12 * radius;
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.fillStyle = color(i % 2 ? ex.c1 : ex.c2);
      g.beginPath();
      g.moveTo(-length * 0.8, 0);
      g.quadraticCurveTo(-length * 0.3, -length * 1.08, length, 0);
      g.quadraticCurveTo(-length * 0.3, length * 0.99, -length * 0.8, 0);
      g.fill();
      g.strokeStyle = color(ex.c3);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-length, 0);
      g.lineTo(length * 0.7, 0);
      g.stroke();
      g.restore();
    }
  } else if (sk.pattern === 'glow') {
    for (const { x, y, radius } of patternMarks('glow', box, patternSeed, seed)) {
      for (const [band, scale] of [[ex.c1, 10], [ex.c2, 7], [ex.c3, 3]] as const) {
        g.fillStyle = color(band);
        g.beginPath(); g.arc(x, y, radius * scale, 0, Math.PI * 2); g.fill();
      }
    }
  }
}

export function tailFeathers(tail: TailLook, skin: SkinSpec): ExtraLook | null {
  return skin.ex?.kind === 'feathers' && tail.kind !== 'spiked' && tail.kind !== 'paddle' ? skin.ex : null;
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
