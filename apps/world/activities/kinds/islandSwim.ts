import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef, type WorldContext } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { startSwim, stepSwim } from './islandSwim/state';

const TUNING = WORLD_ACTIVITIES.islandSwim;
const islandAt = (site: ActivitySite) => site.targets.find(target => target.role === 'island')?.at ?? site.at;

function drawStar(ctx: WorldContext, at: Vec, active: boolean) {
  const { add } = ctx.scene;
  const sand = add.circle(0, 0, 45, 0xeabb6c).setStrokeStyle(4, 0xffeac2);
  const star = add.star(0, 0, 5, 16, 33, active ? 0xffeb75 : 0xffbc4a).setStrokeStyle(3, 0x62422a);
  return add.container(at.x, at.y, [sand, star]).setDepth(DEPTH.objects);
}

function drawDirection(ctx: WorldContext) {
  const { add } = ctx.scene;
  const disc = add.circle(0, 0, 21, 0x16465d).setStrokeStyle(3, 0xc6f6fc);
  const arrow = add.triangle(1, 0, 0, 0, 23, 13, 0, 26, 0xa7f6fd);
  return add.container(0, 0, [disc, arrow]).setDepth(DEPTH.objects + 1);
}

/** Find a buoy off the bridge and on the approach side of the generated island. */
function swimBuoy(site: ActivitySite, island: Vec, deepAt: (x: number, y: number) => boolean): Vec | undefined {
  const heading = Math.atan2(site.at.y - island.y, site.at.x - island.x);
  for (const radius of [2 * TUNING.buoyStep, 3 * TUNING.buoyStep, TUNING.buoyStep]) {
    for (const angle of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
      const dir = heading + angle * Math.PI / 6;
      const at = { x: island.x + radius * Math.cos(dir), y: island.y + radius * Math.sin(dir) };
      if (deepAt(at.x, at.y)) return at;
    }
  }
}

const islandSwim: ActivityKindDef = {
  kind: 'islandSwim',
  decorate(ctx, site) {
    const star = drawStar(ctx, islandAt(site), false);
    return () => star.destroy();
  },
  start(ctx, site, player) {
    const island = islandAt(site);
    const deepAt = (x: number, y: number) => ctx.world.surfaceAt(x, y).kind === 'deep';
    const buoyAt = swimBuoy(site, island, deepAt);
    const star = drawStar(ctx, island, true);
    const buoy = buoyAt && ctx.scene.add.circle(buoyAt.x, buoyAt.y, 23, 0x26d8f5, 0.4)
      .setStrokeStyle(5, 0xd5faff).setDepth(DEPTH.objects);
    const splash = ctx.scene.add.circle(0, 0, 25, 0xaeeeff, 0.3).setStrokeStyle(5, 0xe7fbff)
      .setDepth(DEPTH.players + 1).setVisible(false);
    const direction = drawDirection(ctx);
    const props = buoy ? [star, splash, direction, buoy] : [star, splash, direction];
    props.forEach(prop => ctx.showOnlyTo(prop, player));
    const banner = (text: string) => ctx.bus.emit('ui:banner', { player, text });
    banner('Swim to the star!');
    let state = startSwim(player.move);
    let splashed = false;
    let swam = false;

    return {
      update(dt) {
        const { x, y, angle, airborne } = player.move;
        const deep = airborne === 0 && player.surface.kind === 'deep';
        const approachingDeep = player.controls.throttle > 0 && Math.hypot(x - island.x, y - island.y) < TUNING.stayNear
          && [TUNING.catchRadius / 3, TUNING.catchRadius * 2 / 3, TUNING.catchRadius]
            .some(ahead => deepAt(x + ahead * Math.cos(angle), y + ahead * Math.sin(angle)));
        state = stepSwim(state, player.move, island, player.traits.water, deep, approachingDeep, dt);
        if (!splashed && state.splashing > 0) {
          splashed = true;
          banner('Splish! Try floaties.');
        }
        if (!swam && state.distance >= TUNING.swimDistance) {
          swam = true;
          banner('Now get the star!');
          buoy?.setVisible(false);
        }
        const goal = swam ? island : buoyAt ?? island;
        const dx = goal.x - x, dy = goal.y - y;
        const heading = Math.atan2(dy, dx);
        const reach = 106;
        direction.setVisible(Math.hypot(dx, dy) > reach + 28)
          .setPosition(x + reach * Math.cos(heading), y + reach * Math.sin(heading)).setRotation(heading);
        buoy?.setScale(1 + 0.15 * Math.sin(state.elapsed * 5));
        splash.setVisible(state.splashing > 0).setScale(1 + state.splashing * 2)
          .setPosition(x + 37 * Math.cos(angle), y + 37 * Math.sin(angle));
        return state.outcome;
      },
      destroy() { props.forEach(prop => prop.destroy()); },
    };
  },
};

export default islandSwim;
