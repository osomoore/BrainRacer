import { SIZE_SCALE, SKIN } from '../../art/dino/looks';
import { WS_RUN } from '../../config';
import { circ, ell, fl, line, ol, prop, rr, spec } from '../common/draw';
import { playPractice } from '../common/practice';
import type { PracticeBeat } from '../common/practicePlan';
import { P } from '../common/props';
import { Act, Bird, Critter, Friend, backdrop, fernKey, fruitKey, grassKey } from './kit';
import type { PalName } from './kit';
import type { ScenarioPlayer, StageContext } from '../types';

const T = WS_RUN.practice;
type Task = (a: Act, beat: PracticeBeat) => Promise<void>;

function scene(task: Task, palette: (id: string) => PalName = () => 'meadow') {
  return async (ctx: StageContext, beat: PracticeBeat): Promise<void> => {
    const a = new Act(ctx);
    ctx.layer.once('destroy', () => a.dispose());
    try {
      backdrop(a, palette(beat.part.id), { sunAt: [a.W * 0.17, 150, 0.75] });
      a.img('flowers', a.W * 0.11, a.gy + 10, 0.95);
      a.img('flowers', a.W * 0.93, a.gy + 10, 0.75);
      a.place(a.W * 0.22);
      a.play('idle');
      await task(a, beat);
      if (beat.passed) {
        await a.celebrate(T.holdMs);
      } else {
        a.sfx('wobble', { volume: 0.55 });
        a.play('dizzy');
        const head = a.pt('headTop');
        const stop = a.stars(head.x, head.y - 40);
        await a.hold(T.holdMs);
        stop();
      }
    } finally {
      a.dispose();
    }
  };
}

const color = scene(async (a, { part, passed }) => {
  const look = SKIN[part.id];
  const x = a.W * 0.59;
  const h = Math.ceil(Math.max(310, a.rig.height * a.rs + 20) / 20) * 20;
  const screen = spec(`practice-hide:${part.id}`, 608, 410, (g) => {
    // Overlapping leaf crowns make a broad matching patch for the little hide-and-seek game.
    for (const [x, y, rx, ry, tilt] of [
      [118, 244, 106, 131, -0.42], [176, 131, 100, 111, -0.43], [300, 141, 123, 131, 0.1],
      [440, 144, 115, 118, 0.42], [511, 248, 85, 125, 0.41],
    ]) {
      ol(g, look.dark, ell(x, y, rx, ry, tilt), 7);
      fl(g, look.main, ell(x, y - 10, rx - 10, ry - 14, tilt));
    }
    fl(g, look.main, rr(41, 229, 526, 166, 45));
    for (const [i, [x, y]] of [[71, 213], [133, 128], [201, 84], [304, 65], [393, 111], [473, 108],
      [537, 202], [94, 301], [173, 330], [303, 288], [427, 345], [520, 320]].entries()) {
      fl(g, look.spots ? look.accent : look.light, ell(x, y, 13, 24, i % 2 ? -0.55 : 0.55));
    }
  }, 304, 400);
  const hideout = prop(a.scene, a.world, screen, x, a.gy - 15);
  hideout.displayHeight = h;
  hideout.displayWidth = Math.max(560, a.rig.width * a.rs + 105);
  const fronds = [x - 260, x + 253].map((px) =>
    prop(a.scene, a.fore, P.bush(look.main), px, a.gy, 1.64));
  const seeker = new Critter(a, 'frog', a.W * 0.88, a.gy - 10, 1.05);
  seeker.box.scaleX *= -1;
  await a.walkTo(x, T.approachMs, 'walk');
  a.play('crouch');
  a.sfx('rustle');
  if (passed) await a.tw({ targets: a.root, alpha: 0.16, duration: T.reactionMs });
  else await a.wobble(a.root, 0.06, T.reactionMs / 4, 2);
  a.ctx.buddySearch?.(true);
  await seeker.skipTo(a.W * 0.76, T.actionMs / 2, 2, 44);
  a.sfx('sniff');
  a.ctx.buddySearch?.(false);
  if (passed) {
    await seeker.skipTo(a.W + 150, T.actionMs / 2, 2, 54);
    await a.tw({ targets: a.root, alpha: 1, duration: T.reactionMs });
    for (const f of fronds) void a.wobble(f, 0.1, 125, 2);
  } else {
    seeker.mood('giggle');
    a.sfx('giggle');
    const head = a.pt('headTop');
    void a.floatIcon('p:exclaim', head.x, head.y - 66, 1.05);
    await a.hop(74, T.actionMs / 2, x - 125);
  }
}, (id) => id === 'color.sandy' || id === 'color.orange' ? 'desert' : 'forest');

