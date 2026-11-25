import { PAINT, SIZE_SCALE } from '../../art/race/looks';
import { WS_RUN } from '../../config';
import type { StageContext } from '../types';
import { ell, ol, rr, spec } from '../common/draw';
import { along } from '../common/fx';
import { racePlayer } from '../common/phases';
import { playPractice } from '../common/practice';
import type { PracticeBeat } from '../common/practicePlan';
import { P } from '../common/props';
import { Cable, SideStage, type SideOpts } from '../common/side';
import { slopeProfile } from '../common/terrain';

const T = WS_RUN.practice;
const START = 330;
const TEST = 950;
type Task = (s: SideStage, beat: PracticeBeat) => Promise<void>;

function scene(task: Task, options: (beat: PracticeBeat) => Partial<SideOpts> = () => ({})) {
  return async (ctx: StageContext, beat: PracticeBeat): Promise<void> => {
    const s = new SideStage(ctx, {
      worldW: 2100, clouds: 3, sun: true,
      hills: [{ color: '#b5e5aa', h: 245, f: 0.2 }, { color: '#80cd83', h: 150, f: 0.4, seed: 4 }],
      ...options(beat),
    });
    for (const x of [135, 660, 1370, 1560]) {
      s.put('back', P.bush(), x + ctx.rng.int(-32, 32), undefined, 0.85);
    }
    s.place(START);
    s.follow = null;
    ctx.rig.play('idle');
    await task(s, beat);
    if (beat.passed) {
      await s.cheer(T.holdMs);
    } else {
      ctx.rig.play('dizzy');
      ctx.audio.sfx('wobble', { volume: 0.55 });
      const stars = s.dizzy();
      await ctx.wait(T.holdMs);
      stars.stop();
    }
  };
}

function rev(s: SideStage): void {
  s.ctx.audio.sfx('engineRev', { volume: 0.52 });
}

function tireCourse(id: string) {
  switch (id) {
    case 'wheels.mud': return 'mud';
    case 'wheels.snow': return 'snow';
    case 'wheels.monster': return 'rocks';
    default: return 'track';
  }
}

const wheels = scene(async (s, { part, passed }) => {
  const course = tireCourse(part.id);
  if (course === 'mud' || course === 'snow') {
    s.pool({ x0: 655, x1: 1160, depth: 100, kind: course, frontAlpha: 0.8 });
    s.put('back', course === 'snow' ? P.snowman() : P.barn(), 1225);
  } else if (course === 'rocks') {
    for (const x of [745, 935, 1070]) s.put('back', P.rock(180, 80), x);
  } else {
    s.put('back', P.checker(), 1220, -130, 1.35);
    for (const x of [660, 870, 1080]) s.put('back', P.cone(), x);
    s.add('back', s.scene.add.rectangle(915, -9, 535, 18, 0x596473));
  }
  await s.driveTo(600, T.approachMs);
  rev(s);
  const spray = s.spray(course === 'mud' || course === 'snow' ? course : 'dust');
  const start = s.car.x;
  const end = passed ? 1250 : 870;
  s.ctx.rig.play(passed ? 'drive' : 'spinWheels');
  await along(s.ctx, T.actionMs, (t) => {
    const middle = Math.sin(Math.PI * t);
    s.car.x = start + (end - start) * t + (passed ? 0 : Math.sin(t * 50) * 12 * t);
    s.car.y = course === 'rocks' ? -Math.abs(Math.sin(t * Math.PI * 3)) * middle * 55
      : course === 'track' ? 0 : (passed ? middle * 24 : t * 58);
    s.car.rotation = Math.sin(t * 31) * 0.045 * middle;
  }, 'Sine.easeOut');
  spray.stop();
  s.ctx.rig.play('idle');
  if (!passed) {
    s.ctx.audio.sfx(course === 'mud' ? 'splat' : 'skid');
    const frog = s.put('front', P.frog(), 1100, -8, 1.35);
    await s.hop(frog, s.car.x + 80, s.car.y + s.ctx.rig.anchor('roof').y, T.reactionMs, 200);
  }
});

const engine = scene(async (s, { part, passed }) => {
  s.put('back', P.flag('#ffd23f'), 1210, s.groundAt(1210), 1.45);
  s.put('back', P.gasPump(), 390, 0, 1.25);
  await s.driveTo(550, T.approachMs);
  s.ctx.audio.sfx('engineRev', { volume: part.id === 'engine.electric' ? 0.25 : 0.65 });
  const smoke = s.spray(part.id === 'engine.electric' && passed ? 'sparkle' : 'smoke', 'exhaust');
  await s.driveTo(passed ? 1160 : 855, T.actionMs, passed ? 'Sine.easeInOut' : 'Quad.easeOut',
    passed ? 'drive' : 'spinWheels');
  smoke.stop();
  if (!passed) {
    s.ctx.audio.sfx('boing');
    await s.driveTo(620, T.reactionMs);
  }
}, ({ part }) => ({
  terrain: slopeProfile({ x0: 575, length: 600, tan: part.id === 'engine.big' || part.id === 'engine.turbo' ? 0.56 : 0.4 }),
}));

