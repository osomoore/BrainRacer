import Phaser from 'phaser';
import { WORLD_HOST } from '../config';
import { DEPTH, type HexLive, type WorldContext, type WorldModule } from '../core/runtime';
import type { Feature, Vec } from '../core/types';
import { nearbyHexes } from '../host/liveWorld';
import { objectTexture } from './objectsArt';

type Image = Phaser.GameObjects.Image;
type ObjectImage = { id: string; image: Image };
type Roof = { footprint: Phaser.Geom.Polygon; images: Image[] };
type HexImages = {
  live: HexLive;
  props: Image[];
  obstacles: ObjectImage[];
  items: ObjectImage[];
  roofs: Roof[];
};

export default class ObjectsModule implements WorldModule {
  static order = 300;
  private ctx!: WorldContext;
  private readonly hexes = new Map<string, HexImages>();
  private readonly pool: Image[] = [];
  private centers = '';

  init(ctx: WorldContext): void { this.ctx = ctx; }

  update(dt: number): void {
    const { world, players } = this.ctx;
    const centers = players.map(({ hex }) => `${hex.q},${hex.r}`).join('|');
    if (centers !== this.centers) {
      this.centers = centers;
      const nearby = nearbyHexes(world, players, WORLD_HOST.objectRings);
      for (const [key, images] of this.hexes) {
        if (nearby.has(key)) continue;
        this.release(images);
        this.hexes.delete(key);
      }
      for (const [key, coord] of nearby) {
        if (!this.hexes.has(key)) this.hexes.set(key, this.populate(world.live(coord)));
      }
    }
    const fade = 1 - Math.exp(-dt / WORLD_HOST.roofFadeTau);
    for (const { live, obstacles, items, roofs } of this.hexes.values()) {
      for (const { id, image } of obstacles) {
        const obstacle = live.obstacles.get(id);
        image.setVisible(!!obstacle && !obstacle.gone);
        if (obstacle && !obstacle.gone) image.setPosition(obstacle.at.x, obstacle.at.y);
      }
      for (const { id, image } of items) image.setVisible(!live.takenItems.has(id));
      for (const { footprint, images } of roofs) {
        players.forEach(({ move }, i) => {
          const alpha = footprint.contains(move.x, move.y) ? WORLD_HOST.roofFadeAlpha : 1;
          images[i].alpha += (alpha - images[i].alpha) * fade;
        });
      }
    }
  }

  destroy(): void {
    for (const images of this.hexes.values()) this.release(images);
    this.hexes.clear();
    for (const image of this.pool) image.destroy();
    this.pool.length = 0;
  }

  private populate(live: HexLive): HexImages {
    const { plan } = live;
    const images: HexImages = { live, props: [], obstacles: [], items: [], roofs: [] };
    for (const obstacle of live.obstacles.values()) {
      if (obstacle.gone) continue;
      const image = this.image(obstacle.kind, obstacle.at, obstacle.radius * 2, DEPTH.objects, true);
      images.obstacles.push({ id: obstacle.id, image });
    }
    for (const item of plan.items) {
      images.items.push({ id: item.id, image: this.image('item', item.at, 56, DEPTH.objects) });
    }
    if (plan.giver) images.props.push(this.image('giver', plan.giver.at, 110, DEPTH.objects));
    if (plan.home) {
      const { at } = plan.home;
      images.props.push(this.image('home', at, 176, DEPTH.decals));
      images.props.push(this.image('door', { x: at.x + 18, y: at.y - 150 }, 122, DEPTH.objects));
    }
    if (plan.treasure) images.props.push(this.image('treasure', plan.treasure.at, 73, DEPTH.objects));
    for (const feature of plan.features) {
      if (feature.area.length < 3) continue;
      const covered = feature.kind === 'tunnel' || feature.kind === 'cave';
      if (covered) {
        // Each player can see under the same roof independently in split screen.
        const roofImages = this.ctx.players.map(player => {
          const image = this.featureImage(feature, DEPTH.canopy);
          this.ctx.showOnlyTo(image, player);
          return image;
        });
        images.roofs.push({ footprint: new Phaser.Geom.Polygon(feature.area), images: roofImages });
      } else {
        images.props.push(this.featureImage(feature, DEPTH.decals));
      }
    }
    return images;
  }

  private featureImage(feature: Feature, depth: number): Image {
    const cos = Math.cos(feature.dir), sin = Math.sin(feature.dir);
    const local = feature.area.map(p => ({
      x: (p.x - feature.at.x) * cos + (p.y - feature.at.y) * sin,
      y: -(p.x - feature.at.x) * sin + (p.y - feature.at.y) * cos,
    }));
    const left = Math.min(...local.map(p => p.x)), right = Math.max(...local.map(p => p.x));
    const top = Math.min(...local.map(p => p.y)), bottom = Math.max(...local.map(p => p.y));
    const width = feature.kind === 'jump' ? Math.min(right - left, bottom - top) : right - left;
    const x = left + width / 2, y = (top + bottom) / 2;
    const at = { x: feature.at.x + x * cos - y * sin, y: feature.at.y + x * sin + y * cos };
    return this.image(feature.kind, at, width, depth)
      .setDisplaySize(width, bottom - top).setRotation(feature.dir);
  }

  private image(kind: string, at: Vec, size: number, depth: number, obstacle = false): Image {
    const scene = this.ctx.scene;
    const texture = objectTexture(scene, kind, obstacle);
    const image = this.pool.pop() ?? scene.add.image(0, 0, texture);
    image.cameraFilter = 0;
    return image.setTexture(texture).setPosition(at.x, at.y).setDisplaySize(size, size)
      .setRotation(0).setDepth(depth).setAlpha(1).setVisible(true);
  }

  private release(images: HexImages): void {
    for (const image of [
      ...images.props, ...images.obstacles.map(o => o.image), ...images.items.map(o => o.image),
      ...images.roofs.flatMap(roof => roof.images),
    ]) {
      image.setVisible(false);
      this.pool.push(image);
    }
  }
}
