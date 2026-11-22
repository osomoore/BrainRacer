/** Dinosaur, SIDE view parts (faces +x). One drawing function per aspect; numbers come from ./looks. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath, rrectPath } from '../bake';
import { type Pt, deg, quad, tubeOutline } from '../geom';
import { type ClawLook, EXTRA, type HeadLook, type LegLook, type TailLook, TEETH, type TeethLook } from './looks';
import { drawFrill, type SkinSpec, skinFill, tubeShapes } from './skin';
import type { BodyLook } from './looks';

type G = CanvasRenderingContext2D;
const circle = (g: G, x: number, y: number, r: number) => ellipsePath(g, x, y, r, r);

// ---------------------------------------------------------------- claws / hands

/** Fan of claws (or a grabby hand) at (x, y) pointing along `dir` (radians). */
export function drawClawSet(g: G, c: ClawLook, skin: SkinSpec, x: number, y: number, dir: number, forFoot: boolean): void {
  const kind = forFoot && c.kind === 'grabby' ? 'small' : c.kind;
  if (kind === 'grabby') {
    const sh: Shape[] = [];
    for (let i = 0; i < 4; i++) {
      const a = dir + (i - 1.5) * 0.42, bx = x + Math.cos(dir) * 8, by = y + Math.sin(dir) * 8;
      sh.push({ path: (g2) => ellipsePath(g2, bx + Math.cos(a) * 14, by + Math.sin(a) * 14, 13, 6.5, a), fill: skin.look.belly });
    }
    sh.push({ path: (g2) => circle(g2, x, y, 15), fill: skin.look.belly });
    drawShapes(g, sh, 4);
    return;
  }
  const n = kind === 'tiny' ? 2 : 3;
  const len = forFoot ? Math.min(c.claw, 20) : c.claw;
  const sh: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const a = dir + (i - (n - 1) / 2) * 0.5;
    const bx = x + Math.cos(a) * 3, by = y + Math.sin(a) * 3;
    const px = -Math.sin(a), py = Math.cos(a);
    const wd = kind === 'digging' ? 9 : kind === 'hooks' ? 6 : 5.5;
    const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
    if (kind === 'hooks') {
      sh.push({ path: (g2) => { g2.moveTo(bx + px * wd, by + py * wd); g2.quadraticCurveTo(bx + Math.cos(a) * len * 0.6 + px * 4, by + Math.sin(a) * len * 0.6 + py * 4, tx + px * len * 0.45, ty + py * len * 0.45); g2.quadraticCurveTo(bx + Math.cos(a) * len * 0.7 - px * 2, by + Math.sin(a) * len * 0.7 - py * 2, bx - px * wd, by - py * wd); g2.closePath(); }, fill: c.color });
    } else if (kind === 'digging') {
      sh.push({ path: (g2) => polyPath(g2, [{ x: bx + px * wd * 0.7, y: by + py * wd * 0.7 }, { x: tx + px * wd * 1.1, y: ty + py * wd * 1.1 }, { x: tx - px * wd * 1.1, y: ty - py * wd * 1.1 }, { x: bx - px * wd * 0.7, y: by - py * wd * 0.7 }]), fill: c.color });
    } else {
      sh.push({ path: (g2) => polyPath(g2, [{ x: bx + px * wd, y: by + py * wd }, { x: tx, y: ty }, { x: bx - px * wd, y: by - py * wd }]), fill: c.color });
    }
  }
  drawShapes(g, sh, forFoot ? 3.5 : 4);
}

// ---------------------------------------------------------------- torso & body extras

