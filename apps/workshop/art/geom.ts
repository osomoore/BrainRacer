/** Pure geometry + colour helpers for the workshop art (no Phaser, unit-tested). */

export interface Pt { x: number; y: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Mix two hex colours (t=0 -> a, t=1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
}
export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t);
export const darken = (c: string, t: number): string => mix(c, '#000000', t);

/** Small deterministic PRNG (art-only; same look every time). */
export function artRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function polyBounds(pts: readonly Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
}

/** Topmost (smallest y) point of a closed polygon at vertical line x, or null when x is outside. */
export function topAt(poly: readonly Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
      const y = a.x === b.x ? Math.min(a.y, b.y) : lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
      if (best === null || y < best) best = y;
    }
  }
  return best;
}

/** Horizontal extent [min,max] of a closed polygon at horizontal line y, or null. */
export function extentAt(poly: readonly Pt[], y: number): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      if (a.y === b.y) { min = Math.min(min, a.x, b.x); max = Math.max(max, a.x, b.x); continue; }
      const x = lerp(a.x, b.x, (y - a.y) / (b.y - a.y));
      min = Math.min(min, x); max = Math.max(max, x);
    }
  }
  return min <= max ? { min, max } : null;
}

/** Scale a polygon toward its centroid (cheap inset for windows). */
export function insetPoly(pts: readonly Pt[], kx: number, ky: number): Pt[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => ({ x: cx + (p.x - cx) * kx, y: cy + (p.y - cy) * ky }));
}

/** Sample a quadratic bezier into n+1 points. */
export function quad(a: Pt, c: Pt, b: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return out;
}

/** Offset a polyline by per-point half widths into a closed outline polygon (left side then right side reversed). */
export function tubeOutline(pts: readonly Pt[], halfW: readonly number[]): Pt[] {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = halfW[Math.min(i, halfW.length - 1)];
    left.push({ x: p.x - dy * w, y: p.y + dx * w });
    right.push({ x: p.x + dy * w, y: p.y - dx * w });
  }
  return [...left, ...right.reverse()];
}

export function rotPt(p: Pt, ang: number): Pt {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
export const deg = (d: number): number => (d * Math.PI) / 180;