function snack(id: string) {
  if (id === 'teeth.flat') {
    return spec('practice-lettuce', 160, 140, (g) => {
      for (const [x, y, rot] of [[56, 66, -0.58], [103, 62, 0.52], [78, 61, 0]] as const) {
        ol(g, '#6ad151', ell(x, y, 34, 53, rot), 5);
        line(g, x - Math.sin(rot) * 33, y + 37, x + Math.sin(rot) * 27, y - 26, 4, '#348949');
      }
    }, 80, 124);
  }
  if (id === 'teeth.beak') return null;
  return spec(`practice-cracker:${id}`, 154, 154, (g) => {
    ol(g, '#d98d41', rr(10, 10, 134, 134, 30), 6);
    ol(g, '#ffce7a', rr(17, 17, 120, 116, 26), 4);
    const count = id === 'teeth.mega' ? 3 : id === 'teeth.sharp' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      for (const y of [57, 93]) fl(g, '#b57846', circ(77 + (i - (count - 1) / 2) * 29, y, 7));
    }
  }, 77, 145);
}

const teeth = scene(async (a, { part, passed }) => {
  const x = a.W * 0.68;
  const stump = a.img('stump', x, a.gy + 6, 1.4);
  const foodY = a.gy - 208;
  const meal = snack(part.id);
  const food = meal ? prop(a.scene, a.fore, meal, x, foodY, part.id === 'teeth.mega' ? 1.32 : 1)
    : a.img('nut:2', x, foodY + 6, 0.71, a.fore);
  const friend = new Friend(a, a.W * 0.87, a.gy, 0.88);
  const mouthDx = a.pt('mouth').x - a.root.x;
  await a.walkTo(x - mouthDx - 90, T.approachMs);
  a.play('chomp');
  a.sfx('chomp', { volume: 0.65 });
  await a.tw({ targets: a.root, x: a.root.x + 48, duration: T.reactionMs });
  if (passed) {
    if (!meal) {
      const halves = [-1, 1].map((side) => a.img(side < 0 ? 'nutHalfL' : 'nutHalfR', x, foodY, 0.7, a.fore));
      const treat = a.img('treat', x, foodY - 66, 1.05, a.fore);
      food.setVisible(false);
      a.sfx('pop');
      await Promise.all(halves.map((half, i) => a.arc2(half, x, foodY, x + (i ? 110 : -110), a.gy, 90, T.reactionMs)));
      const mouth = a.pt('mouth');
      await a.move(treat, mouth.x, mouth.y, T.reactionMs);
      treat.setVisible(false);
    } else {
      const mouth = a.pt('mouth');
      await a.tw({ targets: food, x: mouth.x, y: mouth.y + 26,
        scaleX: food.scaleX * 0.18, scaleY: food.scaleY * 0.18, duration: T.reactionMs });
      food.setVisible(false);
      void a.burst(part.id === 'teeth.flat' ? 'leaf' : 'spark', mouth.x, mouth.y, { n: 7, scale: 0.9 });
      await a.wait(T.reactionMs);
    }
    a.sfx('gulp');
    a.play('happy');
    await friend.cheer(34, 2);
  } else {
    await a.wobble(food, 0.18, 95, 2);
    a.sfx('boing');
    await Promise.all([
      a.arc2(food, food.x, food.y, x + 150, a.gy, 150, T.actionMs * 0.65, 1.1),
      a.hop(70, T.actionMs * 0.65, a.root.x - 90),
      a.wobble(stump, 0.045, 110, 2),
    ]);
  }
});

