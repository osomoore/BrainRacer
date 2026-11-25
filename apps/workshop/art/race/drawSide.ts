/** Race car, SIDE view: one drawing function per aspect, all numbers come from ./looks. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath, roundedPolyPath, rrectPath } from '../bake';
import { darken, insetPoly, lerp, lighten } from '../geom';
import { BUMPER, ENGINE, EXTRA, GEAR, JEEP_SPARE, JEEP_SPARE_BRACKET, PAINT, type PaintLook, rackLuggage, RACE_WINDOW, RACE_WINDOW_DARK, ROCKET_NOZZLE_X, SPRING, WHEEL } from './looks';
import { jeepSpareMount, type RaceGeom, type RaceLooks } from './geometry';

type G = CanvasRenderingContext2D;
const PAD = 14;

function paintFill(g: G, p: PaintLook, y0: number, y1: number): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, lighten(p.main, 0.12));
  gr.addColorStop(0.55, p.main);
  gr.addColorStop(1, p.dark);
  return gr;
}

export function rainbowFill(bands: readonly string[], length: number, y0: number, y1: number): (g: G) => void {
  return (g) => {
    const width = length / bands.length;
    for (const [i, color] of bands.entries()) {
      g.fillStyle = color;
      // The following opaque band covers the overlap and leaves a clean join.
      g.fillRect(-length / 2 + i * width, y0, width + 1, y1 - y0);
    }
  };
}

const circle = (g: G, x: number, y: number, r: number) => ellipsePath(g, x, y, r, r);

export function bodySide(l: RaceLooks, geo: RaceGeom, paintId: string, ids: { body: string; shape: string }): PartSpec {
  const paint = PAINT[paintId] ?? PAINT['paint.blue'];
  const b = l.body, s = l.shape;
  const mount = b.spare ? jeepSpareMount(l, geo) : null;
  const padX = Math.max(44, JEEP_SPARE.depth + (mount?.extension ?? 0) + 4);
  const ty0 = geo.roofTop - PAD - 4, ty1 = 8;
  const w = b.len + padX * 2;
  const radii = b.kind === 'sports'
    ? geo.chassis.map((p) => p.y === geo.bottom ? s.r * 0.75 : s.r + 9)
    : [s.r * 0.8, s.r, s.r, s.r * 0.8];
  // Older painted bodies still have solid wheel wells. Use the same opening as the code-drawn body.
  const clearWheelArches = (g: G) => {
    g.save();
    g.beginPath();
    const archClip = geo.chassis.map((p) => p.y === geo.bottom ? { x: p.x, y: p.y + OL + 2 } : p);
    roundedPolyPath(g, archClip, radii);
    g.clip();
    g.globalCompositeOperation = 'destination-out';
    for (const axle of [geo.frontAxle, geo.rearAxle]) {
      g.beginPath();
      circle(g, axle, geo.hubY, geo.wheelRadius + 4);
      g.fill();
    }
    g.restore();
  };
  return {
    key: `ws:r:body:${ids.body}:${ids.shape}:${paintId}:${geo.wheelRadius}:${l.lift}`,
    w, h: ty1 - ty0, ox: w / 2, oy: -ty0,
    finishPaint: clearWheelArches,
    draw: (g) => {
      const y0 = geo.roofTop, y1 = geo.bottom;
      const fill = paint.bands ? rainbowFill(paint.bands, b.len, ty0, ty1) : paintFill(g, paint, y0, y1);
      const shapes: Shape[] = [];
      if (mount) {
        const spare = JEEP_SPARE;
        const { x, y, extension } = mount;
        if (extension) {
          const bracketX = x + spare.depth - 4;
          const bracketY = y + (spare.diameter - JEEP_SPARE_BRACKET) / 2;
          shapes.push({
            path: (c) => rrectPath(c, bracketX, bracketY, geo.rear + 8 - bracketX, JEEP_SPARE_BRACKET, 4),
            fill: spare.rubber,
          });
        }
        shapes.push({
          path: (c) => rrectPath(c, x, y, spare.depth, spare.diameter, 6),
          fill: spare.rubber,
          detail: (c) => {
            c.fillStyle = spare.tread;
            for (let dy = 8; dy < spare.diameter; dy += 9) c.fillRect(x, y + dy, spare.depth, 3);
          },
        });
      }
      if (geo.bed) shapes.push({ path: (c) => polyPath(c, geo.bed!), fill, detail: (c) => { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(geo.rear, geo.bed![0].y, 400, 7); } });
      shapes.push({
        path: (c) => roundedPolyPath(c, geo.chassis, radii),
        fill,
        detail: (c) => {
          c.fillStyle = '#14142e';
          for (const ax of [geo.frontAxle, geo.rearAxle]) { c.beginPath(); circle(c, ax, geo.hubY, geo.wheelRadius + 9); c.fill(); }
          c.save();
          for (const axle of [geo.frontAxle, geo.rearAxle]) {
            c.beginPath();
            c.rect(-w / 2, ty0, w, ty1 - ty0);
            circle(c, axle, geo.hubY, geo.wheelRadius + 9);
            c.clip('evenodd');
          }
          const trimRear = geo.rear + 18, trimFront = geo.front - 18;
          const trimInset = ids.shape === 'shape.wedge' ? 30 : 10;
          c.strokeStyle = paint.accent; c.lineWidth = 6;
          c.beginPath(); c.moveTo(trimRear, geo.chassisTop(trimRear) + trimInset);
          c.lineTo(trimFront, geo.chassisTop(trimFront) + trimInset); c.stroke();
          c.restore();
        },
      });
      const footRadius = Math.min(14, s.rc);
      shapes.push({ path: (c) => roundedPolyPath(c, geo.cabin, [footRadius, s.rc, s.rc, footRadius]), fill });
      drawShapes(g, shapes, OL);
      clearWheelArches(g);
      // windows
      const curvedGlass = s.rc >= 20;
      const [rearSill, rearRoof, frontRoof, frontSill] = geo.cabin;
      const glassSill = (sill: typeof rearSill, roof: typeof rearRoof, inset: number) => {
        const y = geo.chassisTop(sill.x) - 7;
        return { x: lerp(sill.x, roof.x, (y - sill.y) / (roof.y - sill.y)) + inset, y };
      };
      const win = curvedGlass
        ? [
          glassSill(rearSill, rearRoof, 10),
          { x: rearRoof.x + 5, y: rearRoof.y + 9 },
          { x: frontRoof.x - 5, y: frontRoof.y + 9 },
          glassSill(frontSill, frontRoof, -10),
        ]
        : insetPoly(geo.cabin, 0.86, 0.7).map(({ x, y }) => ({ x, y: y + b.cabH * s.cabK * 0.10 }));
      g.save();
      g.beginPath(); roundedPolyPath(g, win, curvedGlass ? [9, s.rc - 7, s.rc - 7, 9] : Math.max(3, s.rc * 0.4));
      const wg = g.createLinearGradient(0, win[1].y, 0, win[0].y);
      wg.addColorStop(0, RACE_WINDOW); wg.addColorStop(1, RACE_WINDOW_DARK);
      g.fillStyle = wg; g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 4; g.stroke();
      g.clip();
      const pillars = b.kind === 'van' ? 2 : 1;
      for (let i = 1; i <= pillars; i++) {
        const t = i / (pillars + 1), px = win[0].x + (win[3].x - win[0].x) * t;
        g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke();
      }
      g.restore();
      // door handle, lights
      const mid = (geo.cabin[0].x + geo.cabin[3].x) / 2;
      g.fillStyle = paint.accent; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      g.beginPath(); rrectPath(g, mid + 8, geo.chassisTop(mid) + 11, 16, 6, 3); g.fill(); g.stroke();
      const hx = geo.front - 16;
      const hy = geo.chassisTop(hx) + Math.min(17, b.chH * s.noseK * 0.46);
      g.fillStyle = '#fff7b0'; g.beginPath(); ellipsePath(g, hx, hy, 8, 6.5); g.fill(); g.stroke();
      g.fillStyle = '#ff3b3b'; g.beginPath(); rrectPath(g, geo.rear + 2, geo.chassisTop(geo.rear) + 8, 8, 14, 3); g.fill(); g.stroke();
    },
  };
}

export function wheelSide(id: string): PartSpec {
  const w = WHEEL[id] ?? WHEEL['wheels.road'];
  const R = w.r, S = (R + 14) * 2;
  return {
    key: `ws:r:wheel:${id}`, w: S, h: S, ox: S / 2, oy: S / 2,
    draw: (g) => {
      const shapes: Shape[] = [];
      if (w.tread === 'lugs') {
        for (let i = 0; i < 16; i++) {
          shapes.push({
            path: (c) => {
              c.save();
              c.rotate(i * Math.PI / 8);
              rrectPath(c, R - 9, -5.5, 17, 11, 4);
              c.restore();
            },
            fill: w.treadColor,
          });
        }
      } else if (w.tread === 'monster') {
        const n = 11, rr = 17;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, d = R - rr * 0.35;
          shapes.push({ path: (c) => circle(c, Math.cos(a) * d, Math.sin(a) * d, rr), fill: w.treadColor });
        }
      }
      shapes.push({ path: (c) => circle(c, 0, 0, R), fill: w.tire });
      drawShapes(g, shapes, w.tread === 'monster' ? 6 : OL);
      g.strokeStyle = w.treadColor; g.lineWidth = 4;
      if (w.tread === 'grooves') {
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10)); g.lineTo(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3)); g.stroke(); }
      } else if (w.tread === 'lugs' || w.tread === 'monster') {
        g.fillStyle = darken(w.tire, 0.25);
        g.beginPath(); circle(g, 0, 0, R * 0.8); g.fill();
      } else if (w.tread === 'slick' && w.stripe) {
        g.strokeStyle = w.stripe; g.lineWidth = 4; g.beginPath(); circle(g, 0, 0, R - 6); g.stroke();
      } else if (w.tread === 'zigzag') {
        for (let i = 0; i < 12; i++) {
          g.save();
          g.rotate(i * Math.PI * 2 / 12);
          drawShapes(g, [
            { path: (c) => rrectPath(c, R - 15, -4, 17, 8, 3), fill: w.treadColor },
            { path: (c) => circle(c, R - 14, 0, 3), fill: '#f8fcff' },
          ], 2);
          g.restore();
        }
      }
      // rim
      const rr = R * w.rimK;
      g.fillStyle = w.rim; g.strokeStyle = OUTLINE; g.lineWidth = 4;
      g.beginPath(); circle(g, 0, 0, rr); g.fill(); g.stroke();
      g.strokeStyle = w.rimDark; g.lineWidth = Math.max(4, R * 0.09);
      for (let i = 0; i < w.spokes; i++) { const a = (i / w.spokes) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * rr * 0.86, Math.sin(a) * rr * 0.86); g.stroke(); }
      g.fillStyle = w.rimDark; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      g.beginPath(); circle(g, 0, 0, rr * 0.3); g.fill(); g.stroke();
      g.fillStyle = '#ee3b3b'; g.beginPath(); circle(g, rr * 0.68, 0, Math.max(3, R * 0.07)); g.fill();
    },
  };
}

/** Hood decal for the engine, drawn flat; origin = bottom centre (sits on the hood). */
export function engineSide(id: string): PartSpec {
  const e = ENGINE[id] ?? ENGINE['engine.small'];
  return {
    key: `ws:r:eng:${id}`, w: 90, h: 70, ox: 45, oy: 64,
    draw: (g) => {
      const sh: Shape[] = [];
      switch (e.kind) {
        case 'vent':
          sh.push({ path: (c) => rrectPath(c, -22, -10, 44, 14, 6), fill: e.accent, detail: (c) => { c.strokeStyle = e.accent2; c.lineWidth = 3; for (let i = -12; i <= 12; i += 8) { c.beginPath(); c.moveTo(i, -9); c.lineTo(i, 4); c.stroke(); } } });
          break;
        case 'scoop':
          sh.push({ path: (c) => { c.moveTo(-34, 4); c.lineTo(-26, -30); c.quadraticCurveTo(0, -42, 30, -22); c.lineTo(38, 4); c.closePath(); }, fill: e.accent });
          sh.push({ path: (c) => rrectPath(c, -6, -26, 34, 20, 5), fill: e.accent2, detail: (c) => { c.strokeStyle = '#8d97a6'; c.lineWidth = 2.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2 + i * 8, -25); c.lineTo(-2 + i * 8, -8); c.stroke(); } } });
          break;
        case 'leaf':
          sh.push({ path: (c) => rrectPath(c, -24, -12, 48, 16, 7), fill: '#e8f9ee' });
          sh.push({ path: (c) => { c.moveTo(-12, -2); c.quadraticCurveTo(-10, -30, 14, -34); c.quadraticCurveTo(18, -8, -12, -2); c.closePath(); }, fill: e.accent, detail: (c) => { c.strokeStyle = e.accent2; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -28); c.stroke(); } });
          break;
        case 'turbo':
          sh.push({ path: (c) => rrectPath(c, -20, -42, 12, 46, 4), fill: '#c3c9d4', detail: (c) => { c.fillStyle = e.accent; c.fillRect(-21, -43, 14, 7); } });
          sh.push({ path: (c) => { circle(c, 18, -16, 20); }, fill: e.accent, detail: (c) => { c.strokeStyle = e.accent2; c.lineWidth = 4; c.beginPath(); c.arc(18, -16, 12, 0.5, 5.2); c.stroke(); c.beginPath(); c.arc(18, -16, 5, 0, 6); c.stroke(); } });
          break;
        case 'bolt':
          sh.push({ path: (c) => rrectPath(c, -26, -13, 52, 18, 6), fill: '#c3c9d4' });
          sh.push({ path: (c) => rrectPath(c, -22, -38, 30, 26, 5), fill: e.accent2, detail: (c) => { c.fillStyle = '#f4fbff'; c.fillRect(-17, -33, 6, 14); c.fillRect(-3, -33, 6, 14); } });
          sh.push({ path: (c) => rrectPath(c, 13, -28, 10, 17, 4), fill: e.accent });
          g.lineCap = 'round'; g.lineWidth = 5;
          g.strokeStyle = '#ee3b3b'; g.beginPath(); g.moveTo(-16, -39); g.bezierCurveTo(-26, -51, 6, -54, 16, -44); g.stroke();
          g.strokeStyle = '#3d7fd0'; g.beginPath(); g.moveTo(-2, -39); g.bezierCurveTo(2, -51, 25, -50, 24, -31); g.stroke();
          break;
      }
      drawShapes(g, sh, 4);
    },
  };
}

