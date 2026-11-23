/** Baked overhead cutaway for the Gears station. The driving rig never uses this view. */
import type Phaser from 'phaser';
import type { Model } from '../../core/types';
import { drawShapes, ellipsePath, partImage, polyPath, roundedPolyPath, rrectPath, type PartSpec, type Shape } from '../bake';
import { rainbowFill } from './drawSide';
import { engineTop, wheelTop } from './drawTop';
import { raceLooks, topOutline } from './geometry';
import { GEAR, PAINT, RACE_WINDOW, type GearLook } from './looks';

const AXLE = 124;
const TRACK = 76;
const ENGINE_X = 88;
const SHELL_LENGTH = 384;

interface Cog {
  x: number;
  y: number;
  radius: number;
  teeth: number;
  phase: number;
}

const TRAINS: Record<GearLook['cue'], readonly Cog[]> = {
  none: [
    { x: 25, y: 0, radius: 23, teeth: 8, phase: 0 },
    { x: -13, y: 0, radius: 18, teeth: 8, phase: Math.PI / 8 },
  ],
  chevrons: [
    { x: 28, y: 0, radius: 14, teeth: 10, phase: 0 },
    { x: 5, y: -9, radius: 13, teeth: 9, phase: 0.2 },
    { x: -18, y: 1, radius: 15, teeth: 10, phase: 0 },
    { x: -43, y: -10, radius: 15, teeth: 10, phase: 0.2 },
  ],
  mountain: [
    { x: 15, y: -21, radius: 30, teeth: 12, phase: 0 },
    { x: -33, y: 5, radius: 31, teeth: 12, phase: 0.15 },
    { x: 15, y: 27, radius: 23, teeth: 10, phase: 0.3 },
  ],
  driveshaft: [
    { x: 22, y: 0, radius: 23, teeth: 10, phase: 0 },
    { x: -17, y: 0, radius: 21, teeth: 10, phase: 0.31 },
  ],
};

function cogShape(cog: Cog, look: GearLook, alternate: boolean): Shape {
  const { x, y, radius, teeth, phase } = cog;
  const pitch = 2 * Math.PI / teeth;
  const points = Array.from({ length: teeth }, (_, i) =>
    [[-0.5, 0.75], [-0.29, 0.75], [-0.18, 1], [0.18, 1], [0.29, 0.75]].map(([offset, scale]) => {
      const angle = phase + (i + offset) * pitch;
      return { x: x + Math.cos(angle) * radius * scale, y: y + Math.sin(angle) * radius * scale };
    }),
  ).flat();
  return {
    path: (g) => polyPath(g, points),
    fill: alternate ? '#e2c784' : look.color,
    detail: (g) => drawShapes(g, [{
      path: (c) => ellipsePath(c, x, y, radius * 0.28, radius * 0.28),
      fill: alternate ? '#745d3a' : look.dark,
    }], 2),
  };
}

function cutaway(model: Model): PartSpec {
  const { body, shape } = raceLooks(model);
  const paint = PAINT[model.paint] ?? PAINT['paint.blue'];
  const gear = GEAR[model.gears] ?? GEAR['gears.easy'];
  const fourByFour = gear.cue === 'driveshaft';
  const silhouette = topOutline(body, shape).map(({ x, y }) => ({ x: x * SHELL_LENGTH / body.len, y: y * 78 / body.hw }));
  return {
    key: ['ws:r:detail:gears', model.gears, model.paint, model.body, model.shape].join(':'),
    w: 480, h: 218, ox: 221, oy: 109,
    draw: (g) => {
      const box = (x: number, y: number, w: number, h: number, r: number, fill: string): Shape =>
        ({ path: (c) => rrectPath(c, x, y, w, h, r), fill });

      drawShapes(g, [{
        path: (c) => roundedPolyPath(c, silhouette, 12),
        fill: paint.bands ? rainbowFill(paint.bands, SHELL_LENGTH, -100, 100) : paint.main,
      }], 5);
      drawShapes(g, [
        box(-151, -49, 53, 98, 15, RACE_WINDOW),
        box(-77, -56, 237, 112, 21, paint.accent),
      ], 3);
      drawShapes(g, [box(-70, -49, 223, 98, 17, '#32354b')], 3);
      drawShapes(g, [
        box(60, -34, 61, 68, 10, '#777f92'),
        box(33, -8, 35, 16, 5, '#b5becd'),
      ], 3);
      if (fourByFour) {
        const hardware = [box(-AXLE, -6, 2 * AXLE, 12, 5, '#acb8c8')];
        for (const x of [-AXLE, AXLE]) {
          hardware.push(box(x - 6, -TRACK, 12, TRACK * 2, 5, '#acb8c8'));
          hardware.push(box(x - 14, -14, 28, 28, 7, '#e9b854'));
        }
        drawShapes(g, hardware, 3);
      }

      drawShapes(g, TRAINS[gear.cue].map((cog, i) => cogShape(cog, gear, i % 2 !== 0)), 2.4);
      // Forward-hinged hood, shown foreshortened with the underside and hinges facing up.
      drawShapes(g, [
        box(153, -41, 36, 12, 4, '#d2d8e3'),
        box(153, 29, 36, 12, 4, '#d2d8e3'),
        { path: (c) => roundedPolyPath(c, [
          { x: 176, y: -56 }, { x: 233, y: -46 }, { x: 245, y: -32 },
          { x: 245, y: 32 }, { x: 233, y: 46 }, { x: 176, y: 56 },
        ], 13), fill: paint.main },
      ], 4);
      drawShapes(g, [box(186, -33, 42, 66, 10, paint.dark)], 2);
      g.strokeStyle = paint.accent;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(188, -31);
      g.lineTo(224, 0);
      g.lineTo(188, 31);
      g.stroke();
    },
  };
}

export function buildGearDetail(scene: Phaser.Scene, model: Model): Phaser.GameObjects.Container {
  const detail = scene.add.container(0, 0).setName('gear-detail');
  detail.add(partImage(scene, cutaway(model)));
  for (const x of [-AXLE, AXLE]) {
    for (const y of [-TRACK, TRACK]) {
      const wheel = partImage(scene, wheelTop(model.wheels), x, y);
      wheel.setScale(wheel.scaleX * 0.82);
      detail.add(wheel);
    }
  }
  detail.add(partImage(scene, engineTop(model.engine), ENGINE_X, 0));
  return detail;
}
