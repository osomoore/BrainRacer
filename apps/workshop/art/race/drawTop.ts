/** Race car, TOP view (nose at +x, centre = origin). Same look tables as the side view. */
import { OL, OUTLINE, type PartSpec, type Shape, drawShapes, ellipsePath, polyPath, roundedPolyPath, rrectPath } from '../bake';
import { darken, lighten } from '../geom';
import { BUMPER, ENGINE, EXTRA, PAINT, RACE_WINDOW, RACE_WINDOW_DARK, WHEEL } from './looks';
import { type RaceLooks, topOutline } from './geometry';

type G = CanvasRenderingContext2D;
const circle = (g: G, x: number, y: number, r: number) => ellipsePath(g, x, y, r, r);

/** Body seen from above with glass. */
export function bodyTop(l: RaceLooks, paintId: string, ids: { body: string; shape: string }): PartSpec {
  const paint = PAINT[paintId] ?? PAINT['paint.blue'];
  const b = l.body, s = l.shape;
  const W = b.len + 100, H = b.hw * 2 + 60;
  return {
    key: `ws:r:tbody:${ids.body}:${ids.shape}:${paintId}`, w: W, h: H, ox: W / 2, oy: H / 2,
    draw: (g) => {
      const out = topOutline(b, s);
      const fill = (c: G) => {
        if (paint.bands) {
          const gr = c.createLinearGradient(0, -b.hw, 0, b.hw);
          const n = paint.bands.length;
          paint.bands.forEach((col, i) => { gr.addColorStop(i / n + 0.001, col); gr.addColorStop((i + 1) / n - 0.001, col); });
          c.fillStyle = gr;
        } else {
          const gr = c.createLinearGradient(0, -b.hw, 0, b.hw);
          gr.addColorStop(0, lighten(paint.main, 0.15)); gr.addColorStop(0.5, paint.main); gr.addColorStop(1, paint.dark);
          c.fillStyle = gr;
        }
        c.fill();
      };
      const [c0, c1] = b.cab;
      const cw = b.hw * (b.kind === 'sports' ? 0.62 : 0.76);
      const sh: Shape[] = [{ path: (c) => roundedPolyPath(c, out, 3 + s.r * 0.4), fill }];
      if (b.bedH > 0) sh.push({ path: (c) => rrectPath(c, -b.len / 2 + 8, -b.hw * 0.78, c0 + b.len / 2 - 14, b.hw * 1.56, 6), fill: '#2f3140', noStroke: true, detail: (c) => { c.fillStyle = '#c98a4b'; c.fillRect(-b.len / 2 + 30, -22, 40, 44); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-b.len / 2 + 48, -22, 5, 44); } });
      drawShapes(g, sh, OL);
      // cabin: rear window, roof, windshield
      const fs = s.slantF * b.slantF * b.cabH * 0.8, rs = s.slantR * b.slantR * b.cabH * 0.8;
      const roofX0 = c0 + rs, roofX1 = c1 - fs;
      const glass = (pts: { x: number; y: number }[]) => {
        const gr = g.createLinearGradient(0, -cw, 0, cw);
        gr.addColorStop(0, RACE_WINDOW); gr.addColorStop(1, RACE_WINDOW_DARK);
        g.fillStyle = gr; g.beginPath(); polyPath(g, pts); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 3.5; g.stroke();
      };
      const cab: Shape[] = [{ path: (c) => rrectPath(c, c0, -cw, c1 - c0, cw * 2, 8 + s.rc * 0.3), fill: lighten(paint.bands ? '#ffd21f' : paint.main, 0.1) }];
      drawShapes(g, cab, 4);
      glass([{ x: roofX1, y: -cw + 4 }, { x: c1 - 3, y: -cw * 0.82 }, { x: c1 - 3, y: cw * 0.82 }, { x: roofX1, y: cw - 4 }]);
      if (rs > 2 || b.kind !== 'pickup') glass([{ x: c0 + 3, y: -cw * 0.8 }, { x: roofX0, y: -cw + 4 }, { x: roofX0, y: cw - 4 }, { x: c0 + 3, y: cw * 0.8 }]);
      // lights
      g.fillStyle = '#fff7b0'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      for (const sy of [-1, 1]) { g.beginPath(); ellipsePath(g, b.len / 2 - 10, sy * b.hw * 0.55, 6, 8); g.fill(); g.stroke(); }
      g.fillStyle = '#ff3b3b';
      for (const sy of [-1, 1]) { g.beginPath(); rrectPath(g, -b.len / 2 + 2, sy * b.hw * 0.55 - 7, 7, 14, 3); g.fill(); g.stroke(); }
      if (b.spare) { g.fillStyle = '#2c2c3a'; g.beginPath(); rrectPath(g, -b.len / 2 - 14, -9, 18, 18, 5); g.fill(); g.stroke(); }
    },
  };
}

