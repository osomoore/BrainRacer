import type Phaser from 'phaser';
import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { startDuckParade, updateDuckParade } from './duckParadeState';

function pondAt(site: ActivitySite): Vec {
  return site.targets.find(target => target.role === 'pond')?.at ?? site.at;
}

function drawDuck(scene: Phaser.Scene, at: Vec, color: number) {
  return scene.add.container(at.x, at.y, [
    scene.add.ellipse(0, 0, 34, 25, color),
    scene.add.circle(16, -5, 10, color),
    scene.add.triangle(28, -5, 0, 0, 12, 5, 0, 10, 0xff8c3a),
    scene.add.circle(19, -8, 2.5, 0x302a28),
  ]).setDepth(DEPTH.objects + 1);
}

const duckParade: ActivityKindDef = {
  kind: 'duckParade',
  decorate(ctx, site) {
    const at = pondAt(site);
    const width = 2 * WORLD_ACTIVITIES.duckParade.pondRadius;
    const pond = ctx.scene.add.ellipse(at.x, at.y, width, 0.7 * width, 0x55b8dc, 0.78)
      .setStrokeStyle(8, 0xb4efff).setDepth(DEPTH.decals + 0.1);
    const duck = drawDuck(ctx.scene, at, 0xffd447);
    return () => { pond.destroy(); duck.destroy(); };
  },
  start(ctx, site, player) {
    const pond = pondAt(site);
    const state = startDuckParade(player.move, Math.max(1, Math.min(3, site.targets.length)));
    const sprites = state.ducks.map((duck, i) => {
      const sprite = drawDuck(ctx.scene, duck, i % 2 ? 0xffe680 : 0xffd447);
      ctx.showOnlyTo(sprite, player);
      return sprite;
    });
    return {
      update(dt) {
        const outcome = updateDuckParade(state, player.move, pond, dt);
        state.ducks.forEach((duck, i) => {
          const sprite = sprites[i];
          if (Math.hypot(duck.x - sprite.x, duck.y - sprite.y) > 0.1) {
            sprite.setRotation(Math.atan2(duck.y - sprite.y, duck.x - sprite.x));
          }
          sprite.setPosition(duck.x, duck.y);
        });
        return outcome;
      },
      destroy() { sprites.forEach(sprite => sprite.destroy()); },
    };
  },
};

export default duckParade;