const gears = scene(async (s, { part, passed }) => {
  const slow = part.id === 'gears.climbing' || part.id === 'gears.fourByFour';
  const flags = [660, 875, 1100].map((x, i) => s.put('back', P.flag(['#ffd23f', '#ff8f5c', '#62b858'][i]), x));
  await s.driveTo(500, T.approachMs);
  const points = passed ? [680, 900, 1220] : [645, 990, 795];
  for (const [i, x] of points.entries()) {
    s.ctx.audio.sfx('engineRev', { rate: 0.75 + i * 0.24, volume: 0.48 });
    await s.driveTo(x, T.actionMs / 3, slow ? 'Linear' : 'Sine.easeIn', !passed && i === 2 ? 'spinWheels' : 'drive');
    if (passed) await s.ctx.tween({ targets: flags[i], angle: 15, duration: 110, yoyo: true });
  }
  if (!passed) s.ctx.audio.sfx('skid');
});

const springs = scene(async (s, { part, passed }) => {
  const high = part.id === 'springs.lifted' || part.id === 'springs.bouncy';
  for (const x of [690, 865, 1040]) s.put('back', P.hay(), x, 42, high ? 0.85 : 0.62);
  await s.driveTo(535, T.approachMs);
  s.ctx.rig.play('drive');
  const height = high ? 95 : 48;
  await along(s.ctx, T.actionMs, (t) => {
    const bounce = Math.abs(Math.sin(t * Math.PI * 3));
    s.car.x = 535 + t * (passed ? 670 : 420);
    s.car.y = -bounce * (passed ? height : height + t * 95);
    s.car.rotation = passed ? 0 : Math.sin(t * 14) * t * 0.25;
  });
  s.ctx.audio.sfx('boing');
  await s.squash(passed ? 1.06 : 1.26, passed ? 0.94 : 0.76, T.reactionMs / 2);
});

const bumpers = scene(async (s, { part, passed }) => {
  const roll = s.put('mid', P.logRound(part.id === 'bumpers.pusher' ? 174 : 120), TEST, -60);
  const stop = TEST - s.ctx.rig.anchor('front').x - 62;
  await s.driveTo(stop, T.approachMs);
  s.ctx.audio.sfx('boing');
  if (passed) {
    await along(s.ctx, T.actionMs, (t) => {
      s.car.x = stop + 255 * t;
      roll.x = TEST + 330 * t;
      roll.rotation = 5 * t;
    }, 'Sine.easeInOut');
  } else {
    await s.squash(0.83, 1.17, T.reactionMs / 2);
    await s.driveTo(stop - 110, T.actionMs, 'Elastic.easeOut');
  }
});

const paint = scene(async (s, { part, passed }) => {
  const look = PAINT[part.id];
  const color = look.bands ? 'rainbow' : look.main;
  const booth = spec('practice-photo-booth', 480, 345, (g) => {
    ol(g, '#fcf3dd', rr(17, 66, 446, 273, 25), 7);
    ol(g, '#f487ab', rr(4, 25, 472, 100, 24), 7);
    ol(g, '#ffe6a1', rr(68, 148, 198, 175, 10));
    ol(g, '#90d7ec', rr(296, 156, 129, 92, 18));
    ol(g, '#394e68', ell(361, 202, 31, 31));
    ol(g, '#c8f7ff', ell(351, 191, 11, 9));
  });
  s.put('back', booth, 1010);
  const judge = s.put('back', P.person('#8059bb', '#ffe69d', 'wave'), 1215, 0, 1.2);
  const card = s.put('front', P.marshalCard(color), 1290, -152, 1.75);
  for (const [i, x] of [645, 1410].entries()) {
    s.put('back', P.balloon(i === 0 ? look.light : look.accent), x, -140, 1.6);
  }
  await s.driveTo(845, T.approachMs);
  s.ctx.rig.play('idle');
  await s.ctx.tween({ targets: card, y: -235, duration: T.reactionMs, ease: 'Back.easeOut' });
  await s.ctx.wait(T.actionMs / 2);
  if (passed) {
    const flash = s.scene.add.rectangle(0, 0, s.ctx.size.w, s.ctx.size.h, 0xffffff, 0.68).setOrigin(0);
    s.overlay.add(flash);
    s.ctx.audio.sfx('click');
    await s.ctx.tween({ targets: flash, alpha: 0, duration: T.reactionMs });
    flash.destroy();
    await s.hop(judge, judge.x, judge.y, T.reactionMs, 95);
  } else {
    s.ctx.audio.sfx('wobble');
    await s.ctx.tween({ targets: [judge, card], angle: -18, duration: T.reactionMs, yoyo: true });
    await s.squash(1.08, 0.89);
  }
});

