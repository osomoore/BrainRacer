import Phaser from 'phaser';
import { allTextureKeys } from '../../art/keys';
import { DINO_RIG, type RigPart } from '../../art/dinoRig';
import { FARM_TILE, FARM_TILE_COUNT, farmTileSource } from '../../art/farm';
import { TEX } from '../../core/assetKeys';
import { TILE_SIZE } from '../../config/gameConfig';

/**
 * Dev scene: ?dev=ArtGallery[&y=<scrollPixels>]. Mouse wheel / arrow keys scroll.
 * Top screen: demos (road loop, roof building, hero cars, rig-assembled dino). Below: every texture.
 */
export default class ArtGallery extends Phaser.Scene {
  constructor() { super('ArtGallery'); }

  create(): void {
    const W = 1920;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#171b27');
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x262c3d, 1);
    const H = 6000;
    for (let x = 0; x <= W; x += 40) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 40) grid.lineBetween(0, y, W, y);

    const label = (x: number, y: number, s: string, size = 18, color = '#9fb0d0') =>
      this.add.text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, color }).setOrigin(0, 0);

    label(30, 16, 'BrainRacer ArtGallery   (wheel / arrows scroll, ?y=1080 jumps)', 24, '#ffffff');

    // ---- road loop demo (6 x 4) with a junction
    label(30, 52, 'road loop 6x4 (N1 E2 S4 W8)', 16);
    const roads = [
      [6, 10, 14, 10, 10, 12],
      [5, -1, 5, -1, -1, 5],
      [7, 10, 15, 10, 10, 13],
      [3, 10, 11, 10, 10, 9],
    ];
    const ox = 30, oy = 76, T = TILE_SIZE;
    roads.forEach((row, ry) => row.forEach((m, rx) => {
      const key = m < 0 ? (rx === 3 ? TEX.tilePark : TEX.tileGrass) : `${TEX.roadPrefix}${m}`;
      this.add.image(ox + rx * T, oy + ry * T, key).setOrigin(0, 0);
    }));
    this.add.image(ox + 1 * T, oy + 1 * T, TEX.tileSidewalk).setOrigin(0, 0);
    this.add.image(ox + 4 * T, oy + 1 * T, TEX.tileWater).setOrigin(0, 0);
    this.add.image(ox + 3 * T + 64, oy + T + 64, TEX.tree);
    this.add.image(ox + 4 * T, oy + 2 * T - 40, TEX.cone);
    this.add.image(ox + 2 * T + 100, oy + 2 * T + 30, TEX.carKart);
    this.add.image(ox + 3 * T + 30, oy + 2 * T + 94, TEX.carDino).setAngle(0);
    this.add.image(ox + 1 * T + 64, oy + 0 * T + 94, TEX.traffic[0]).setAngle(180);
    this.add.image(ox + 5 * T + 34, oy + 1 * T + 64, TEX.police[0]).setAngle(90);

    // ---- building made of roof tiles (4 x 3)
    const bx = 840, by = 76;
    label(bx, 52, 'building: roof_0..5 tiled (3 tiles each)', 16);
    this.add.rectangle(bx + 10, by + 12, T * 6, T * 3, 0x000000, 0.35).setOrigin(0, 0);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) this.add.image(bx + i * T, by + k * T, TEX.roof[i]).setOrigin(0, 0);
    const edge = this.add.graphics();
    edge.lineStyle(5, 0x222a3c, 1).strokeRect(bx, by, T * 6, T * 3);
    for (let i = 0; i < 6; i++) label(bx + i * T + 4, by + T * 3 + 4, `roof_${i}`, 14);
    this.add.image(bx + T * 6 + 40, by + 70, TEX.tree).setScale(1.4);
    this.add.image(bx + T * 6 + 30, by + 220, TEX.bush).setScale(1.5);
    this.add.image(bx - 24, by + 330, TEX.lamp).setScale(2);

    // ---- hero cars
    const cy = 640;
    label(30, cy - 36, 'hero cars: 0.5x, 1x, 2x (kart red / dino green)', 16);
    let x = 60;
    for (const s of [0.5, 1, 2]) {
      for (const key of [TEX.carKart, TEX.carDino]) {
        const spec = key === TEX.carKart ? 60 : 72;
        this.add.image(x + spec * s / 2, cy + 50 + (s === 2 ? 20 : 0), TEX.carShadow).setScale(s * (spec / 70)).setAlpha(0.9);
        this.add.image(x + spec * s / 2, cy + 50 + (s === 2 ? 20 : 0), key).setScale(s);
        x += spec * s + 36;
      }
      x += 30;
    }
    // traffic row
    const ty = cy + 170;
    let tx = 40;
    for (const key of [...TEX.traffic, TEX.truck, ...TEX.police]) {
      const img = this.add.image(0, ty, key).setScale(1.3);
      img.x = tx + img.displayWidth / 2; tx += img.displayWidth + 22;
    }
    label(30, ty + 36, 'traffic_0..3 truck police_0/1', 14);
    // props & ui row
    const py = ty + 110;
    label(30, py - 28, 'ramp, sign, buttons, arrow', 14);
    this.add.image(100, py + 40, TEX.ramp);
    this.add.image(300, py + 40, TEX.signFrame).setScale(0.8);
    TEX.buttonBadge.forEach((k, i) => this.add.image(450 + i * 90, py + 40, k));
    this.add.image(730, py + 40, TEX.arrow).setScale(1.2);
    this.add.nineslice(850, py + 40, TEX.panel, undefined, 220, 90, 30, 30, 30, 30);

    // ---- dino assembled from DINO_RIG
    this.buildDino(1500, 800, 0.8);
    label(1300, 960, 'dino assembled from DINO_RIG (legs + tail animated)', 14);

    // ---- catalog
    const cat0 = this.farmSection(1080, label);
    label(30, cat0 + 8, 'ALL TEXTURES (key, size)', 24, '#ffffff');
    const cell = 150, cols = 12;
    allTextureKeys().forEach((key, i) => {
      const cx = (i % cols) * cell, cyy = cat0 + 50 + Math.floor(i / cols) * (cell + 8);
      this.add.rectangle(cx + 4, cyy, cell - 8, cell, 0x20263a).setOrigin(0, 0).setStrokeStyle(1, 0x394261);
      const tex = this.textures.get(key);
      const src = tex.getSourceImage();
      const w = src.width, h = src.height;
      const sc = Math.min(4, 112 / Math.max(w, h));
      this.add.image(cx + cell / 2, cyy + 62, key).setScale(sc);
      label(cx + 8, cyy + cell - 30, key, 12, '#cfe0ff');
      label(cx + 8, cyy + cell - 16, `${w}x${h}${sc !== 1 ? ` (x${sc.toFixed(2)})` : ''}`, 11, '#7f8db0');
    });
    const maxY = cat0 + 50 + Math.ceil(allTextureKeys().length / cols) * (cell + 8);

    // scrolling
    const qy = Number(new URLSearchParams(location.search).get('y') ?? 0) || 0;
    cam.setScroll(0, qy);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, maxY - 1080); });
    const cur = this.input.keyboard?.createCursorKeys();
    this.events.on('update', () => {
      if (cur?.down.isDown) cam.scrollY = Math.min(maxY - 1080, cam.scrollY + 14);
      if (cur?.up.isDown) cam.scrollY = Math.max(0, cam.scrollY - 14);
    });
  }

  /** Farm section: tileset sheet, a small driving-zoom scene, then every sprite. Returns the y where it ends. */
  private farmSection(y0: number, label: (x: number, y: number, s: string, size?: number, color?: string) => Phaser.GameObjects.Text): number {
    const F = TEX.farm, T = TILE_SIZE;
    label(30, y0, 'FARM  (no baked shadows; golden-hour palette)', 26, '#ffd36a');
    // tileset sheet via farmTileSource
    const src = farmTileSource(T), cols = 11, rows = Math.ceil(FARM_TILE_COUNT / cols);
    const sheet = this.textures.createCanvas('gallery_farm_tiles', cols * T, rows * T)!;
    const sctx = sheet.getContext();
    for (let i = 0; i < FARM_TILE_COUNT; i++) sctx.drawImage(src(i), (i % cols) * T, Math.floor(i / cols) * T);
    sheet.refresh();
    label(30, y0 + 40, 'farmTileSource: 0 water, 1-3 grass, 4 lane, 5 yard, 6-8 corn, 9 mown, 10 flat, 11 mud, 12-27 road masks, 28-43 water banks', 16);
    this.add.image(30, y0 + 66, 'gallery_farm_tiles').setOrigin(0, 0);
    let y = y0 + 66 + rows * T + 20;

    // driving-zoom scene on real tiles (1 tile = 128 px)
    label(30, y, 'driving-zoom scene', 16); y += 24;
    const grid = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 18, 10, 10, 10, 10, 10, 14, 1, 6, 6, 6],
      [1, 17, 1, 1, 5, 5, 4, 17, 1, 6, 9, 6],
      [1, 17, 1, 1, 5, 5, 4, 17, 1, 6, 9, 10],
      [1, 17, 1, 1, 1, 1, 4, 17, 1, 7, 10, 7],
      [1, 13, 10, 10, 10, 10, 10, 15, 28 + 0, 8, 8, 8],
      [1, 1, 1, 11, 11, 1, 1, 1, 28 + 14, 28 + 4, 28 + 4, 28 + 4],
    ];
    // road masks: 12 + mask. fix up a few cells to real road indexes
    const R = (m: number) => 12 + m;
    grid[1] = [1, R(6), R(10), R(10), R(10), R(10), R(10), R(12), 1, 6, 6, 6];
    for (const r of [2, 3, 4]) { grid[r][1] = R(5); grid[r][7] = R(5); }
    grid[5] = [1, R(3), R(10), R(10), R(10), R(10), R(10), R(9), 0, 8, 8, 8];
    grid[5][8] = FARM_TILE.waterBankBase + 8; grid[6][8] = FARM_TILE.waterBankBase + 9;
    for (let c = 9; c < 12; c++) grid[6][c] = FARM_TILE.waterBankBase + 1;
    grid[6][3] = FARM_TILE.mud; grid[6][4] = FARM_TILE.mud;
    grid[4][10] = FARM_TILE.cornFlat; grid[4][11] = FARM_TILE.cornFlat;
    const scene = this.textures.createCanvas('gallery_farm_scene', 12 * T, grid.length * T)!;
    const gctx = scene.getContext();
    grid.forEach((row, r) => row.forEach((idx, c) => gctx.drawImage(src(idx), c * T, r * T)));
    scene.refresh();
    this.add.image(30, y, 'gallery_farm_scene').setOrigin(0, 0);
    const sx = 30, sy = y;
    this.add.image(sx + 3 * T, sy + 2.4 * T, F.barn).setScale(0.75);
    this.add.image(sx + 5.2 * T, sy + 2.2 * T, F.silo).setScale(0.6);
    this.add.image(sx + 8.2 * T, sy + 1.6 * T, F.farmhouse).setScale(0.6);
    const mill = this.add.image(sx + 9.8 * T, sy + 3.3 * T, F.windmill);
    const blade = this.add.image(mill.x, mill.y, F.windmillBlade).setScale(0.7);
    this.tweens.add({ targets: blade, angle: 360, duration: 6000, repeat: -1 });
    this.add.image(sx + 0.7 * T, sy + 0.5 * T, F.shed).setScale(0.5);
    this.add.image(sx + 2.2 * T, sy + 4.6 * T, F.orchardTree).setScale(0.7);
    this.add.image(sx + 1.3 * T, sy + 3.9 * T, F.orchardTree).setScale(0.7);
    this.add.image(sx + 6.6 * T, sy + 4.5 * T, F.hayRound);
    this.add.image(sx + 5.6 * T, sy + 3.9 * T, F.haySquare);
    this.add.image(sx + 4.2 * T, sy + 3.9 * T, F.pumpkin);
    this.add.image(sx + 8 * T, sy + 5.5 * T, F.bridge).setAngle(90).setScale(0.7);
    this.add.image(sx + 8.9 * T, sy + 2.9 * T, F.mazeSign).setScale(0.8);
    for (let i = 0; i < 4; i++) this.add.image(sx + 4.1 * T + i * 128, sy + 5.15 * T - 4, F.fence);
    this.add.image(sx + 5.8 * T, sy + 5.15 * T - 4, F.gatePost);
    this.add.image(sx + 2.5 * T, sy + 1.5 * T, F.pickup[0]);
    this.add.image(sx + 5.2 * T, sy + 1.5 * T, F.pickup[1]).setAngle(180);
    this.add.image(sx + 6.5 * T, sy + 2.5 * T, F.tractor).setAngle(90);
    this.add.image(sx + 2.0 * T, sy + 5.5 * T, TEX.carKart);
    this.add.image(sx + 2.8 * T, sy + 5.5 * T, TEX.carDino);
    this.add.image(sx + 11 * T - 20, sy + 6.3 * T - 10, F.duck[0]).setScale(1.2);
    this.add.image(sx + 9.5 * T, sy + 6.2 * T, F.duck[1]).setAngle(40);
    this.add.image(sx + 7.4 * T, sy + 4.0 * T, F.turbine);
    this.add.image(sx + 7.4 * T, sy + 4.0 * T, F.turbineBlade).setScale(0.45);
    y += grid.length * T + 30;

    // all sprites at 1x and 2x in labelled rows
    const row = (title: string, keys: readonly string[], scale: number, gap = 24): void => {
      label(30, y, title, 14);
      let x = 30, h = 0;
      for (const k of keys) {
        const im = this.add.image(0, 0, k).setScale(scale).setOrigin(0, 0);
        const bg = this.add.rectangle(x - 4, y + 22, im.displayWidth + 8, im.displayHeight + 8, 0x3a6f35).setOrigin(0, 0).setDepth(-1);
        im.setPosition(x, y + 26);
        x += im.displayWidth + gap; h = Math.max(h, im.displayHeight);
        void bg;
      }
      y += h + 52;
    };
    row('buildings: barn silo farmhouse shed windmill+blade turbine+blade', [F.barn, F.silo, F.farmhouse, F.shed, F.windmill], 1);
    row('blades / turbine', [F.windmillBlade, F.turbine, F.turbineBlade], 1);
    row('decor: hay round/square, orchard tree, pumpkin, fence, gate post, bridge, maze sign, corn flat stamp', [F.hayRound, F.haySquare, F.orchardTree, F.pumpkin, F.fence, F.gatePost, F.bridge, F.mazeSign, F.cornFlat], 1);
    row('animals walk frames (2x): cow sheep pig horse', [...F.cow, ...F.sheep, ...F.pig, ...F.horse], 1.5);
    row('chicken duck walk (3x) + tumble poses (cow sheep pig horse chicken duck, 1.5x)', [...F.chicken, ...F.duck, F.cowTumble, F.sheepTumble, F.pigTumble, F.horseTumble, F.chickenTumble, F.duckTumble], 2);
    row('vehicles: pickup x2, tractor, hay wagon, combine (2x)', [...F.pickup, F.tractor, F.hayWagon, F.combine], 2);
    return y + 40;
  }

  private buildDino(x: number, y: number, scale: number): void {
    const root = this.add.container(x, y).setScale(scale);
    const sh = DINO_RIG.shadow;
    root.add(this.add.image(sh.x, sh.y, sh.key).setOrigin(sh.originX, sh.originY));
    const made: Record<string, Phaser.GameObjects.Image> = {};
    const parts = Object.entries(DINO_RIG.parts) as [string, RigPart][];
    parts.sort((a, b) => a[1].depth - b[1].depth);
    for (const [name, p] of parts) {
      const img = this.add.image(p.x, p.y, p.key).setOrigin(p.originX, p.originY).setFlipY(!!p.flipY);
      root.add(img);
      made[name] = img;
    }
    const frames = DINO_RIG.legs.frames;
    let f = 0;
    this.time.addEvent({
      delay: DINO_RIG.legs.frameMs, loop: true,
      callback: () => {
        f++;
        made.legL.setTexture(frames[f % 4]);
        made.legR.setTexture(frames[(f + DINO_RIG.legs.rightPhaseOffset) % 4]);
      },
    });
    this.tweens.add({ targets: made.tail, rotation: { from: -DINO_RIG.tailWag, to: DINO_RIG.tailWag }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: made.head, y: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
