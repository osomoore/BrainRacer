import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef, type WorldContext } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { startHerd, stepHerd } from './herdSheep/state';

const TUNING = WORLD_ACTIVITIES.herdSheep;

function sheepPositions(site: ActivitySite): Vec[] {
  return site.targets.map(({ at }) => {
    const angle = Math.atan2(at.y - site.at.y, at.x - site.at.x);
    const distance = Math.max(TUNING.penRadius + 29, Math.hypot(at.x - site.at.x, at.y - site.at.y));
    return { x: site.at.x + Math.cos(angle) * distance, y: site.at.y + Math.sin(angle) * distance };
  });
}

function drawPen(ctx: WorldContext, at: Vec) {
  const { add } = ctx.scene;
  const r = TUNING.penRadius;
  const field = add.circle(0, 0, r, 0x316750, 0.6).setStrokeStyle(4, 0xe8d99f);
  const corners = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => {
    const rail = add.rectangle(0, 0, 42, 7, 0xe3b477);
    const posts = [-21, 21].map(x => add.circle(x, 0, 7, 0x835534).setStrokeStyle(2, 0xffdc9e));
    return add.container(Math.sin(angle) * r, -Math.cos(angle) * r, [rail, ...posts]).setRotation(angle);
  });
  return add.container(at.x, at.y, [field, ...corners]).setDepth(DEPTH.decals + 1);
}

function drawSheep(ctx: WorldContext, at: Vec) {
  const { add } = ctx.scene;
  const shadow = add.ellipse(-2, 5, 61, 44, 0x293039, 0.28);
  const fleece = add.ellipse(-5, 0, 55, 39, 0xfff7dd).setStrokeStyle(3, 0x685757);
  const wool = [[-20, -8], [-20, 8], [-6, -10], [-6, 10], [5, 0]].map(([x, y], index) =>
    add.circle(x, y, 10, index % 2 === 0 ? 0xfff8df : 0xdfd4be));
  const ears = [-12, 12].map(y => add.ellipse(16, y, 14, 7, 0x665060));
  const face = add.ellipse(19, 0, 25, 27, 0x685365).setStrokeStyle(2, 0x382d37);
  const eyes = [-5, 5].map(y => add.circle(24, y, 2, 0xffeee1));
  const sprite = add.container(at.x, at.y, [shadow, fleece, ...wool, ...ears, face, ...eyes]).setDepth(DEPTH.objects + 1);
  return { sprite, fleece };
}

const herdSheep: ActivityKindDef = {
  kind: 'herdSheep',
  decorate(ctx, site) {
    const pen = drawPen(ctx, site.at);
    return () => pen.destroy();
  },
  start(ctx, site, player) {
    const positions = sheepPositions(site);
    let state = startHerd(positions);
    let honked = false;
    const offHonk = ctx.bus.on('player:honk', event => { if (event.player === player) honked = true; });
    const sprites = positions.map(at => drawSheep(ctx, at));
    sprites.forEach(({ sprite }, index) => {
      const at = positions[index];
      sprite.setRotation(Math.atan2(site.at.y - at.y, site.at.x - at.x));
      ctx.showOnlyTo(sprite, player);
    });
    ctx.bus.emit('ui:banner', { player, text: 'Nudge or honk them in!' });
    const canStep = (at: Vec) => {
      const surface = ctx.world.surfaceAt(at.x, at.y).kind;
      const radius = 16;
      return surface !== 'deep' && surface !== 'cliff'
        && !ctx.world.nearbySolids(at.x, at.y, radius).obstacles.some(obstacle =>
          obstacle.effect !== 'pass' && Math.hypot(at.x - obstacle.at.x, at.y - obstacle.at.y) < obstacle.radius + radius);
    };

    return {
      update(dt) {
        const { move, traits } = player;
        const velocity = move.airborne === 0 && !move.flying ? { x: move.vx, y: move.vy } : { x: 0, y: 0 };
        state = stepHerd(state, site.at, move, velocity, honked, traits.loud, dt, canStep);
        honked = false;
        state.sheep.forEach(({ at, away, penned, stride }, index) => {
          const { sprite, fleece } = sprites[index];
          sprite.setPosition(at.x, at.y).setScale(1 + (stride > 0 ? 0.08 * Math.sin(state.elapsed * 32) : 0));
          if (away.x || away.y) sprite.setRotation(Math.atan2(away.y, away.x));
          if (penned) fleece.setFillStyle(0xb8e5bc);
        });
        return state.outcome;
      },
      destroy() { offHonk(); sprites.forEach(({ sprite }) => sprite.destroy()); },
    };
  },
};

export default herdSheep;