export function wheelTop(id: string): PartSpec {
  const w = WHEEL[id] ?? WHEEL['wheels.road'];
  const L = w.r * 2 + 8, T = w.topW + 8;
  return {
    key: `ws:r:twheel:${id}`, w: L + 14, h: T + 14, ox: (L + 14) / 2, oy: (T + 14) / 2,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => rrectPath(c, -L / 2, -T / 2, L, T, Math.min(12, T / 2)), fill: w.tire }];
      drawShapes(g, sh, 4.5);
      g.save(); g.beginPath(); rrectPath(g, -L / 2, -T / 2, L, T, Math.min(12, T / 2)); g.clip();
      g.strokeStyle = w.tread === 'slick' && w.stripe ? w.stripe : w.treadColor; g.lineWidth = 4;
      if (w.tread === 'slick') { g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); }
      else {
        const step = w.tread === 'monster' ? 22 : w.tread === 'lugs' ? 14 : 10;
        for (let x = -L / 2 + 6; x < L / 2; x += step) { g.beginPath(); if (w.tread === 'zigzag') { g.moveTo(x, -T / 2); g.lineTo(x + 5, 0); g.lineTo(x, T / 2); } else { g.moveTo(x, -T / 2 + 3); g.lineTo(x, T / 2 - 3); } g.stroke(); }
      }
      g.restore();
    },
  };
}

export function engineTop(id: string): PartSpec {
  const e = ENGINE[id] ?? ENGINE['engine.small'];
  return {
    key: `ws:r:teng:${id}`, w: 80, h: 80, ox: 40, oy: 40,
    draw: (g) => {
      const sh: Shape[] = [];
      switch (e.kind) {
        case 'vent': sh.push({ path: (c) => rrectPath(c, -22, -14, 44, 28, 6), fill: e.accent, detail: (c) => { c.strokeStyle = e.accent2; c.lineWidth = 3; for (let i = -12; i <= 12; i += 8) { c.beginPath(); c.moveTo(i, -12); c.lineTo(i, 12); c.stroke(); } } }); break;
        case 'scoop': sh.push({ path: (c) => rrectPath(c, -30, -24, 60, 48, 10), fill: e.accent, detail: (c) => { c.fillStyle = e.accent2; c.fillRect(-4, -18, 30, 36); c.strokeStyle = '#8d97a6'; c.lineWidth = 2.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0, -12 + i * 8); c.lineTo(24, -12 + i * 8); c.stroke(); } } }); break;
        case 'leaf': sh.push({ path: (c) => circle(c, 0, 0, 24), fill: '#e8f9ee' }); sh.push({ path: (c) => { c.moveTo(-14, 10); c.quadraticCurveTo(-18, -18, 14, -16); c.quadraticCurveTo(18, 14, -14, 10); c.closePath(); }, fill: e.accent }); break;
        case 'turbo': sh.push({ path: (c) => circle(c, 6, 0, 22), fill: e.accent, detail: (c) => { c.strokeStyle = e.accent2; c.lineWidth = 4; c.beginPath(); c.arc(6, 0, 12, 0.5, 5.2); c.stroke(); } }); for (const y of [-26, 26]) sh.push({ path: (c) => circle(c, -22, y * 0.8, 8), fill: '#c3c9d4', detail: (c) => { c.fillStyle = '#222'; c.beginPath(); circle(c, -22, y * 0.8, 4); c.fill(); } }); break;
        case 'bolt': sh.push({ path: (c) => circle(c, 0, 0, 24), fill: e.accent2, detail: (c) => { c.fillStyle = e.accent; c.beginPath(); c.moveTo(4, -20); c.lineTo(-12, 2); c.lineTo(-1, 2); c.lineTo(-6, 20); c.lineTo(13, -4); c.lineTo(2, -4); c.closePath(); c.fill(); } }); break;
      }
      drawShapes(g, sh, 4);
    },
  };
}

