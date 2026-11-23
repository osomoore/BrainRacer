/** Dinosaur, TOP view parts (faces +x). Same look tables and skin as the side view. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath } from '../bake';
import { type Pt, quad } from '../geom';
import { EXTRA, type BodyLook, type ClawLook, type HeadLook, type LegLook, type TailLook, TEETH } from './looks';
import { drawFrill, drawHeadFeathers, drawHeadJoint, flipperBlade, type SkinSpec, skinFill, tubeShapes } from './skin';

type G = CanvasRenderingContext2D;
const circle = (g: G, x: number, y: number, r: number) => ellipsePath(g, x, y, r, r);

export function topHalfW(b: BodyLook, pose: string): number { return b.ry * (pose === 'swim' ? 0.62 : 0.74); }

export function torsoTop(b: BodyLook, h: HeadLook, pose: string, sk: SkinSpec, bodyId: string, headId: string): PartSpec {
  const hw = topHalfW(b, pose);
  const neckStart = b.rx * 0.65;
  const neckEnd = b.rx * 0.78 + h.neckLen;
  const baseWidth = h.neckLen > 120 ? 23 : 30;
  const tipWidth = h.neckLen > 120 ? 15 : 23;
  const x0 = -b.rx, x1 = neckEnd + tipWidth;
  const pad = 30;
  return {
    key: `ws:d:ttorso:${bodyId}:${headId}:${pose}:${sk.key}`,
    w: x1 - x0 + pad * 2, h: hw * 2 + pad * 2, ox: pad - x0, oy: hw + pad,
    draw: (g) => {
      const fill = skinFill(sk, { x0, y0: -hw, x1, y1: hw }, 1);
      const sh = tubeShapes([{ x: neckStart, y: 0 }, { x: neckEnd, y: 0 }], [baseWidth, tipWidth], fill);
      sh.push({ path: (c) => ellipsePath(c, 0, 0, b.rx, hw), fill });
      drawShapes(g, sh, OL);
    },
  };
}

export function platesTop(b: BodyLook, pose: string): PartSpec {
  const hw = topHalfW(b, pose), W = b.rx * 2 + 40, H = hw * 2 + 60;
  return {
    key: `ws:d:tplates:${b.rx}:${hw}`, w: W, h: H, ox: W / 2, oy: H / 2,
    draw: (g) => {
      const sh: Shape[] = [];
      for (let i = 0; i < 6; i++) {
        const x = -b.rx * 0.7 + (i / 5) * b.rx * 1.35, s = 16 + 12 * Math.sin((i / 5) * Math.PI);
        sh.push({ path: (c) => polyPath(c, [{ x: x - s * 0.8, y: 0 }, { x, y: -s }, { x: x + s * 0.8, y: 0 }, { x, y: s }]), fill: i % 2 ? '#a7b0be' : '#c6ced9' });
      }
      drawShapes(g, sh, 4);
    },
  };
}

export function sailTop(b: BodyLook, pose: string): PartSpec {
  const hw = topHalfW(b, pose), W = b.rx * 2 + 40, H = hw * 2 + 60;
  return {
    key: `ws:d:tsail:${b.rx}:${hw}`, w: W, h: H, ox: W / 2, oy: H / 2,
    draw: (g) => {
      const x0 = -b.rx * 0.7, x1 = b.rx * 0.7;
      const sh: Shape[] = [{ path: (c) => { c.moveTo(x0, 0); for (let i = 0; i <= 6; i++) { const x = x0 + (i / 6) * (x1 - x0); c.lineTo(x, -(11 + (i % 2 ? 7 : 0))); } for (let i = 6; i >= 0; i--) { const x = x0 + (i / 6) * (x1 - x0); c.lineTo(x, 11 + (i % 2 ? 7 : 0)); } c.closePath(); }, fill: b.accent }];
      drawShapes(g, sh, 4);
    },
  };
}

/** Head from above; origin = back centre (neck joint). */
export function headTop(h: HeadLook, sk: SkinSpec, headId: string, teethId: string): PartSpec {
  const hw = h.top * (h.brow ? 0.5 : 0.42);
  const W = h.len + 140, H = hw * 2 + 150;
  const beak = teethId === 'teeth.beak';
  return {
    key: `ws:d:thead:${headId}:${sk.key}:${beak ? 'b' : 'n'}`, w: W, h: H, ox: 50, oy: H / 2,
    draw: (g) => {
      const len = h.len;
      const sh: Shape[] = [];
      if (h.horns) for (const sgn of [-1, 1]) sh.push({ path: (c) => polyPath(c, [{ x: len * 0.22, y: sgn * hw * 0.8 }, { x: len * 0.5 + h.horns * 0.5, y: sgn * (hw + 34) }, { x: len * 0.52, y: sgn * hw * 0.7 }]), fill: '#fff3d0' });
      if (h.noseHorn) sh.push({ path: (c) => ellipsePath(c, len * 0.88, 0, 12, 7), fill: '#fff3d0' });
      drawShapes(g, sh, OL);
      const skull: Shape['path'] = (c) => {
        c.moveTo(-4, -hw * 0.81);
        c.quadraticCurveTo(len * 0.4, -hw * 1.25, len * 0.88, -hw * (0.6 - h.snout * 0.5));
        c.quadraticCurveTo(len + 10, 0, len * 0.88, hw * (0.6 - h.snout * 0.5));
        c.quadraticCurveTo(len * 0.4, hw * 1.25, -4, hw * 0.81);
        c.quadraticCurveTo(-16, 0, -4, -hw * 0.81);
        c.closePath();
      };
      drawHeadJoint(g, skull, skinFill(sk, { x0: -16, y0: -hw, x1: len, y1: hw }, 3), sk.look.main, -8, 0, h.neckLen > 120 ? 19 : 29, true);
      if (h.crest) drawShapes(g, [{ path: (c) => ellipsePath(c, len * 0.3, 0, h.crest * 0.55, 8), fill: EXTRA['extra.frill'].c1 }], OL);
      if (beak) drawShapes(g, [{
        path: (c) => {
          c.moveTo(len * 0.68, -hw * 0.47);
          c.quadraticCurveTo(len * 0.96, -hw * 0.57, len * 1.1, 0);
          c.quadraticCurveTo(len * 0.96, hw * 0.57, len * 0.68, hw * 0.47);
          c.quadraticCurveTo(len * 0.61, 0, len * 0.68, -hw * 0.47);
          c.closePath();
        },
        fill: TEETH[teethId].color,
      }], 4.5);
      g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
      for (const sgn of [-1, 1]) {
        g.fillStyle = '#fff'; g.beginPath(); circle(g, len * 0.45, sgn * hw * 0.62, h.eye * 0.95); g.fill(); g.stroke();
        g.fillStyle = OUTLINE; g.beginPath(); circle(g, len * 0.45 + 2, sgn * hw * 0.62, h.eye * 0.5); g.fill();
        if (!beak) { g.beginPath(); circle(g, len * 0.88, sgn * hw * 0.22, 3); g.fill(); }
      }
    },
  };
}

