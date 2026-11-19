/**
 * Package G: turns WorldData into Phaser render objects + Matter bodies.
 * Ground = one Tilemap layer over a canvas tileset atlas; buildings = roofs with fake height;
 * water/boundary/building/tree bodies are static; small props and parked cars are dynamic.
 */
import Phaser from 'phaser';
import { CAT, DEPTH } from '../config/gameConfig';
import { roadTex, sceneTex, TEX } from '../core/assetKeys';
import type { BodyOwner } from '../core/race';
import { Tile, type BuildingLot, type Prop, type Rect, type WorldData } from '../core/types';
import { signSceneFor } from '../data/places';
import { mergeRects } from './geometry';

export interface BuiltWorld {
  /** World bounds in pixels. */
  bounds: Rect;
  /** Dynamic prop / parked-car game objects (for debugging or systems that want to scan them). */
  dynamicProps: Phaser.GameObjects.GameObject[];
  /** Static + dynamic Matter bodies created by the builder. */
  bodies: MatterJS.BodyType[];
  destroy(): void;
}

/** Tuning for the fake-3D building look and body setup (pixels). */
export const BUILDING_LOOK = {
  wallSouth: 24,        // visible south wall band height
  wallEast: 10,         // visible east wall band width
  shadowOffset: 22,
  shadowAlpha: 0.1,
  shadowLayers: 5,
  outline: 0x1d2236,
  wallSouthColor: 0x2c3148,
  wallEastColor: 0x3f4562,
  treeRadius: 26,
  boundaryThickness: 600,
  bodyFriction: 0.02,   // low so cars slide along walls (frictionStatic is 0)
  lightMass: 0.4,
  lightFrictionAir: 0.2,
  parkedMass: 10,
  parkedFrictionAir: 0.15,
  signMax: 150,
  signMin: 90,
  labelFont: 40,
};

const TILESET_KEY = 'world_tileset';
const TS = 128, EXT = 2, CELL = TS + EXT * 2, COLS = 8;
/** Tileset index: 0 water, 1 grass, 2 sidewalk, 3 park, 4 plaza, 5 dirt, 6.. road masks. */
const TILE_KEYS: string[] = [
  TEX.tileWater, TEX.tileGrass, TEX.tileSidewalk, TEX.tilePark, TEX.tilePlaza, TEX.tileDirt,
  ...Array.from({ length: 16 }, (_, i) => roadTex(i)),
];
const ROAD_BASE = 6;

function ensureTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return;
  const rows = Math.ceil(TILE_KEYS.length / COLS);
  const tex = scene.textures.createCanvas(TILESET_KEY, COLS * CELL, rows * CELL);
  if (!tex) throw new Error('tileset canvas failed');
  const ctx = tex.getContext();
  TILE_KEYS.forEach((key, i) => {
    const src = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
    ctx.drawImage(src, cx + EXT, cy + EXT, TS, TS);
    // extrude edges to avoid seams at fractional zoom
    ctx.drawImage(src, 0, 0, 1, TS, cx, cy + EXT, EXT, TS);
    ctx.drawImage(src, TS - 1, 0, 1, TS, cx + EXT + TS, cy + EXT, EXT, TS);
    ctx.drawImage(src, 0, 0, TS, 1, cx + EXT, cy, TS, EXT);
    ctx.drawImage(src, 0, TS - 1, TS, 1, cx + EXT, cy + EXT + TS, TS, EXT);
  });
  tex.refresh();
}

function tileIndex(world: WorldData, i: number): number {
  switch (world.tiles[i] as Tile) {
    case Tile.Water: return 0;
    case Tile.Grass: return 1;
    case Tile.Sidewalk: return 2;
    case Tile.Building: return 2;
    case Tile.Park: return 3;
    case Tile.Plaza: return 4;
    case Tile.Dirt: return 5;
    case Tile.Road: return ROAD_BASE + (world.roadMask[i] & 15);
    default: return 1;
  }
}

function hashPos(x: number, y: number): number {
  return (Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)) >>> 0;
}

type BodyCfg = Phaser.Types.Physics.Matter.MatterBodyConfig;

