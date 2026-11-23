/** Dinosaur, SIDE view parts (faces +x). One drawing function per aspect; numbers come from ./looks. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath, rrectPath } from '../bake';
import { type Pt, deg, mix, quad, rotPt } from '../geom';
import { BEAK_LOOKS, type BeakLook, type ClawLook, EXTRA, type HeadLook, type LegLook, type TailLook, TEETH, type TeethLook } from './looks';
import { crestFill, drawFrill, drawHeadFeathers, drawHeadJoint, flipperBlade, paddleFins, type SkinSpec, skinFill, tubeShapes } from './skin';
import type { BodyLook } from './looks';
import type { Skeleton } from './skeleton';

type G = CanvasRenderingContext2D;
const TEETH_FRONT = 0.96;
const MEGA_TEETH_BACK = 0.35;
export const MEGA_JAW_REST = 0.34;
const circle = (g: G, x: number, y: number, r: number) => ellipsePath(g, x, y, r, r);

// ---------------------------------------------------------------- claws / hands

/** The near digit sets the silhouette; the other digits peek over it in profile. */
function drawClawSet(g: G, c: ClawLook, skin: SkinSpec, x: number, y: number, dir: number, forFoot: boolean): void {
  const kind = forFoot && c.kind === 'grabby' ? 'small' : c.kind;
  const length = kind === 'grabby' ? 23 : forFoot ? Math.min(c.claw || 11, 21) : c.claw;
  const count = kind === 'tiny' ? 2 : 3;
  g.save();
  g.translate(x, y);
  g.rotate(dir);
  for (let i = count - 1; i >= 0; i--) {
    const reach = length * (1 - i * 0.15);
    g.save();
    g.translate(-i * 2.5, -i * 3);
    drawShapes(g, [{
      path: (p) => {
        p.moveTo(-5, -4);
        p.quadraticCurveTo(reach * 0.72, -8, reach, -3);
        if (kind === 'grabby') {
          p.quadraticCurveTo(reach + 4, 5, reach - 4, 7);
          p.quadraticCurveTo(reach * 0.64, 6, reach * 0.72, 1);
        } else if (kind === 'digging') {
          p.quadraticCurveTo(reach + 3, 3, reach - 3, 6);
        } else {
          p.quadraticCurveTo(reach + 1, 1, reach - (kind === 'hooks' ? 4 : 1), kind === 'hooks' ? 10 : 5);
          p.quadraticCurveTo(reach * 0.71, 3, reach * 0.47, 3);
        }
        p.quadraticCurveTo(2, 6, -5, 4);
        p.closePath();
      },
      fill: kind === 'grabby'
        ? (i === 0 ? skin.look.belly : skin.look.dark)
        : mix(c.color, skin.look.dark, i * 0.16),
    }], 2.3);
    g.restore();
  }
  if (kind === 'grabby') drawShapes(g, [{
    path: (p) => ellipsePath(p, 2, 3, 8, 5, -0.4), fill: skin.look.belly,
  }], 2.3);
  g.restore();
}

// ---------------------------------------------------------------- torso & body extras