/** Rear exhaust pipes: origin = where the pipes meet the body, pointing -x. */
export function exhaustSide(id: string): PartSpec | null {
  const e = ENGINE[id] ?? ENGINE['engine.small'];
  if (e.pipes === 0) return null;
  const len = 18 + e.pipeW * 1.6;
  return {
    key: `ws:r:pipe:${id}`, w: len + 30, h: e.pipes * (e.pipeW + 6) + 20, ox: len + 20, oy: 10 + e.pipeW / 2,
    draw: (g) => {
      const sh: Shape[] = [];
      for (let i = 0; i < e.pipes; i++) {
        const y = i * (e.pipeW + 2) * 0.55 - 2;
        sh.push({
          path: (c) => {
            c.moveTo(-len, y - e.pipeW / 2);
            c.lineTo(-10, y - e.pipeW / 2);
            c.quadraticCurveTo(-3, y - e.pipeW / 2, 4, -10);
            c.lineTo(8, 0);
            c.quadraticCurveTo(-5, y + e.pipeW / 2, -10, y + e.pipeW / 2);
            c.lineTo(-len, y + e.pipeW / 2);
            c.closePath();
          },
          fill: '#b5bdca',
        });
      }
      drawShapes(g, sh, 3.5);
    },
  };
}

/** Gear badge (between the wheels). Origin = centre. */
export function gearSide(id: string): PartSpec {
  const gl = GEAR[id] ?? GEAR['gears.easy'];
  return {
    key: `ws:r:gear:${id}`, w: 90, h: 60, ox: 45, oy: 30,
    draw: (g) => {
      const sh: Shape[] = [];
      sh.push({ path: (c) => rrectPath(c, -38, -24, 76, 48, 14), fill: '#f5f7fb' });
      drawShapes(g, sh, 3.5);
      const drawGear = (cx: number, cy: number, r: number, teeth: number, col: string, dk: string) => {
        const pts: { x: number; y: number }[] = [];
        const step = (Math.PI * 2) / teeth;
        for (let i = 0; i < teeth; i++) {
          const a = i * step;
          for (const [da, rr] of [[-0.3, 0.72], [-0.2, 1], [0.2, 1], [0.3, 0.72]] as const) pts.push({ x: cx + Math.cos(a + da * step * 1.6) * r * rr, y: cy + Math.sin(a + da * step * 1.6) * r * rr });
        }
        g.fillStyle = col; g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
        g.beginPath(); polyPath(g, pts); g.fill(); g.stroke();
        g.fillStyle = dk; g.beginPath(); circle(g, cx, cy, r * 0.32); g.fill(); g.stroke();
      };
      if (gl.cue === 'mountain') {
        g.fillStyle = '#7ec96a'; g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.moveTo(-34, 20); g.lineTo(-14, -12); g.lineTo(0, 8); g.lineTo(10, -4); g.lineTo(34, 20); g.closePath(); g.fill(); g.stroke();
        drawGear(14, -2, gl.size * 0.62, gl.teeth, gl.color, gl.dark);
        return;
      }
      if (gl.count === 2) {
        drawGear(-9, 4, gl.size * 0.55, gl.teeth, gl.color, gl.dark);
        drawGear(11, -6, gl.size * 0.42, gl.teeth - 2, '#ffd21f', '#a86a00');
      } else drawGear(0, 0, gl.size * 0.78, gl.teeth, gl.color, gl.dark);
      if (gl.cue === 'chevrons') {
        g.strokeStyle = '#ee3b3b'; g.lineWidth = 4;
        for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(22 + i * 6, -14); g.lineTo(28 + i * 6, -8); g.lineTo(22 + i * 6, -2); g.stroke(); }
      }
      if (gl.cue === 'driveshaft') {
        g.fillStyle = '#566074';
        for (const [x, y] of [[-26, -12], [26, -12], [-26, 14], [26, 14]]) { g.beginPath(); circle(g, x, y, 4); g.fill(); }
      }
    },
  };
}