export function exhaustTop(id: string, hw: number): PartSpec | null {
  const e = ENGINE[id] ?? ENGINE['engine.small'];
  if (e.pipes === 0) return null;
  const len = 14 + e.pipeW;
  return {
    key: `ws:r:tpipe:${id}:${hw}`, w: len + 30, h: 90, ox: len + 20, oy: 45,
    draw: (g) => {
      const sh: Shape[] = [];
      const ys = e.pipes === 1 ? [0] : [-hw * 0.4, hw * 0.4];
      for (const y of ys) sh.push({ path: (c) => rrectPath(c, -len, y - e.pipeW / 2, len + 4, e.pipeW, e.pipeW / 2), fill: '#b5bdca', detail: (c) => { c.fillStyle = e.accent; c.fillRect(-len, y - 20, 6, 40); } });
      drawShapes(g, sh, 3.5);
    },
  };
}

export function bumperTop(id: string, hw: number): PartSpec {
  const bl = BUMPER[id] ?? BUMPER['bumpers.small'];
  const span = hw * 2 * (bl.kind === 'pusher' ? 1 : 0.92);
  const T = bl.depth * 0.9 + 6;
  return {
    key: `ws:r:tbumper:${id}:${hw}`, w: T + 40, h: span + 30, ox: 14, oy: (span + 30) / 2,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => rrectPath(c, -2, -span / 2, T, span, bl.kind === 'rubber' ? 14 : 6), fill: bl.kind === 'chrome' ? '#eef2f8' : bl.color, detail: (c) => { if (bl.kind === 'pusher') { c.strokeStyle = '#2a2a34'; c.lineWidth = 5; for (let y = -span / 2 + 14; y < span / 2; y += 16) { c.beginPath(); c.moveTo(-2, y); c.lineTo(T, y); c.stroke(); } } if (bl.kind === 'rubber') { c.fillStyle = '#ffd21f'; c.fillRect(T - 8, -span / 2, 5, span); } } }];
      drawShapes(g, sh, 4);
    },
  };
}

export function rackTop(len: number, wid: number): PartSpec {
  const ex = EXTRA['extra.roofRack'];
  return {
    key: `ws:r:track:${Math.round(len)}:${Math.round(wid)}`, w: len + 30, h: wid + 30, ox: (len + 30) / 2, oy: (wid + 30) / 2,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => rrectPath(c, -len / 2, -wid / 2, len, wid, 6), fill: '#00000000', noStroke: false }];
      drawShapes(g, sh, 4);
      g.strokeStyle = ex.color; g.lineWidth = 6;
      for (const x of [-len / 2 + 4, len / 2 - 4]) { g.beginPath(); g.moveTo(x, -wid / 2); g.lineTo(x, wid / 2); g.stroke(); }
      const bw = len / 3.2;
      const boxes: [number, string][] = [[-len / 2 + 6, ex.color2], [-len / 2 + 10 + bw, '#4aa8ff'], [-len / 2 + 14 + bw * 2, ex.color3]];
      const bs: Shape[] = boxes.filter(([x]) => x + bw - 4 <= len / 2 + 2).map(([x, col], i) => ({ path: (c: G) => rrectPath(c, x, -wid / 2 + 6 + i * 3, bw - 6, wid - 12 - i * 6, 5), fill: col, detail: (c: G) => { c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x + (bw - 6) / 2 - 3, -wid, 6, wid * 2); } }));
      drawShapes(g, bs, 4);
    },
  };
}

