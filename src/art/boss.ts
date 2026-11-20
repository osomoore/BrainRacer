import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import type { RaceMap } from '../core/types';
import { bodyGrad, ellipse, fillStroke, lin, makeCanvas, poly, radial, rr, type Ctx } from './draw';
import { ROCK_MONSTER_RIG } from './rockMonster';

const OCTOPUS_RIG = { ...ROCK_MONSTER_RIG, headX: 100, eyeFwd: 157, armY: 79, footX: -114, footY: 74 };
const ROBOT_RIG = { ...ROCK_MONSTER_RIG, headX: 120, eyeFwd: 177, armY: 96 };
const CHICKEN_RIG = { ...ROCK_MONSTER_RIG, headX: 122, eyeFwd: 179, armX: 18, armY: 79, footX: -96, footY: 52 };

export const MAP_BOSSES = {
  city: { name: 'Dino', objectName: 'dino-encounter', head: TEX.dinoHead, rig: null, tint: 0xff7ab8, color: '#ffd34d' },
  underground: { name: 'Rock Monster', objectName: 'rock-monster', head: TEX.rockMonster.head,
    rig: { ...ROCK_MONSTER_RIG, tex: TEX.rockMonster }, tint: 0x7affed, color: '#78f7ed' },
  harbor: { name: 'Octopus', objectName: 'octopus', head: TEX.octopus.head,
    rig: { ...OCTOPUS_RIG, tex: TEX.octopus }, tint: 0xffa2fd, color: '#ffb3ff' },
  industrial: { name: 'Robot', objectName: 'factory-robot', head: TEX.factoryRobot.head,
    rig: { ...ROBOT_RIG, tex: TEX.factoryRobot }, tint: 0xffcf62, color: '#ffdc7f' },
  farm: { name: 'Giant Chicken', objectName: 'giant-chicken', head: TEX.giantChicken.head,
    rig: { ...CHICKEN_RIG, tex: TEX.giantChicken }, tint: 0xff9375, color: '#ffbd86' },
} satisfies Record<RaceMap, { name: string; objectName: string; head: string;
  rig: (Record<keyof typeof ROCK_MONSTER_RIG, number> & { tex: Record<keyof typeof TEX.rockMonster, string> }) | null;
  tint: number; color: string }>;

const INK = '#202635';

function eyes(c: Ctx, iris: string): void {
  for (const y of [30, 114]) {
    ellipse(c, 102, y, 19, 16);
    fillStroke(c, '#fff8df', INK, 4);
    ellipse(c, 106, y, 11, 10);
    fillStroke(c, iris, null);
    ellipse(c, 110, y - 2, 4, 4);
    fillStroke(c, '#ffffff', null);
  }
}

function tentacle(c: Ctx, x: number, y: number, scale: number): void {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.beginPath();
  c.moveTo(0, 3);
  c.bezierCurveTo(39, -22, 52, 45, 97, 43);
  c.bezierCurveTo(137, 41, 124, 5, 106, 16);
  c.bezierCurveTo(93, 15, 107, -9, 132, 6);
  c.bezierCurveTo(175, 32, 132, 79, 84, 75);
  c.bezierCurveTo(37, 70, 29, 41, 0, 42);
  c.closePath();
  fillStroke(c, bodyGrad(c, 0, 0, 147, 80, '#ff8e96', '#a52983'), '#5a184f', 6);
  for (const [sx, sy, r] of [[38, 31, 8], [57, 49, 8], [80, 58, 8], [106, 57, 6], [127, 46, 5]]) {
    ellipse(c, sx, sy, r, r * 0.72);
    fillStroke(c, '#ffc4bd', '#9e437f', 2);
  }
  c.restore();
}

function octopus(scene: Phaser.Scene): void {
  const tex = TEX.octopus;
  bake(scene, tex.body, 288, 213, c => {
    ellipse(c, 151, 107, 130, 92);
    fillStroke(c, bodyGrad(c, 20, 20, 255, 170, '#ff9aa0', '#b53f7b'), '#5a184f', 7);
    ellipse(c, 112, 65, 68, 20);
    fillStroke(c, '#ffbbc799', null);
    for (const [x, y, r] of [[58, 108, 11], [91, 144, 9], [62, 141, 6], [133, 161, 7]]) {
      ellipse(c, x, y, r, r);
      fillStroke(c, '#cf507d', null);
    }
  });
  bake(scene, tex.head, 180, 145, c => {
    ellipse(c, 88, 72, 83, 66);
    fillStroke(c, bodyGrad(c, 4, 7, 163, 133, '#ffaba6', '#c74784'), '#5a184f', 6);
    eyes(c, '#9933aa');
    ellipse(c, 144, 72, 14, 10);
    fillStroke(c, '#71315e', '#5a184f', 3);
    for (const y of [39, 105]) {
      ellipse(c, 131, y, 7, 6);
      fillStroke(c, '#ff8f9b', null);
    }
  });
  bake(scene, tex.arm, 207, 110, c => { tentacle(c, 15, 9, 0.85); tentacle(c, 53, 32, 0.93); });
  bake(scene, tex.foot, 164, 119, c => {
    c.translate(162, 0);
    c.scale(-1, 1);
    tentacle(c, 16, 14, 0.8);
    tentacle(c, 29, 49, 0.78);
  });
  laserArt(scene, tex, '#f462e9', '#b635ff', '#fff1ff');
}