export function torsoSide(b: BodyLook, sk: SkinSpec, bodyId: string): PartSpec {
  const W = b.rx * 2 + 60, H = b.ry * 2 + 60;
  return {
    key: `ws:d:torso:${bodyId}:${sk.key}`, w: W, h: H, ox: W / 2, oy: H / 2,
    draw: (g) => {
      const box = { x0: -b.rx, y0: -b.ry, x1: b.rx, y1: b.ry };
      const sh: Shape[] = [{ path: (c) => ellipsePath(c, 0, 0, b.rx, b.ry), fill: skinFill(sk, box, 1), detail: (c) => {
        c.fillStyle = sk.look.belly; c.globalAlpha = 0.95; c.beginPath(); c.ellipse(b.rx * 0.08, b.ry * (b.kind === 'belly' ? 0.45 : 0.78), b.rx * 0.86, b.ry * (b.kind === 'belly' ? 0.75 : 0.5), 0, 0, 6.3); c.fill(); c.globalAlpha = 1;
        if (b.kind === 'belly') { c.strokeStyle = sk.look.dark; c.lineWidth = 3.5; c.beginPath(); c.arc(b.rx * 0.08, b.ry * 0.5, b.ry * 0.2, 0.3, 2.8); c.stroke(); }
      } }];
      drawShapes(g, sh, OL);
    },
  };
}

export function platesSide(b: BodyLook): PartSpec {
  const W = b.rx * 2 + 80, H = b.ry * 2 + 90;
  return {
    key: `ws:d:plates:${b.rx}:${b.ry}`, w: W, h: H, ox: W / 2, oy: H / 2 + 20,
    draw: (g) => {
      const sh: Shape[] = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 6, a = deg(-160 + t * 140);
        const px = Math.cos(a) * b.rx * 0.98, py = Math.sin(a) * b.ry * 0.98;
        const s = 20 + 11 * Math.sin(t * Math.PI);
        const nx = Math.cos(a), ny = Math.sin(a);
        sh.push({ path: (c) => polyPath(c, [{ x: px - ny * s * 0.7, y: py + nx * s * 0.7 }, { x: px + nx * s * 1.3, y: py + ny * s * 1.3 }, { x: px + ny * s * 0.7, y: py - nx * s * 0.7 }, { x: px - nx * 4, y: py - ny * 4 }]), fill: i % 2 ? '#a7b0be' : '#c6ced9' });
      }
      drawShapes(g, sh, 4);
    },
  };
}

export function sailSide(b: BodyLook): PartSpec {
  const W = b.rx * 2 + 80, H = b.ry * 2 + 150;
  return {
    key: `ws:d:sail:${b.rx}:${b.ry}`, w: W, h: H, ox: W / 2, oy: H / 2 + 40,
    draw: (g) => {
      const peaks: Pt[] = [], base: Pt[] = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5, a = deg(-150 + t * 120);
        base.push({ x: Math.cos(a) * b.rx * 0.95, y: Math.sin(a) * b.ry * 0.95 });
        const h = 38 + 64 * Math.sin(t * Math.PI);
        peaks.push({ x: Math.cos(a) * (b.rx * 0.95 + h * 0.5), y: Math.sin(a) * (b.ry * 0.95 + h) });
      }
      const sh: Shape[] = [{ path: (c) => { c.moveTo(base[0].x, base[0].y); for (let i = 0; i <= 5; i++) { if (i) { const m = { x: (peaks[i - 1].x + peaks[i].x) / 2, y: (peaks[i - 1].y + peaks[i].y) / 2 + 14 }; c.quadraticCurveTo(m.x, m.y, peaks[i].x, peaks[i].y); } else c.lineTo(peaks[0].x, peaks[0].y); } c.lineTo(base[5].x, base[5].y); c.closePath(); }, fill: b.accent, detail: (c) => { c.strokeStyle = 'rgba(120,0,40,0.55)'; c.lineWidth = 4; for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(base[i].x, base[i].y); c.lineTo(peaks[i].x, peaks[i].y); c.stroke(); } } }];
      drawShapes(g, sh, OL);
    },
  };
}

// ---------------------------------------------------------------- neck, head, jaw, teeth