export function torsoSide(b: BodyLook, h: HeadLook, pose: Skeleton, sk: SkinSpec, bodyId: string, headId: string): PartSpec {
  const { rx, ry, rot } = pose.torso;
  const angle = pose.neckAng - rot;
  const joint = rotPt({ x: pose.neckBase.x - pose.torso.x, y: pose.neckBase.y - pose.torso.y }, -rot);
  const baseWidth = h.neckLen > 120 ? 30 : 38;
  const tipWidth = h.neckLen > 120 ? 16 : 22;
  const underCheek = rotPt({ x: -5, y: -h.top * 0.11 }, pose.headRot - pose.neckAng);
  const neck = quad({ x: -24, y: 0 }, { x: h.neckLen * 0.45, y: 6 }, { x: h.neckLen + underCheek.x, y: underCheek.y }, 14)
    .map((p) => rotPt(p, angle))
    .map((p) => ({ x: p.x + joint.x, y: p.y + joint.y }));
  const widths = neck.map((_, i) => baseWidth + (tipWidth - baseWidth) * (i / (neck.length - 1)));
  const edge = neck[neck.length - 1];
  const x0 = -rx, y0 = Math.min(-ry, edge.y - tipWidth), x1 = Math.max(rx, edge.x + tipWidth), y1 = Math.max(ry, edge.y + tipWidth);
  const pad = baseWidth + OL;
  return {
    key: `ws:d:torso:${bodyId}:${headId}:${pose.pose}:${sk.key}`,
    w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2, ox: pad - x0, oy: pad - y0,
    draw: (g) => {
      const fill = skinFill(sk, { x0, y0, x1, y1 }, 1);
      const sh = tubeShapes(neck, widths, fill);
      const tubby = b.kind === 'belly';
      sh.push({ path: (c) => {
        if (!tubby) {
          ellipsePath(c, 0, 0, rx, ry);
          return;
        }
        c.moveTo(-rx, -ry * 0.07);
        c.bezierCurveTo(-rx, -ry * 1.22, rx, -ry * 1.28, rx, -ry * 0.04);
        c.bezierCurveTo(rx, ry * 1.47, -rx, ry * 1.55, -rx, -ry * 0.07);
        c.closePath();
      }, fill, detail: (c) => {
        c.fillStyle = sk.look.belly;
        c.beginPath();
        ellipsePath(c, rx * 0.04, ry * (tubby ? 0.70 : 0.78), rx * (tubby ? 0.99 : 0.86), ry * (tubby ? 0.46 : 0.50));
        c.fill();
      } });
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
      for (let i = 0; i < 6; i++) {
        const t = i / 5, a = deg(-160 + t * 72);
        const px = Math.cos(a) * b.rx * 0.98, py = Math.sin(a) * b.ry * 0.98;
        const s = 14 + 15 * Math.sin(t * Math.PI);
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

function skullPath(g: G, h: HeadLook): void {
  const { len, top, snout } = h;
  const fy = -top * (h.brow ? 0.38 : 0.68 - snout * 0.9);
  g.moveTo(-8, 5);
  g.bezierCurveTo(-22, -1, -27, -top * 0.54, -8, -top * 0.96);
  g.quadraticCurveTo(len * 0.12, -top * 1.16, len * 0.52, -top * (h.brow ? 1.0 : 1.02));
  g.quadraticCurveTo(len * 0.86, -top * (h.brow ? 0.9 : 0.95), len * 0.97, fy);
  g.quadraticCurveTo(len + 13, -top * 0.15, len, -1);
  g.bezierCurveTo(len * 0.72, 1, len * 0.32, 1, -8, 5);
  g.closePath();
}

export function headSide(h: HeadLook, sk: SkinSpec, headId: string, teethId: string, beakLook: BeakLook = BEAK_LOOKS[0]): PartSpec {
  const extra = h.horns + h.crest + (sk.ex?.kind === 'feathers' ? 70 : 0);
  const beak = teethId === 'teeth.beak';
  const W = h.len * (beak ? beakLook.reach : 1) + 130, H = h.top + extra + 90;
  return {
    key: `ws:d:head:${headId}:${sk.key}:${beak ? beakLook.name : 'n'}`, w: W, h: H, ox: 70, oy: H - 30,
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
        const cr = h.crest;
        sh.push({ path: (c) => { c.moveTo(len * 0.62, -top * 0.98); c.quadraticCurveTo(len * 0.55, -top - cr, len * 0.12, -top - cr * 0.95); c.quadraticCurveTo(-4, -top - cr * 0.3, -12, -top * 0.7); c.closePath(); }, fill: crestFill(sk, -top - cr, -top * 0.76) });
      }
      drawShapes(g, sh, OL);
      drawHeadJoint(g, (c) => skullPath(c, h), skinFill(sk, box, 3), sk.look.main, -12, -1, h.neckLen > 120 ? 20 : 25, true);
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
        const { base, reach, rise, hook } = beakLook;
        const x0 = len * base, tip = len * reach, span = tip - x0;
        const peak = top * rise, drop = top * hook;
        const bs: Shape[] = [{
          path: (c) => {
            c.moveTo(x0, -peak * 0.67);
            c.bezierCurveTo(x0 + span * 0.22, -peak, tip - span * 0.16, -peak * 1.02, tip, drop * 0.33);
            c.quadraticCurveTo(tip + 2, drop + 3, tip - span * (0.06 + hook * 0.54), drop * 0.45 + 1);
            c.quadraticCurveTo(x0 + span * 0.57, 1, x0, 5);
            c.quadraticCurveTo(x0 - span * 0.15, -3, x0, -peak * 0.67);
            c.closePath();
          },
          fill: '#ffc44f',
          detail: (c) => {
            const surface = c.createLinearGradient(0, -peak, 0, drop + 6);
            surface.addColorStop(0, '#ffe49a');
            surface.addColorStop(0.58, t.color);
            surface.addColorStop(1, '#e79932');
            c.fillStyle = surface;
            c.fillRect(x0 - 8, -peak - 8, span + 18, peak + drop + 20);
            c.fillStyle = '#a5672a';
            c.beginPath();
            ellipsePath(c, x0 + span * 0.28, -peak * 0.49, 4.2, 2.9, -0.14);
            c.fill();
          },
        }];
        drawShapes(g, bs, 4.5);
      }
    },
  };
}

function teethRow(g: G, t: TeethLook, x0: number, x1: number, y: number, dir: 1 | -1): void {
  const pitch = (x1 - x0) / t.n;
  for (let i = 0; i < t.n; i++) {
    const cx = x0 + (i + 0.5) * pitch;
    const w = Math.min(t.w, pitch * (t.kind === 'mega' ? 0.64 : 0.78));
    const tall = t.kind === 'mega'
      ? Math.min(t.h, cx * (dir === 1 ? 0.33 : 0.22)) * (dir === 1 && i % 2 ? 0.78 : 1)
      : t.h * (t.kind === 'sharp' && i < 3 ? 0.48 + i * 0.18 : 1);
    drawShapes(g, [{
      path: (c) => {
        if (t.kind === 'flat') rrectPath(c, cx - w / 2, dir === 1 ? y - 2 : y - tall + 2, w, tall, 3);
        else if (t.kind === 'big') rrectPath(c, cx - w / 2, dir === 1 ? y - 2 : y - tall + 2, w, tall, 7);
        else {
          c.moveTo(cx - w / 2, y - dir * 2);
          c.quadraticCurveTo(cx - w * 0.23, y + dir * tall * 0.64, cx + w * 0.11, y + dir * tall);
          c.quadraticCurveTo(cx + w * 0.32, y + dir * tall * 0.58, cx + w / 2, y - dir * 2);
          c.closePath();
        }
      },
      fill: t.color,
    }], Math.min(2.1, pitch * 0.18));
  }
}

/** Upper teeth (hang from the mouth line) or the beak cap is part of the head texture. Origin = hinge. */
export function teethSide(h: HeadLook, teethId: string): PartSpec | null {
  const t = TEETH[teethId] ?? TEETH['teeth.flat'];
  if (t.kind === 'beak') return null;
  const W = h.len + 80, H = t.h + 50;
  return {
    key: `ws:d:teeth:${teethId}:${h.len}`, w: W, h: H, ox: 40, oy: 20,
    draw: (g) => teethRow(g, t, h.len * (t.kind === 'sharp' ? 0.18 : MEGA_TEETH_BACK), h.len * TEETH_FRONT, 2, 1),
  };
}

/** The back of the mouth, with clear space in front of it when the jaw opens. */
export function throatSide(h: HeadLook): PartSpec {
  const len = h.len * 0.35;
  return {
    key: `ws:d:throat:${h.len}`, w: len + 8, h: len * 2 + 8, ox: 4, oy: len + 4,
    draw: (g) => {
      g.fillStyle = '#572c4b';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len, -len);
      g.bezierCurveTo(len * 0.42, -len * 0.35, len * 0.37, len * 0.37, len, len);
      g.closePath();
      g.fill();
    },
  };
}

