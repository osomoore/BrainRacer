import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef, type WorldContext } from '../../core/runtime';
import type { ActivitySite } from '../../core/types';
import { dashGates, startDash, stepDash, type Gate } from './gateDash/state';

const TUNING = WORLD_ACTIVITIES.gateDash;
const gatesFor = (site: ActivitySite) => dashGates(site.at, site.targets.map(target => target.at).slice(0, 3));

function drawGate(ctx: WorldContext, gate: Gate) {
  const { add } = ctx.scene;
  const width = TUNING.halfWidth;
  const stripe = add.rectangle(0, 0, 8, width * 2, 0xffdf83);
  const posts = [-width, width].map(y => add.circle(0, y, 12, 0x304756).setStrokeStyle(4, 0xfff2c6));
  const shape = add.container(gate.at.x, gate.at.y, [stripe, ...posts])
    .setRotation(gate.angle).setDepth(DEPTH.decals + 1);
  return { shape, stripe, posts };
}

const gateDash: ActivityKindDef = {
  kind: 'gateDash',
  decorate(ctx, site) {
    const gates = gatesFor(site).map(gate => drawGate(ctx, gate).shape.setAlpha(0.62));
    return () => gates.forEach(gate => gate.destroy());
  },
  start(ctx, site, player) {
    const gates = gatesFor(site);
    let state = startDash(player.move);
    const { add } = ctx.scene;
    const numbers = gates.map(({ at }, index) => add.text(at.x, at.y, String(index + 1), {
      fontFamily: 'sans-serif', fontSize: '29px', fontStyle: 'bold', color: '#fff8d7',
      backgroundColor: '#263844', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(DEPTH.objects + 1));
    const markers = gates.map(gate => drawGate(ctx, gate));
    const timer = add.text(0, 0, `${TUNING.timeoutSeconds}s`, {
      fontFamily: 'sans-serif', fontSize: '29px', fontStyle: 'bold', color: '#fff8d7',
      backgroundColor: '#263844', padding: { x: 10, y: 3 },
    }).setOrigin(0.5).setDepth(DEPTH.popups);
    const objects = [...numbers, ...markers.map(marker => marker.shape), timer];
    objects.forEach(object => ctx.showOnlyTo(object, player));
    ctx.bus.emit('ui:banner', { player, text: 'Go through 1, 2, 3!' });
    let shownTime = TUNING.timeoutSeconds as number;

    return {
      update(dt) {
        state = stepDash(state, gates, player.move, dt);
        const rotation = -ctx.viewRotation(player);
        markers.forEach(({ stripe, posts }, index) => {
          const color = index < state.next ? 0x67dba1 : index === state.next ? 0xffd348 : 0x9babb2;
          stripe.setFillStyle(color);
          posts.forEach(post => post.setFillStyle(color));
          numbers[index].setRotation(rotation).setAlpha(index < state.next ? 0.45 : 1);
        });
        const seconds = Math.ceil(TUNING.timeoutSeconds - state.elapsed);
        if (seconds !== shownTime) {
          shownTime = seconds;
          timer.setText(`${seconds}s`).setColor(seconds <= 3 ? '#ffae81' : '#fff8d7');
        }
        const lift = 142, left = 142;
        timer.setPosition(player.move.x + lift * Math.sin(rotation) - left * Math.cos(rotation),
          player.move.y - lift * Math.cos(rotation) - left * Math.sin(rotation))
          .setRotation(rotation);
        return state.outcome;
      },
      destroy() { objects.forEach(object => object.destroy()); },
    };
  },
};

export default gateDash;
