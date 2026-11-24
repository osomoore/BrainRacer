/** Dinosaur, TOP view parts (faces +x). Same look tables and skin as the side view. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath } from '../bake';
import { type Pt, mix, quad } from '../geom';
import { BEAK_LOOKS, type BeakLook, EXTRA, type BodyLook, type ClawLook, type HeadLook, type LegLook, type TailLook, TEETH } from './looks';
import { crestFill, drawFrill, drawHeadFeathers, drawHeadJoint, flipperBlade, paddleFins, patternedPart, type SkinSpec, skinFill, tailFeathers, tubeShapes } from './skin';

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
  return patternedPart(sk, {
    key: `ws:d:ttorso:${bodyId}:${headId}:${pose}:${sk.key}`,
    w: x1 - x0 + pad * 2, h: hw * 2 + pad * 2, ox: pad - x0, oy: hw + pad,
    draw: (g, patternSeed) => {
      const fill = skinFill(sk, { x0, y0: -hw, x1, y1: hw }, 1, patternSeed);
      const sh = tubeShapes([{ x: neckStart, y: 0 }, { x: neckEnd, y: 0 }], [baseWidth, tipWidth], fill);
      sh.push({ path: (c) => ellipsePath(c, 0, 0, b.rx, hw), fill });
      drawShapes(g, sh, OL);
    },
  });
}

export function platesTop(b: BodyLook, pose: string): PartSpec {
  const hw = topHalfW(b, pose), W = b.rx * 2 + 40, H = hw * 2 + 60;
  return {
    key: `ws:d:tplates:${b.rx}:${hw}`, w: W, h: H, ox: W / 2, oy: H / 2,
    draw: (g) => {
      const sh: Shape[] = [];
      for (let i = 0; i < 6; i++) {
        const x = -b.rx * 0.74 + (i / 5) * b.rx * 1.36, s = 12 + 12 * Math.sin((i / 5) * Math.PI);
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
export function headTop(h: HeadLook, sk: SkinSpec, headId: string, teethId: string, beakLook: BeakLook = BEAK_LOOKS[0]): PartSpec {
  const hw = h.top * (h.brow ? 0.5 : 0.42);
  const beak = teethId === 'teeth.beak';
  const W = h.len * (beak ? beakLook.reach : 1) + 140, H = hw * 2 + 150;
  return patternedPart(sk, {
    key: `ws:d:thead:${headId}:${sk.key}:${beak ? beakLook.name : 'n'}`, w: W, h: H, ox: 50, oy: H / 2,
    draw: (g, patternSeed) => {
      const len = h.len;
      const skull: Shape['path'] = (c) => {
        const snout = hw * (0.6 - h.snout * 0.5);
        if (h.brow) {
          // Start within the neck cap and keep both sides tangent through the flare.
          c.moveTo(-25, -17);
          c.bezierCurveTo(4, -17, len * 0.13, -hw, len * 0.38, -hw);
          c.quadraticCurveTo(len * 0.66, -hw, len * 0.88, -snout);
          c.quadraticCurveTo(len + 10, 0, len * 0.88, snout);
          c.quadraticCurveTo(len * 0.66, hw, len * 0.38, hw);
          c.bezierCurveTo(len * 0.13, hw, 4, 17, -25, 17);
          c.quadraticCurveTo(-34, 0, -25, -17);
          c.closePath();
          return;
        }
        c.moveTo(-4, -hw * 0.81);
        c.quadraticCurveTo(len * 0.4, -hw * 1.25, len * 0.88, -snout);
        c.quadraticCurveTo(len + 10, 0, len * 0.88, snout);
        c.quadraticCurveTo(len * 0.4, hw * 1.25, -4, hw * 0.81);
        c.quadraticCurveTo(-16, 0, -4, -hw * 0.81);
        c.closePath();
      };
      const rear = h.brow ? -34 : -16;
      const fill = skinFill(sk, { x0: rear, y0: -hw, x1: len, y1: hw }, 3, patternSeed, headId === 'head.round');
      drawHeadJoint(g, skull, fill, sk.look.main,
        h.brow ? -25 : -8, 0, h.neckLen > 120 ? 19 : 29, true);
      if (h.crest) drawShapes(g, [{ path: (c) => ellipsePath(c, len * 0.3, 0, h.crest * 0.55, 8), fill: crestFill(sk, len * 0.3 - h.crest * 0.55, len * 0.66, true) }], OL);
      if (h.horns) {
        const horns: Shape[] = [-1, 1].map((sgn) => ({
          path: (c) => {
            // Root behind the eye, with the tip sweeping out past the skull.
            c.moveTo(len * 0.02, sgn * hw * 0.52);
            c.quadraticCurveTo(len * 0.10, sgn * hw * 1.24, len * 0.02 + h.horns * 0.62, sgn * (hw + 28));
            c.quadraticCurveTo(len * 0.23, sgn * hw * 0.77, len * 0.21, sgn * hw * 0.23);
            c.quadraticCurveTo(len * 0.08, sgn * hw * 0.20, len * 0.02, sgn * hw * 0.52);
            c.closePath();
          },
          fill: '#fff3d0',
        }));
        drawShapes(g, horns, 3.5);
      }
      if (h.noseHorn) drawShapes(g, [{
        path: (c) => polyPath(c, [{ x: len * 0.80, y: -6 }, { x: len * 1.02, y: 0 }, { x: len * 0.80, y: 6 }]),
        fill: '#fff3d0',
      }], 3.5);
      if (beak) {
        const base = len * beakLook.base, tip = len * beakLook.reach, half = hw * beakLook.width;
        const wide = base + (tip - base) * (0.52 + beakLook.width * 0.46);
        drawShapes(g, [{
          path: (c) => {
            c.moveTo(base, -half * 0.7);
            c.bezierCurveTo(wide, -half * 1.18, tip, -half * beakLook.width, tip, 0);
            c.bezierCurveTo(tip, half * beakLook.width, wide, half * 1.18, base, half * 0.7);
            c.quadraticCurveTo(base - len * 0.09, 0, base, -half * 0.7);
            c.closePath();
          },
          fill: (c) => {
            const gold = c.createLinearGradient(0, -half, 0, half);
            gold.addColorStop(0, '#e69d39');
            gold.addColorStop(0.42, '#ffe49a');
            gold.addColorStop(1, TEETH[teethId].color);
            c.fillStyle = gold;
            c.fillRect(base - 12, -half * 1.3, tip - base + 24, half * 2.6);
          },
        }], 4.5);
      }
      g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
      for (const sgn of [-1, 1]) {
        g.fillStyle = '#fff'; g.beginPath(); circle(g, len * 0.45, sgn * hw * 0.62, h.eye * 0.95); g.fill(); g.stroke();
        g.fillStyle = OUTLINE; g.beginPath(); circle(g, len * 0.45 + 2, sgn * hw * 0.62, h.eye * 0.5); g.fill();
        if (!beak) { g.beginPath(); circle(g, len * 0.88, sgn * hw * 0.22, 3); g.fill(); }
      }
    },
  });
}

export function featherHeadTop(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.feathers'];
  return {
    key: `ws:d:tfhead:${h.len}:${h.top}:${sk.look.accent}`, w: 145, h: 100, ox: 100, oy: 50,
    draw: (g) => drawHeadFeathers(g, ex, h.crest ? -18 : 4, 0, Math.PI, 0.58, 30, 8.5),
  };
}

/** Overhead toe spread stays visible when a claw is chosen for a front leg or arm. */
function clawTipsTop(g: G, claw: ClawLook, sk: SkinSpec, x: number, spread: number, hand: boolean): void {
  const kind = !hand && (claw.kind === 'grabby' || claw.kind === 'tiny') ? 'small' : claw.kind;
  const length = Math.max(8, Math.min(claw.claw, hand ? 32 : 20) * 0.74);
  const count = kind === 'tiny' ? 2 : kind === 'grabby' ? 4 : 3;
  const tips: Shape[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2, y = offset * spread;
    const tip = x + length + (kind === 'grabby' ? 6 - Math.abs(offset) * 3 : 0);
    const end = y + offset * 2.8;
    if (kind === 'grabby') {
      tips.push({ path: (c) => ellipsePath(c, x + 4, y, tip - x - 4, 4, offset * 0.21), fill: sk.look.belly });
    } else {
      tips.push({
        path: (c) => {
          c.moveTo(x - 3, y - 3);
          c.quadraticCurveTo(tip - 3, end - (kind === 'digging' ? 5 : 4), tip, end);
          c.quadraticCurveTo(tip - (kind === 'digging' ? 3 : 6), end + 4, x - 3, y + 3);
          c.closePath();
        },
        fill: claw.color,
      });
    }
  }
  drawShapes(g, tips, 1.7);
}