export function neckSide(h: HeadLook, sk: SkinSpec, headId: string): PartSpec {
  const len = h.neckLen, tb = h.neckLen > 120 ? 26 : 34, te = h.neckLen > 120 ? 18 : 30;
  const W = len + 120, H = len + 140;
  return {
    key: `ws:d:neck:${headId}:${sk.key}`, w: W, h: H, ox: 60, oy: H / 2,
    draw: (g) => {
      const base = -36;
      const pts = quad({ x: base, y: 0 }, { x: len * 0.5, y: len > 120 ? 12 : 4 }, { x: len, y: 0 }, 14);
      const hw = pts.map((_, i) => tb + (te - tb) * (i / 14));
      const box = { x0: base, y0: -tb, x1: len, y1: tb };
      drawShapes(g, [{ path: (c) => polyPath(c, tubeOutline(pts, hw)), fill: skinFill(sk, box, 2, true) }], OL);
      // Fade the shoulder overlap into the torso while the neck moves.
      g.save();
      g.globalCompositeOperation = 'destination-in';
      const join = g.createLinearGradient(base, 0, 4, 0);
      join.addColorStop(0, 'transparent');
      join.addColorStop(1, '#fff');
      g.fillStyle = join;
      g.fillRect(-60, -H / 2, W, H);
      g.restore();
    },
  };
}

function skullPath(g: G, h: HeadLook): void {
  const { len, top, snout } = h;
  const fy = -top * (h.brow ? 0.38 : 0.68 - snout * 0.9);
  g.moveTo(-14, 6);
  g.quadraticCurveTo(-34, -top * 0.5, -8, -top * 0.96);
  g.quadraticCurveTo(len * 0.12, -top * 1.16, len * 0.52, -top * (h.brow ? 1.0 : 1.02));
  g.quadraticCurveTo(len * 0.86, -top * (h.brow ? 0.9 : 0.95), len * 0.97, fy);
  g.quadraticCurveTo(len + 14, -top * 0.12, len, 0);
  g.lineTo(-14, 6);
  g.closePath();
}

export function headSide(h: HeadLook, sk: SkinSpec, headId: string, teethId: string): PartSpec {
  const extra = h.horns + h.crest + (sk.ex?.kind === 'feathers' ? 70 : 0);
  const W = h.len + 130, H = h.top + extra + 90;
  const beak = teethId === 'teeth.beak';
  return {
    key: `ws:d:head:${headId}:${sk.key}:${beak ? 'b' : 'n'}`, w: W, h: H, ox: 70, oy: H - 30,
    draw: (g) => {
      const { len, top } = h;
      const box = { x0: -34, y0: -top * 1.1, x1: len + 10, y1: 6 };
      const sh: Shape[] = [];
      if (h.horns) {
        for (const [dx, far] of [[0.2, true], [0.34, false]] as const) {
          const bx = len * dx, by = -top * 0.92;
          sh.push({ path: (c) => polyPath(c, [{ x: bx - 14, y: by + 8 }, { x: bx + 40 + h.horns * 0.15, y: by - h.horns }, { x: bx + 14, y: by + 10 }]), fill: far ? '#e8d6a8' : '#fff3d0' });
        }
      }
      if (h.noseHorn) sh.push({ path: (c) => polyPath(c, [{ x: len * 0.8, y: -top * 0.62 }, { x: len * 0.9 + 10, y: -top * 0.62 - 34 }, { x: len * 0.97, y: -top * 0.5 }]), fill: '#fff3d0' });
      if (h.crest) {
        const cr = h.crest, c1 = EXTRA['extra.frill'].c1;
        sh.push({ path: (c) => { c.moveTo(len * 0.62, -top * 0.98); c.quadraticCurveTo(len * 0.55, -top - cr, len * 0.12, -top - cr * 0.95); c.quadraticCurveTo(-4, -top - cr * 0.3, -12, -top * 0.7); c.closePath(); }, fill: c1, detail: (c) => { c.strokeStyle = '#ffd21f'; c.lineWidth = 5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(len * 0.5 - i * 22, -top); c.lineTo(len * 0.3 - i * 20, -top - cr * 0.8); c.stroke(); } } });
      }
      sh.push({ path: (c) => skullPath(c, h), fill: skinFill(sk, box, 3) });
      drawShapes(g, sh, OL);
      // cheek + nostril + eye
      g.fillStyle = 'rgba(255,110,140,0.4)'; g.beginPath(); circle(g, len * 0.4, -top * 0.22, h.eye * 1.1); g.fill();
      g.fillStyle = OUTLINE; g.beginPath(); ellipsePath(g, len * (h.brow ? 0.9 : 0.88), -top * 0.42, 4.5, 3); g.fill();
      const ex = len * 0.46, ey = -top * 0.6;
      g.fillStyle = '#fff'; g.strokeStyle = OUTLINE; g.lineWidth = 3.5; g.beginPath(); circle(g, ex, ey, h.eye * 1.3); g.fill(); g.stroke();
      g.fillStyle = OUTLINE; g.beginPath(); circle(g, ex + 3, ey + 1, h.eye * 0.7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); circle(g, ex + 5, ey - 3, h.eye * 0.28); g.fill();
      if (h.brow) { g.strokeStyle = sk.look.dark; g.lineWidth = 9; g.beginPath(); g.moveTo(ex - 20, ey - h.eye * 1.9); g.quadraticCurveTo(ex, ey - h.eye * 2.6, ex + 20, ey - h.eye * 1.9); g.stroke(); }
      if (beak) {
        const t = TEETH[teethId];
        const bs: Shape[] = [{ path: (c) => { c.moveTo(len * 0.55, -top * 0.78); c.quadraticCurveTo(len + 20, -top * 0.7, len + 24, -top * 0.1); c.quadraticCurveTo(len + 14, 8, len * 0.58, 4); c.closePath(); }, fill: t.color }];
        drawShapes(g, bs, 4.5);
      }
    },
  };
}

