/**
 * Farm renderer (package farm-render): the farm tileset (country roads, two-track dirt lanes, corn
 * rows, water banks), farm buildings over their BuildingLots, decorations, fences with bodies,
 * rotating windmill / turbine blades and long low-sun shadows for every caster.
 * Everything is a static baked image (no live Graphics); shadows live in world space so they turn
 * with each player's rotating camera like the buildings do.
 */
import type Phaser from 'phaser';
import { FARM_TILE, farmTileSource } from '../art/farm';
import { hash, makeCanvas, type Ctx } from '../art/draw';
import { DEPTH, FARM_LOOK } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { BodyOwner } from '../core/race';
import { FARM_LANE_BASE, centerSides } from './farmGround';
import {
  ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile,
  type BuildingLot, type FarmDecoration, type FarmLayout, type WorldData,
} from '../core/types';
import { ensureBodyTexture, ensureCastShadow, type CastShadow } from './buildingTex';

export const FARM_TILESET_KEY = 'world_tileset_farm';
export { FARM_TILESET_COUNT, farmTileIndices } from './farmGround';

type AddRect = (x: number, y: number, w: number, h: number, owner: BodyOwner, angle?: number) => void;
type AddCircle = (x: number, y: number, radius: number, owner: BodyOwner) => void;
type Objs = Phaser.GameObjects.GameObject[];

const H = FARM_LOOK.heights;
const S = 128;

// ───────────────────────────── tileset ─────────────────────────────

function paint(ctx: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Run fn in a frame rotated so the given side (0 N, 1 E, 2 S, 3 W) is the top edge. */
function onSide(ctx: Ctx, side: number, fn: () => void): void {
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(side * Math.PI / 2);
  ctx.translate(-S / 2, -S / 2);
  fn();
  ctx.restore();
}

const SIDES = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];