export function legTop(l: LegLook, claw: ClawLook, sk: SkinSpec, legId: string, clawId: string, hand: boolean): PartSpec {
  const foreleg = hand && l.kind === 'powerful';
  const th = l.thick * 0.72 * (foreleg ? 0.56 : 1), foot = l.foot * (foreleg ? 0.76 : 1);
  const W = foot + 100, H = th + 100;
  return patternedPart(sk, {
    key: `ws:d:tleg:${legId}:${clawId}:${sk.key}:${hand ? 'h' : ''}`, w: W, h: H, ox: 50 + foot * 0.28, oy: H / 2,
    draw: (g, patternSeed) => {
      const fill = skinFill(sk, { x0: -foot / 2, y0: -th, x1: foot, y1: th }, 7, patternSeed);
      const sh: Shape[] = [];
      if (l.kind === 'flipper') sh.push(flipperBlade(sk, { x: -29, y: 0, angle: 0.14, length: foot * 0.96, width: 38 }));
      else sh.push({ path: (c) => ellipsePath(c, foot * 0.12, 0, foot * 0.5, th * 0.55), fill });
      drawShapes(g, sh, 4.5);
      if (l.kind !== 'flipper') clawTipsTop(g, claw, sk, foot * 0.57, th * 0.24, hand);
    },
  });
}

