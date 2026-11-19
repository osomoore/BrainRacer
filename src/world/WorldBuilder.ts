/**
 * Package G: turns WorldData into Phaser render objects + Matter bodies.
 * Ground = one Tilemap layer over a canvas tileset atlas; buildings = baked beveled blocks;
 * water/boundary/building/tree bodies are static; small props and parked cars are dynamic.
 */
import Phaser from 'phaser';
import { CAMERA, CAT, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { roadTex, sceneTex, TEX } from '../core/assetKeys';
import type { BodyOwner } from '../core/race';
import { Tile, type Prop, type Rect, type WorldData } from '../core/types';
import { signSceneFor } from '../data/places';
import { BUILDING_3D, bevelFor, ensureBodyTexture, ensureShadowTexture } from './buildingTex';
import { mergeRects } from './geometry';
import {
  INDUSTRIAL_BUILDING_TINT, INDUSTRIAL_SLAB_VARIANTS, INDUSTRIAL_TILESET_KEY, addIndustrialWorld, industrialTileSource,
} from './industrialWorld';

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
  treeRadius: 26,
  boundaryThickness: 600,
  bodyFriction: 0.02,   // low so cars slide along walls (frictionStatic is 0)
  lightMass: 0.4,
  lightFrictionAir: 0.2,
  parkedMass: 10,
  parkedFrictionAir: 0.15,
  signMax: 150,
  signMin: 90,
};

const TILESET_KEY = 'world_tileset';
const TS = 128, EXT = 2, CELL = TS + EXT * 2, COLS = 8;
/** Tileset index: 0 water, 1 grass, 2 sidewalk, 3 park, 4 plaza, 5 dirt, 6.. road masks. */
const TILE_KEYS: string[] = [
  TEX.tileWater, TEX.tileGrass, TEX.tileSidewalk, TEX.tilePark, TEX.tilePlaza, TEX.tileDirt,
  ...Array.from({ length: 16 }, (_, i) => roadTex(i)),
];
const ROAD_BASE = 6;

function ensureTileset(scene: Phaser.Scene, industrial: boolean): string {
  const key = industrial ? INDUSTRIAL_TILESET_KEY : TILESET_KEY;
  if (scene.textures.exists(key)) return key;
  const tileCount = TILE_KEYS.length + (industrial ? INDUSTRIAL_SLAB_VARIANTS : 0);
  const rows = Math.ceil(tileCount / COLS);
  const tex = scene.textures.createCanvas(key, COLS * CELL, rows * CELL);
  if (!tex) throw new Error('tileset canvas failed');
  const ctx = tex.getContext();
  const drawTile = industrial ? industrialTileSource(TS) : undefined;
  for (let i = 0; i < tileCount; i++) {
    const src = drawTile ? drawTile(i) : scene.textures.get(TILE_KEYS[i]).getSourceImage() as CanvasImageSource;
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
    ctx.drawImage(src, cx + EXT, cy + EXT, TS, TS);
    // extrude edges to avoid seams at fractional zoom
    ctx.drawImage(src, 0, 0, 1, TS, cx, cy + EXT, EXT, TS);
    ctx.drawImage(src, TS - 1, 0, 1, TS, cx + EXT + TS, cy + EXT, EXT, TS);
    ctx.drawImage(src, 0, 0, TS, 1, cx + EXT, cy, TS, EXT);
    ctx.drawImage(src, 0, TS - 1, TS, 1, cx + EXT, cy + EXT + TS, TS, EXT);
  }
  tex.refresh();
  return key;
}