const body = scene(async (s, { part, passed }) => {
  const mount = s.ctx.rig.bodyMount?.();
  const load = part.id === 'body.van' || part.id === 'body.truck' ? 3 : 2;
  const roof = s.ctx.rig.anchor('roof');
  s.put('back', P.store(), 1130);
  await s.driveTo(635, T.approachMs);
  s.ctx.rig.play('idle');
  const boxes = Array.from({ length: load }, (_, i) =>
    s.put('front', P.crate(), s.car.x + i * 62 - 60, -620, 0.7));
  await Promise.all(boxes.map((box) => s.ctx.tween({ targets: box, y: roof.y - 12, duration: T.reactionMs, ease: 'Bounce.easeOut' })));
  if (passed && mount) {
    for (const box of boxes) {
      box.x -= s.car.x;
      mount.add(box);
      s.ctx.layer.once('destroy', () => box.destroy());
    }
    await s.driveTo(1090, T.actionMs);
  } else {
    await Promise.all(boxes.map((box, i) => s.hop(box, box.x + 175 + i * 25, -3, T.actionMs, 105)));
    s.ctx.audio.sfx('boing');
  }
});

const shape = scene(async (s, { part, passed }) => {
  const streamlined = part.id === 'shape.sleek' || part.id === 'shape.wedge';
  const flags = [680, 855, 1060, 1210].map((x) => s.put('back', P.flag('#ff8f5c'), x, -35, 1.45));
  for (const [i, flag] of flags.entries()) {
    void s.ctx.tween({ targets: flag, scaleX: -flag.scaleX, angle: -12, duration: 260 + i * 22,
      yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
  }
  await s.driveTo(555, T.approachMs);
  s.ctx.audio.sfx('whoosh');
  const wind = s.spray('dust', 'front', { speed: { min: 280, max: 540 }, angle: { min: 173, max: 187 } });
  if (passed) {
    await s.driveTo(1190, T.actionMs, streamlined ? 'Quad.easeIn' : 'Sine.easeInOut');
  } else {
    await s.driveTo(770, T.actionMs / 2, 'Quad.easeOut', 'spinWheels');
    await s.driveTo(495, T.actionMs / 2, 'Quad.easeOut');
  }
  wind.stop();
});

const size = scene(async (s, { part, passed }) => {
  const ratio = SIZE_SCALE[part.id] / SIZE_SCALE[s.ctx.model.size];
  const width = Math.round(s.ctx.rig.width * ratio + 45);
  const clearance = Math.round(s.ctx.rig.height * ratio + 30);
  s.put('back', P.arch(clearance, width), TEST);
  const button = s.put('front', P.plank(Math.round(width * 0.8), 'wood'), TEST, 6);
  await s.driveTo(610, T.approachMs);
  await s.driveTo(passed ? TEST : ratio < 1 ? TEST - width / 2 : TEST, T.actionMs);
  if (passed) {
    s.ctx.audio.sfx('click');
    await s.ctx.tween({ targets: button, y: 16, duration: T.reactionMs });
  } else {
    s.ctx.audio.sfx('boing');
    await s.driveTo(s.car.x - 155, T.reactionMs);
  }
});

const extra = scene(async (s, { part, passed }) => {
  const x = TEST;
  const water = part.id === 'extra.floats' || part.id === 'extra.snorkel';
  const winch = part.id === 'extra.winch';
  const rack = part.id === 'extra.roofRack';
  if (water) s.pool({ x0: 700, x1: 1160, depth: 165, kind: 'water', frontAlpha: 0.68 });
  const target = s.put('back', winch ? P.tractor() : rack ? P.crate() : P.checker(), x + 190, 0);
  if (!water && !winch && !rack) s.put('back', part.id === 'extra.rocket' ? P.ramp(245, 90) : P.cone(), 795);
  await s.driveTo(620, T.approachMs);
  const cable = winch && passed ? new Cable(s.scene, s.layers.front) : undefined;
  const start = s.car.x;
  const fx = water ? s.spray('splash') : undefined;
  const roof = s.ctx.rig.anchor('roof');
  if (rack) {
    await s.hop(target, passed ? start : start + 180, passed ? roof.y : 0, T.actionMs, 290);
  } else {
    s.ctx.audio.sfx(water ? 'splash' : 'whoosh');
    await along(s.ctx, T.actionMs, (t) => {
      const arc = Math.sin(t * Math.PI);
      if (winch) {
        target.x = x + 190 - (passed ? 270 : 18) * t;
        cable?.set(s.car.x + s.ctx.rig.anchor('front').x, -65, target.x - 75, -55);
      } else {
        s.car.x = start + (passed ? 635 * t : 230 * arc);
        if (water) s.car.y = arc * (passed ? part.id === 'extra.snorkel' ? 112 : 15 : 115);
        else if (part.id === 'extra.rocket') s.car.y = -arc * (passed ? 200 : 48);
        else s.car.rotation = arc * (passed ? 0.08 : -0.24);
      }
    }, 'Sine.easeInOut');
  }
  cable?.destroy();
  fx?.stop();
  if (!passed) {
    s.ctx.audio.sfx('boing');
    await s.squash(1.12, 0.89, T.reactionMs / 2);
  }
});

export const racePracticeScenes = { wheels, engine, gears, springs, bumpers, paint, body, shape, size, extra };

export default racePlayer('practice', (ctx) => playPractice(ctx, racePracticeScenes));