export function rocketTop(): PartSpec {
  const ex = EXTRA['extra.rocket'];
  return {
    key: 'ws:r:trocket', w: 150, h: 70, ox: 138, oy: 35,
    draw: (g) => {
      const sh: Shape[] = [
        { path: (c) => { c.moveTo(-96, -20); c.lineTo(-112, -32); c.lineTo(-70, -18); c.closePath(); }, fill: ex.color2 },
        { path: (c) => { c.moveTo(-96, 20); c.lineTo(-112, 32); c.lineTo(-70, 18); c.closePath(); }, fill: ex.color2 },
        { path: (c) => rrectPath(c, -104, -12, 14, 24, 4), fill: '#4b4f63' },
        { path: (c) => { c.moveTo(-96, -20); c.lineTo(-34, -22); c.quadraticCurveTo(-4, -18, 4, 0); c.quadraticCurveTo(-4, 18, -34, 22); c.lineTo(-96, 20); c.closePath(); }, fill: '#f2f2f8', detail: (c) => { c.fillStyle = ex.color2; c.fillRect(-60, -24, 14, 48); c.beginPath(); c.moveTo(-26, -24); c.quadraticCurveTo(-4, -18, 6, 0); c.quadraticCurveTo(-4, 18, -26, 24); c.closePath(); c.fill(); } },
      ];
      drawShapes(g, sh, 4.5);
    },
  };
}

export function floatTop(len: number): PartSpec {
  const ex = EXTRA['extra.floats'];
  return {
    key: `ws:r:tfloat:${Math.round(len)}`, w: len + 30, h: 56, ox: (len + 30) / 2, oy: 28,
    draw: (g) => {
      drawShapes(g, [{ path: (c) => rrectPath(c, -len / 2, -15, len, 30, 15), fill: ex.color2, detail: (c) => { c.fillStyle = ex.color; for (let x = -len / 2; x < len / 2; x += 44) c.fillRect(x, -20, 22, 40); } }], 4.5);
    },
  };
}

export function spoilerTop(hw: number): PartSpec {
  const ex = EXTRA['extra.spoiler'];
  const span = hw * 2 + 10;
  return {
    key: `ws:r:tspoiler:${hw}`, w: 70, h: span + 30, ox: 35, oy: (span + 30) / 2,
    draw: (g) => {
      const sh: Shape[] = [{ path: (c) => rrectPath(c, -14, -span / 2, 28, span, 8), fill: ex.color }];
      for (const y of [-span / 2, span / 2 - 8]) sh.push({ path: (c) => rrectPath(c, -22, y, 44, 8, 3), fill: ex.color2 });
      drawShapes(g, sh, 4.5);
    },
  };
}

export function snorkelTop(): PartSpec {
  const ex = EXTRA['extra.snorkel'];
  return { key: 'ws:r:tsnorkel', w: 50, h: 50, ox: 25, oy: 25, draw: (g) => drawShapes(g, [{ path: (c) => circle(c, 0, 0, 11), fill: ex.color, detail: (c) => { c.fillStyle = ex.color3; c.beginPath(); circle(c, 0, 0, 5); c.fill(); } }], 4) };
}

export function winchTop(): PartSpec {
  const ex = EXTRA['extra.winch'];
  return {
    key: 'ws:r:twinch', w: 90, h: 70, ox: 30, oy: 35,
    draw: (g) => {
      drawShapes(g, [{ path: (c) => rrectPath(c, -24, -26, 48, 52, 8), fill: ex.color }, { path: (c) => rrectPath(c, -10, -20, 20, 40, 6), fill: ex.color2, detail: (c) => { c.strokeStyle = ex.color3; c.lineWidth = 3; for (let y = -14; y < 18; y += 7) { c.beginPath(); c.moveTo(-10, y); c.lineTo(10, y); c.stroke(); } } }], 4.5);
      g.strokeStyle = '#c3c9d4'; g.lineWidth = 4; g.beginPath(); g.arc(40, 0, 7, 0, 6.3); g.stroke();
      g.fillStyle = darken(ex.color, 0); g.beginPath(); g.moveTo(24, 0); g.lineTo(33, 0); g.stroke();
    },
  };
}
