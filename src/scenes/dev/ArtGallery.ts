import Phaser from 'phaser';
import { allTextureKeys } from '../../art/keys';
import { DINO_RIG, type RigPart } from '../../art/dinoRig';
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
    const H = 3000;
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
    const cat0 = 1080;
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