function tileIndex(world: WorldData, i: number): number {
  switch (world.tiles[i] as Tile) {
    case Tile.Water: return 0;
    case Tile.Grass: return 1;
    case Tile.Sidewalk: return 2;
    case Tile.Building: return 2;
    case Tile.Park: return 3;
    case Tile.Plaza: {
      if (world.industrial) {
        const weighted = hashPos(i % world.widthTiles, Math.floor(i / world.widthTiles)) % 13;
        if (weighted < INDUSTRIAL_SLAB_VARIANTS) return TILE_KEYS.length + weighted;
      }
      return 4;
    }
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
  const rememberStaticBody = (b: MatterJS.BodyType, owner: BodyOwner) => {
    (b as unknown as { plugin: { owner: BodyOwner } }).plugin.owner = owner;
    bodies.push(b);
  };
  const addStaticRect = (cx: number, cy: number, w: number, h: number, owner: BodyOwner, angle = 0) => {
    rememberStaticBody(M.add.rectangle(cx, cy, w, h, { ...staticOpts(owner), angle }) as unknown as MatterJS.BodyType, owner);
  };

  // ── ground
  const tilesetKey = ensureTileset(scene, world.industrial !== undefined);
  const data: number[][] = [];
  for (let y = 0; y < world.heightTiles; y++) {
    const row: number[] = [];
    for (let x = 0; x < world.widthTiles; x++) row.push(tileIndex(world, y * world.widthTiles + x));
    data.push(row);
  }
  const map = scene.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
  const tileset = map.addTilesetImage('world', tilesetKey, TS, TS, EXT, EXT * 2);
  if (!tileset) throw new Error('tileset failed');
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('layer failed');
  layer.setDepth(DEPTH.ground);
  if (CAMERA.facingUp) {
    // Rotating cameras: Phaser culls tiles by the UNROTATED worldView, so pad by the rotated diagonal.
    const z = CAMERA.baseZoom - CAMERA.speedZoomOut - CAMERA.turboZoomOut - 0.1;
    const hw = GAME_WIDTH / 2 / z, hh = GAME_HEIGHT / 2 / z, r = Math.hypot(hw, hh);
    layer.setCullPadding(Math.ceil((r - hw) / ts) + 1, Math.ceil((r - hh) / ts) + 1);
  }

  // ── buildings: baked beveled-block body + baked soft shadow (one image each, no live Graphics)
  for (const b of world.buildings) {
    const fx = b.tx * ts, fy = b.ty * ts, fw = b.tw * ts, fh = b.th * ts;
    const sk = ensureShadowTexture(scene, fw, fh);
    const m = BUILDING_3D.shadowMargin;
    objs.push(scene.add.image(fx - m, fy - m, sk).setOrigin(0, 0).setDepth(DEPTH.decal - 1));
    const bk = ensureBodyTexture(scene, fw, fh, b.style);
    const building = scene.add.image(fx, fy, bk).setOrigin(0, 0).setDepth(DEPTH.building);
    if (world.industrial) building.setTint(INDUSTRIAL_BUILDING_TINT);
    objs.push(building);
    addStaticRect(fx + fw / 2, fy + fh / 2, fw, fh, { kind: 'building', buildingId: b.id });
    if (b.placeWord) {
      const bv = Math.min(bevelFor(b.style), Math.floor(Math.min(fw, fh) / 4));
      addSign(scene, fx + fw / 2, fy + fh / 2, fw - bv * 2, fh - bv * 2, b.placeWord, objs);
    }
  }

  // ── water + boundary bodies
  const water = new Uint8Array(world.widthTiles * world.heightTiles);
  for (let i = 0; i < water.length; i++) water[i] = world.tiles[i] === Tile.Water ? 1 : 0;
  for (const r of mergeRects(water, world.widthTiles, world.heightTiles)) {
    addStaticRect((r.x + r.w / 2) * ts, (r.y + r.h / 2) * ts, r.w * ts, r.h * ts, { kind: 'boundary' });
  }
  const T = L.boundaryThickness;
  const bnd: BodyOwner = { kind: 'boundary' };
  if (world.industrial) {
    addIndustrialWorld(scene, world.industrial, objs,
      (x, y, w, h, angle) => addStaticRect(x, y, w, h, bnd, angle),
      (x, y, radius) => rememberStaticBody(M.add.circle(x, y, radius, staticOpts(bnd)) as unknown as MatterJS.BodyType, bnd));
  }
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
      if (M.world) for (const b of bodies) M.world.remove(b);
      for (const o of [...dynamicProps, ...objs]) o.destroy();
      layer.destroy();
      map.destroy();
      bodies.length = 0; dynamicProps.length = 0; objs.length = 0;
    },
  };
}

function addSign(scene: Phaser.Scene, cx: number, cy: number, rw: number, rh: number, word: string, objs: Phaser.GameObjects.GameObject[]): void {
  const L = BUILDING_LOOK;
  const S = Phaser.Math.Clamp(Math.min(rw, rh) - 24, L.signMin, L.signMax);
  const frame = scene.add.image(cx, cy, TEX.signFrame).setDisplaySize(S, S).setDepth(DEPTH.sign);
  const pic = scene.add.image(cx, cy, sceneTex(signSceneFor(word)));
  pic.setScale((S * 0.87) / Math.max(pic.width, pic.height)).setDepth(DEPTH.sign + 0.1);
  objs.push(frame, pic);
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