export function featherHeadTop(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.feathers'];
  return {
    key: `ws:d:tfhead:${h.len}:${h.top}`, w: 145, h: 100, ox: 100, oy: 50,
    draw: (g) => drawHeadFeathers(g, ex, h.crest ? -18 : 4, 0, Math.PI, 0.58, 30, 8.5),
  };
}

export function legTop(l: LegLook, claw: ClawLook, sk: SkinSpec, legId: string, clawId: string, hand: boolean): PartSpec {
  const th = l.thick * 0.72, foot = l.foot;
  const W = foot + 100, H = th + 100;
  return {
    key: `ws:d:tleg:${legId}:${clawId}:${sk.key}:${hand ? 'h' : ''}`, w: W, h: H, ox: 50 + foot * 0.28, oy: H / 2,
    draw: (g) => {
      const fill = skinFill(sk, { x0: -foot / 2, y0: -th, x1: foot, y1: th }, 7);
      const sh: Shape[] = [];
      if (l.kind === 'flipper') sh.push(flipperBlade(sk, { x: -29, y: 0, angle: 0.14, length: foot * 0.96, width: 38 }));
      else sh.push({ path: (c) => ellipsePath(c, foot * 0.12, 0, foot * 0.5, th * 0.55), fill });
      drawShapes(g, sh, 4.5);
      if (l.kind !== 'flipper') {
        g.fillStyle = hand && claw.kind === 'digging' ? claw.color : '#fffbe8'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(foot * 0.55, i * th * 0.28 - 3); g.lineTo(foot * 0.55 + 14, i * th * 0.3); g.lineTo(foot * 0.55, i * th * 0.28 + 3); g.closePath(); g.fill(); g.stroke(); }
      }
    },
  };
}

