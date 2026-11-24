import type Phaser from 'phaser';
import { CLOUD_EDGE, cloud, smile } from '../../shared/buddies/cloudArt';
import { UNLOCK_VEHICLES } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import { bodyGrad, ellipse, fillStroke, glossHighlight, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';

const INK = '#25324d';

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): void {
  const { ctx, done } = makeCanvas(scene, key, w, h);
  paint(ctx);
  done();
}

function box(c: Ctx, x: number, y: number, w: number, h: number, r: number, paint: string | CanvasGradient) {
  rr(c, x, y, w, h, r);
  fillStroke(c, paint, INK, 2);
}

function glass(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  box(c, x, y, w, h, r, bodyGrad(c, x, y, w, h, '#9cecf6', '#254368'));
  glossHighlight(c, x + w * 0.48, y + 4, w * 0.25, 1.4);
}

function thruster(c: Ctx, x: number, y: number, w: number, h: number, trim: string) {
  box(c, x, y, w, h, h / 2, '#384c72');
  box(c, x + 3, y + 2, w - 9, h - 4, h / 2, trim);
}

const vehicles = {
  skyTaxi(c: Ctx, paint: CanvasGradient, trim: string) {
    for (const y of [3, 37]) {
      thruster(c, 5, y, 29, 12, trim);
      thruster(c, 68, y, 21, 12, trim);
    }
    box(c, 7, 7, 88, 38, 10, paint);
    glass(c, 12, 15, 21, 22, 6);
    glass(c, 62, 12, 24, 28, 8);
    for (const y of [9, 36]) for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 12; column++) {
        c.fillStyle = (row + column) % 2 ? '#fff1ae' : INK;
        c.fillRect(34 + column * 2, y + row * 3, 2, 3);
      }
    }
    box(c, 38, 21, 17, 10, 3, '#fff0be');
    c.fillStyle = INK;
    c.font = 'bold 5px sans-serif';
    c.textAlign = 'center';
    c.fillText('TAXI', 46.5, 28);
  },
  cloudCoupe(c: Ctx, paint: CanvasGradient, trim: string) {
    for (const y of [3, 36]) thruster(c, 17, y, 38, 13, trim);
    ellipse(c, 51, 26, 44, 19);
    fillStroke(c, paint, INK, 2.5);
    box(c, 11, 19, 20, 14, 7, '#dcecff');
    glass(c, 34, 11, 44, 30, 15);
    box(c, 49, 13, 4, 26, 2, '#eff9ff');
  },
  galeRoadster(c: Ctx, paint: CanvasGradient, trim: string) {
    poly(c, [7, 9, 39, 4, 59, 19, 88, 17, 96, 26, 88, 35, 59, 33, 39, 48, 7, 43, 19, 26]);
    fillStroke(c, paint, INK, 2.5);
    for (const y of [8, 35]) thruster(c, 10, y, 22, 9, trim);
    box(c, 37, 16, 25, 20, 7, '#273957');
    box(c, 40, 19, 8, 14, 3, '#4e9ab0');
    glass(c, 57, 15, 10, 22, 5);
    poly(c, [69, 22, 90, 26, 69, 30, 74, 26]);
    fillStroke(c, trim, null);
  },
  propellerBuggy(c: Ctx, paint: CanvasGradient, trim: string) {
    box(c, 20, 4, 13, 44, 5, '#604962');
    for (const y of [12, 40]) {
      ellipse(c, 22, y, 18, 7);
      fillStroke(c, '#fbebd4', INK, 2);
      box(c, 18, y - 3, 9, 6, 3, '#a7505d');
    }
    box(c, 30, 10, 64, 32, 12, paint);
    box(c, 38, 14, 29, 24, 8, '#2a3b58');
    box(c, 43, 18, 11, 16, 4, trim);
    glass(c, 61, 14, 10, 24, 4);
    for (const y of [18, 29]) box(c, 78, y, 9, 5, 2, '#fff0ca');
  },
  courierPod(c: Ctx, paint: CanvasGradient, trim: string) {
    for (const y of [2, 38]) thruster(c, 12, y, 52, 12, trim);
    box(c, 5, 7, 90, 38, 15, paint);
    glass(c, 68, 12, 19, 28, 9);
    box(c, 15, 15, 39, 22, 5, trim);
    c.beginPath();
    c.moveTo(18, 18);
    c.lineTo(34.5, 29);
    c.lineTo(51, 18);
    c.strokeStyle = '#6553aa';
    c.lineWidth = 2;
    c.stroke();
    box(c, 57, 20, 6, 12, 3, '#f5d786');
  },
};