const head = scene(async (a, { part, passed }) => {
  const tall = part.id === 'head.longNeck';
  const loud = part.id === 'head.crest' || part.id === 'head.rex';
  const x = a.W * 0.71;
  const y = a.gy - (tall ? 440 : loud ? 275 : 142);
  a.img(tall ? 'trunk' : 'stump', x + 15, a.gy + 8, tall ? 0.86 : 1.15);
  const target = loud ? a.img('p:feather', x, y, 1.7) : tall ? a.img(fruitKey('ff8a2a'), x, y, 1.4)
    : a.img(part.id === 'head.horned' ? 'nut:1' : 'treat', x, y, 0.8);
  await a.walkTo(x - (a.pt('front').x - a.root.x) - 80, T.approachMs);
  a.play(loud ? 'chomp' : 'stand');
  a.sfx(loud ? 'roar' : 'boing', { volume: 0.55 });
  if (passed) {
    const mouth = a.pt('mouth');
    await a.arc2(target, x, y, loud ? x + 165 : mouth.x, loud ? y - 150 : mouth.y, 95, T.actionMs);
    if (!loud) target.setVisible(false);
    a.sfx(loud ? 'whoosh' : 'gulp');
  } else {
    await a.wobble(target, 0.2, T.reactionMs / 3, 2);
    await a.hop(50, T.actionMs / 2, a.root.x - 90);
  }
});

const claws = scene(async (a, { part, passed }) => {
  const x = a.W * 0.71;
  const dig = part.id === 'claws.digging';
  const climb = part.id === 'claws.hooks' || part.id === 'claws.grabby';
  const y = a.gy - (climb ? 180 : 30);
  const mound = a.img(dig ? 'dirt' : climb ? 'rock:b' : 'log', x, a.gy + 8, 0.83);
  const prize = a.img('treat', x, y, 0.95).setVisible(!dig);
  await a.walkTo(x - (a.pt('front').x - a.root.x) - 60, T.approachMs);
  a.sfx('rustle');
  a.play(dig ? 'crouch' : 'stand');
  if (dig) void a.burst('dust', x, a.gy - 35, { n: 9, scale: 1.3 });
  if (passed) {
    if (dig) await a.tw({ targets: mound, scaleY: 0.15, duration: T.reactionMs });
    if (climb) await a.hop(110, T.reactionMs, a.root.x + 82);
    prize.setVisible(true);
    await a.arc2(prize, x, y, a.root.x + 155, a.gy - 290, 96, T.actionMs * 0.65);
    a.sfx('pop');
  } else {
    await a.shake(mound, 9, 70, 4);
    await a.hop(40, T.actionMs * 0.67, a.root.x - 95);
    a.sfx('boing');
  }
});

const legs = scene(async (a, { part, passed }) => {
  const swim = part.id === 'legs.flippers';
  const x = a.W * 0.65;
  if (swim) {
    a.img('water', x - 180, a.gy - 40).setDisplaySize(385, 140);
    a.img('waveTop', x - 180, a.gy - 32).setDisplaySize(385, 42);
  } else {
    for (const [i, dx] of [-110, 0, 110].entries()) {
      a.img('rock:c', x + dx, a.gy + 7, 0.5 + i * (part.id === 'legs.short' ? 0.04 : 0.18));
    }
  }
  await a.walkTo(x - 240, T.approachMs);
  if (passed) {
    if (swim) {
      a.play('walk');
      void a.burst('drop', x, a.gy - 40, { n: 10 });
      await a.move(a.root, x + 210, a.gy, T.actionMs);
    } else {
      const high = part.id === 'legs.hoppy' ? 225 : 123;
      await a.hop(high, T.actionMs / 2, x, a.gy - 75);
      await a.hop(high * 0.65, T.actionMs / 2, x + 230);
    }
  } else {
    await a.hop(68, T.actionMs / 2, x - 115);
    a.sfx(swim ? 'splash' : 'boing');
    await a.hop(52, T.actionMs / 2, x - 185);
  }
});