/** 4x4 drive shaft under the body: origin = centre at hub height. */
export function shaftSide(span: number): PartSpec {
  return {
    key: `ws:r:shaft:${Math.round(span)}`, w: span + 50, h: 44, ox: (span + 50) / 2, oy: 22,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => rrectPath(c, -span / 2, -6, span, 12, 5), fill: '#9aa3b0' }];
      for (const x of [-span / 2, span / 2]) sh.push({ path: (c) => rrectPath(c, x - 16, -14, 32, 28, 9), fill: '#566074' });
      drawShapes(g, sh, 4);
    },
  };
}

/** Coil spring and shock, from the hub (origin = bottom centre) upwards by H. */
export function springSide(id: string, H: number): PartSpec {
  const sp = SPRING[id] ?? SPRING['springs.soft'];
  const w = sp.width + 40;
  return {
    key: `ws:r:spring:${id}:${Math.round(H)}`, w, h: H + 24, ox: w / 2, oy: H + 12,
    draw: (g) => {
      const pitch = (H - 6) / sp.turns;
      const pass = (col: string, wd: number) => {
        g.strokeStyle = col; g.lineWidth = wd;
        g.beginPath();
        for (let i = 0; i < sp.turns; i++) {
          const y = -4 - i * pitch;
          g.moveTo(-sp.width / 2, y);
          g.lineTo(sp.width / 2, y - pitch * 0.55);
        }
        g.stroke();
      };
      pass(OUTLINE, sp.thick + 6);
      pass(sp.coilDark, sp.thick + 1);
      // Thick coil shadows can merge on short springs. Put the shaft above them and cross it with the thin coil faces.
      g.lineCap = 'butt';
      g.strokeStyle = OUTLINE; g.lineWidth = 12; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -H); g.stroke();
      g.strokeStyle = sp.shock; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -H); g.stroke();
      g.lineCap = 'round';
      pass(sp.coil, Math.min(sp.thick - 2.5, pitch / 2));
    },
  };
}

