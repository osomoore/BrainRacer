/**
 * Package G: turns WorldData into Phaser render objects + Matter bodies.
 * Ground = one Tilemap layer over a canvas tileset atlas; buildings = baked beveled blocks;
 * water/boundary/building/tree bodies are static; small props and parked cars are dynamic.
 */
import Phaser from 'phaser';
import { CAMERA, CAT, CITY_NIGHT_LIGHTING, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { roadTex, TEX } from '../core/assetKeys';
import { isQueuedMap, type QueuedMap } from '../config/queuedMaps';
import type { BodyOwner } from '../core/race';
import { Tile, type Prop, type RaceMap, type Rect, type WorldData } from '../core/types';
import { BUILDING_3D, ensureBodyTexture, ensureShadowTexture } from './buildingTex';
import { mergeRects, registerBuildingFootprints } from './geometry';
import { laterBuildingPolygons } from './laterBuildingFootprints';
import { addHarborWorld, harborRoadTile, harborSandTile } from './harborWorld';
import { addUndergroundWorld } from './undergroundWorld';
import { undergroundTileIndex, undergroundTileSource } from './undergroundTiles';
import { addSkyBuilding, addSkyWorld, skyTileIndex, skyTileSource } from './skyWorld';
import { addQueuedWorld, queuedWorldTileset } from './queuedWorlds';
import { FOREST_TILESET_KEY, addForestBuilding, addForestWorld, forestTileSource } from './forestWorld';
import { UNDERWATER_TILESET_KEY, addUnderwaterBuilding, addUnderwaterWorld, underwaterTileIndex, underwaterTileSource } from './underwaterWorld';
import { addUnderwaterProps } from './underwaterProps';
import {
  FARM_TILESET_COUNT, FARM_TILESET_KEY, addFarmBuilding, addFarmWorld, farmTileIndices, farmWorldTileSource,
  type FarmBlade, type FarmWorldHandle,
} from './farmWorld';
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
  update?(dt: number): void;
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
};

const TILESET_KEY = 'world_tileset';
const NIGHT_TILESET_KEY = 'world_tileset_night';
const HARBOR_TILESET_KEY = 'world_tileset_harbor';
const UNDERGROUND_TILESET_KEY = 'world_tileset_underground';
const WORLD_TILESETS = {
  sky: { key: 'world_tileset_sky', source: skyTileSource, index: skyTileIndex, building: addSkyBuilding },
  forest: { key: FOREST_TILESET_KEY, source: forestTileSource, index: tileIndex, building: addForestBuilding },
  underwater: { key: UNDERWATER_TILESET_KEY, source: underwaterTileSource, index: underwaterTileIndex, building: addUnderwaterBuilding },
};
const TS = 128, EXT = 2, CELL = TS + EXT * 2, COLS = 8;
/** Tileset index: 0 water, 1 grass, 2 sidewalk, 3 park, 4 plaza, 5 dirt, 6.. road masks. */
const TILE_KEYS: string[] = [
  TEX.tileWater, TEX.tileGrass, TEX.tileSidewalk, TEX.tilePark, TEX.tilePlaza, TEX.tileDirt,
  ...Array.from({ length: 16 }, (_, i) => roadTex(i)),
];
const ROAD_BASE = 6;
const PROP_STYLE_ORDER: Partial<Record<QueuedMap, readonly number[]>> = {
  castle: [3, 2, 9, 4, 1, 5, 6, 7, 8, 10, 11, 0], // banner, shield, pennants and other courtyard gear
  airport: [2, 5, 7, 10, 1, 4, 6, 8, 9, 11, 0, 3], // luggage, carts, ground-service equipment
};