/** Paved country road, half of a 2-tile strip: gravel shoulder on outer edges, dashed yellow center. */
function drawCountryRoad(ctx: Ctx, mask: number): void {
  paint(ctx, '#6b6a72', 0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(hash(i, 1, 7) * S), y = Math.floor(hash(i, 2, 7) * S);
    paint(ctx, hash(i, 3, 7) < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(30,20,20,0.15)', x, y, 2, 2);
  }
  const center = centerSides(mask);
  for (let side = 0; side < 4; side++) {
    onSide(ctx, side, () => {
      if (!(mask & SIDES[side])) {
        paint(ctx, '#d6bf8a', 0, 0, S, 13);                       // gravel shoulder
        for (let i = 0; i < 26; i++) paint(ctx, i % 2 ? '#b9a06b' : '#ecdcb0', hash(i, side, 11) * S, 2 + hash(i, 9, 11) * 9, 3, 2);
        paint(ctx, '#4f4e55', 0, 13, S, 2);                       // asphalt lip
        paint(ctx, '#f2e6c4', 0, 19, S, 4);                       // pale edge line
      } else if (center[side]) {
        // Each tile paints half of the shared dashed center line.
        for (let x = 16; x < S; x += 64) paint(ctx, '#ffd23a', x, 0, 32, 3);
      }
    });
  }
}

/** Two-track dirt lane: wheel rut along the tile, a grassy hump on the shared center, soft berms outside. */
function drawDirtLane(ctx: Ctx, base: HTMLCanvasElement, mask: number): void {
  ctx.drawImage(base, 0, 0, S, S);
  const center = centerSides(mask);
  const horiz = center[0] || center[2], vert = center[1] || center[3];
  const rut = (alongX: boolean) => {
    ctx.save();
    if (!alongX) { ctx.translate(S, 0); ctx.rotate(Math.PI / 2); }
    paint(ctx, 'rgba(110,74,40,0.35)', 0, S / 2 - 13, S, 26);
    paint(ctx, 'rgba(90,58,30,0.35)', 0, S / 2 - 7, S, 14);
    for (let i = 0; i < 18; i++) paint(ctx, 'rgba(240,210,160,0.45)', hash(i, 1, 12) * S, S / 2 - 6 + hash(i, 2, 12) * 12, 5, 1.5);
    ctx.restore();
  };
  if (horiz) rut(true);
  if (vert) rut(false);
  for (let side = 0; side < 4; side++) {
    onSide(ctx, side, () => {
      if (!(mask & SIDES[side])) {
        // soft berm + a fringe of grass tufts creeping onto the lane
        paint(ctx, 'rgba(120,84,46,0.35)', 0, 0, S, 10);
        for (let i = 0; i < 30; i++) {
          const x = hash(i, side, 13) * S, h = 4 + hash(i, 5, 13) * 8;
          paint(ctx, i % 2 ? '#6aa63a' : '#86bf4c', x, 0, 3, h);
        }
      } else if (center[side]) {
        // grassy hump between the wheel tracks (half on each tile)
        paint(ctx, '#7aa846', 0, 0, S, 5);
        for (let i = 0; i < 26; i++) paint(ctx, i % 2 ? '#5f9a35' : '#9ccf5a', hash(i, side, 14) * S, 0, 3, 3 + hash(i, 6, 14) * 6);
      }
    });
  }
}

/** Base grass plus clover tufts, or a scatter of buttercups and daisies. */
function drawGrassDetail(ctx: Ctx, base: HTMLCanvasElement, flowers: boolean): void {
  ctx.drawImage(base, 0, 0, S, S);
  const seed = flowers ? 33 : 34;
  for (let i = 0; i < (flowers ? 9 : 6); i++) {
    const x = 10 + hash(i, 1, seed) * (S - 20), y = 10 + hash(i, 2, seed) * (S - 20);
    if (flowers) {
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#ffd84a';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = i % 3 === 0 ? '#ffc53a' : '#e09a1a';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(70,130,45,0.45)';
      for (let p = 0; p < 3; p++) {
        const a = (p / 3) * Math.PI * 2 + i;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 3.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

/**
 * One detached canvas reused by WorldBuilder for each atlas cell: the art's farm tiles, with the
 * single-tile city-style road masks swapped for 2-tile country-road halves, plus lane masks.
 */
export function farmWorldTileSource(size: number): (index: number) => HTMLCanvasElement {
  const art = farmTileSource(size);
  const lane = document.createElement('canvas');
  lane.width = lane.height = S;
  lane.getContext('2d')!.drawImage(art(FARM_TILE.dirtLane), 0, 0, S, S);
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d')!;
  return (index) => {
    const isRoad = index >= FARM_TILE.roadBase && index < FARM_TILE.roadBase + 16;
    const isGrassVariant = index === FARM_TILE.grass2 || index === FARM_TILE.grass3;
    if (!isRoad && !isGrassVariant && index < FARM_LANE_BASE) return art(index);
    ctx.setTransform(size / S, 0, 0, size / S, 0, 0);
    ctx.clearRect(0, 0, S, S);
    // Grass variants share the base tone (no checkerboard across the meadows) and only add details.
    if (isGrassVariant) drawGrassDetail(ctx, art(FARM_TILE.grass), index === FARM_TILE.grass3);
    else if (isRoad) drawCountryRoad(ctx, index - FARM_TILE.roadBase);
    else drawDirtLane(ctx, lane, index - FARM_LANE_BASE);
    return tile;
  };
}

// ───────────────────────────── shadows ─────────────────────────────

type ShadowShape = Pick<CastShadow, 'w' | 'h' | 'shape' | 'rotation' | 'fade' | 'blur' | 'alpha'>;

/** Long low-sun shadow for a caster of `height` px standing on its footprint (optionally lifted from `base`). */
function castShadow(scene: Phaser.Scene, farm: FarmLayout, objs: Objs, x: number, y: number, s: ShadowShape, height: number, base = 0): void {
  const L = farm.shadowLength;
  const t = ensureCastShadow(scene, {
    alpha: FARM_LOOK.shadowAlpha, blur: FARM_LOOK.shadowBlur, color: FARM_LOOK.shadowColor, fade: FARM_LOOK.shadowFade,
    ...s, angle: farm.shadowAngle, length: Math.max(1, (height - base) * L), start: base * L,
  });
  objs.push(scene.add.image(x, y, t.key).setOrigin(t.ox / t.tw, t.oy / t.th).setDepth(FARM_LOOK.shadowDepth));
}

/** Lollipop shadow for a tree: thin trunk line, then the canopy blob far out along the sun line. */
function treeShadow(scene: Phaser.Scene, farm: FarmLayout, objs: Objs, x: number, y: number, canopy: number, trunk: number, top: number): void {
  castShadow(scene, farm, objs, x, y, { w: 10, h: 10, shape: 'ellipse' }, trunk + canopy * 0.2);
  castShadow(scene, farm, objs, x, y, { w: canopy, h: canopy, shape: 'ellipse', fade: 0.25 }, top, trunk);
}

/** Corn walls: gradient strips just beyond the field edges that face the sun's far side (tileable, no blur seams). */
function cornEdgeShadows(scene: Phaser.Scene, world: WorldData, farm: FarmLayout, objs: Objs): void {
  const len = H.corn * farm.shadowLength;
  const dx = Math.cos(farm.shadowAngle) * len, dy = Math.sin(farm.shadowAngle) * len;
  const strips: { key: string; along: 'x' | 'y'; d: number }[] = [];
  const bake = (key: string, d: number, alongX: boolean) => {
    const w = alongX ? Math.ceil(Math.abs(d)) : S, h = alongX ? S : Math.ceil(Math.abs(d));
    if (!scene.textures.exists(key)) {
      const { ctx, done } = makeCanvas(scene, key, w, h);
      const toPos = d > 0;
      const g = alongX ? ctx.createLinearGradient(toPos ? 0 : w, 0, toPos ? w : 0, 0) : ctx.createLinearGradient(0, toPos ? 0 : h, 0, toPos ? h : 0);
      const c = FARM_LOOK.shadowColor;
      g.addColorStop(0, hexA(c, FARM_LOOK.shadowAlpha * 1.1));
      g.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      done();
    }
  };
  if (Math.abs(dx) >= 4) { strips.push({ key: `farm_cornshadow_x${Math.round(dx)}`, along: 'x', d: dx }); bake(strips[strips.length - 1].key, dx, true); }
  if (Math.abs(dy) >= 4) { strips.push({ key: `farm_cornshadow_y${Math.round(dy)}`, along: 'y', d: dy }); bake(strips[strips.length - 1].key, dy, false); }
  const W = world.widthTiles, Hh = world.heightTiles, ts = world.tileSize;
  const isCorn = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hh && world.tiles[y * W + x] === Tile.Corn;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (!isCorn(x, y)) continue;
    for (const s of strips) {
      const sx = s.along === 'x' ? Math.sign(s.d) : 0, sy = s.along === 'y' ? Math.sign(s.d) : 0;
      if (isCorn(x + sx, y + sy)) continue;
      const px = s.along === 'x' ? (s.d > 0 ? (x + 1) * ts : x * ts + s.d) : x * ts;
      const py = s.along === 'y' ? (s.d > 0 ? (y + 1) * ts : y * ts + s.d) : y * ts;
      const img = scene.add.image(px, py, s.key).setOrigin(0).setDepth(FARM_LOOK.shadowDepth);
      if (s.along === 'x') img.setDisplaySize(Math.abs(s.d), ts); else img.setDisplaySize(ts, Math.abs(s.d));
      objs.push(img);
    }
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ───────────────────────────── blades ─────────────────────────────

export interface FarmBlade { img: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; phase: number; secPerTurn: number }

/** Blurred black silhouette of a blade sprite (its rotating ground shadow). */
function bladeShadowKey(scene: Phaser.Scene, src: string): string {
  const key = `${src}_shadow`;
  if (scene.textures.exists(key)) return key;
  const img = scene.textures.get(src).getSourceImage() as HTMLCanvasElement;
  const pad = 8;
  const { ctx, done } = makeCanvas(scene, key, img.width + pad * 2, img.height + pad * 2);
  ctx.filter = 'blur(3px)';
  ctx.drawImage(img, pad, pad);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = hexA(FARM_LOOK.shadowColor, FARM_LOOK.shadowAlpha * 0.9);
  ctx.fillRect(0, 0, img.width + pad * 2, img.height + pad * 2);
  done();
  return key;
}

function addBlade(
  scene: Phaser.Scene, world: WorldData, objs: Objs, blades: FarmBlade[], x: number, y: number,
  tex: string, size: number, hubHeight: number, secPerTurn: number,
): void {
  const farm = world.farm!;
  const reach = hubHeight * farm.shadowLength;
  const sx = x + Math.cos(farm.shadowAngle) * reach, sy = y + Math.sin(farm.shadowAngle) * reach;
  // A blade shadow falling past the map edge (east turbine row) would hang over the background.
  const inside = sx > 0 && sy > 0 && sx < world.widthTiles * world.tileSize && sy < world.heightTiles * world.tileSize;
  let shadow: Phaser.GameObjects.Image | undefined;
  if (inside) {
    const src = scene.textures.get(tex).getSourceImage() as HTMLCanvasElement;
    shadow = scene.add.image(sx, sy, bladeShadowKey(scene, tex)).setDepth(FARM_LOOK.shadowDepth).setScale(size / src.width);
    objs.push(shadow);
  }
  const img = scene.add.image(x, y, tex).setDisplaySize(size, size).setDepth(FARM_LOOK.bladeDepth).setTint(FARM_LOOK.decorTint);
  objs.push(img);
  blades.push({ img, shadow, phase: hash(x | 0, y | 0, 5) * Math.PI * 2, secPerTurn });
}

// ───────────────────────────── buildings ─────────────────────────────

/** Composite looks so each farm building fills its square BuildingLot (physics = the lot). */
function compositeKey(scene: Phaser.Scene, key: string, w: number, h: number, parts: [string, number, number, number, number][]): string {
  if (scene.textures.exists(key)) return key;
  const { ctx, done } = makeCanvas(scene, key, w, h);
  for (const [tex, x, y, pw, ph] of parts) ctx.drawImage(scene.textures.get(tex).getSourceImage() as CanvasImageSource, x, y, pw, ph);
  done();
  return key;
}

/** Rotation (multiple of 90°) that turns a look's local +y side toward the lot's road front. */
function faceFront(world: WorldData, lot: BuildingLot, cx: number, cy: number): number {
  const place = world.places.find((p) => p.buildingId === lot.id);
  if (!place) return 0;
  const a = Math.atan2(place.front.y - cy, place.front.x - cx) - Math.PI / 2;
  return Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
}

const SIGNED_LOOKS: Record<string, string> = { well: 'well', lake: 'boathouse', campsite: 'campsite', cave: 'cave', forest: 'pines' };

/**
 * Draws a farm BuildingLot and its long shadow (the body and picture sign stay with WorldBuilder).
 * Village lots without a farm look get the city's beveled roofs.
 */
export function addFarmBuilding(scene: Phaser.Scene, world: WorldData, lot: BuildingLot, objs: Objs, blades: FarmBlade[]): void {
  const farm = world.farm!;
  const ts = world.tileSize;
  const fx = lot.tx * ts, fy = lot.ty * ts, fw = lot.tw * ts, fh = lot.th * ts;
  const cx = fx + fw / 2, cy = fy + fh / 2;
  const deco = farm.decorations.find((d) => d.buildingId === lot.id);
  const tint = FARM_LOOK.decorTint;
  const K = TEX.farm;
  // Long side of a 2×1 lot runs along local x.
  const turned = fh > fw;
  const lw = turned ? fh : fw, lh = turned ? fw : fh;
  const baseRot = turned ? Math.PI / 2 : 0;
  const img = (key: string, x: number, y: number, w: number, h: number, rot: number, depth: number = DEPTH.building) => {
    const o = scene.add.image(x, y, key).setDisplaySize(w, h).setRotation(rot).setDepth(depth).setTint(tint);
    objs.push(o);
    return o;
  };
  const box = (height: number, w = fw, h = fh, shape: 'rect' | 'ellipse' = 'rect', x = cx, y = cy) =>
    castShadow(scene, farm, objs, x, y, { w, h, shape }, height);

  switch (deco?.kind) {
    case 'barn': {
      const rot = faceFront(world, lot, cx, cy) + Math.PI; // lean-to away from the road, barn doors toward it
      const key = compositeKey(scene, 'farm_lot_barn', 384, 384, [[K.leanTo, 0, 256, 384, 128], [K.barn, 0, 0, 384, 256]]);
      img(key, cx, cy, fw, fh, rot);
      // barn body (top 2/3 of the look) + low lean-to (bottom 1/3), as two casters
      const at = (v: number): [number, number] => [cx - Math.sin(rot) * v, cy + Math.cos(rot) * v];
      castShadow(scene, farm, objs, ...at(-fh / 6), { w: fw, h: fh * 2 / 3, rotation: rot }, H.barn);
      castShadow(scene, farm, objs, ...at(fh / 3), { w: fw, h: fh / 3, rotation: rot }, H.leanTo);
      return;
    }
    case 'farmhouse': {
      const rot = faceFront(world, lot, cx, cy);
      const key = compositeKey(scene, 'farm_lot_farmhouse', 256, 256, [[K.porch, 0, 192, 256, 64], [K.farmhouse, 0, 0, 256, 192]]);
      img(key, cx, cy, fw, fh, rot);
      box(H.farmhouse, fw * 0.95, fh * 0.75);
      return;
    }
    case 'silo': {
      img(K.pad, cx, cy, fw, fh, 0, DEPTH.building - 0.2);
      img(K.silo, cx, cy, fw * 0.86, fh * 0.86, 0);
      box(H.silo, fw * 0.8, fh * 0.8, 'ellipse');
      box(H.pad, fw, fh);
      return;
    }
    case 'shed': {
      // shed on one tile, a gravel bay with the farm tractor on the other
      const ux = Math.cos(baseRot) * ts / 2, uy = Math.sin(baseRot) * ts / 2;
      img(K.pad, cx, cy, lw, lh, baseRot, DEPTH.building - 0.2);
      img(K.shed, cx - ux, cy - uy, ts, ts, baseRot);
      img(K.tractor, cx + ux, cy + uy, 80, 56, baseRot + Math.PI / 2, DEPTH.building - 0.1);
      castShadow(scene, farm, objs, cx - ux, cy - uy, { w: ts, h: ts }, H.shed);
      castShadow(scene, farm, objs, cx + ux, cy + uy, { w: 56, h: 80 - 20, rotation: baseRot }, 30);
      return;
    }
    case 'windmill': {
      img(K.windmillBase, cx, cy, fw, fh, 0, DEPTH.building - 0.3);
      const body = FARM_LOOK.windmillBodyPx;
      img(K.windmill, cx, cy, body, body, 0);
      box(H.windmill, body * 0.8, body * 0.8, 'ellipse');
      addBlade(scene, world, objs, blades, cx, cy, K.windmillBlade, 256 * FARM_LOOK.windmillBladeScale, H.windmill, FARM_LOOK.windmillSecPerTurn);
      return;
    }
    case 'windTurbine': {
      img(K.pad, cx, cy, fw, fh, 0, DEPTH.building - 0.2);
      addTurbine(scene, world, objs, blades, cx, cy);
      return;
    }
    default: break;
  }
  const look = lot.placeWord ? SIGNED_LOOKS[lot.placeWord] : undefined;
  if (look) {
    const key = (K as Record<string, unknown>)[look] as string;
    switch (look) {
      case 'well': img(key, cx, cy, fw, fh, 0); box(H.well, fw * 0.6, fh * 0.6, 'ellipse'); return;
      case 'campsite': img(key, cx, cy, fw, fh, faceFront(world, lot, cx, cy)); box(H.campsite, fw * 0.6, fh * 0.4, 'ellipse'); return;
      case 'cave': img(key, cx, cy, fw, fh, faceFront(world, lot, cx, cy)); box(H.cave, fw * 0.85, fh * 0.85, 'ellipse'); return;
      case 'pines': {
        img(key, cx, cy, lw, lh, baseRot);
        const ux = Math.cos(baseRot), uy = Math.sin(baseRot);
        for (const [u, v, r] of [[-68, -2, 52], [12, -18, 42], [70, 10, 48]] as const) {
          treeShadow(scene, farm, objs, cx + u * ux - v * uy, cy + u * uy + v * ux, r * 1.7, 30, H.pines);
        }
        return;
      }
      case 'boathouse': {
        const rot = turned ? faceFront(world, lot, cx, cy) : baseRot;
        img(key, cx, cy, lw, lh, rot);
        box(H.boathouse, fw * 0.6, fh * 0.6);
        return;
      }
    }
  }
  // Village houses, shops, bakery, school: the city's beveled roofs with a long farm shadow.
  const bk = ensureBodyTexture(scene, fw, fh, lot.style);
  objs.push(scene.add.image(fx, fy, bk).setOrigin(0, 0).setDepth(DEPTH.building).setTint(tint));
  box(H.village);
}

function addTurbine(scene: Phaser.Scene, world: WorldData, objs: Objs, blades: FarmBlade[], x: number, y: number): void {
  const farm = world.farm!;
  const k = FARM_LOOK.turbineScale;
  // long thin tower shadow, then the nacelle and the rotating blade shadow at its tip
  castShadow(scene, farm, objs, x, y, { w: 16, h: 16, shape: 'ellipse', fade: 0.2, blur: 4 }, H.turbine);
  objs.push(scene.add.image(x, y, TEX.farm.turbine).setScale(k).setDepth(DEPTH.building).setTint(FARM_LOOK.decorTint));
  addBlade(scene, world, objs, blades, x, y, TEX.farm.turbineBlade, 224 * k, H.turbine, FARM_LOOK.turbineSecPerTurn);
}

// ───────────────────────────── decorations ─────────────────────────────

function addDecoration(
  scene: Phaser.Scene, world: WorldData, d: FarmDecoration, objs: Objs, blades: FarmBlade[], addRect: AddRect, addCircle: AddCircle,
): void {
  const farm = world.farm!;
  const K = TEX.farm, tint = FARM_LOOK.decorTint;
  const bnd: BodyOwner = { kind: 'boundary' };
  const { x, y, w, h, angle } = d;
  switch (d.kind) {
    case 'streamBridge': {
      // Deck spans the 2-tile stream and the banks; rails sit just outside the road strip.
      const dw = w * 1.45, dh = h * 1.12;
      castShadow(scene, farm, objs, x, y, { w: dw, h: dh, rotation: angle, fade: 0 }, H.bridge);
      objs.push(scene.add.image(x, y, K.bridge).setDisplaySize(dw, dh).setRotation(angle).setDepth(FARM_LOOK.bridgeDepth).setTint(tint));
      return;
    }
    case 'hayBale': {
      const round = hash(x | 0, y | 0, 3) < 0.55;
      if (round) {
        const s = w * 0.82;
        castShadow(scene, farm, objs, x, y, { w: s, h: s, shape: 'ellipse' }, H.hay);
        objs.push(scene.add.image(x, y, K.hayRound).setDisplaySize(s, s).setRotation(hash(x | 0, y | 0, 4) * 6.28).setDepth(DEPTH.prop).setTint(tint));
        addCircle(x, y, s * 0.46, bnd);
      } else {
        const rot = hash(x | 0, y | 0, 4) < 0.5 ? 0 : Math.PI / 2;
        const bw = w * 0.95, bh = w * 0.6;
        castShadow(scene, farm, objs, x, y, { w: bw, h: bh, rotation: rot }, H.hay);
        objs.push(scene.add.image(x, y, K.haySquare).setDisplaySize(bw, bh).setRotation(rot).setDepth(DEPTH.prop).setTint(tint));
        addRect(x, y, bw * 0.95, bh * 0.9, bnd, rot);
      }
      return;
    }
    case 'orchardTree': {
      const s = w * 1.05;
      treeShadow(scene, farm, objs, x, y, s * 0.85, H.orchardTrunk, H.orchardTop);
      objs.push(scene.add.image(x, y, K.orchardTree).setDisplaySize(s, s).setRotation(hash(x | 0, y | 0, 6) * 6.28).setDepth(FARM_LOOK.canopyDepth).setTint(tint));
      addCircle(x, y, w * 0.3, bnd);
      return;
    }
    case 'windTurbine':
      if (d.buildingId !== undefined) return; // drawn with its lot
      addTurbine(scene, world, objs, blades, x, y);
      addCircle(x, y, w * 0.45, bnd);
      return;
    case 'pumpkinPatch': {
      const n = Math.round((w / S) * (h / S) * FARM_LOOK.pumpkinsPerTile);
      for (let i = 0; i < n; i++) {
        // jittered grid so pumpkins don't clump
        const cols = Math.max(1, Math.round(Math.sqrt(n * w / h))), rows = Math.ceil(n / cols);
        const gx = i % cols, gy = Math.floor(i / cols);
        const px = x - w / 2 + (gx + 0.2 + hash(i, 1, x | 0) * 0.6) * (w / cols);
        const py = y - h / 2 + (gy + 0.2 + hash(i, 2, y | 0) * 0.6) * (h / rows);
        const s = 34 + hash(i, 3, 9) * 16;
        castShadow(scene, farm, objs, px, py, { w: s * 0.8, h: s * 0.8, shape: 'ellipse', blur: 4 }, H.pumpkin);
        objs.push(scene.add.image(px, py, K.pumpkin).setDisplaySize(s, s).setRotation(hash(i, 4, 9) * 6.28).setDepth(DEPTH.prop).setTint(tint));
      }
      return;
    }
    case 'cornMaze': addMazeSign(scene, world, d, objs); return;
    default: return; // building decorations are drawn with their lots
  }
}

/** Maze sign on the corn beside the first entrance (mown path reaching the field edge). */
function addMazeSign(scene: Phaser.Scene, world: WorldData, d: FarmDecoration, objs: Objs): void {
  const ts = world.tileSize, W = world.widthTiles;
  const x0 = Math.round((d.x - d.w / 2) / ts), y0 = Math.round((d.y - d.h / 2) / ts);
  const x1 = x0 + Math.round(d.w / ts) - 1, y1 = y0 + Math.round(d.h / ts) - 1;
  const t = (x: number, y: number) => world.tiles[y * W + x];
  const edges: [number, number, number, number][] = []; // entrance tile + sideways step to the corn
  for (let x = x0; x <= x1; x++) { edges.push([x, y0, 1, 0], [x, y1, 1, 0]); }
  for (let y = y0; y <= y1; y++) { edges.push([x0, y, 0, 1], [x1, y, 0, 1]); }
  for (const [x, y, sx, sy] of edges) {
    if (t(x, y) !== Tile.Grass) continue;
    const cx = x + sx, cy = y + sy;
    if (cx > x1 || cy > y1 || t(cx, cy) !== Tile.Corn) continue;
    const px = (cx + 0.5) * ts, py = (cy + 0.5) * ts;
    const farm = world.farm!;
    castShadow(scene, farm, objs, px, py, { w: 90, h: 14 }, H.mazeSign);
    objs.push(scene.add.image(px, py, TEX.farm.mazeSign).setScale(1.3).setDepth(DEPTH.prop).setTint(FARM_LOOK.decorTint));
    return;
  }
}

// ───────────────────────────── fences ─────────────────────────────

function fenceKey(scene: Phaser.Scene, len: number): string {
  const L = Math.max(8, Math.round(len));
  const key = `farm_fence_run_${L}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(TEX.farm.fence).getSourceImage() as HTMLCanvasElement;
  const { ctx, done } = makeCanvas(scene, key, L, 24);
  for (let x = 0; x < L; x += 128) ctx.drawImage(src, x, 0);
  done();
  return key;
}

function addFences(scene: Phaser.Scene, farm: FarmLayout, objs: Objs, addRect: AddRect): void {
  const owner: BodyOwner = { kind: 'fence' };
  const posts = new Set<string>();
  for (const f of farm.fences) {
    const len = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
    if (len < 1) continue;
    const ang = Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x);
    const mx = (f.a.x + f.b.x) / 2, my = (f.a.y + f.b.y) / 2;
    castShadow(scene, farm, objs, mx, my, { w: len, h: 8, rotation: ang, blur: 5, fade: 0.2 }, H.fence);
    objs.push(scene.add.image(mx, my, fenceKey(scene, len)).setRotation(ang).setDepth(DEPTH.prop).setTint(FARM_LOOK.decorTint));
    addRect(mx, my, len, 14, owner, ang);
    for (const p of [f.a, f.b]) {
      const k = `${Math.round(p.x)},${Math.round(p.y)}`;
      if (posts.has(k)) continue;
      posts.add(k);
      objs.push(scene.add.image(p.x, p.y, TEX.farm.gatePost).setScale(1.25).setDepth(DEPTH.prop + 0.1).setTint(FARM_LOOK.decorTint));
    }
  }
}

// ───────────────────────────── entry ─────────────────────────────

export interface FarmWorldHandle { destroy(): void }

/**
 * Everything farm-specific except the ground tilemap, lot bodies and picture signs (WorldBuilder).
 * Call after the buildings loop; `blades` was filled by addFarmBuilding.
 */
export function addFarmWorld(
  scene: Phaser.Scene, world: WorldData, objs: Objs, blades: FarmBlade[], addRect: AddRect, addCircle: AddCircle,
): FarmWorldHandle {
  const farm = world.farm!;
  for (const d of farm.decorations) addDecoration(scene, world, d, objs, blades, addRect, addCircle);
  addFences(scene, farm, objs, addRect);
  cornEdgeShadows(scene, world, farm, objs);
  for (const p of world.props) {
    if (p.kind === 'tree') treeShadow(scene, farm, objs, p.x, p.y, 70, H.treeTrunk, H.treeTop);
    else if (p.kind === 'bush') castShadow(scene, farm, objs, p.x, p.y, { w: 36, h: 36, shape: 'ellipse', blur: 6 }, H.bush);
  }
  const spin = () => {
    const t = scene.time.now / 1000;
    for (const b of blades) {
      const r = b.phase + (t / b.secPerTurn) * Math.PI * 2;
      b.img.setRotation(r);
      b.shadow?.setRotation(r);
    }
  };
  scene.events.on('update', spin);
  return { destroy: () => scene.events.off('update', spin) };
}

