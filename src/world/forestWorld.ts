import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, hash, makeCanvas, poly, radial, rr, wrap, type Ctx } from '../art/draw';
import { DEPTH, FOREST } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, type BuildingLot, type WorldData } from '../core/types';

export const FOREST_TILESET_KEY = 'world_tileset_forest';
const ROAD_BASE = 6;
const EDGES = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];
const FLOOR_COLORS = ['#171b37', '#232d3d', '#555068', '#1c303a', '#51495d', '#453943'];
const INK = '#171d30';
const MOONLIGHT = '#88b4bb';
const WARM = '#ffe69d';
const ROOFS = [
  ['#987385', '#4d4265', '#73464e'], ['#517688', '#344861', '#415266'], ['#a38364', '#674956', '#8c6758'],
  ['#558080', '#3a586e', '#52656a'], ['#846ca4', '#514465', '#665483'], ['#718d84', '#45596a', '#526354'],
] as const;

function rect(c: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function line(c: Ctx, color: string, width: number, points: number[]): void {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

/** Canvas source for the standard six terrain cells and sixteen road masks. */
export function forestTileSource(size: number): (index: number) => HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  return index => {
    const road = index >= ROAD_BASE;
    rect(c, road ? '#393951' : FLOOR_COLORS[index], 0, 0, size, size);
    for (let i = 0; i < 130; i++) {
      const x = Math.floor(hash(i, 0, index) * size), y = Math.floor(hash(i, 1, index) * size);
      const length = 2 + (i % 4);
      wrap(size, x, y, 5, (px, py) => rect(c, i % 3 ? '#bac2c016' : '#100f2557', px, py, length, 1));
    }
    if (road) {
      const mask = index - ROAD_BASE;
      const horizontal = (mask & (ROAD_E | ROAD_W)) === (ROAD_E | ROAD_W);
      const vertical = (mask & (ROAD_N | ROAD_S)) === (ROAD_N | ROAD_S);
      for (const [i, bit] of EDGES.entries()) {
        c.save();
        c.translate(size / 2, size / 2);
        c.rotate(i * Math.PI / 2);
        c.translate(-size / 2, -size / 2);
        if (!(mask & bit)) {
          rect(c, '#232840', 0, 0, size, 10);
          rect(c, '#68647e', 0, 8, size, 2);
          rect(c, '#aaa196', 0, 11, size, 2);
        } else if (i % 2 ? vertical && !horizontal : horizontal && !vertical) {
          for (const x of [17, 80]) rect(c, '#e2b775', x, 0, 26, 1.5);
        }
        c.restore();
      }
    } else if (index === 2 || index === 4) {
      for (let y = 0; y < size; y += 24) {
        rect(c, '#221e384d', 0, y, size, 2);
        for (let x = ((y / 24) % 2) * 14; x < size; x += 28) rect(c, '#241f3c52', x, y, 1, 24);
      }
    } else if (index === 1 || index === 3) {
      for (let i = 0; i < 9; i++) {
        const x = hash(i, 0, 11) * size, y = hash(i, 1, 11) * size;
        line(c, i % 3 ? '#585977' : '#647d75', 1.4, [x - 4, y - 4, x, y + 2, x + 3, y - 5]);
      }
    } else if (index === 0) {
      for (let i = 0; i < 7; i++) {
        const x = hash(i, 0, 16) * size, y = hash(i, 1, 16) * size;
        rect(c, '#64689b50', x, y, 8 + i % 4 * 3, 1);
      }
    }
    return canvas;
  };
}

function forestTexture(scene: Phaser.Scene, kind: string, w: number, h: number, draw: (c: Ctx) => void): string {
  const key = `forest-${kind}`;
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, w, h);
    draw(ctx);
    done();
  }
  return key;
}

function lampGlow(c: Ctx, x: number, y: number, radius: number, color: string): void {
  const gradient = radial(c, x, y, 0, radius, [[0, color + 'bd'], [.22, color + '69'], [.65, color + '22'], [1, color + '00']]);
  rect(c, gradient, x - radius, y - radius, radius * 2, radius * 2);
}

function addWindows(c: Ctx, w: number, h: number, alternate: boolean): void {
  const frame = (x: number, y: number, lit: boolean) => {
    if (lit) lampGlow(c, x + 9, y + 5, 23, '#f4af66');
    rr(c, x, y, 20, 11, 2);
    fillStroke(c, lit ? WARM : '#394357', '#352f46', 2);
    rect(c, '#755445', x + 9, y + 1, 2, 9);
  };
  for (let x = 23; x <= w - 43; x += 39) {
    const lit = (x + (alternate ? 1 : 0)) % 3 !== 0;
    frame(x, h - 22, lit);
    frame(x, 11, !lit || x % 2 === 0);
  }
}

