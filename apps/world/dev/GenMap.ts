import Phaser from 'phaser';
import type { BiomeId, HexPlan, SurfaceKind, Vec } from '../core/types';
import { COVERAGE_KIND, offRoadCoverage } from '../gen/coverage';
import { WorldGen } from '../gen/world';
import { corners } from '../gen/hex';

const COLORS: Record<BiomeId, number> = {
  meadow: 0x8ebd67, mud: 0x9d7854, rocky: 0x99958a, lake: 0x88a966, darkwood: 0x42634c,
  snow: 0xe3eef0, desert: 0xd8b96e, jungle: 0x76a15e, canyon: 0xbb8260, geyser: 0x9b806e,
};
const SURFACES: Record<SurfaceKind, number> = {
  road: 0xc7ad7e, path: 0xf0dfb7, bridge: 0x8e5e40, grass: 0x93be67,
  tallGrass: 0x487845, sand: 0xe8ce83, snow: 0xf4fbff, ice: 0xa2d9e7, mud: 0x927053,
  deepMud: 0x584437, rough: 0x9e9387, shallow: 0x82cddb, deep: 0x327fae,
  hotSpring: 0x67c7b4, cliff: 0x573f34,
};

const LABELS: Partial<Record<SurfaceKind, string>> = {
  shallow: 'ponds', deepMud: 'deep mud', cliff: 'cliffs', deep: 'deep water',
  tallGrass: 'tall grass', ice: 'ice', rough: 'mesas', hotSpring: 'springs',
};

const OBSTACLE_COLORS: Record<string, number> = {
  tree: 0x183b28, vine: 0x647234, cactus: 0x4d6b40, bush: 0x527a40,
  boulder: 0x59524b, iceBlock: 0x609bb1, vent: 0xecb880, flower: 0xf5d474, log: 0x574336,
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
    for (const plan of plans) {
      for (const blob of plan.terrain) {
        const fill = plan.biome === 'desert' && blob.kind === 'rough' ? 0xa78056 : SURFACES[blob.kind];
        g.fillStyle(blob.covered ? 0x40374a : fill, 1).fillPoints(blob.poly, true);
        if (blob.kind === 'cliff') g.lineStyle(32, 0x80543e, 1).strokePoints(blob.poly, true);
      }
    }
    for (const plan of plans) this.drawPlan(g, plan);

    const camera = this.cameras.main;
    camera.setBackgroundColor('#24303a');
    camera.centerOn(0, 0);
    const points = outlines.flat();
    const maxX = Math.max(...points.map(p => Math.abs(p.x)));
    const maxY = Math.max(...points.map(p => Math.abs(p.y)));
    const zoom = Math.min((camera.width - 120) / (2 * maxX), (camera.height - 120) / (2 * maxY));
    camera.setZoom(zoom);

    const labels = plans.map(plan => {
      const kind = COVERAGE_KIND[plan.biome];
      const share = Math.round(offRoadCoverage(plan)[kind] * 100);
      return this.add.text(camera.width / 2 + plan.center.x * zoom,
        camera.height / 2 + (plan.center.y - 1510) * zoom,
        `${plan.biome.toUpperCase()}\n${share}% ${LABELS[kind] ?? kind}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', align: 'center',
          color: '#ffffff', stroke: '#293133', strokeThickness: 3,
        }).setOrigin(0.5);
    });
    const legend = this.add.text(24, 20, [
      'Adventure World', `Seed ${seed} · 4 rings`, 'Coverage is off-road area', '',
      'Gold · Activity', 'White · Home', 'Orange · Quest giver',
    ], {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff',
      backgroundColor: '#18212a', padding: { x: 12, y: 10 }, lineSpacing: 5,
    });
    camera.ignore([legend, ...labels]);
    this.cameras.add(0, 0, camera.width, camera.height).ignore(g);
  }

  private drawPlan(g: Phaser.GameObjects.Graphics, plan: HexPlan): void {
    for (const road of plan.roads) {
      if (road.points.length < 2) continue;
      g.lineStyle(road.width, SURFACES[road.kind], 1);
      g.beginPath();
      g.moveTo(road.points[0].x, road.points[0].y);
      for (const point of road.points.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
    }

    for (const feature of plan.features) {
      if (feature.kind === 'bridge') {
        g.fillStyle(SURFACES.bridge, 1).fillPoints(feature.area, true);
        continue;
      }
      if (feature.kind === 'jump' && feature.needs?.length) g.fillStyle(0x573f34, 1).fillPoints(feature.area, true);
      g.lineStyle(26, 0xe4e0c6, 0.85).strokePoints(feature.area, true);
    }
    for (const obstacle of plan.obstacles) {
      g.fillStyle(OBSTACLE_COLORS[obstacle.kind] ?? 0x534d48, 0.95);
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