export function drawSkyCollectibles(scene: Phaser.Scene): void {
  for (const id of Object.keys(vehicles) as (keyof typeof vehicles)[]) {
    const { spec, colors: [light, dark, trim] } = UNLOCK_VEHICLES[id];
    bake(scene, TEX.unlockVehicles[id], spec.length * 2, spec.width * 2, c => {
      c.scale(spec.length / 50, spec.width / 26);
      vehicles[id](c, bodyGrad(c, 5, 6, 90, 40, light, dark), trim);
    });
  }
}

export function drawThundercloud(scene: Phaser.Scene): void {
  const tex = TEX.thundercloud;
  bake(scene, tex.body, 288, 213, c => {
    cloud(c, 4, 32, 155, 155, '#c5b9f1', '#7561ab');
    cloud(c, 42, 5, 232, 201, '#e8dbff', '#9379cb');
    cloud(c, 27, 129, 104, 67, '#d9c9fc', '#a48adf');
    poly(c, [138, 62, 104, 115, 131, 115, 105, 155, 172, 101, 144, 101, 169, 62]);
    fillStroke(c, bodyGrad(c, 104, 62, 68, 93, '#fffabc', '#ffbf51'), CLOUD_EDGE, 5);
  });
  bake(scene, tex.head, 180, 144, c => {
    cloud(c, 3, 2, 170, 139, '#fff0ff', '#b29ae3');
    // x=90 is 45 px ahead of the .25 origin. The two eyes sit 42 px off center.
    for (const y of [30, 114]) {
      ellipse(c, 90, y, 18, 15);
      fillStroke(c, '#fffdf0', CLOUD_EDGE, 3.5);
      ellipse(c, 95, y, 10, 11);
      fillStroke(c, '#604599', null);
      glossHighlight(c, 99, y - 4, 3.7, 3.7, 0.9);
    }
    for (const y of [40, 104]) {
      ellipse(c, 123, y, 10, 6);
      fillStroke(c, '#f7add5', null);
    }
    smile(c, 125, 72, 15, 5);
  });
  bake(scene, tex.arm, 172, 105, c => {
    cloud(c, 4, 39, 87, 62, '#cbbbf6', '#9279ce');
    cloud(c, 35, 16, 128, 81, '#f4e7ff', '#a38bdc');
  });
  bake(scene, tex.foot, 120, 92, c => {
    cloud(c, 3, 27, 63, 53, '#b7a4ea', '#836fb9');
    cloud(c, 29, 8, 84, 66, '#e5d7ff', '#a48cda');
  });
  bake(scene, tex.beam, 192, 64, c => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, '#875aff00'], [0.3, '#875aff66'], [0.5, '#b49affbc'],
      [0.7, '#875aff66'], [1, '#875aff00']]);
    c.fillRect(0, 0, 192, 64);
    c.beginPath();
    c.moveTo(0, 32);
    for (let x = 0; x < 192; x += 32) {
      c.lineTo(x + 13, 14);
      c.lineTo(x + 18, 45);
      c.lineTo(x + 32, 32);
    }
    c.lineJoin = 'round';
    c.strokeStyle = '#9e75ff';
    c.lineWidth = 17;
    c.stroke();
    c.strokeStyle = '#fff3d1';
    c.lineWidth = 7;
    c.stroke();
  });
  bake(scene, tex.glow, 128, 128, c => {
    c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#fffcec'], [0.22, '#ffe9aa'], [0.52, '#b38affbd'], [1, '#9870ff00']]);
    c.fillRect(0, 0, 128, 128);
  });
}