/** Lower jaw. Origin = hinge; the top edge is the mouth line. */
export function jawSide(h: HeadLook, sk: SkinSpec, headId: string, teethId: string, beakLook: BeakLook = BEAK_LOOKS[0]): PartSpec {
  const t = TEETH[teethId] ?? TEETH['teeth.flat'];
  const beak = t.kind === 'beak';
  const W = h.len * (beak ? beakLook.reach : 1) + 100, H = h.jaw + t.h + 80;
  return {
    key: `ws:d:jaw:${headId}:${teethId}:${sk.key}:${beak ? beakLook.name : ''}`, w: W, h: H, ox: 60, oy: t.h + 40,
    draw: (g) => {
      const { len, jaw } = h;
      const hinge = len * 0.08;
      const chin = beak ? len * beakLook.reach * (0.97 - beakLook.hook * 0.24) : len * 0.97;
      const depth = beak ? jaw * 0.38 + h.top * beakLook.lower * 0.48 : jaw * 0.68;
      const lip: Shape['path'] = (c) => {
        c.moveTo(hinge, -3);
        c.quadraticCurveTo(len * 0.58, 1, chin, -1);
        c.quadraticCurveTo(chin + 1, depth * 0.64, chin * 0.74, depth);
        c.quadraticCurveTo(len * 0.28, jaw * 0.59, hinge, jaw * 0.28);
        c.quadraticCurveTo(hinge - 7, jaw * 0.06, hinge, -3);
        c.closePath();
      };
      if (!beak) {
        drawShapes(g, [{
          path: (c) => {
            c.moveTo(len * 0.14, 2);
            c.bezierCurveTo(len * 0.32, -4, len * 0.48, -jaw * 0.49, len * 0.65, -jaw * 0.42);
            c.quadraticCurveTo(len * 0.81, -jaw * 0.30, len * 0.73, -1);
            c.quadraticCurveTo(len * 0.47, 5, len * 0.14, 2);
            c.closePath();
          },
          fill: '#ec7893',
        }], 2.4, '#8c4166');
        if (t.kind === 'mega') {
          // Place the lower row half a tooth forward and account for the resting jaw tilt.
          const pitch = (TEETH_FRONT - MEGA_TEETH_BACK) / t.n;
          const lower = { ...t, n: t.n - 1, h: 13, w: t.w * 0.70 };
          const atRest = (x: number) => (len * x - 10 * Math.sin(MEGA_JAW_REST)) / Math.cos(MEGA_JAW_REST);
          teethRow(g, lower, atRest(MEGA_TEETH_BACK + pitch / 2), atRest(TEETH_FRONT - pitch / 2), -4, -1);
        } else {
          const lower = { ...t, n: Math.max(2, t.n - 2), h: Math.max(7, t.h * 0.44) };
          teethRow(g, lower, len * 0.42, len * 0.90, -4, -1);
        }
      }
      drawHeadJoint(g, lip, (c) => {
        const underside = c.createLinearGradient(hinge, 0, len * 0.75, jaw * 0.65);
        underside.addColorStop(0, sk.look.main);
        underside.addColorStop(0.44, sk.look.light);
        underside.addColorStop(1, sk.look.belly);
        c.fillStyle = underside;
        c.fillRect(-12, -10, len + 30, jaw + 20);
      }, sk.look.main, hinge, 1, Math.min(27, len * 0.22));
      if (beak) {
        g.save();
        g.beginPath();
        lip(g);
        g.clip();
        const gold = g.createLinearGradient(0, -4, 0, depth);
        gold.addColorStop(0, '#e49c37');
        gold.addColorStop(1, '#ffd173');
        g.fillStyle = gold;
        g.beginPath();
        g.moveTo(len * beakLook.base, -8);
        g.quadraticCurveTo(len * (beakLook.base - 0.03), depth * 0.42, len * (beakLook.base + 0.05), depth + 7);
        g.lineTo(chin + 12, depth + 7);
        g.lineTo(chin + 12, -8);
        g.closePath();
        g.fill();
        g.restore();
      }
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
      const tipY = t.droop;
      const bend = t.kind === 'paddle' ? 22 : -tipY * 0.65;
      const pts = quad({ x: 10, y: 0 }, { x: -len * 0.56, y: bend }, { x: -len, y: tipY }, N);
      const hw = pts.map((_, i) => {
        const u = i / N;
        if (t.kind === 'club') return t.base * (0.5 - 0.28 * Math.min(1, u / 0.72));
        return t.base / 2 + (t.tip / 2 - t.base / 2) * Math.pow(u, 0.8);
      });
      const box = { x0: -len - Math.max(t.tip, 45), y0: -t.base, x1: 10 + t.base / 2, y1: t.base + t.droop };
      const fill = skinFill(sk, box, 4);
      const sh: Shape[] = [];
      const end = pts[N];
      if (t.kind === 'spiked') {
        for (let i = 5; i <= N; i += 3) {
          const p = pts[i], s = 24 - i * 0.65;
          sh.push({ path: (c) => {
            c.moveTo(p.x + 9, p.y - hw[i] * 0.48);
            c.quadraticCurveTo(p.x - 3, p.y - hw[i] - s, p.x - 14, p.y - hw[i] - s + 1);
            c.quadraticCurveTo(p.x - 9, p.y - hw[i] * 0.65, p.x - 10, p.y - hw[i] * 0.43);
            c.closePath();
          }, fill: '#fff3d0' });
        }
        sh.push({ path: (c) => ellipsePath(c, end.x + 4, end.y, 19, 13, 0.05), fill: mix(sk.look.main, sk.look.accent, 0.50) });
        sh.push({ path: (c) => polyPath(c, [{ x: end.x + 1, y: end.y - 8 }, { x: end.x - 36, y: end.y - 5 }, { x: end.x + 1, y: end.y + 7 }]), fill: '#fff3d0' });
      }
      if (t.kind === 'paddle') sh.push(...paddleFins(sk, end, false));
      if (sk.ex?.kind === 'feathers') {
        const cols = [sk.ex.c1, sk.ex.c2, sk.ex.c3];
        const compact = t.kind === 'paddle' || t.kind === 'spiked';
        const reach = compact ? 18 : 34;
        const x = end.x + (compact ? 24 : t.kind === 'club' ? -16 : 0);
        cols.forEach((col, i) => { const a = Math.PI + (i - 1) * 0.5; sh.push({ path: (c) => ellipsePath(c, x + Math.cos(a) * reach, end.y + Math.sin(a) * reach, reach, reach * 0.32, a), fill: col }); });
      }
      sh.push(...tubeShapes(pts, hw, fill));
      if (t.kind === 'club') sh.push({
        path: (c) => {
          c.moveTo(end.x + 29, end.y - 10);
          c.bezierCurveTo(end.x + 6, end.y - 11, end.x - 26, end.y - 33, end.x - 32, end.y - 5);
          c.bezierCurveTo(end.x - 41, end.y + 30, end.x - 10, end.y + 46, end.x + 9, end.y + 31);
          c.quadraticCurveTo(end.x + 19, end.y + 17, end.x + 29, end.y + 8);
          c.closePath();
        },
        fill,
        detail: (c) => {
          c.strokeStyle = sk.look.accent;
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(end.x - 15, end.y - 14);
          c.quadraticCurveTo(end.x - 25, end.y + 2, end.x - 14, end.y + 13);
          c.stroke();
        },
      });
      drawShapes(g, sh, OL);
    },
  };
}

