/** Dino skin: base colour + patterns (spots, tiger stripes, leaf camo, glow). Shared by side and top parts. */
import type { Model } from '../../core/types';
import { type Shape } from '../bake';
import { type Pt, artRng, hashStr, tubeOutline } from '../geom';
import { EXTRA, type ExtraLook, SKIN, type SkinLook } from './looks';

type G = CanvasRenderingContext2D;
export type PatternKind = 'none' | 'camo' | 'stripes' | 'glow';
export interface SkinSpec { look: SkinLook; pattern: PatternKind; ex: ExtraLook | null; key: string }
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function skinSpec(m: Model): SkinSpec {
  const look = SKIN[m.color] ?? SKIN['color.orange'];
  const ex = EXTRA[m.extra] ?? null;
  const pattern: PatternKind = ex && (ex.kind === 'camo' || ex.kind === 'stripes' || ex.kind === 'glow') ? ex.kind : 'none';
  return { look, pattern, ex, key: `${m.color}:${m.extra}` };
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
    if (L.spots) {
      g.fillStyle = L.spots;
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
      const n = Math.max(4, Math.min(16, Math.round((w * h) / 2200)));
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? ex.c1 : ex.c2;
        g.beginPath(); g.ellipse(box.x0 + rng() * w, box.y0 + rng() * h, 11 + rng() * 6, 5 + rng() * 3, rng() * 3, 0, 6.3); g.fill();
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