/** Bumper: origin = attachment point (body end, middle of the bumper); extends +x. */
export function bumperSide(id: string): PartSpec {
  const bl = BUMPER[id] ?? BUMPER['bumpers.small'];
  const w = bl.depth + 40, h = bl.h + 30;
  return {
    key: `ws:r:bumper:${id}`, w, h, ox: 14, oy: h / 2,
    draw: (g) => {
      const d = bl.depth, hh = bl.h;
      const sh: Shape[] = [];
      if (bl.kind === 'pusher') {
        sh.push({ path: (c) => rrectPath(c, -4, -hh / 2, d + 4, hh, 5), fill: (c) => { c.fillStyle = bl.color; c.fill(); }, detail: (c) => { c.fillStyle = '#2a2a34'; for (let i = -hh; i < hh; i += 22) { c.beginPath(); c.moveTo(-4, i); c.lineTo(d + 4, i - 14); c.lineTo(d + 4, i - 3); c.lineTo(-4, i + 11); c.closePath(); c.fill(); } } });
        sh.push({ path: (c) => rrectPath(c, d - 6, -hh / 2 - 4, 10, hh + 8, 4), fill: '#c3c9d4' });
      } else if (bl.kind === 'rubber') {
        sh.push({ path: (c) => rrectPath(c, -4, -hh / 2, d + 4, hh, hh / 2.2), fill: bl.color, detail: (c) => { c.strokeStyle = '#6b6f86'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(6 + i * 7, -hh / 2 + 7); c.lineTo(6 + i * 7, hh / 2 - 7); c.stroke(); } c.fillStyle = '#ffd21f'; c.fillRect(d - 8, -hh / 2, 5, hh); } });
      } else if (bl.kind === 'chrome') {
        sh.push({ path: (c) => rrectPath(c, -4, -hh / 2, d + 4, hh, 9), fill: (c) => { const gr = c.createLinearGradient(0, -hh / 2, 0, hh / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, bl.color); gr.addColorStop(1, bl.dark); c.fillStyle = gr; c.fill(); } });
      } else {
        sh.push({ path: (c) => rrectPath(c, -2, -hh / 2, d + 2, hh, 5), fill: bl.color });
      }
      drawShapes(g, sh, 4);
      if (bl.kind === 'chrome') { g.fillStyle = bl.dark; for (const y of [-9, 9]) { g.beginPath(); circle(g, 8, y, 2.6); g.fill(); } }
    },
  };
}