/** Moonlit roof ridges and amber windows, with a reserved flat center for place signs. */
export function addForestBuilding(
  scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objs: Phaser.GameObjects.GameObject[],
): void {
  const ts = world.tileSize, fw = lot.tw * ts, fh = lot.th * ts;
  const x = lot.tx * ts, y = lot.ty * ts;
  const shadow = forestTexture(scene, 'roof-shadow', 100, 100, c => lampGlow(c, 50, 50, 50, '#0b1121'));
  objs.push(scene.add.image(x + fw / 2 + 15, y + fh / 2 + 15, shadow).setDisplaySize(fw + 100, fh + 100).setDepth(DEPTH.decal));
  const key = forestTexture(scene, `roof-${fw}x${fh}-${lot.style}`, fw, fh, c => {
    const [light, dark, wall] = ROOFS[lot.style];
    rr(c, 3, 3, fw - 6, fh - 6, 9);
    fillStroke(c, wall, INK, 6);
    addWindows(c, fw, fh, lot.style % 2 === 0);
    const eaves = 25;
    poly(c, [eaves, eaves, fw - eaves, eaves, fw - 11, fh / 2, fw - eaves, fh - eaves, eaves, fh - eaves, 11, fh / 2]);
    fillStroke(c, bodyGrad(c, 12, 12, fw - 24, fh - 24, light, dark), INK, 5);
    for (let row = eaves + 9; row < fh - eaves; row += 11) {
      const x0 = row < fh / 2 ? eaves - (row - eaves) * .13 : eaves - (fh - eaves - row) * .13;
      line(c, '#201d355c', 1.5, [x0 + 3, row, fw - x0 - 3, row]);
      for (let col = x0 + 8 + (row % 2) * 6; col < fw - x0 - 6; col += 18) {
        line(c, '#1c223b48', 1.1, [col, row, col, row - 9]);
      }
    }
    line(c, dark, 13, [29, fh / 2, fw - 29, fh / 2]);
    line(c, '#a3a6abcc', 2.6, [30, fh / 2 - 3, fw - 30, fh / 2 - 3]);
    if (lot.style % 3 !== 0) {
      rr(c, 30, fh / 2 - 32, 28, 28, 3);
      fillStroke(c, '#725a60', '#302f42', 3);
      rr(c, 35, fh / 2 - 27, 15, 15, 3);
      fillStroke(c, '#292a3e', '#c2998b', 2);
    }
  });
  objs.push(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.building).setName('forest-lantern-roof'));
}

function leaves(c: Ctx, x: number, y: number, radius: number, tint: string, dark: string, style: number): void {
  c.beginPath();
  const pieces = 40;
  for (let i = 0; i < pieces; i++) {
    const angle = i * Math.PI * 2 / pieces;
    const r = radius * (.78 + hash(i, y, style) * .2 + (i % 2 ? .1 : 0));
    c.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  c.closePath();
  fillStroke(c, bodyGrad(c, x - radius, y - radius, radius * 2, radius * 2, tint, dark), '#162a3a', 2);
  for (let i = 0; i < 7; i++) {
    const px = x + (hash(i, x, style) - .5) * radius;
    const py = y + (hash(i, y, style + 7) - .5) * radius;
    line(c, '#afccc74b', 2, [px - 3, py - 1, px + 2, py - 3, px + 5, py - 2]);
  }
}

function forestTree(scene: Phaser.Scene, style: number): string {
  return forestTexture(scene, `tree-${style}`, 180, 180, c => {
    lampGlow(c, 101, 103, 75, '#091826');
    line(c, '#4f4357', 20, [90, 90, 100, 103, 123, 114]);
    line(c, '#887289', 5, [90, 92, 103, 101, 126, 112]);
    const palette = [
      ['#476c71', '#253d54'], ['#586483', '#2d3e61'], ['#3b7581', '#274959'], ['#687683', '#414c68'],
    ];
    const [tint, dark] = palette[style];
    if (style < 2) {
      // Five uneven boughs around a dense round broadleaf crown.
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4;
        leaves(c, 77 + Math.cos(angle) * 30, 80 + Math.sin(angle) * 31, 33 + i % 3 * 3, tint, dark, i + style);
      }
      leaves(c, 75, 74, 33, tint, dark, style);
    } else {
      // Sharply pointed conifer sprays.
      for (const [x, y, r] of [[75, 81, 65], [75, 75, 51], [74, 65, 35]]) {
        const points: number[] = [];
        for (let i = 0; i < 20; i++) {
          const angle = i * Math.PI / 10, radius = i % 2 ? r * .64 : r;
          points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        }
        poly(c, points);
        fillStroke(c, bodyGrad(c, x - r, y - r, 2 * r, 2 * r, tint, dark), '#193843', 2.3);
      }
      line(c, '#a5c3bb83', 3, [65, 60, 74, 49, 80, 58]);
    }
  });
}