export function buildWorld(scene: Phaser.Scene, world: WorldData): BuiltWorld {
  const ts = world.tileSize;
  const W = world.widthTiles * ts, H = world.heightTiles * ts;
  const L = BUILDING_LOOK;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bodies: MatterJS.BodyType[] = [];
  const dynamicProps: Phaser.GameObjects.GameObject[] = [];
  const M = scene.matter;

  const staticOpts = (owner: BodyOwner): BodyCfg => ({
    isStatic: true, friction: L.bodyFriction, frictionStatic: 0, restitution: 0.2,
    collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 },
    plugin: { owner },
  } as BodyCfg);
  const addStaticRect = (cx: number, cy: number, w: number, h: number, owner: BodyOwner) => {
    const b = M.add.rectangle(cx, cy, w, h, staticOpts(owner)) as unknown as MatterJS.BodyType;
    (b as unknown as { plugin: { owner: BodyOwner } }).plugin.owner = owner;
    bodies.push(b);
  };

  // ── ground
  ensureTileset(scene);
  const data: number[][] = [];
  for (let y = 0; y < world.heightTiles; y++) {
    const row: number[] = [];
    for (let x = 0; x < world.widthTiles; x++) row.push(tileIndex(world, y * world.widthTiles + x));
    data.push(row);
  }
  const map = scene.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
  const tileset = map.addTilesetImage('world', TILESET_KEY, TS, TS, EXT, EXT * 2);
  if (!tileset) throw new Error('tileset failed');
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('layer failed');
  layer.setDepth(DEPTH.ground);

  // ── building shadows, walls (graphics) and roofs
  const shadowG = scene.add.graphics().setDepth(DEPTH.decal - 1);
  const wallG = scene.add.graphics().setDepth(DEPTH.building - 1);
  const trimG = scene.add.graphics().setDepth(DEPTH.building + 0.1);
  objs.push(shadowG, wallG, trimG);
  for (let k = L.shadowLayers; k >= 1; k--) {
    const grow = (k / L.shadowLayers) * 14, off = L.shadowOffset * (0.5 + 0.5 * (k / L.shadowLayers));
    shadowG.fillStyle(0x000000, L.shadowAlpha);
    for (const b of world.buildings) {
      shadowG.fillRoundedRect(b.tx * ts + off - grow * 0.4, b.ty * ts + off - grow * 0.4,
        b.tw * ts + grow * 0.8, b.th * ts + grow * 0.8, 10);
    }
  }
  for (const b of world.buildings) {
    const fx = b.tx * ts, fy = b.ty * ts, fw = b.tw * ts, fh = b.th * ts;
    const rw = fw - L.wallEast, rh = fh - L.wallSouth;
    wallG.fillStyle(L.wallSouthColor, 1).fillRect(fx, fy + rh, fw, L.wallSouth);
    wallG.fillStyle(L.wallEastColor, 1).fillRect(fx + rw, fy, L.wallEast, rh);
    wallG.fillStyle(0x000000, 0.25).fillRect(fx, fy + rh + L.wallSouth * 0.55, fw, L.wallSouth * 0.45);
    // window dots on the south wall
    wallG.fillStyle(0xbfd8ff, 0.55);
    for (let wx = fx + 28; wx < fx + fw - 28; wx += 44) wallG.fillRect(wx, fy + rh + 8, 18, 8);
    const roof = scene.add.tileSprite(fx + rw / 2, fy + rh / 2, rw, rh, TEX.roof[b.style % TEX.roof.length]).setDepth(DEPTH.building);
    objs.push(roof);
    trimG.lineStyle(5, L.outline, 1).strokeRect(fx + 2.5, fy + 2.5, rw - 5, rh - 5);
    trimG.lineStyle(2, 0xffffff, 0.28).strokeRect(fx + 8, fy + 8, rw - 16, rh - 16);
    trimG.lineStyle(4, L.outline, 1).strokeRect(fx, fy, fw, fh);
    addStaticRect(fx + fw / 2, fy + fh / 2, fw, fh, { kind: 'building', buildingId: b.id });
    if (b.placeWord) addSign(scene, b, rw, rh, ts, objs);
  }

  // ── water + boundary bodies
  const water = new Uint8Array(world.widthTiles * world.heightTiles);
  for (let i = 0; i < water.length; i++) water[i] = world.tiles[i] === Tile.Water ? 1 : 0;
  for (const r of mergeRects(water, world.widthTiles, world.heightTiles)) {
    addStaticRect((r.x + r.w / 2) * ts, (r.y + r.h / 2) * ts, r.w * ts, r.h * ts, { kind: 'boundary' });
  }
  const T = L.boundaryThickness;
  const bnd: BodyOwner = { kind: 'boundary' };
  addStaticRect(W / 2, -T / 2, W + 2 * T, T, bnd);
  addStaticRect(W / 2, H + T / 2, W + 2 * T, T, bnd);
  addStaticRect(-T / 2, H / 2, T, H, bnd);
  addStaticRect(W + T / 2, H / 2, T, H, bnd);

  // ── ramps (no bodies)
  for (const r of world.ramps) {
    objs.push(scene.add.image(r.x, r.y, TEX.ramp).setDisplaySize(r.w, r.h).setRotation(r.angle).setDepth(DEPTH.ramp));
  }

  // ── props
  for (const p of world.props) addProp(scene, p, objs, dynamicProps, bodies, staticOpts);

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    dynamicProps, bodies,
    destroy() {
      for (const b of bodies) M.world.remove(b);
      for (const o of [...dynamicProps, ...objs]) o.destroy();
      layer.destroy();
      map.destroy();
      bodies.length = 0; dynamicProps.length = 0; objs.length = 0;
    },
  };
}