function teethRow(g: G, t: TeethLook, x0: number, x1: number, y: number, dir: 1 | -1): void {
  const sh: Shape[] = [];
  const n = t.n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) / n) * (x1 - x0), w = Math.min(t.w, (x1 - x0) / n * 1.05);
    const tall = t.kind === 'mega' && i % 2 ? t.h * 0.7 : t.h;
    sh.push({
      path: (c) => {
        if (t.kind === 'flat') rrectPath(c, cx - w / 2, dir === 1 ? y - 2 : y - tall + 2, w, tall, 3);
        else if (t.kind === 'big') rrectPath(c, cx - w / 2, dir === 1 ? y - 2 : y - tall + 2, w, tall, 7);
        else polyPath(c, [{ x: cx - w / 2, y: y - dir * 2 }, { x: cx + w * 0.2, y: y + dir * tall }, { x: cx + w / 2, y: y - dir * 2 }]);
      },
      fill: t.color,
    });
  }
  drawShapes(g, sh, 3.2);
}

/** Upper teeth (hang from the mouth line) or the beak cap is part of the head texture. Origin = hinge. */
export function teethSide(h: HeadLook, teethId: string): PartSpec | null {
  const t = TEETH[teethId] ?? TEETH['teeth.flat'];
  if (t.kind === 'beak') return null;
  const W = h.len + 80, H = t.h + 50;
  return {
    key: `ws:d:teeth:${teethId}:${h.len}`, w: W, h: H, ox: 40, oy: 20,
    draw: (g) => teethRow(g, t, h.len * 0.32, h.len * 0.97, 0, 1),
  };
}