const move = scene(async (a, { part, passed }) => {
  const x = a.W * 0.65;
  const fly = part.id === 'move.fly', swim = part.id === 'move.swim', stand = part.id === 'move.stand';
  const markerY = a.gy - (fly ? 390 : stand ? 330 : swim ? 25 : 90);
  if (swim) a.img('water', x - 195, a.gy - 42).setDisplaySize(400, 135);
  else if (!fly) {
    for (const dx of [-117, 0, 106]) a.img(grassKey(2), x + dx, a.gy, stand ? 1.6 : 1.1);
  }
  const hoop = a.img('p:ring', x, markerY, 1.05).setAngle(90);
  await a.walkTo(x - 240, T.approachMs);
  a.play(fly ? 'flap' : stand ? 'stand' : 'crouch');
  a.sfx(fly ? 'flap' : swim ? 'splash' : 'rustle');
  if (passed) {
    if (fly) await a.arc(x + 185, a.gy, 300, T.actionMs);
    else if (stand) await a.hop(90, T.actionMs, x - 35);
    else await a.move(a.root, x + 155, a.gy, T.actionMs, 'Sine.easeInOut');
    hoop.setTint(0xffd861);
    void a.burst('spark', x, markerY, { n: 7 });
  } else {
    await a.hop(52, T.actionMs / 2, x - 120);
    await a.hop(45, T.actionMs / 2, x - 205);
    a.sfx('boing');
  }
});

const tail = scene(async (a, { part, passed }) => {
  const x = a.W * 0.64;
  const ball = prop(a.scene, a.fore, part.id === 'tail.heavy' ? P.logRound(132) : P.beachBall(), x - 255, a.gy - 12, 1.5);
  const basket = a.img('nestFront', x - 430, a.gy + 7, 0.85, a.fore);
  await a.walkTo(x, T.approachMs);
  a.play('wag');
  const tail = a.pt('tail');
  const contact = Math.max(x - 345, Math.min(x - 82, tail.x));
  await a.move(ball, contact, ball.y, T.reactionMs);
  if (passed) {
    a.sfx('boing');
    await a.arc2(ball, contact, ball.y, basket.x, a.gy - 70, part.id === 'tail.long' ? 285 : 185, T.actionMs, -4);
  } else {
    a.sfx('wobble');
    await a.arc2(ball, contact, ball.y, contact + 75, a.gy - 30, 55, T.actionMs, 2);
  }
});

const body = scene(async (a, { part, passed }) => {
  const x = a.W * 0.69;
  const slim = part.id === 'body.slim', armor = part.id === 'body.armored', sail = part.id === 'body.sail';
  const propKey = slim ? 'dome' : armor ? 'rock:b' : sail ? 'snowmound' : 'water';
  const goal = a.img(propKey, slim || armor || sail ? x : x - 165, a.gy + (propKey === 'water' ? -45 : 4), slim ? 0.55 : 0.86);
  if (propKey === 'water') goal.setDisplaySize(365, 145);
  if (slim) a.img('hole', x - 74, a.gy - 75, 0.64);
  const friend = new Friend(a, a.W * 0.88, a.gy, 0.78);
  await a.walkTo(x - 240, T.approachMs);
  if (passed) {
    if (slim) {
      a.play('crouch');
      await a.tw({ targets: a.root, x: x - 64, scaleY: a.rs * 0.52, duration: T.actionMs / 2 });
      await a.tw({ targets: a.root, x: x + 124, scaleY: a.rs, duration: T.actionMs / 2 });
    } else if (armor || sail) {
      await a.walkTo(x - 120, T.actionMs / 2);
      a.sfx(armor ? 'boing' : 'sparkle');
      void a.burst(armor ? 'pebble' : 'snow', x - 70, a.gy - 135, { n: 10 });
      await a.tw({ targets: goal, scaleY: 0.1, alpha: 0.3, duration: T.actionMs / 2 });
    } else {
      a.sfx('splash');
      a.play('crouch');
      void a.burst('drop', x - 80, a.gy - 25, { n: 8 });
      await a.arc(x + 145, a.gy, 43, T.actionMs);
    }
    await friend.cheer(22, 2);
  } else {
    await a.walkTo(x - 146, T.actionMs / 2);
    a.sfx('boing');
    await a.hop(58, T.actionMs / 2, x - 235);
  }
}, (id) => id === 'body.sail' ? 'snow' : 'meadow');

