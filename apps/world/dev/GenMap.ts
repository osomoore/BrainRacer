import Phaser from 'phaser';
import type { BiomeId, HexPlan, SurfaceKind, Vec } from '../core/types';
import { WorldGen } from '../gen/world';
import { corners } from '../gen/hex';

const COLORS: Record<BiomeId, number> = {
  meadow: 0x8ebd67, mud: 0x806c4b, rocky: 0x99958a, lake: 0x71b9d2, darkwood: 0x42634c,
  snow: 0xe3eef0, desert: 0xd8b96e, jungle: 0x4b925e, canyon: 0xc87953, geyser: 0x9b806e,
};
const SURFACES: Record<SurfaceKind, number> = {
  road: 0xc7ad7e, path: 0xf0dfb7, bridge: 0x8e5e40, grass: 0x93be67,
  tallGrass: 0x487845, sand: 0xe8ce83, snow: 0xf4fbff, ice: 0xa2d9e7, mud: 0x927053,
  deepMud: 0x584437, rough: 0x9e9387, shallow: 0x82cddb, deep: 0x327fae,
  hotSpring: 0x67c7b4, cliff: 0x504441,
};

/** Development-only overview of generated terrain. Open with `world.html?dev=GenMap&seed=1`. */
export default class GenMap extends Phaser.Scene {
  constructor() { super('GenMap'); }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const requestedSeed = Number(params.get('seed') ?? 1);
    const seed = Number.isFinite(requestedSeed) ? requestedSeed : 1;
    const world = new WorldGen(seed);
    const plans = world.hexesNear(0, 0, 4).map((coord) => world.plan(coord));
    const g = this.add.graphics();
    const outlines = plans.map(plan => corners(plan.coord));

    // Put every tile below the roads so neighboring fills cannot hide a seam.
    plans.forEach((plan, i) => {
      g.fillStyle(COLORS[plan.biome], 1);
      g.lineStyle(16, 0x304336, 0.85);
      g.fillPoints(outlines[i], true);
      g.strokePoints(outlines[i], true);
    });
    for (const plan of plans) this.drawPlan(g, plan);

    const camera = this.cameras.main;
    camera.setBackgroundColor('#24303a');
    camera.centerOn(0, 0);
    const points = outlines.flat();
    const maxX = Math.max(...points.map(p => Math.abs(p.x)));
    const maxY = Math.max(...points.map(p => Math.abs(p.y)));
    camera.setZoom(Math.min((camera.width - 120) / (2 * maxX), (camera.height - 120) / (2 * maxY)));

    const legend = this.add.text(24, 20, [
      `Seed ${seed} · 4 rings`, 'Gold · Activity', 'White · Home', 'Orange · Quest giver',
    ], {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff',
      backgroundColor: '#18212a', padding: { x: 12, y: 10 }, lineSpacing: 5,
    });
    camera.ignore(legend);
    this.cameras.add(0, 0, camera.width, camera.height).ignore(g);
  }

  private drawPlan(g: Phaser.GameObjects.Graphics, plan: HexPlan): void {
    for (const blob of plan.terrain) {
      g.fillStyle(blob.covered ? 0x40374a : SURFACES[blob.kind], 0.9);
      g.fillPoints(blob.poly, true);
    }

    for (const road of plan.roads) {
      if (road.points.length < 2) continue;
      g.lineStyle(road.width, SURFACES[road.kind], 1);
      g.beginPath();
      g.moveTo(road.points[0].x, road.points[0].y);
      for (const point of road.points.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
    }

    for (const feature of plan.features) {
      if (feature.kind === 'bridge') g.fillStyle(SURFACES.bridge, 1).fillPoints(feature.area, true);
      g.lineStyle(25, 0xe4e0c6, 0.95);
      g.strokePoints(feature.area, true);
    }
    for (const obstacle of plan.obstacles) {
      g.fillStyle(0x534d48, 0.95);
      g.fillCircle(obstacle.at.x, obstacle.at.y, obstacle.radius);
    }
    for (const site of plan.activities) {
      g.fillStyle(0xffd54f, 0.95);
      g.fillCircle(site.at.x, site.at.y, 90);
      g.lineStyle(26, 0x634a16, 1);
      g.strokeCircle(site.at.x, site.at.y, 90);
    }
    for (const item of plan.items) {
      g.fillStyle(0xebe0b3, 1);
      g.fillCircle(item.at.x, item.at.y, 54);
    }
    if (plan.giver) this.marker(g, plan.giver.at, 0xff9d68, 145);
    if (plan.treasure) this.marker(g, plan.treasure.at, 0xf6a4ed, 110);
    if (plan.home) this.marker(g, plan.home.at, 0xf8f5e7, 180);
  }

  private marker(g: Phaser.GameObjects.Graphics, at: Vec, color: number, radius: number): void {
    g.fillStyle(color, 1);
    g.fillCircle(at.x, at.y, radius);
    g.lineStyle(30, 0x27313a, 1);
    g.strokeCircle(at.x, at.y, radius);
  }
}