export function armTop(c: ClawLook, sk: SkinSpec, clawId: string): PartSpec {
  return {
    key: `ws:d:tarm:${clawId}:${sk.key}`, w: 120, h: 80, ox: 40, oy: 40,
    draw: (g) => {
      const L = c.arm * 0.55;
      drawShapes(g, [{ path: (cx) => ellipsePath(cx, L * 0.5, 0, L * 0.6, c.thick * 0.5), fill: skinFill(sk, { x0: 0, y0: -10, x1: L, y1: 10 }, 8) }], 4.5);
      g.fillStyle = c.kind === 'digging' ? c.color : '#fffbe8'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      const n = c.kind === 'tiny' ? 2 : 3;
      for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * 9; g.beginPath(); g.moveTo(L, y - 3); g.lineTo(L + Math.max(8, c.claw * 0.6), y); g.lineTo(L, y + 3); g.closePath(); g.fill(); g.stroke(); }
    },
  };
}

/** Wing from above, pointing toward -y (up); flip for the other side. Origin = shoulder. */
export function wingTop(sk: SkinSpec): PartSpec {
  return {
    key: `ws:d:twing:${sk.key}`, w: 220, h: 260, ox: 120, oy: 230,
    draw: (g) => {
      const pts: Pt[] = [{ x: 20, y: 0 }, { x: -10, y: -90 }, { x: -50, y: -170 }, { x: -90, y: -130 }, { x: -110, y: -150 }, { x: -120, y: -60 }, { x: -70, y: -10 }];
      drawShapes(g, [{ path: (c) => polyPath(c, pts), fill: sk.look.light, detail: (c) => { c.strokeStyle = sk.look.dark; c.lineWidth = 5; for (const p of [pts[2], pts[4], pts[5]]) { c.beginPath(); c.moveTo(0, -10); c.lineTo(p.x, p.y); c.stroke(); } } }], OL);
    },
  };
}

export function tailTop(t: TailLook, sk: SkinSpec, tailId: string): PartSpec {
  const len = t.len, W = len + 160, H = 200;
  return {
    key: `ws:d:ttail:${tailId}:${sk.key}`, w: W, h: H, ox: len + 110, oy: 100,
    draw: (g) => {
      const N = 14;
      const pts = quad({ x: 10, y: 0 }, { x: -len * 0.5, y: 0 }, { x: -len, y: 0 }, N);
      const hw = pts.map((_, i) => { const u = i / N; if (t.kind === 'club') return u < 0.6 ? t.base / 2 + (t.base * 0.22 - t.base / 2) * (u / 0.6) : t.base * 0.22 + (t.tip - t.base * 0.22) * ((u - 0.6) / 0.4); return t.base / 2 + (t.tip / 2 - t.base / 2) * Math.pow(u, 0.8); });
      const sh: Shape[] = [];
      const end = pts[N];
      if (t.kind === 'spiked') for (let i = 6; i <= N; i += 2) for (const sgn of [-1, 1]) sh.push({ path: (c) => polyPath(c, [{ x: pts[i].x - 8, y: sgn * hw[i] * 0.6 }, { x: pts[i].x - 4, y: sgn * (hw[i] + 18) }, { x: pts[i].x + 8, y: sgn * hw[i] * 0.6 }]), fill: '#fff3d0' });
      if (t.kind === 'paddle') sh.push({ path: (c) => ellipsePath(c, end.x - 22, 0, 40, 34), fill: sk.look.light });
      if (sk.ex?.kind === 'feathers') [sk.ex.c1, sk.ex.c2, sk.ex.c3].forEach((col, i) => { const a = Math.PI + (i - 1) * 0.6; sh.push({ path: (c) => ellipsePath(c, end.x + Math.cos(a) * 30, Math.sin(a) * 30, 32, 10, a), fill: col }); });
      sh.push(...tubeShapes(pts, hw, skinFill(sk, { x0: -len - t.tip, y0: -t.base, x1: 10 + t.base / 2, y1: t.base }, 4)));
      drawShapes(g, sh, OL);
    },
  };
}

export function frillTop(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.frill'];
  const W = h.top * 2 + 40;
  return {
    key: `ws:d:tfrill:${h.top}`, w: W, h: W, ox: W / 2, oy: W / 2,
    draw: (g) => drawFrill(g, -h.top * 0.12, 0, h.top * 0.58, h.top * 0.87, ex),
  };
}