// ---------------------------------------------------------------- extras

export function rackSide(w: number, legH: number, bagCount = 2): PartSpec {
  const ex = EXTRA['extra.roofRack'];
  const H = legH + 70, W = w + 30;
  return {
    key: `ws:r:rack:${Math.round(w)}:${Math.round(legH)}:${bagCount}`, w: W, h: H, ox: W / 2, oy: H - 6,
    draw: (g) => {
      const sh: Shape[] = [];
      const top = -legH;
      for (const x of [-w / 2 + 6, w / 2 - 6]) sh.push({ path: (c) => rrectPath(c, x - 4, top, 8, legH + 6, 3), fill: ex.color });
      sh.push({ path: (c) => rrectPath(c, -w / 2, top - 8, w, 9, 4), fill: ex.color });
      for (const { x, width, height, color } of rackLuggage(w, bagCount)) {
        const y = top - 8 - height;
        sh.push({
          path: (c) => rrectPath(c, x, y, width, height, 5),
          fill: color,
          detail: (c) => {
            c.fillStyle = 'rgba(255,255,255,0.45)';
            c.fillRect(x + width * 0.27, y, 5, height);
            c.fillRect(x + width * 0.67, y, 5, height);
          },
        });
      }
      drawShapes(g, sh, 4);
    },
  };
}