function addSign(scene: Phaser.Scene, b: BuildingLot, rw: number, rh: number, ts: number, objs: Phaser.GameObjects.GameObject[]): void {
  const L = BUILDING_LOOK;
  const word = b.placeWord!;
  const label = word.toUpperCase().replace(' ', '\n');
  const lines = label.split('\n').length;
  const plateH = lines * (L.labelFont + 4) + 12;
  const cx = b.tx * ts + rw / 2, top = b.ty * ts;
  const S = Phaser.Math.Clamp(rh - plateH - 28, L.signMin, L.signMax);
  const sy = top + 12 + S / 2;
  const frame = scene.add.image(cx, sy, TEX.signFrame).setDisplaySize(S, S).setDepth(DEPTH.sign);
  const pic = scene.add.image(cx, sy, sceneTex(signSceneFor(word)));
  const fit = (S * 0.87) / Math.max(pic.width, pic.height);
  pic.setScale(fit).setDepth(DEPTH.sign + 0.1);
  const txt = scene.add.text(cx, 0, label, {
    fontFamily: 'Arial Black, Arial, sans-serif', fontSize: `${L.labelFont}px`, fontStyle: 'bold',
    color: '#1b2340', align: 'center',
  }).setOrigin(0.5, 0).setDepth(DEPTH.sign + 0.3);
  if (txt.width + 24 > rw - 8) txt.setScale((rw - 32) / txt.width);
  const plateW = Math.min(rw - 8, txt.width * txt.scaleX + 36);
  const py = sy + S / 2 + 8;
  txt.setY(py + 6);
  const plate = scene.add.graphics().setDepth(DEPTH.sign + 0.2);
  plate.fillStyle(0x000000, 0.25).fillRoundedRect(cx - plateW / 2 + 3, py + 4, plateW, plateH, 14);
  plate.fillStyle(0xfff4c2, 1).fillRoundedRect(cx - plateW / 2, py, plateW, plateH, 14);
  plate.lineStyle(4, 0x1b2340, 1).strokeRoundedRect(cx - plateW / 2, py, plateW, plateH, 14);
  objs.push(frame, pic, txt, plate);
}

function addProp(
  scene: Phaser.Scene, p: Prop, objs: Phaser.GameObjects.GameObject[], dyn: Phaser.GameObjects.GameObject[],
  bodies: MatterJS.BodyType[], staticOpts: (o: BodyOwner) => BodyCfg,
): void {
  const L = BUILDING_LOOK;
  const M = scene.matter;
  const setOwner = (img: Phaser.Physics.Matter.Image) => {
    const body = img.body as MatterJS.BodyType & { plugin: { owner?: BodyOwner } };
    body.plugin.owner = { kind: 'prop', prop: img };
    bodies.push(body);
  };
  const lightOpts = (shape: Phaser.Types.Physics.Matter.MatterSetBodyConfig, mass: number, air: number) => ({
    shape, friction: L.bodyFriction, frictionStatic: 0, frictionAir: air, restitution: 0.3,
    mass, collisionFilter: { category: CAT.prop, mask: 0xffff, group: 0 },
  }) as BodyCfg;

  switch (p.kind) {
    case 'bush':
      objs.push(scene.add.image(p.x, p.y, TEX.bush).setRotation(p.angle).setDepth(DEPTH.prop));
      return;
    case 'tree': {
      const img = M.add.image(p.x, p.y, TEX.tree, undefined, {
        shape: { type: 'circle', radius: L.treeRadius },
        ...staticOpts({ kind: 'boundary' }),
      } as BodyCfg);
      img.setStatic(true).setRotation(p.angle).setDepth(DEPTH.prop);
      setOwner(img);
      objs.push(img);
      return;
    }
    case 'lamp': case 'hydrant': case 'cone': case 'bench': {
      const key = TEX[p.kind];
      const tex = scene.textures.get(key).getSourceImage();
      const shape: Phaser.Types.Physics.Matter.MatterSetBodyConfig = p.kind === 'bench'
        ? { type: 'rectangle', width: tex.width, height: tex.height }
        : { type: 'circle', radius: tex.width / 2 };
      const img = M.add.image(p.x, p.y, key, undefined, lightOpts(shape, L.lightMass, L.lightFrictionAir));
      img.setRotation(p.angle).setDepth(DEPTH.prop);
      setOwner(img);
      dyn.push(img);
      return;
    }
    case 'parkedCar': {
      const key = TEX.traffic[hashPos(p.x, p.y) % TEX.traffic.length];
      const img = M.add.image(p.x, p.y, key, undefined, lightOpts({ type: 'rectangle', width: 62, height: 34 }, L.parkedMass, L.parkedFrictionAir));
      img.setRotation(p.angle).setDepth(DEPTH.prop);
      setOwner(img);
      dyn.push(img);
      return;
    }
  }
}
