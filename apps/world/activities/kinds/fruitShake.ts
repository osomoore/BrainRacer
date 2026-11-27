import type { ActivityKindDef, ActivityOutcome, WorldContext } from '../../core/runtime';
import type { Vec } from '../../core/types';
import { WORLD_ACTIVITIES } from '../../config';

const TUNING = WORLD_ACTIVITIES.fruitShake;

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** A low reach build can still try; reaching further makes a tree drop fruit sooner. */
export function canShakeTree(player: Vec, tree: Vec, reach: number, velocity?: Vec): boolean {
  const dist = distance(player, tree);
  if (dist > TUNING.treeBaseRadius + Math.max(0, reach) * TUNING.treeRadiusPerReach) return false;
  if (!velocity) return true;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= TUNING.shakeSpeed) return false;
  if (dist < 1) return true;
  const alignment = ((tree.x - player.x) * velocity.x + (tree.y - player.y) * velocity.y) / (dist * speed);
  return alignment > TUNING.bumpAlignment;
}

/** Push a dropped fruit toward its basket while the player nudges it. */
export function rollFruit(at: Vec, basket: Vec, player: Vec, reach: number, velocity: Vec, dt: number): Vec {
  if (distance(at, player) > TUNING.fruitContactRadius) return at;
  const dx = basket.x - at.x, dy = basket.y - at.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return basket;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < TUNING.shakeSpeed || (dx * velocity.x + dy * velocity.y) / (length * speed) <= TUNING.bumpAlignment) return at;
  const amount = Math.min(length, (TUNING.rollSpeed + Math.max(0, reach) * TUNING.rollSpeedPerReach) * dt);
  return { x: at.x + dx / length * amount, y: at.y + dy / length * amount };
}

export interface FruitState { trees: Vec[]; fruits: { at: Vec; basket: Vec; dropped: boolean }[]; elapsed: number; missed: number }

/** Bump trees within reach, then guide the dropped fruit into its nearby basket. */
export function stepFruit(state: FruitState, player: Vec, reach: number, velocity: Vec, dt: number) {
  const speed = Math.hypot(velocity.x, velocity.y);
  let missed = state.missed;
  const fruits = state.fruits.map((fruit, index) => {
    const nearTree = distance(player, state.trees[index]) <= TUNING.treeBaseRadius + 50;
    const canShake = canShakeTree(player, state.trees[index], reach, velocity);
    if (!fruit.dropped && speed > TUNING.shakeSpeed && nearTree && !canShake) missed += dt;
    let next = fruit;
    if (!fruit.dropped && canShake) {
      next = { ...fruit, dropped: true, at: { x: state.trees[index].x + TUNING.dropOffsetX, y: state.trees[index].y + TUNING.dropOffsetY } };
      missed = 0;
    }
    if (next.dropped && distance(next.at, next.basket) > TUNING.basketRadius) {
      next = { ...next, at: rollFruit(next.at, next.basket, player, reach, velocity, dt) };
    }
    return next;
  });
  const elapsed = state.elapsed + dt;
  const success = fruits.every(fruit => fruit.dropped && distance(fruit.at, fruit.basket) <= TUNING.basketRadius);
  const outcome: ActivityOutcome = success ? 'success' : missed >= TUNING.missedReachSeconds || elapsed >= TUNING.timeoutSeconds ? 'fail' : 'running';
  return { state: { ...state, fruits, elapsed, missed }, outcome };
}

function treeSprite(ctx: WorldContext, at: Vec) {
  const scene = ctx.scene;
  const trunk = scene.add.rectangle(0, 20, 20, 56, 0x80512d).setDepth(12);
  const crown = [scene.add.circle(-17, -7, 27, 0x2d7439), scene.add.circle(12, -17, 31, 0x3f9147), scene.add.circle(29, 4, 23, 0x347d3d)];
  const sprite = scene.add.container(at.x, at.y, [trunk, ...crown]).setDepth(12);
  return sprite;
}

function basketSprite(ctx: WorldContext, at: Vec) {
  const scene = ctx.scene;
  const base = scene.add.rectangle(0, 0, 66, 35, 0xb97d35).setStrokeStyle(4, 0x704a24);
  const rim = scene.add.rectangle(0, -18, 76, 9, 0xe0b65f).setStrokeStyle(2, 0x704a24);
  const bars = [-18, 0, 18].map(x => scene.add.rectangle(x, 1, 5, 30, 0xe5bd70));
  return scene.add.container(at.x, at.y, [base, rim, ...bars]).setDepth(12);
}

const fruitShake: ActivityKindDef = {
  kind: 'fruitShake',
  decorate(ctx, site) {
    const trees = site.targets.map(target => treeSprite(ctx, target.at));
    return () => trees.forEach(tree => tree.destroy());
  },
  start(ctx, site, player) {
    const count = Math.min(3, Math.max(1, site.targets.length));
    const trees = site.targets.slice(0, count).map(target => ({ ...target.at }));
    const baskets = trees.map((tree, index) => ({ x: tree.x + (index % 2 ? -TUNING.basketOffsetX : TUNING.basketOffsetX), y: tree.y + TUNING.basketOffsetY }));
    const fruits = trees.map((tree, index) => ({ at: { ...tree }, dropped: false, basket: baskets[index] }));
    const fruitSprites = fruits.map(fruit => ctx.scene.add.ellipse(fruit.at.x, fruit.at.y, 30, 24, 0xe94d44, 1).setStrokeStyle(2, 0xa72b2b).setDepth(13));
    const basketSprites = baskets.map(at => basketSprite(ctx, at));
    [...fruitSprites, ...basketSprites].forEach(sprite => ctx.showOnlyTo(sprite, player));
    let state: FruitState = { trees, fruits, elapsed: 0, missed: 0 };
    return {
      update(dt) {
        const stepped = stepFruit(state, player.move, player.traits.reach, { x: player.move.vx, y: player.move.vy }, dt);
        state = stepped.state;
        state.fruits.forEach((fruit, index) => {
          fruitSprites[index].setPosition(fruit.at.x, fruit.at.y);
          if (fruit.dropped && distance(fruit.at, fruit.basket) <= TUNING.basketRadius) fruitSprites[index].setFillStyle(0x76ce79, 1);
        });
        return stepped.outcome;
      },
      destroy() { [...fruitSprites, ...basketSprites].forEach(sprite => sprite.destroy()); },
    };
  },
};

export default fruitShake;