export function armTop(c: ClawLook, sk: SkinSpec, clawId: string): PartSpec {
  return patternedPart(sk, {
    key: `ws:d:tarm:${clawId}:${sk.key}`, w: 120, h: 80, ox: 40, oy: 40,
    draw: (g, patternSeed) => {
      if (c.kind === 'tiny') {
        const wrist = { x: 31, y: 13 };
        const points = quad({ x: 0, y: 0 }, { x: 3, y: 21 }, wrist, 8);
        const widths = points.map((_, i) => c.thick * 0.5 * (1 - i / 8 * 0.35));
        const fill = skinFill(sk, { x0: -10, y0: -10, x1: 38, y1: 23 }, 8, patternSeed);
        drawShapes(g, tubeShapes(points, widths, fill), 3.5);
        g.save();
        g.translate(wrist.x, wrist.y);
        clawTipsTop(g, c, sk, 1, 6, true);
        g.restore();
        return;
      }
      const L = c.arm * 0.55;
      drawShapes(g, [{ path: (cx) => ellipsePath(cx, L * 0.5, 0, L * 0.6, c.thick * 0.5), fill: skinFill(sk, { x0: 0, y0: -10, x1: L, y1: 10 }, 8, patternSeed) }], 4.5);
      clawTipsTop(g, c, sk, L, c.thick * 0.38, true);
    },
  });
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
  return patternedPart(sk, {
    key: `ws:d:ttail:${tailId}:${sk.key}`, w: W, h: H, ox: len + 110, oy: 100,
    draw: (g, patternSeed) => {
      const N = 14;
      const pts = quad({ x: 10, y: 0 }, { x: -len * 0.5, y: 0 }, { x: -len, y: 0 }, N);
      const hw = pts.map((_, i) => { const u = i / N; if (t.kind === 'club') return t.base * (0.5 - 0.28 * Math.min(1, u / 0.72)); return t.base / 2 + (t.tip / 2 - t.base / 2) * Math.pow(u, 0.8); });
      const fill = skinFill(sk, { x0: -len - Math.max(t.tip, 45), y0: -t.base, x1: 10 + t.base / 2, y1: t.base }, 4, patternSeed);
      const sh: Shape[] = [];
      const end = pts[N];
      if (t.kind === 'paddle') sh.push(...paddleFins(sk, end, true));
      const feathers = tailFeathers(t, sk);
      if (feathers) {
        const reach = 30;
        const x = end.x - (t.kind === 'club' ? 16 : 0);
        [feathers.c1, feathers.c2, feathers.c3].forEach((col, i) => { const a = Math.PI + (i - 1) * 0.6; sh.push({ path: (c) => ellipsePath(c, x + Math.cos(a) * reach, Math.sin(a) * reach, reach + 2, reach * 0.33, a), fill: col }); });
      }
      sh.push(...tubeShapes(pts, hw, fill));
      if (t.kind === 'club') sh.push({ path: (c) => ellipsePath(c, end.x + 2, 0, 34, 27), fill });
      drawShapes(g, sh, OL);
      if (t.kind === 'spiked') {
        const ridge: Shape[] = [];
        for (let i = 4; i < N; i += 2) {
          const x = pts[i].x;
          ridge.push({ path: (c) => polyPath(c, [{ x: x + 8, y: -hw[i] * 0.45 }, { x: x - 13, y: 0 }, { x: x + 8, y: hw[i] * 0.45 }]), fill: '#fff3d0' });
        }
        ridge.push(
          { path: (c) => ellipsePath(c, end.x + 4, 0, 19, 13), fill: mix(sk.look.main, sk.look.accent, 0.50) },
          { path: (c) => polyPath(c, [{ x: end.x + 1, y: -8 }, { x: end.x - 36, y: 0 }, { x: end.x + 1, y: 7 }]), fill: '#fff3d0' },
        );
        drawShapes(g, ridge, 3.5);
      }
    },
  });
}

export function frillTop(h: HeadLook, sk: SkinSpec): PartSpec {
  const ex = sk.ex ?? EXTRA['extra.frill'];
  const W = h.top * 2 + 40;
  return {
    key: `ws:d:tfrill:${h.top}`, w: W, h: W, ox: W / 2, oy: W / 2,
    draw: (g) => drawFrill(g, -h.top * 0.12, 0, h.top * 0.58, h.top * 0.87, ex),
  };
}
