import type { BuildingLot } from '../core/types';
import { bodyGrad, ellipse, fillStroke, poly, radial, rr, type Ctx } from '../art/draw';
import { UNDERWATER_BUILDING_LOTS } from './gen/underwater';

interface Module {
  x: number;
  y: number;
  w: number;
  h: number;
  roof: 'glass' | 'panel' | 'garden' | 'airlock';
  radius?: number;
}

const plans: Record<string, readonly Module[]> = {
  school: [
    { x: 128, y: 104, w: 212, h: 104, roof: 'panel' },
    { x: 60, y: 169, w: 76, h: 94, roof: 'glass' },
    { x: 196, y: 169, w: 76, h: 94, roof: 'glass' },
  ],
  shop: [
    { x: 119, y: 126, w: 191, h: 145, roof: 'panel' },
    { x: 211, y: 126, w: 49, h: 71, roof: 'airlock' },
  ],
  bakery: [
    { x: 100, y: 140, w: 153, h: 133, roof: 'panel', radius: 26 },
    { x: 165, y: 101, w: 130, h: 77, roof: 'glass', radius: 21 },
  ],
  museum: [
    { x: 128, y: 124, w: 208, h: 166, roof: 'glass', radius: 30 },
    { x: 127, y: 210, w: 89, h: 37, roof: 'airlock' },
  ],
  library: [
    { x: 84, y: 124, w: 121, h: 161, roof: 'panel' },
    { x: 157, y: 124, w: 72, h: 59, roof: 'airlock' },
    { x: 193, y: 124, w: 76, h: 106, roof: 'glass', radius: 24 },
  ],
  tower: [
    { x: 128, y: 128, w: 153, h: 153, roof: 'panel', radius: 30 },
    { x: 128, y: 194, w: 57, h: 49, roof: 'airlock' },
  ],
  restaurant: [
    { x: 128, y: 98, w: 194, h: 121, roof: 'glass', radius: 25 },
    { x: 125, y: 175, w: 125, h: 77, roof: 'panel' },
  ],
  house: [
    { x: 138, y: 124, w: 163, h: 141, roof: 'panel', radius: 24 },
    { x: 57, y: 122, w: 63, h: 79, roof: 'glass' },
    { x: 151, y: 200, w: 62, h: 38, roof: 'airlock' },
  ],
  park: [
    { x: 64, y: 122, w: 80, h: 167, roof: 'garden', radius: 26 },
    { x: 192, y: 122, w: 80, h: 167, roof: 'garden', radius: 26 },
  ],
  hospital: [
    { x: 128, y: 130, w: 203, h: 95, roof: 'panel' },
    { x: 128, y: 130, w: 93, h: 203, roof: 'panel' },
  ],
};

export const underwaterBuildingKind = (lot: BuildingLot) => UNDERWATER_BUILDING_LOTS[lot.id]?.[2] ?? 'shop';

/** Normalized rectangle extents measured from the lot center, also used for collisions. */
export function underwaterBuildingFootprints(lot: BuildingLot): { x: number; y: number; w: number; h: number; radius: number }[] {
  return plans[underwaterBuildingKind(lot)].map(({ x, y, w, h, radius = 15 }) => ({
    x: (x - 128) / 256, y: (y - 128) / 256, w: w / 256, h: h / 256, radius: radius / Math.min(w, h),
  }));
}

const colors = {
  school: ['#55b4a8', '#296278', '#ffecae'],
  shop: ['#dbad67', '#795a56', '#fee2a0'],
  bakery: ['#df8d81', '#753f61', '#ffcad3'],
  museum: ['#80b2d3', '#365278', '#ccf3f7'],
  library: ['#ab98d5', '#554f82', '#f9d1f7'],
  tower: ['#6fa7c8', '#344b7e', '#c0fbf5'],
  restaurant: ['#d48e78', '#704764', '#f7dec2'],
  house: ['#86bfa2', '#355d70', '#d1ffcc'],
  park: ['#7cae91', '#315b68', '#d5ffb1'],
  hospital: ['#b5d4d2', '#4d7c98', '#ffe8e7'],
} as Record<string, readonly [string, string, string]>;