function ensureTileset(scene: Phaser.Scene, industrial: boolean, night: boolean, farm: boolean, harbor: boolean, underground: boolean,
  themed?: (typeof WORLD_TILESETS)[keyof typeof WORLD_TILESETS]): string {
  const key = themed?.key ?? (underground ? UNDERGROUND_TILESET_KEY : harbor ? HARBOR_TILESET_KEY : farm ? FARM_TILESET_KEY : industrial ? INDUSTRIAL_TILESET_KEY : night ? NIGHT_TILESET_KEY : TILESET_KEY);
  if (scene.textures.exists(key)) return key;
  const tileCount = farm ? FARM_TILESET_COUNT : TILE_KEYS.length + (industrial ? INDUSTRIAL_SLAB_VARIANTS : 0);
  const rows = Math.ceil(tileCount / COLS);
  const tex = scene.textures.createCanvas(key, COLS * CELL, rows * CELL);
  if (!tex) throw new Error('tileset canvas failed');
  const ctx = tex.getContext();
  const drawTile = themed?.source(TS) ?? (underground ? undergroundTileSource(TS) : farm ? farmWorldTileSource(TS) : industrial ? industrialTileSource(TS) : undefined);
  for (let i = 0; i < tileCount; i++) {
    const src = harbor && i === 5 ? harborSandTile(TS)
      : harbor && i >= ROAD_BASE ? harborRoadTile(TS, i - ROAD_BASE)
      : drawTile ? drawTile(i) : scene.textures.get(TILE_KEYS[i]).getSourceImage() as CanvasImageSource;
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
    ctx.drawImage(src, cx + EXT, cy + EXT, TS, TS);
    // extrude edges to avoid seams at fractional zoom
    ctx.drawImage(src, 0, 0, 1, TS, cx, cy + EXT, EXT, TS);
    ctx.drawImage(src, TS - 1, 0, 1, TS, cx + EXT + TS, cy + EXT, EXT, TS);
    ctx.drawImage(src, 0, 0, TS, 1, cx + EXT, cy, TS, EXT);
    ctx.drawImage(src, 0, TS - 1, TS, 1, cx + EXT, cy + EXT + TS, TS, EXT);
  }
  if (night && !industrial) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = CITY_NIGHT_LIGHTING.groundTint;
    ctx.fillRect(0, 0, tex.width, tex.height);
    ctx.globalCompositeOperation = 'source-over';
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
    case Tile.Mud: return 5;   // farm worlds use farmTileIndices instead
    case Tile.Corn: return 3;
    case Tile.Road: return ROAD_BASE + (world.roadMask[i] & 15);
    default: return 1;
  }
}

function hashPos(x: number, y: number): number {
  return (Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)) >>> 0;
}

type BodyCfg = Phaser.Types.Physics.Matter.MatterBodyConfig;

