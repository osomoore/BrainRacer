import type Phaser from 'phaser';
import { UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, UNLOCK_VEHICLES, type UnlockGuide, type UnlockVehicle } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import { bodyGrad, ellipse, fillStroke, glossHighlight, lin, makeCanvas, OUTLINE, poly, rr, star, type Ctx } from './draw';

function box(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string | CanvasGradient) {
  rr(ctx, x, y, w, h, radius);
  fillStroke(ctx, color, OUTLINE, 2.3);
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ellipse(ctx, x, y, rx, ry);
  fillStroke(ctx, color, OUTLINE, 2.3);
}

function tire(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, 3, '#39455a');
  ctx.fillStyle = '#7e8ba0';
  ctx.fillRect(x + 3, y + 2, w - 6, 2);
}

function glass(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, 6, lin(ctx, x, y, x + w * 0.7, y + h, [[0, '#b2f3ff'], [0.38, '#477fa1'], [1, '#29445f']]));
  glossHighlight(ctx, x + w * 0.4, y + 3.5, w * 0.25, 1.4);
}

function drawVehicle(scene: Phaser.Scene, id: UnlockVehicle) {
  const { spec, colors, family } = UNLOCK_VEHICLES[id];
  const { ctx, done } = makeCanvas(scene, TEX.unlockVehicles[id], spec.length * 2, spec.width * 2);
  ctx.scale(spec.length * 0.02, spec.width / 26);
  const [light, dark, accent] = colors;
  const paint = bodyGrad(ctx, 4, 6, 90, 40, light, dark);
  const sides = [2, 41];

  if (family === 'cycle' || family === 'trike') {
    const trike = family === 'trike';
    const scooter = id === 'scooter';
    for (const y of trike ? sides : [19]) tire(ctx, 4, y, 26, trike ? 9 : 14);
    tire(ctx, 76, 20, 22, 12);
    if (trike) box(ctx, 9, 8, 21, 36, 6, dark);
    box(ctx, scooter ? 11 : 18, scooter ? 9 : 14, scooter ? 49 : 45, scooter ? 34 : 24, 12, paint);
    box(ctx, 54, scooter ? 5 : 9, 9, scooter ? 42 : 34, 4, '#454d63');
    box(ctx, 60, 17, 29, 18, 8, paint);
    box(ctx, 26, 18, 25, 16, 7, '#293149');
    oval(ctx, 72, 26, 9, 5, accent);
    oval(ctx, 88, 26, 5, 5, '#fff8ca');
    done();
    return;
  }

  if (family === 'tracked') {
    for (const y of [2, 35]) {
      box(ctx, 4, y, 89, 15, 6, '#364257');
      for (let x = 13; x <= 82; x += 10) box(ctx, x, y + 1, 4, 13, 1, '#8290a4');
    }
  } else {
    const oversized = id === 'monsterTruck' || id === 'tractor';
    for (const y of sides) {
      tire(ctx, oversized ? 7 : 18, y, oversized ? 25 : 15, oversized ? 10 : 8);
      tire(ctx, 69, y, id === 'monsterTruck' ? 25 : 15, oversized ? 10 : 8);
    }
  }

  switch (family) {
    case 'open':
      poly(ctx, [5, 18, 17, 11, 34, 11, 45, 7, 82, 7, 95, 14, 97, 31, 87, 45, 42, 45, 28, 39, 8, 38]);
      fillStroke(ctx, paint, OUTLINE, 2.8);
      box(ctx, 34, 13, 30, 26, 10, '#29354d');
      box(ctx, 42, 17, 12, 18, 6, accent);
      glass(ctx, 60, 13, 9, 26);
      if (id === 'buggy') {
        box(ctx, 11, 12, 13, 28, 4, '#617792');
        oval(ctx, 81, 26, 8, 6, accent);
      } else if (id === 'hotRod') {
        box(ctx, 73, 17, 14, 18, 3, '#c4d5e5');
        for (const y of [20, 25, 30]) box(ctx, 72, y, 16, 3, 1, accent);
      } else {
        box(ctx, 72, 24, 19, 5, 2, accent);
      }
      break;
    case 'utility':
      box(ctx, id === 'tractor' ? 15 : 4, 8, id === 'tractor' ? 77 : 92, 36, 8, paint);
      if (id === 'tractor') {
        glass(ctx, 31, 14, 23, 24);
        box(ctx, 59, 15, 27, 22, 5, light);
        for (const x of [66, 72, 78]) box(ctx, x, 18, 2.5, 16, 1.2, dark);
      } else {
        box(ctx, 8, 12, 34, 28, 4, '#40506a');
        if (id === 'towTruck') {
          poly(ctx, [11, 19, 40, 23, 40, 29, 11, 33]);
          fillStroke(ctx, accent, OUTLINE, 2);
          oval(ctx, 11, 26, 5, 4, '#f3f7ff');
        } else if (id === 'jeep') {
          oval(ctx, 13, 26, 8, 9, '#41516c');
          box(ctx, 24, 14, 11, 24, 4, accent);
        } else {
          for (const y of [18, 26, 34]) box(ctx, 11, y - 1, 27, 2, 1, '#657991');
        }
        glass(ctx, 45, 13, 26, 26);
        box(ctx, 75, 13, 13, 26, 5, id === 'monsterTruck' ? accent : light);
      }
      break;
    case 'van':
      box(ctx, 3, 5, 93, 42, id === 'camper' ? 13 : 7, paint);
      box(ctx, 8, 9, 58, 34, 5, light);
      glass(ctx, 69, 10, 19, 32);
      if (id === 'ambulance') {
        box(ctx, 33, 16, 8, 20, 2, accent);
        box(ctx, 26, 22, 22, 8, 2, accent);
        box(ctx, 59, 8, 7, 36, 2, accent);
      } else if (id === 'bus') {
        for (const x of [12, 25, 38, 51]) for (const y of [8, 36]) box(ctx, x, y, 9, 8, 2, '#35415c');
        box(ctx, 11, 24, 49, 4, 2, accent);
      } else if (id === 'camper') {
        box(ctx, 11, 21, 47, 10, 3, accent);
        oval(ctx, 36, 26, 9, 6, '#5fb9b2');
      } else {
        box(ctx, 20, 16, 33, 20, 4, accent);
        poly(ctx, [24, 20, 36.5, 28, 49, 20]);
        ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
      }
      break;
    case 'tracked':
      box(ctx, 20, 8, 67, 36, 8, paint);
      glass(ctx, 58, 12, 22, 28);
      box(ctx, 89, 2, 8, 48, 3, '#d1e2ed');
      for (const y of [10, 22, 34]) box(ctx, 25, y, 24, 6, 2, accent);
      break;
    case 'racer':
      if (id === 'dragster') {
        poly(ctx, [7, 13, 30, 9, 50, 20, 83, 19, 95, 23, 95, 29, 83, 33, 50, 32, 29, 43, 7, 39]);
        fillStroke(ctx, paint, OUTLINE, 2.8);
        box(ctx, 9, 6, 9, 40, 3, accent);
        glass(ctx, 30, 16, 22, 20);
        box(ctx, 62, 24, 20, 4, 2, accent);
      } else {
        poly(ctx, [6, 13, 27, 7, 62, 8, 91, 13, 97, 22, 97, 30, 91, 39, 62, 44, 27, 45, 6, 39]);
        fillStroke(ctx, paint, OUTLINE, 2.8);
        glass(ctx, 31, 12, 39, 28);
        box(ctx, 9, 9, 8, 34, 3, accent);
        for (const y of [18, 30]) box(ctx, 76, y, 16, 4, 2, accent);
      }
      break;
    case 'closed':
      box(ctx, 4, 7, 92, 38, 12, paint);
      glass(ctx, 27, 11, 44, 30);
      box(ctx, 39, 15, 15, 22, 4, light);
      if (id === 'taxi') {
        box(ctx, 42, 18, 10, 16, 3, accent);
        for (const x of [18, 30, 42, 54, 66]) for (const y of [8, 40]) box(ctx, x, y, 7, 4, 1, accent);
      } else {
        for (const y of [13, 35]) box(ctx, 73, y, 16, 4, 2, accent);
        box(ctx, 8, 8, 8, 36, 3, accent);
      }
      break;
  }
  for (const y of id === 'dragster' ? [24, 28] : [14, 38]) {
    oval(ctx, 93, y, 3.2, 3, '#fff5ad');
    if (id !== 'dragster') oval(ctx, 7, y, 2.6, 3, '#ff686e');
  }
  done();
}