export function paintUnderwaterBuilding(c: Ctx, lot: BuildingLot): void {
  const kind = underwaterBuildingKind(lot);
  const modules = plans[kind];
  const [light, dark, highlight] = colors[kind];
  function modulePath(m: Module, inset = 0): void {
    rr(c, m.x - m.w / 2 + inset, m.y - m.h / 2 + inset, m.w - inset * 2, m.h - inset * 2,
      Math.max(5, (m.radius ?? 15) - inset));
  }
  c.save();
  c.translate(7, 8);
  for (const module of modules) {
    modulePath(module, -2);
    fillStroke(c, '#12344994', null);
  }
  c.restore();
  for (const m of modules) {
    const left = m.x - m.w / 2, top = m.y - m.h / 2;
    modulePath(m);
    fillStroke(c, bodyGrad(c, left, top, m.w, m.h, light, dark), '#163b50', 4);
    modulePath(m, 6);
    c.strokeStyle = highlight;
    c.globalAlpha = 0.66;
    c.lineWidth = 2;
    c.stroke();
    c.globalAlpha = 1;
    modulePath(m, 11);
    if (m.roof === 'airlock') {
      fillStroke(c, '#254f65', '#133b51', 2);
      c.fillStyle = highlight;
      c.fillRect(m.x - 9, m.y - 2, 18, 4);
    } else if (m.roof === 'glass') {
      fillStroke(c, radial(c, m.x - m.w / 5, m.y - m.h / 4, 2, m.w * .72, [[0, '#d0fff0'], [.33, light], [1, dark]]), '#234f68', 3);
      for (const offset of [-.24, 0, .24]) {
        c.beginPath();
        c.moveTo(m.x + m.w * offset, top + 14);
        c.quadraticCurveTo(m.x + m.w * offset + 12, m.y, m.x + m.w * offset, top + m.h - 14);
        c.strokeStyle = '#e1ffef63';
        c.stroke();
      }
      ellipse(c, m.x - m.w * .22, top + 24, 11, 3);
      fillStroke(c, '#faffd8ac', null);
    } else if (m.roof === 'garden') {
      fillStroke(c, '#254f57', '#387776', 2);
      for (const toY of [-.32, -.12, .1, .31]) {
        ellipse(c, m.x + 12 * Math.cos(toY * 23), m.y + toY * m.h, 17, 13);
        fillStroke(c, '#72b784', '#397c67', 2);
        for (const dx of [-6, 5]) {
          ellipse(c, m.x + 12 * Math.cos(toY * 23) + dx, m.y + toY * m.h - 2, 4, 4);
          fillStroke(c, '#ffd4a7', null);
        }
      }
    } else {
      fillStroke(c, bodyGrad(c, left + 10, top + 10, m.w - 20, m.h - 20, light, dark), '#284963', 2);
      c.fillStyle = '#173d56';
      for (const side of [-1, 1]) {
        c.fillRect(m.x - m.w * .31, m.y + side * (m.h / 2 - 18) - 3, m.w * .62, 6);
        c.fillStyle = highlight;
        for (let x = m.x - m.w * .25; x < m.x + m.w * .29; x += 18) {
          c.fillRect(x, m.y + side * (m.h / 2 - 18) - 1, 6, 2);
        }
        c.fillStyle = '#173d56';
      }
    }
  }
  if (kind === 'hospital') {
    rr(c, 101, 103, 54, 54, 16);
    fillStroke(c, '#f2f6e4', '#397887', 3);
    c.fillStyle = '#c35f73';
    c.fillRect(121, 112, 14, 36);
    c.fillRect(110, 123, 36, 14);
  } else if (kind === 'tower') {
    for (const [r, color] of [[61, '#284b69'], [52, '#69b6c6'], [40, '#386688'], [28, '#83d9d3'], [14, '#e4ffc8']] as const) {
      ellipse(c, 128, 128, r, r);
      fillStroke(c, color, '#204462', 3);
    }
    c.beginPath();
    c.arc(128, 128, 48, 3.55, 5);
    c.strokeStyle = '#d8ffe1';
    c.lineWidth = 4;
    c.stroke();
  } else if (kind === 'museum') {
    // A fossil-shaped frame sits under the observation glass.
    for (let r = 50; r >= 14; r -= 12) {
      c.beginPath();
      c.arc(128, 115, r, -.4, Math.PI * 1.55);
      c.strokeStyle = r === 50 ? '#e9e8ce' : '#dbe9d4b8';
      c.lineWidth = 3;
      c.stroke();
    }
    c.beginPath();
    c.moveTo(109, 113);
    c.lineTo(174, 99);
    c.stroke();
  } else if (kind === 'school') {
    for (const [x, coat] of [[94, '#f0c468'], [128, '#ef9591'], [162, '#c9d0fb']] as const) {
      poly(c, [x - 6, 105, x, 92, x + 6, 105, x + 6, 120, x - 6, 120]);
      fillStroke(c, coat, '#427280', 2);
      c.fillStyle = '#173d56';
      c.fillRect(x - 4, 105, 8, 2);
    }
  } else if (kind === 'restaurant' || kind === 'bakery') {
    const module = modules[kind === 'restaurant' ? 1 : 0];
    for (const dx of [-33, 0, 33]) {
      ellipse(c, module.x + dx, module.y, 11, 11);
      fillStroke(c, '#d99189', '#6c4861', 2);
      ellipse(c, module.x + dx, module.y, 5, 5);
      fillStroke(c, '#fae0bb', null);
    }
  } else if (kind !== 'park') {
    const module = modules[0];
    for (const x of [-23, 0, 23]) {
      rr(c, module.x + x - 8, module.y - 13, 16, 26, 5);
      fillStroke(c, '#28627a', highlight, 2);
      c.fillStyle = '#211f5094';
      c.fillRect(module.x + x - 5, module.y, 10, 10);
    }
  }
}