/** Rocket booster: origin = nose tip (touches the car), extends -x. */
export function rocketSide(): PartSpec {
  const ex = EXTRA['extra.rocket'];
  return {
    key: 'ws:r:rocket', w: 150, h: 120, ox: 138, oy: 60,
    draw: (g) => {
      const sh: Shape[] = [];
      sh.push({ path: (c) => { c.moveTo(-96, -30); c.lineTo(-114, -52); c.lineTo(-70, -26); c.closePath(); }, fill: ex.color2 });
      sh.push({ path: (c) => { c.moveTo(-96, 30); c.lineTo(-114, 52); c.lineTo(-70, 26); c.closePath(); }, fill: ex.color2 });
      sh.push({ path: (c) => rrectPath(c, ROCKET_NOZZLE_X, -14, 14, 28, 4), fill: '#4b4f63' });
      sh.push({ path: (c) => { c.moveTo(-96, -24); c.lineTo(-34, -26); c.quadraticCurveTo(-4, -22, 4, 0); c.quadraticCurveTo(-4, 22, -34, 26); c.lineTo(-96, 24); c.closePath(); }, fill: (c) => { const gr = c.createLinearGradient(0, -26, 0, 26); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#bcc3d2'); c.fillStyle = gr; c.fill(); }, detail: (c) => { c.fillStyle = ex.color2; c.fillRect(-60, -30, 14, 60); c.beginPath(); c.moveTo(-26, -30); c.quadraticCurveTo(-4, -22, 6, 0); c.quadraticCurveTo(-4, 22, -26, 30); c.closePath(); c.fill(); } });
      drawShapes(g, sh, 4.5);
      g.fillStyle = '#7ad7ff'; g.strokeStyle = OUTLINE; g.lineWidth = 3.5; g.beginPath(); circle(g, -76, 0, 8); g.fill(); g.stroke();
    },
  };
}

/** Rocket flame, origin = nozzle, extends -x. */
export function flameSide(): PartSpec {
  const ex = EXTRA['extra.rocket'];
  return {
    key: 'ws:r:flame', w: 110, h: 60, ox: 104, oy: 30,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => { c.moveTo(0, -14); c.quadraticCurveTo(-34, -22, -96, 0); c.quadraticCurveTo(-34, 22, 0, 14); c.closePath(); }, fill: '#ff7a1a' }];
      drawShapes(g, sh, 3.5);
      g.fillStyle = ex.color3; g.beginPath(); g.moveTo(-2, -8); g.quadraticCurveTo(-24, -12, -58, 0); g.quadraticCurveTo(-24, 12, -2, 8); g.closePath(); g.fill();
      g.fillStyle = '#fff6b0'; g.beginPath(); g.moveTo(-2, -4); g.quadraticCurveTo(-14, -5, -28, 0); g.quadraticCurveTo(-14, 5, -2, 4); g.closePath(); g.fill();
    },
  };
}