/** Lower jaw. Origin = hinge; the top edge is the mouth line. */
export function jawSide(h: HeadLook, sk: SkinSpec, headId: string, teethId: string): PartSpec {
  const t = TEETH[teethId] ?? TEETH['teeth.flat'];
  const W = h.len + 100, H = h.jaw + t.h + 80;
  return {
    key: `ws:d:jaw:${headId}:${teethId}:${sk.key}`, w: W, h: H, ox: 60, oy: t.h + 40,
    draw: (g) => {
      const { len, jaw } = h;
      const sh: Shape[] = [{
        path: (c) => { c.moveTo(-12, -3); c.lineTo(len * 0.97, -3); c.quadraticCurveTo(len * 0.99, jaw * 0.85, len * 0.7, jaw); c.quadraticCurveTo(len * 0.2, jaw * 1.1, -14, jaw * 0.4); c.closePath(); },
        fill: sk.look.belly,
        detail: (c) => { c.fillStyle = '#a3203f'; c.fillRect(-14, -4, len + 10, 8); c.fillStyle = '#ff7f9f'; c.beginPath(); c.ellipse(len * 0.4, 2, len * 0.22, 5, 0, 0, 6.3); c.fill(); },
      }];
      if (t.kind === 'beak') sh.push({ path: (c) => { c.moveTo(len * 0.5, -3); c.lineTo(len + 14, -3); c.quadraticCurveTo(len + 16, jaw * 0.7, len * 0.7, jaw * 0.9); c.lineTo(len * 0.5, jaw * 0.5); c.closePath(); }, fill: t.color });
      drawShapes(g, sh, OL);
      if (t.kind !== 'beak') teethRow(g, { ...t, n: Math.max(2, t.n - 1), h: t.h * 0.7 }, len * 0.4, len * 0.9, -3, -1);
    },
  };
}

// ---------------------------------------------------------------- tail, legs, arms, wings, frill, feathers

export function tailSide(t: TailLook, sk: SkinSpec, tailId: string): PartSpec {
  const len = t.len, W = len + 140, H = t.droop + 190;
  return {
    key: `ws:d:tail:${tailId}:${sk.key}`, w: W, h: H, ox: len + 100, oy: 100,
    draw: (g) => {
      const N = 18;
      const pts = quad({ x: 10, y: 0 }, { x: -len * 0.5, y: -t.droop * 0.3 }, { x: -len, y: t.droop }, N);
      const hw = pts.map((_, i) => {
        const u = i / N;
        if (t.kind === 'club') return u < 0.6 ? t.base / 2 + (t.base * 0.22 - t.base / 2) * (u / 0.6) : t.base * 0.22 + (t.tip - t.base * 0.22) * ((u - 0.6) / 0.4);
        return t.base / 2 + (t.tip / 2 - t.base / 2) * Math.pow(u, 0.8);
      });
      const box = { x0: -len - t.tip, y0: -t.base, x1: 10 + t.base / 2, y1: t.base + t.droop };
      const sh: Shape[] = [];
      const end = pts[N];
      if (t.kind === 'spiked') {
        for (let i = 8; i <= N; i += 2) {
          const p = pts[i], s = 20 - (i - 8) * 0.8;
          for (const sgn of [-1, 1]) sh.push({ path: (c) => polyPath(c, [{ x: p.x - 9, y: p.y + sgn * hw[i] * 0.5 }, { x: p.x - 2, y: p.y + sgn * (hw[i] + s) }, { x: p.x + 9, y: p.y + sgn * hw[i] * 0.5 }]), fill: '#fff3d0' });
        }
        sh.push({ path: (c) => polyPath(c, [{ x: end.x + 4, y: end.y - 14 }, { x: end.x - 38, y: end.y }, { x: end.x + 4, y: end.y + 14 }]), fill: '#fff3d0' });
      }
      if (t.kind === 'paddle') sh.push({ path: (c) => ellipsePath(c, end.x - 20, end.y, 46, 22, 0.1), fill: sk.look.light, detail: (c) => { c.strokeStyle = sk.look.dark; c.lineWidth = 3.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(end.x + 10, end.y + i * 4); c.lineTo(end.x - 60, end.y + i * 14); c.stroke(); } } });
      if (sk.ex?.kind === 'feathers') {
        const cols = [sk.ex.c1, sk.ex.c2, sk.ex.c3];
        cols.forEach((col, i) => { const a = Math.PI + (i - 1) * 0.5; sh.push({ path: (c) => ellipsePath(c, end.x + Math.cos(a) * 34, end.y + Math.sin(a) * 34, 34, 11, a), fill: col }); });
      }
      sh.push(...tubeShapes(pts, hw, skinFill(sk, box, 4, false)));
      drawShapes(g, sh, OL);
    },
  };
}