function robot(scene: Phaser.Scene): void {
  const tex = TEX.factoryRobot;
  const plate = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
    rr(c, x, y, w, h, r);
    fillStroke(c, bodyGrad(c, x, y, w, h, '#b4d3d8', '#4d627a'), INK, 7);
  };
  const bolt = (c: Ctx, x: number, y: number) => {
    ellipse(c, x, y, 7, 7);
    fillStroke(c, '#dcecf1', '#526276', 3);
  };
  bake(scene, tex.body, 288, 213, c => {
    plate(c, 10, 19, 267, 176, 36);
    rr(c, 36, 46, 210, 118, 20);
    fillStroke(c, '#304251', '#242a37', 4);
    rr(c, 66, 64, 111, 84, 18);
    fillStroke(c, '#dd823b', '#ab5b2e', 4);
    for (const y of [65, 85, 105, 125, 145]) {
      rr(c, 202, y, 23, 9, 3);
      fillStroke(c, '#a4bcc5', null);
    }
    for (const x of [45, 240]) for (const y of [33, 180]) bolt(c, x, y);
  });
  bake(scene, tex.head, 180, 145, c => {
    plate(c, 7, 9, 163, 127, 27);
    rr(c, 73, 12, 67, 120, 24);
    fillStroke(c, '#38444d', INK, 3);
    eyes(c, '#b9681b');
    rr(c, 111, 56, 44, 33, 9);
    fillStroke(c, '#34404e', INK, 4);
    for (const y of [63, 71, 79]) {
      rr(c, 117, y, 31, 3, 2);
      fillStroke(c, '#ffc763', null);
    }
    bolt(c, 30, 34); bolt(c, 30, 110);
  });
  bake(scene, tex.arm, 207, 110, c => {
    plate(c, 9, 29, 140, 52, 19);
    plate(c, 115, 12, 81, 83, 18);
    for (const y of [29, 55, 81]) bolt(c, 176, y);
    rr(c, 25, 43, 68, 22, 8);
    fillStroke(c, '#f3a849', '#7c573b', 4);
  });
  bake(scene, tex.foot, 120, 92, c => {
    plate(c, 8, 8, 104, 76, 20);
    for (const x of [24, 43, 62, 81]) {
      rr(c, x, 22, 9, 48, 5);
      fillStroke(c, '#46586c', null);
    }
  });
  laserArt(scene, tex, '#ffbb39', '#ff7635', '#fff3d2');
}

function chicken(scene: Phaser.Scene): void {
  const tex = TEX.giantChicken;
  const feather = (c: Ctx, x: number, y: number, rx: number, ry: number) => {
    ellipse(c, x, y, rx, ry);
    fillStroke(c, bodyGrad(c, x - rx, y - ry, 2 * rx, 2 * ry, '#fff8dd', '#dbb889'), '#796449', 5);
  };
  bake(scene, tex.body, 288, 213, c => {
    for (const y of [53, 79, 106, 132, 159]) feather(c, 48, y, 41, 23);
    feather(c, 161, 106, 119, 93);
    for (const [x, y] of [[107, 74], [148, 55], [111, 132], [157, 152]]) {
      ellipse(c, x, y, 21, 11);
      fillStroke(c, '#fff8dfad', null);
    }
  });
  bake(scene, tex.head, 180, 145, c => {
    feather(c, 82, 72, 69, 60);
    poly(c, [135, 48, 173, 72, 135, 97, 121, 74]);
    fillStroke(c, bodyGrad(c, 122, 48, 51, 49, '#ffde67', '#dc7629'), '#a85a25', 5);
    for (const [x, r] of [[49, 10], [68, 16], [89, 20], [107, 15]]) {
      ellipse(c, x, 71, r, 15);
      fillStroke(c, '#eb5854', '#ac363a', 4);
    }
    eyes(c, '#b4433e');
  });
  bake(scene, tex.arm, 207, 110, c => {
    for (const [x, y] of [[57, 74], [83, 78], [106, 72], [131, 61], [155, 51]]) feather(c, x, y, 42, 23);
    feather(c, 103, 43, 85, 32);
  });
  bake(scene, tex.foot, 120, 92, c => {
    poly(c, [9, 33, 45, 33, 93, 11, 109, 19, 84, 40, 114, 42, 114, 56, 84, 57, 105, 73,
      96, 84, 46, 63, 12, 63]);
    fillStroke(c, '#f4a848', '#9b5726', 5);
  });
  laserArt(scene, tex, '#ff795d', '#ff3f59', '#fff0cf');
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void): void {
  const { ctx, done } = makeCanvas(scene, key, w, h);
  paint(ctx);
  done();
}

function laserArt(scene: Phaser.Scene, tex: { beam: string; glow: string }, beam: string, edge: string, core: string): void {
  bake(scene, tex.beam, 64, 64, c => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, edge + '00'], [0.25, edge + 'ab'], [0.43, beam],
      [0.5, core], [0.57, beam], [0.75, edge + 'ab'], [1, edge + '00']]);
    c.fillRect(0, 0, 64, 64);
  });
  bake(scene, tex.glow, 128, 128, c => {
    c.fillStyle = radial(c, 64, 64, 0, 64, [[0, '#ffffff'], [0.26, beam], [0.55, edge + '78'], [1, edge + '00']]);
    c.fillRect(0, 0, 128, 128);
  });
}

export function drawNewBosses(scene: Phaser.Scene): void {
  octopus(scene);
  robot(scene);
  chicken(scene);
}