/** Float pontoon; origin = centre. */
export function floatSide(len: number): PartSpec {
  const ex = EXTRA['extra.floats'];
  return {
    key: `ws:r:float:${Math.round(len)}`, w: len + 30, h: 56, ox: (len + 30) / 2, oy: 28,
    draw: (g) => {
      const sh: Shape[] = [{
        path: (c) => rrectPath(c, -len / 2, -16, len, 32, 16), fill: ex.color2,
        detail: (c) => { c.fillStyle = ex.color; for (let x = -len / 2; x < len / 2; x += 44) c.fillRect(x, -20, 22, 40); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-len / 2, -11, len, 5); },
      }];
      drawShapes(g, sh, 4.5);
    },
  };
}

/** Spoiler: origin = bottom centre between the struts. */
export function spoilerSide(paintId = 'paint.blue'): PartSpec {
  const paint = PAINT[paintId] ?? PAINT['paint.blue'];
  return {
    key: `ws:r:spoiler:${paintId}`, w: 112, h: 62, ox: 56, oy: 46,
    draw: (g) => {
      const sh: Shape[] = [];
      for (const x of [-15, 17]) {
        sh.push({ path: (c) => polyPath(c, [{ x: x - 4, y: -24 }, { x: x + 5, y: -24 }, { x: x + 9, y: 3 }, { x: x - 6, y: 3 }]), fill: paint.dark });
      }
      sh.push({
        path: (c) => polyPath(c, [{ x: -41, y: -34 }, { x: 36, y: -20 }, { x: 34, y: -11 }, { x: -38, y: -23 }]),
        fill: paint.main,
      });
      sh.push({
        path: (c) => polyPath(c, [{ x: -41, y: -34 }, { x: -28, y: -32 }, { x: -25, y: -21 }, { x: -38, y: -23 }]),
        fill: paint.light,
      });
      drawShapes(g, sh, 4);
    },
  };
}