export function buildWorld(scene: Phaser.Scene, world: WorldData, raceMap: RaceMap = 'city'): BuiltWorld {
  const night = raceMap === 'industrial';
  const harbor = raceMap === 'harbor';
  const underground = raceMap === 'underground';
  const themed = isQueuedMap(raceMap) ? queuedWorldTileset(raceMap)
    : raceMap === 'sky' || raceMap === 'forest' || raceMap === 'underwater' ? WORLD_TILESETS[raceMap] : undefined;
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
  const tilesetKey = ensureTileset(scene, world.industrial !== undefined, night, world.farm !== undefined, harbor, underground, themed);
  const farmTiles = world.farm ? farmTileIndices(world) : undefined;
  const mapTileIndex = themed?.index ?? (underground ? undergroundTileIndex : tileIndex);
  const data: number[][] = [];
  for (let y = 0; y < world.heightTiles; y++) {
    const row: number[] = [];
    for (let x = 0; x < world.widthTiles; x++) {
      const i = y * world.widthTiles + x;
      row.push(farmTiles ? farmTiles[i] : mapTileIndex(world, i));
    }
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
  const farmBlades: FarmBlade[] = [];
  const footprints = new Map<number, ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>>();
  for (const b of world.buildings) {
    const fx = b.tx * ts, fy = b.ty * ts, fw = b.tw * ts, fh = b.th * ts;
    const owner: BodyOwner = { kind: 'building', buildingId: b.id };
    if (world.farm || themed) {
      if (world.farm) addFarmBuilding(scene, world, b, objs, farmBlades);
      else themed?.building(scene, world, b, objs);
      const polygons = laterBuildingPolygons(raceMap, world, b);
      if (polygons) {
        footprints.set(b.id, polygons);
        for (const vertices of polygons) {
          const center = M.vertices.centre(vertices);
          const body = M.add.fromVertices(center.x, center.y, vertices, {
            ...staticOpts(owner), label: `world-building-${b.id}`,
          });
          rememberStaticBody(body, owner);
        }
      } else {
        addStaticRect(fx + fw / 2, fy + fh / 2, fw, fh, owner);
      }
      continue;
    }
    const sk = ensureShadowTexture(scene, fw, fh);
    const m = BUILDING_3D.shadowMargin;
    objs.push(scene.add.image(fx - m, fy - m, sk).setOrigin(0, 0).setDepth(DEPTH.decal - 1));
    const bk = ensureBodyTexture(scene, fw, fh, b.style);
    const building = scene.add.image(fx, fy, bk).setOrigin(0, 0).setDepth(DEPTH.building);
    if (world.industrial) building.setTint(INDUSTRIAL_BUILDING_TINT);
    else if (underground) building.setTint(0x9393bd);
    else if (night) building.setTint(CITY_NIGHT_LIGHTING.buildingTint);
    objs.push(building);
    addStaticRect(fx + fw / 2, fy + fh / 2, fw, fh, owner);
  }
  if (footprints.size) registerBuildingFootprints(world, footprints);

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
  let farmHandle: FarmWorldHandle | undefined;
  if (world.farm) {
    farmHandle = addFarmWorld(scene, world, objs, farmBlades,
      (x, y, w, h, owner, angle = 0) => addStaticRect(x, y, w, h, owner, angle),
      (x, y, radius, owner) => rememberStaticBody(M.add.circle(x, y, radius, staticOpts(owner)) as unknown as MatterJS.BodyType, owner));
  }
  if (harbor) addHarborWorld(scene, world, objs);
  let update: BuiltWorld['update'];
  if (underground) {
    const handle = addUndergroundWorld(scene, world, objs);
    update = dt => handle.update(dt);
  } else if (raceMap === 'sky') {
    const handle = addSkyWorld(scene, world, objs);
    update = dt => handle.update(dt);
  } else if (raceMap === 'forest') {
    const handle = addForestWorld(scene, world, objs,
      (x, y, radius) => rememberStaticBody(M.add.circle(x, y, radius, staticOpts(bnd)) as unknown as MatterJS.BodyType, bnd));
    update = dt => handle.update(dt);
  } else if (raceMap === 'underwater') {
    update = addUnderwaterWorld(scene, world, objs);
    addUnderwaterProps(scene, world, dynamicProps, bodies);
  } else if (isQueuedMap(raceMap)) {
    update = addQueuedWorld(scene, world, objs, raceMap);
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
  if (raceMap !== 'forest') {
    for (const [index, p] of world.props.entries()) addProp(scene, p, objs, dynamicProps, bodies, staticOpts, raceMap, index);
  }

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    dynamicProps, bodies,
    update,
    destroy() {
      farmHandle?.destroy();
      if (M.world) for (const b of bodies) M.world.remove(b);
      for (const o of [...dynamicProps, ...objs]) o.destroy();
      layer.destroy();
      map.destroy();
      bodies.length = 0; dynamicProps.length = 0; objs.length = 0;
    },
  };
}

function addProp(
  scene: Phaser.Scene, p: Prop, objs: Phaser.GameObjects.GameObject[], dyn: Phaser.GameObjects.GameObject[],
  bodies: MatterJS.BodyType[], staticOpts: (o: BodyOwner) => BodyCfg, raceMap: RaceMap, index: number,
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

  if (isQueuedMap(raceMap)) {
    const order = PROP_STYLE_ORDER[raceMap] ?? Array.from({ length: 12 }, (_, style) => style);
    const key = `queued_${raceMap}_prop_${order[index % order.length]}`;
    if (scene.textures.exists(key)) {
      const img = M.add.image(p.x, p.y, key, undefined,
        lightOpts({ type: 'circle', radius: 45 }, 0.7, 0.16));
      img.setScale(0.46).setRotation(p.angle).setDepth(DEPTH.prop);
      setOwner(img);
      dyn.push(img);
      return;
    }
  }

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