function forestBramble(scene: Phaser.Scene): string {
  return forestTexture(scene, 'bramble', 83, 78, c => {
    for (const [x, y, r] of [[22, 45, 18], [42, 35, 25], [57, 48, 19]]) {
      leaves(c, x, y, r, '#596877', '#303d52', x);
      for (const [dx, dy] of [[-7, 4], [5, 7], [3, -4]]) {
        ellipse(c, x + dx, y + dy, 2.3, 2.1);
        fillStroke(c, '#df94a3', null);
      }
    }
  });
}

interface ForestShrub {
  x: number;
  y: number;
  angle: number;
  length: number;
  image: Phaser.GameObjects.Image;
  scatter?: { angle: number; elapsed: number };
}

const forestShrubs = new WeakMap<Phaser.Scene, ForestShrub[]>();
export function getForestShrubs(scene: Phaser.Scene): ForestShrub[] { return forestShrubs.get(scene) ?? []; }

function forestLamp(scene: Phaser.Scene): string {
  return forestTexture(scene, 'street-lamp', 200, 200, c => {
    lampGlow(c, 100, 100, 99, '#fcbd7a');
    ellipse(c, 104, 107, 20, 15);
    fillStroke(c, '#392d4490', null);
    const lantern = [99, 83, 113, 94, 112, 107, 100, 116, 87, 108, 87, 94];
    poly(c, lantern); fillStroke(c, '#766281', '#2a2639', 4);
    poly(c, [100, 88, 108, 96, 108, 104, 100, 110, 92, 104, 92, 96]);
    fillStroke(c, WARM, '#be8c67', 2);
    ellipse(c, 100, 100, 4, 4); fillStroke(c, '#fff7db', null);
  });
}

/** Skyline scenery driven by the race clock. Town roads stay bright enough for split screen. */
export function addForestWorld(
  scene: Phaser.Scene, world: WorldData, objs: Phaser.GameObjects.GameObject[],
  addTreeBody: (x: number, y: number, radius: number) => void,
) {
  const rng = new Rng(world.seed ^ 0x464f5245);
  const treeKeys = Array.from({ length: 4 }, (_, i) => forestTree(scene, i));
  const bush = forestBramble(scene), lamp = forestLamp(scene);
  const shrubs: ForestShrub[] = [];
  forestShrubs.set(scene, shrubs);
  for (const prop of world.props) {
    const tree = prop.kind === 'tree', lantern = prop.kind === 'lamp';
    const key = lantern ? lamp : tree ? rng.pick(treeKeys) : bush;
    const scale = lantern ? 1 : tree ? rng.range(.81, 1.36) : rng.range(...FOREST.shrubScale);
    const image = scene.add.image(prop.x, prop.y, key).setScale(scale).setRotation(prop.angle)
      .setDepth(lantern ? DEPTH.decal - 1 : DEPTH.prop)
      .setName(lantern ? 'forest-lantern' : tree ? 'forest-tree' : 'forest-bramble');
    objs.push(image);
    if (tree) addTreeBody(prop.x, prop.y, FOREST.treeRadius * scale);
    if (prop.kind === 'bush') shrubs.push({ ...prop, length: 0, image });
  }

  const firefly = forestTexture(scene, 'firefly-light', 40, 40, c => {
    lampGlow(c, 20, 20, 20, '#d2f1a0');
    ellipse(c, 20, 20, 3.6, 3.3);
    fillStroke(c, '#fdf6b4', null);
    line(c, MOONLIGHT, .8, [20, 16, 18, 15]);
  });
  const glades = rng.shuffle(world.props.filter(prop => prop.kind === 'tree')).slice(0, FOREST.fireflyCount);
  const fireflies = glades.map(({ x, y }) => {
    const image = scene.add.image(x, y, firefly).setDepth(DEPTH.prop + 1).setName('forest-firefly');
    objs.push(image);
    return { x, y, phase: rng.range(0, 2 * Math.PI), speed: rng.range(.5, 1.6), image };
  });
  let elapsed = 0;
  const update = (dt: number) => {
    elapsed += dt;
    for (const { x, y, phase, speed, image } of fireflies) {
      const t = elapsed * speed + phase;
      image.setPosition(x + FOREST.fireflyDrift * Math.cos(t), y + FOREST.fireflyDrift * Math.sin(t * .72))
        .setAlpha(.22 + .76 * Math.pow((1 + Math.cos(t * 2)) / 2, 2));
    }
  };
  update(0);
  return { update };
}