const size = scene(async (a, { part, passed }) => {
  const x = a.W * 0.68;
  const ratio = SIZE_SCALE[part.id] / SIZE_SCALE[a.ctx.model.size];
  const opening = Math.round((a.rig.height * a.rs * ratio + 35) / 10) * 10;
  const burrow = a.img('dome', x + 66, a.gy + 7, 0.8);
  burrow.displayHeight = Math.max(315, opening + 80);
  const hole = a.img('hole', x, a.gy - opening / 2, 1);
  hole.setDisplaySize(opening * 1.12, opening);
  const friend = new Friend(a, a.W * 0.91, a.gy, 0.78);
  await a.walkTo(x - Math.min(300, opening / 2 + 70), T.approachMs);
  a.play('crouch');
  if (passed) {
    await a.tw({ targets: a.root, x, scaleX: a.rs * 0.68, scaleY: a.rs * 0.68, duration: T.actionMs / 2 });
    a.sfx('pop');
    void a.puff(x, a.gy - opening * 0.35, 1.1);
    await a.tw({ targets: a.root, x: x - 115, scaleX: a.rs, scaleY: a.rs, duration: T.actionMs / 2 });
    await friend.cheer(20, 2);
  } else {
    await a.wobble(a.root, 0.12, T.reactionMs / 3, 3);
    a.sfx('boing');
    await a.hop(65, T.actionMs * 0.72, a.root.x - 95);
  }
});

const extra = scene(async (a, { part, passed }) => {
  const x = a.W * 0.69;
  const glow = part.id === 'extra.glow';
  const frill = part.id === 'extra.frill';
  const feathers = part.id === 'extra.feathers';
  if (glow) {
    a.img('dome', x, a.gy + 8, 0.86);
    a.img('hole', x - 24, a.gy - 137, 1.2);
  } else if (feathers) a.img('snowmound', x, a.gy + 6, 1.15);
  else if (!frill) a.img(part.id === 'extra.camo' ? fernKey(7) : grassKey(1), x, a.gy + 10, 1.7, a.fore);
  const bird = new Bird(a, x + 123, a.gy - 166, 0.87);
  await a.walkTo(x - 100, T.approachMs);
  a.play(frill ? 'chomp' : 'crouch');
  if (passed) {
    if (glow || feathers) {
      const light = a.img('glow', x - 79, a.gy - 135, 5.5, a.fore).setAlpha(0);
      light.setTint(glow ? 0xffe576 : 0xfff3d5);
      await a.tw({ targets: light, alpha: 0.9, duration: T.actionMs / 2 });
      a.sfx('sparkle');
      await a.pop(bird.box, 1.17, T.reactionMs / 2);
      await a.wait(T.actionMs / 2);
    } else {
      a.sfx(frill ? 'roar' : 'rustle', { volume: 0.5 });
      bird.flap();
      await a.arc2(bird.box, bird.box.x, bird.box.y, a.W + 150, a.gy - 310, 115, T.actionMs);
      bird.rest();
    }
  } else {
    bird.mood('peck');
    await a.wait(T.reactionMs);
    bird.mood('laugh');
    a.sfx('giggle');
    await a.hop(55, T.actionMs, a.root.x - 115);
  }
}, (id) => id === 'extra.feathers' ? 'snow' : 'forest');

export const dinoPracticeScenes = { color, head, teeth, claws, legs, move, tail, body, size, extra };

export default {
  workshop: 'dino',
  scenario: 'practice',
  play: (ctx) => playPractice(ctx, dinoPracticeScenes),
} satisfies ScenarioPlayer;