export function legSide(l: LegLook, sk: SkinSpec, legId: string, claw: ClawLook, clawId: string, len: number, far: boolean, hand: boolean, swimming: boolean): PartSpec {
  const foreleg = hand && l.kind === 'powerful';
  const th = l.thick * (foreleg ? 0.56 : 1), foot = l.foot * (foreleg ? 0.76 : 1);
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
      if (l.kind === 'powerful') sh.push({ path: (c) => ellipsePath(c, -2, th * 0.45, th * (foreleg ? 0.65 : 0.9), th * (foreleg ? 0.81 : 1.05)), fill, detail: darkOverlay });
      const sole = len - OL;
      if (l.kind === 'flipper') {
        sh.push(flipperBlade(sk, swimming
          ? { x: 4, y: len - 24, angle: Math.PI / 2 - 0.12, length: foot * 0.82, width: 31, far }
          : { x: -9, y: sole - 14, angle: 0.02, length: foot * 0.96, width: 25, far }));
      } else if (swimming) {
        sh.push({ path: (c) => ellipsePath(c, 3, len - 8, th * 0.28, foot * 0.3, -0.14), fill, detail: darkOverlay });
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
  const W = h.top * 2.4 + 34;
  return {
    key: `ws:d:frill:${h.top}`, w: W, h: W, ox: W / 2, oy: W / 2 + h.top * 0.47,
    draw: (g) => drawFrill(g, -h.top * 0.20, 0, h.top * 0.79, h.top * 0.79, ex),
  };
}

export function featherHeadSide(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.feathers'];
  return {
    key: `ws:d:fhead:${h.len}:${h.top}:${sk.look.accent}`, w: 210, h: h.top + 140, ox: 120, oy: h.top + 120,
    draw: (g) => drawHeadFeathers(g, ex, h.crest ? -18 : 1, -h.top * (h.crest ? 0.74 : 0.93), deg(-132), deg(22), 34, 9),
  };
}