/** Snorkel: origin = base on the fender; rises by H. */
export function snorkelSide(H: number): PartSpec {
  const ex = EXTRA['extra.snorkel'];
  return {
    key: `ws:r:snorkel:${Math.round(H)}`, w: 70, h: H + 40, ox: 22, oy: H + 24,
    draw: (g) => {
      const path = () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -H + 14); g.quadraticCurveTo(0, -H, 12, -H); g.lineTo(18, -H); };
      g.lineCap = 'round';
      path(); g.strokeStyle = OUTLINE; g.lineWidth = 17; g.stroke();
      path(); g.strokeStyle = ex.color; g.lineWidth = 9; g.stroke();
      path(); g.strokeStyle = ex.color2; g.lineWidth = 2.5; g.stroke();
      const sh: Shape[] = [{ path: (c) => rrectPath(c, 14, -H - 11, 18, 22, 6), fill: ex.color2, detail: (c) => { c.fillStyle = ex.color3; c.fillRect(25, -H - 8, 6, 16); } }];
      drawShapes(g, sh, 4);
    },
  };
}

/** Winch: origin = bottom centre of the base; hook hangs in front (+x). */
export function winchSide(): PartSpec {
  const ex = EXTRA['extra.winch'];
  return {
    key: 'ws:r:winch', w: 100, h: 80, ox: 38, oy: 36,
    draw: (g) => {
      g.strokeStyle = OUTLINE; g.lineWidth = 9; g.beginPath(); g.moveTo(24, -8); g.quadraticCurveTo(44, -4, 40, 16); g.stroke();
      g.strokeStyle = '#8d97a6'; g.lineWidth = 4; g.stroke();
      const sh: Shape[] = [
        { path: (c) => rrectPath(c, -26, -34, 52, 34, 8), fill: ex.color },
        { path: (c) => circle(c, 0, -17, 11), fill: ex.color2, detail: (c) => { c.strokeStyle = ex.color3; c.lineWidth = 3; c.beginPath(); c.arc(0, -17, 6, 0, 6); c.stroke(); } },
        { path: (c) => { c.arc(40, 24, 8, 0, 6.3); }, fill: '#ffffff00', noStroke: true },
      ];
      drawShapes(g, sh, 4.5);
      g.strokeStyle = OUTLINE; g.lineWidth = 10; g.beginPath(); g.arc(40, 24, 8, -0.5, 4.2); g.stroke();
      g.strokeStyle = '#c3c9d4'; g.lineWidth = 4; g.beginPath(); g.arc(40, 24, 8, -0.5, 4.2); g.stroke();
    },
  };
}

/** Narrow front mount shown in both views when an oversized tire needs more clearance. */
export function winchBracket(extension: number): PartSpec {
  const w = extension + 24;
  return {
    key: `ws:r:winchBracket:${extension}`, w, h: 20, ox: 9, oy: 10,
    draw: (g) => drawShapes(g, [{ path: (c) => rrectPath(c, -5, -5, extension + 14, 10, 4), fill: EXTRA['extra.winch'].color3 }], 4),
  };
}
