import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef, type PlayerControls, type WorldContext } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { startDig, stepDig } from './digSpot/state';

const TUNING = WORLD_ACTIVITIES.digSpot;
const spotsFor = (site: ActivitySite) => site.targets.length ? site.targets.map(target => target.at) : [site.at];

function drawMark(ctx: WorldContext, at: Vec, from: Vec) {
  const { add } = ctx.scene;
  const dirt = add.circle(0, 0, TUNING.radius, 0x703e2b).setStrokeStyle(4, 0xffcd89);
  const cross = [-Math.PI / 4, Math.PI / 4].map(angle =>
    add.rectangle(0, 0, 54, 10, 0xffe5b0).setRotation(angle));
  return add.container(at.x, at.y, [dirt, ...cross])
    .setRotation(Math.atan2(at.y - from.y, at.x - from.x)).setDepth(DEPTH.decals + 1);
}

const digSpot: ActivityKindDef = {
  kind: 'digSpot',
  decorate(ctx, site) {
    const marks = spotsFor(site).map(at => drawMark(ctx, at, site.at));
    return () => marks.forEach(mark => mark.destroy());
  },
  start(ctx, site, player) {
    let state = startDig(spotsFor(site));
    // The host consumes the start press. Count it if the player was already parked on an X.
    let startingPress = true;
    const stars = state.spots.map(at => ctx.scene.add.star(at.x, at.y, 5, 13, 29, 0xffd35d)
      .setStrokeStyle(3, 0xfff2bf).setDepth(DEPTH.objects).setVisible(false));
    const meter = ctx.scene.add.circle(0, 0, TUNING.radius + 12, 0xffffff, 0)
      .setStrokeStyle(6, 0xffdb63).setDepth(DEPTH.players + 1).setVisible(false);
    const clods = [0, 1, 2].map(i => ctx.scene.add.circle(0, 0, 9 - i, 0xd58c54)
      .setStrokeStyle(2, 0x70452f).setDepth(DEPTH.players + 1).setVisible(false));
    const props = [...stars, meter, ...clods];
    props.forEach(prop => ctx.showOnlyTo(prop, player));
    const banner = (text: string) => ctx.bus.emit('ui:banner', { player, text });
    const controls = () => player.controls as PlayerControls & { held?: { a: boolean } };
    banner(controls().held === undefined ? 'Park on an X. Tap A!' : 'Park on an X. Hold A!');

    return {
      update(dt) {
        const before = state;
        const { pressed, held } = controls();
        const { vx, vy, airborne } = player.move;
        const speed = airborne === 0 ? Math.hypot(vx, vy) : Infinity;
        state = stepDig(state, player.move, speed, player.traits.dig,
          { pressed: startingPress || pressed.a, held: held?.a }, dt);
        startingPress = false;
        if (!before.stuck && state.stuck) banner('Just a dirt mustache!');
        stars.forEach((star, index) => star.setVisible(state.uncovered[index]));
        meter.setVisible(state.stroke > 0);
        clods.forEach(clod => clod.setVisible(state.stroke > 0 || state.stuck > 0));
        const at = state.spots[state.digging];
        if (at) {
          meter.setPosition(at.x, at.y).setScale(1 - 0.18 * state.stroke).setAlpha(0.35 + 0.65 * state.stroke);
          clods.forEach((clod, i) => {
            const phase = state.elapsed * 8 + i * 2 * Math.PI / clods.length;
            const radius = 53 + 9 * Math.sin(phase * 2);
            clod.setPosition(at.x + Math.cos(phase) * radius, at.y + Math.sin(phase) * radius);
          });
        }
        return state.outcome;
      },
      destroy() { props.forEach(prop => prop.destroy()); },
    };
  },
};

export default digSpot;