function guideFace(ctx: Ctx, x: number, y: number) {
  for (const side of [-1, 1]) oval(ctx, x + side * 5, y, 1.3, 2.4, '#20314d');
  ctx.beginPath(); ctx.arc(x, y + 4, 3, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawGuide(scene: Phaser.Scene, id: UnlockGuide) {
  const { ctx, done } = makeCanvas(scene, TEX.unlockGuides[id], 58, 58);
  switch (id) {
    case 'fairy':
      for (const x of [14, 44]) {
        oval(ctx, x, 23, 11, 10, '#d3f7ff');
        oval(ctx, x + (x < 29 ? 1 : -1) * 3, 35, 8, 8, '#f9bbfc');
      }
      poly(ctx, [29, 26, 43, 44, 36, 48, 22, 48, 15, 44]);
      fillStroke(ctx, '#d867c5', OUTLINE, 2.5);
      oval(ctx, 29, 20, 12, 11, '#ffdbad');
      oval(ctx, 29, 12, 10, 5, '#ffb65b');
      guideFace(ctx, 29, 20);
      star(ctx, 46, 9, 7, 3, 4);
      fillStroke(ctx, '#fff29a', OUTLINE, 1.5);
      break;
    case 'bumblebee':
      for (const x of [16, 42]) oval(ctx, x, 20, 11, 12, '#caf6ff');
      oval(ctx, 29, 31, 15, 18, '#ffd85b');
      box(ctx, 16, 35, 26, 4, 2, '#263752');
      box(ctx, 21, 43, 16, 3, 1.5, '#263752');
      guideFace(ctx, 29, 23);
      break;
    case 'owl':
      oval(ctx, 29, 33, 19, 19, '#a66cdb');
      poly(ctx, [11, 24, 10, 8, 23, 15, 35, 15, 48, 8, 47, 24, 40, 41, 18, 41]);
      fillStroke(ctx, '#bb88e5', OUTLINE, 2.5);
      for (const x of [20, 38]) {
        oval(ctx, x, 25, 9, 10, '#fff0d3');
        oval(ctx, x, 25, 2.8, 4, '#374168');
      }
      poly(ctx, [25, 33, 33, 33, 29, 40]); fillStroke(ctx, '#ffb661', OUTLINE, 1.5);
      break;
    case 'rocket':
      poly(ctx, [19, 32, 9, 48, 24, 44, 34, 44, 49, 48, 39, 32]);
      fillStroke(ctx, '#ff8078', OUTLINE, 2.5);
      poly(ctx, [23, 41, 29, 55, 35, 41]); fillStroke(ctx, '#ffd166', OUTLINE, 2);
      poly(ctx, [29, 3, 39, 15, 42, 35, 35, 44, 23, 44, 16, 35, 19, 15]);
      fillStroke(ctx, '#e0f0ff', OUTLINE, 2.5);
      oval(ctx, 29, 24, 9, 9, '#56cff2');
      oval(ctx, 27, 21, 3.5, 2.2, '#e3faff');
      break;
    case 'comet':
      poly(ctx, [18, 22, 3, 43, 17, 38, 7, 53, 36, 44, 47, 28]);
      fillStroke(ctx, '#3ca4de', OUTLINE, 2.5);
      poly(ctx, [20, 24, 11, 43, 36, 37, 41, 24]);
      fillStroke(ctx, '#95edff', OUTLINE, 2);
      star(ctx, 36, 24, 19, 10, 5, -0.85);
      fillStroke(ctx, '#baf6ff', OUTLINE, 2.5);
      guideFace(ctx, 36, 22);
      break;
  }
  done();
}

export function drawCollectibles(scene: Phaser.Scene) {
  for (const id of UNLOCK_VEHICLE_IDS) drawVehicle(scene, id);
  for (const id of UNLOCK_GUIDE_IDS) drawGuide(scene, id);
}