export function legSide(l: LegLook, sk: SkinSpec, legId: string, claw: ClawLook, clawId: string, len: number, far: boolean, hand: boolean, swimming: boolean): PartSpec {
  const th = l.thick, foot = l.foot;
  const W = th * 2 + foot + 90, H = len + th + 70;
  return {
    key: `ws:d:leg:${legId}:${sk.key}:${clawId}:${Math.round(len)}:${far ? 'f' : 'n'}${hand ? 'h' : ''}${swimming ? 's' : ''}`, w: W, h: H, ox: th + 40, oy: th + 20,
    draw: (g) => {
      const N = 12;
      let pts: Pt[];
      if (l.kind === 'hoppy') pts = [...quad({ x: 0, y: 0 }, { x: -26, y: len * 0.5 }, { x: 8, y: len * 0.72 }, 8), ...quad({ x: 8, y: len * 0.72 }, { x: 14, y: len * 0.9 }, { x: 6, y: len - 14 }, 5).slice(1)];
      else pts = quad({ x: 0, y: 0 }, { x: -5, y: len * 0.5 }, { x: 3, y: len - 14 - OL }, N);
      const n = pts.length;
      const hw = pts.map((_, i) => { const u = i / (n - 1); return l.kind === 'powerful' ? th * 0.5 * (1 - u * 0.5) : th * 0.5 * (1 - u * 0.3); });
      const box = { x0: -th, y0: l.kind === 'powerful' ? -th * 0.65 : -th * 0.5, x1: foot, y1: len + (swimming ? foot * 0.24 : 0) };
      const fill = skinFill(sk, box, 5);
      const darkOverlay = (c: G) => { if (far) { c.fillStyle = 'rgba(30,0,40,0.28)'; c.fillRect(-th * 2, -th * 2, W * 2, H * 2); } };
      const sh: Shape[] = [];
      if (l.kind === 'powerful') sh.push({ path: (c) => ellipsePath(c, -2, th * 0.45, th * 0.9, th * 1.05), fill, detail: darkOverlay });
      const sole = len - OL;
      if (swimming) {
        const flipper = l.kind === 'flipper';
        sh.push({
          path: (c) => ellipsePath(c, 3, len - 8, flipper ? 15 : th * 0.28, foot * (flipper ? 0.48 : 0.3), -0.14),
          fill: flipper ? sk.look.light : fill,
          detail: (c) => {
            darkOverlay(c);
            if (!flipper) return;
            c.strokeStyle = sk.look.dark;
            c.lineWidth = 3;
            for (const offset of [-1, 0, 1]) {
              c.beginPath();
              c.moveTo(offset * 3, len - 10);
              c.lineTo(offset * 8 + 4, len + foot * 0.3);
              c.stroke();
            }
          },
        });
      } else if (l.kind === 'flipper') {
        const finY = sole - 18;
        sh.push({ path: (c) => ellipsePath(c, foot * 0.28, finY, foot * 0.58, 17, 0.12), fill: sk.look.light, detail: (c) => { darkOverlay(c); c.strokeStyle = sk.look.dark; c.lineWidth = 3.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(0, finY + i * 3); c.lineTo(foot * 0.8, finY + i * 9); c.stroke(); } } });
      } else sh.push({ path: (c) => rrectPath(c, -foot * 0.28, sole - 18, foot, 18, 9), fill, detail: darkOverlay });
      sh.push(...tubeShapes(pts, hw, (c) => { fill(c); darkOverlay(c); }));
      drawShapes(g, sh, OL);
      if (l.kind === 'flipper') return;
      if (swimming) drawClawSet(g, claw, sk, 4, len + foot * 0.14, 1.45, true);
      else drawClawSet(g, claw, sk, foot * 0.7, sole - 9, 0.1, !hand);
    },
  };
}

