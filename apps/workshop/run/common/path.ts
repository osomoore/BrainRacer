/**
 * Pure path math for top-view tracks (no Phaser): a polyline with rounded corners, sampled by distance.
 *   const p = new RoundedPath(trackVerts(w, h, level), 130);
 *   p.at(300) -> {x, y, a}   // position and heading (radians, 0 = +x, y down)
 *   p.corners[i]             // vertex, incoming/outgoing directions, arc distance range, turn side
 */
export interface Pt { x: number; y: number }
export interface PathPose { x: number; y: number; a: number }
export interface Corner { vertex: Pt; din: Pt; dout: Pt; /** distance where the arc starts / ends */ s0: number; s1: number; /** +1 turns right (clockwise on screen), -1 left */ turn: 1 | -1 }

export class RoundedPath {
  readonly pts: Pt[];
  readonly cum: number[] = [];
  readonly corners: Corner[] = [];
  readonly length: number;

  constructor(readonly verts: readonly Pt[], radius: number, step = 14) {
    const n = verts.length;
    const out: Pt[] = [verts[0]];
    const raw: { i0: number; i1: number; vertex: Pt; din: Pt; dout: Pt; turn: 1 | -1 }[] = [];
    for (let i = 1; i < n - 1; i++) {
      const a = verts[i - 1], b = verts[i], c = verts[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
      const d1 = { x: (b.x - a.x) / l1, y: (b.y - a.y) / l1 }, d2 = { x: (c.x - b.x) / l2, y: (c.y - b.y) / l2 };
      const cross = d1.x * d2.y - d1.y * d2.x, dot = d1.x * d2.x + d1.y * d2.y;
      const ang = Math.atan2(Math.abs(cross), dot);
      if (ang < 0.01) { out.push(b); continue; }
      const off = Math.min(radius * Math.tan(ang / 2), l1 * 0.48, l2 * 0.48);
      const r = off / Math.tan(ang / 2);
      const turn: 1 | -1 = cross > 0 ? 1 : -1;
      const t1 = { x: b.x - d1.x * off, y: b.y - d1.y * off };
      const cx = t1.x - d1.y * turn * r, cy = t1.y + d1.x * turn * r;
      const a0 = Math.atan2(t1.y - cy, t1.x - cx);
      const steps = Math.max(4, Math.ceil((ang * r) / step));
      const i0 = out.length;
      for (let s = 0; s <= steps; s++) { const aa = a0 + turn * ang * (s / steps); out.push({ x: cx + Math.cos(aa) * r, y: cy + Math.sin(aa) * r }); }
      raw.push({ i0, i1: out.length - 1, vertex: b, din: d1, dout: d2, turn });
    }
    out.push(verts[n - 1]);
    this.pts = out;
    let s = 0;
    this.cum = [0];
    for (let i = 1; i < out.length; i++) { s += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y); this.cum.push(s); }
    this.length = s;
    for (const c of raw) this.corners.push({ vertex: c.vertex, din: c.din, dout: c.dout, turn: c.turn, s0: this.cum[c.i0], s1: this.cum[c.i1] });
  }

  /** Pose at distance d along the path (clamped). */
  at(d: number): PathPose {
    const dd = Math.max(0, Math.min(this.length, d));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= dd) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi];
    const seg = this.cum[hi] - this.cum[lo] || 1;
    const t = (dd - this.cum[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
  }
}

/**
 * Track vertices (axis-aligned segments) for the turn scene in a w x h area.
 * level 1: one sharp corner; 2: zig-zag (4 corners); 3: hairpins (6 corners). Path starts at the left edge and exits
 * past the right (levels 2, 3) or the top (level 1) edge.
 */
export function trackVerts(w: number, h: number, level: number): Pt[] {
  if (level <= 1) return [{ x: -60, y: h * 0.7 }, { x: w * 0.64, y: h * 0.7 }, { x: w * 0.64, y: -80 }];
  if (level === 2) return [{ x: -60, y: h * 0.78 }, { x: w * 0.3, y: h * 0.78 }, { x: w * 0.3, y: h * 0.26 }, { x: w * 0.7, y: h * 0.26 }, { x: w * 0.7, y: h * 0.78 }, { x: w + 60, y: h * 0.78 }];
  const inset = Math.max(w * 0.16, 200);
  return [
    { x: -60, y: h * 0.86 }, { x: w - inset, y: h * 0.86 }, { x: w - inset, y: h * 0.62 }, { x: inset, y: h * 0.62 },
    { x: inset, y: h * 0.38 }, { x: w - inset, y: h * 0.38 }, { x: w - inset, y: h * 0.14 }, { x: w + 60, y: h * 0.14 },
  ];
}
