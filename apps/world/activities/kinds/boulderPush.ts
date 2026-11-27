import type { ActivityKindDef, ActivityOutcome, WorldContext } from '../../core/runtime';
import type { Vec } from '../../core/types';
import { WORLD_ACTIVITIES } from '../../config';

const TUNING = WORLD_ACTIVITIES.boulderPush;

const close = (a: Vec, b: Vec, radius: number) => Math.hypot(a.x - b.x, a.y - b.y) <= radius;

/** Advances a boulder toward its spot when the player is close and moving with enough push. */
export function pushBoulder(at: Vec, spot: Vec, player: Vec, push: number, velocity: Vec, dt: number): Vec {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (push < TUNING.minPush || !close(at, player, TUNING.contactRadius) || speed < TUNING.minSpeed) return at;
  const dx = spot.x - at.x, dy = spot.y - at.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return spot;
  const aimed = (velocity.x * dx + velocity.y * dy) / (speed * distance);
  if (aimed < 0.2) return at;
  const amount = Math.min(distance, Math.min(TUNING.maxRollSpeed, TUNING.rollSpeed + push * TUNING.rollSpeedPerLevel) * dt);
  return { x: at.x + dx / distance * amount, y: at.y + dy / distance * amount };
}

export interface BoulderState { rocks: Vec[]; spots: Vec[]; elapsed: number; blocked: number }

export function stepBoulders(state: BoulderState, player: Vec, push: number, velocity: Vec, dt: number) {
  const rocks = state.rocks.map((rock, index) => pushBoulder(rock, state.spots[index], player, push, velocity, dt));
  const straining = push < TUNING.minPush && Math.hypot(velocity.x, velocity.y) >= TUNING.minSpeed
    && state.rocks.some((rock, i) => !close(rock, state.spots[i], TUNING.spotRadius)
      && close(rock, player, TUNING.contactRadius));
  const blocked = straining ? state.blocked + dt : 0;
  const elapsed = state.elapsed + dt;
  const outcome: ActivityOutcome = rocks.every((rock, index) => close(rock, state.spots[index], TUNING.spotRadius)) ? 'success'
    : blocked >= TUNING.blockedSeconds || elapsed >= TUNING.timeoutSeconds ? 'fail' : 'running';
  return { state: { rocks, spots: state.spots, elapsed, blocked }, outcome };
}

function marker(ctx: WorldContext, at: Vec, color: number, radius: number) {
  const sprite = ctx.scene.add.circle(at.x, at.y, radius, color, 0.8).setDepth(12);
  return sprite;
}

function boulderSprite(ctx: WorldContext, at: Vec) {
  const scene = ctx.scene;
  const body = scene.add.ellipse(at.x, at.y, 72, 62, 0x777b82, 1).setStrokeStyle(4, 0x484c52).setDepth(12);
  const facet = scene.add.ellipse(at.x - 11, at.y - 10, 22, 12, 0xa7abb0, 0.85).setDepth(13);
  const sprite = scene.add.container(at.x, at.y, [body, facet]).setDepth(12);
  body.setPosition(0, 0); facet.setPosition(-11, -10);
  return {
    sprite,
    setPosition(x: number, y: number) { sprite.setPosition(x, y); },
    setFillStyle(color: number, alpha: number) { body.setFillStyle(color, alpha); },
    destroy() { sprite.destroy(); },
  };
}

const boulderPush: ActivityKindDef = {
  kind: 'boulderPush',
  decorate(ctx, site) {
    const objects = site.targets.map(target => marker(ctx, target.at, 0xf2c84b, 28));
    return () => objects.forEach(object => object.destroy());
  },
  start(ctx, site, player) {
    const count = Math.min(3, Math.max(1, site.targets.length));
    const spots = site.targets.slice(0, count).map(target => ({ ...target.at }));
    const rocks = spots.map(spot => ({ x: spot.x + TUNING.rockOffsetX, y: spot.y + TUNING.rockOffsetY }));
    const marks = spots.map(at => marker(ctx, at, 0xf5d55f, 29));
    const sprites = rocks.map(at => boulderSprite(ctx, at));
    marks.forEach(sprite => ctx.showOnlyTo(sprite, player));
    sprites.forEach(sprite => ctx.showOnlyTo(sprite.sprite, player));
    let state: BoulderState = { rocks, spots, elapsed: 0, blocked: 0 };
    return {
      update(dt) {
        const stepped = stepBoulders(state, player.move, player.traits.push, { x: player.move.vx, y: player.move.vy }, dt);
        state = stepped.state;
        state.rocks.forEach((rock, index) => {
          sprites[index].setPosition(rock.x, rock.y);
          if (close(rock, spots[index], TUNING.spotRadius)) sprites[index].setFillStyle(0x76ce79, 0.95);
        });
        return stepped.outcome;
      },
      destroy() { [...marks, ...sprites].forEach(sprite => sprite.destroy()); },
    };
  },
};

export default boulderPush;