export function armSide(c: ClawLook, sk: SkinSpec, clawId: string, far: boolean): PartSpec {
  const W = c.arm + 120, H = c.arm + 110;
  return {
    key: `ws:d:arm:${clawId}:${sk.key}:${far ? 'f' : 'n'}`, w: W, h: H, ox: 60, oy: 40,
    draw: (g) => {
      const pts = quad({ x: 0, y: 0 }, { x: 4, y: c.arm * 0.5 }, { x: 10, y: c.arm }, 8);
      const hw = pts.map((_, i) => c.thick * 0.5 * (1 - (i / 8) * 0.25));
      const fill = skinFill(sk, { x0: -c.thick, y0: -c.thick * 0.5, x1: c.thick, y1: c.arm + c.thick * 0.5 }, 6);
      drawShapes(g, tubeShapes(pts, hw, (cx) => { fill(cx); if (far) { cx.fillStyle = 'rgba(30,0,40,0.28)'; cx.fillRect(-100, -100, 400, 400); } }), OL);
      drawClawSet(g, c, sk, 10, c.arm + 2, deg(80), false);
    },
  };
}

export function wingSide(sk: SkinSpec, far: boolean): PartSpec {
  return {
    key: `ws:d:wing:${sk.key}:${far ? 'f' : 'n'}`, w: 260, h: 220, ox: 230, oy: 180,
    draw: (g) => {
      const elbow = { x: -40, y: -100 }, t1 = { x: -190, y: -120 }, t2 = { x: -200, y: -40 }, t3 = { x: -140, y: 14 }, tail = { x: -30, y: 30 };
      const sh: Shape[] = [{
        path: (c) => { c.moveTo(0, 0); c.lineTo(elbow.x, elbow.y); c.lineTo(t1.x, t1.y); c.quadraticCurveTo(-170, -85, t2.x, t2.y); c.quadraticCurveTo(-180, -10, t3.x, t3.y); c.quadraticCurveTo(-90, 6, tail.x, tail.y); c.closePath(); },
        fill: sk.look.light,
        detail: (c) => {
          c.strokeStyle = sk.look.dark; c.lineWidth = 6;
          for (const t of [t1, t2, t3]) { c.beginPath(); c.moveTo(elbow.x, elbow.y); c.lineTo(t.x, t.y); c.stroke(); }
          c.beginPath(); c.moveTo(0, 0); c.lineTo(elbow.x, elbow.y); c.stroke();
          if (far) { c.fillStyle = 'rgba(30,0,40,0.28)'; c.fillRect(-300, -300, 400, 400); }
        },
      }];
      drawShapes(g, sh, OL);
    },
  };
}

export function frillSide(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.frill'];
  const W = h.top * 2 + 40;
  return {
    key: `ws:d:frill:${h.top}`, w: W, h: W, ox: W / 2, oy: W / 2 + h.top * 0.37,
    draw: (g) => drawFrill(g, -h.top * 0.12, 0, h.top * 0.62, h.top * 0.65, ex),
  };
}

export function featherHeadSide(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.feathers'];
  return {
    key: `ws:d:fhead:${h.len}:${h.top}`, w: 200, h: h.top + 140, ox: 100, oy: h.top + 120,
    draw: (g) => {
      const sh: Shape[] = [];
      [ex.c3, ex.c2, ex.c1].forEach((col, i) => { const a = deg(-110 - i * 22); const bx = h.len * 0.2 - i * 8, by = -h.top * 0.95; sh.push({ path: (c) => ellipsePath(c, bx + Math.cos(a) * 36, by + Math.sin(a) * 36, 38, 11, a), fill: col }); });
      drawShapes(g, sh, 4);
    },
  };
}

