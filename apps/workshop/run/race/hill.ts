/** A steep picnic hill. The engine labors on the grade, then either crests or rolls back into the hay. */
import { WS_RUN } from '../../config';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { slopeProfile } from '../common/terrain';

export default racePlayer('hill', async (ctx) => {
  const { slope, climbMs, stallProgress } = WS_RUN.hill;
  const plan = planStage(ctx, ['hill.power']);
  const level = Math.min(slope.length, plan.level('hill.power')) - 1;
  const spec = { x0: 810, length: 1090, tan: slope[level], ease: 175 };
  const ground = slopeProfile(spec);
  const crest = spec.x0 + spec.length;
  const S = new SideStage(ctx, {
    worldW: crest + 1270, terrain: ground, groundFrac: 0.76,
    sky: ['#6ec8ff', '#f4fbff'], clouds: 5, sun: true,
    hills: [{ color: '#bdeab0', h: 260, f: 0.12 }, { color: '#92dc8c', h: 170, f: 0.25, seed: 6 }],
  });
  const rig = ctx.rig;
  S.fx.seed(ctx.rng);
  S.followY = true;
  S.put('back', P.tree(), 205, 0, 0.95);
  const hayX = 420;
  const hay = S.put('back', P.hay(), hayX, 0, 0.94);
  S.put('back', P.roadWarning('hill'), 680);
  for (let x = 1090; x < crest - 80; x += 260) {
    S.put('back', P.bush('#3fa046'), x, ground(x) + 6, ctx.rng.range(0.6, 0.85));
  }
  const sheep = S.put('back', P.sheep(), 774, 0, 1.1);
  const hillSheepX = crest + 145;
  const hillSheep = S.put('back', P.sheep(), hillSheepX, ground(hillSheepX), 1.08).setFlipX(true);
  const flagX = crest + 315;
  const flag = S.put('back', P.flag('#e8434a'), flagX);
  S.put('back', P.towel(), crest + 460, ground(crest + 460) + 5, 1.48);
  S.put('back', P.umbrella(), crest + 650);
  S.put('back', P.crate('#f2cf5a'), crest + 565, undefined, 0.65);

  S.place(245);
  rig.play('idle');
  void S.hop(sheep, sheep.x + 24, sheep.y, 550, 38);
  await ctx.wait(600);
  const engine = ctx.audio.loop('engine', { volume: 0.42 });
  await S.driveTo(spec.x0 - 70, 1380, 'Sine.easeInOut');
  const approach = S.car.x;
  const strain = S.fx.stream(S.layers.front, 'smoke', null, 0, 0, 140 - level * 24, {
    speed: { min: 75, max: 145 }, angle: { min: 185, max: 235 }, tint: 0x9aa8b7,
  });
  const exhaust = rig.anchor('exhaust');
  const puffAtExhaust = (): void => {
    const { x, y, rotation: r } = S.car;
    strain.setPos(x + exhaust.x * Math.cos(r) - exhaust.y * Math.sin(r), y + exhaust.x * Math.sin(r) + exhaust.y * Math.cos(r));
  };
  puffAtExhaust();
  ctx.audio.sfx('engineRev', { volume: 0.65, rate: 0.9 + level * 0.08 });

  if (plan.ok) {
    await along(ctx, climbMs, (t) => {
      S.setCarX(approach + (crest - 100 - approach) * t);
      S.car.rotation -= Math.sin(t * 38) * 0.026 * Math.sin(t * Math.PI);
      puffAtExhaust();
    }, 'Sine.easeOut');
    void S.squash(1.035, 0.94, 145);
    ctx.audio.sfx('engineRev', { volume: 0.75, rate: 1.24 });
    const nearCrest = S.car.x;
    await along(ctx, 970, (t) => {
      S.setCarX(nearCrest + (crest + 352 - nearCrest) * t);
      puffAtExhaust();
    }, 'Quad.easeOut');
    strain.stop();
    engine();
    ctx.audio.sfx('honk', { volume: 0.45 });
    void S.hop(hillSheep, hillSheep.x - 32, hillSheep.y, 650, 88);
    void ctx.tween({ targets: flag, rotation: 0.16, duration: 240, yoyo: true, repeat: 1 });
    await S.squash(1.12, 0.82, 125);
    await S.cheer(960);
    await S.exit(700);
    return;
  }

  const stall = spec.x0 + spec.length * stallProgress[level];
  await along(ctx, 2100, (t) => {
    S.setCarX(approach + (stall - approach) * t);
    puffAtExhaust();
  }, 'Quad.easeOut');
  rig.play('spinWheels');
  const spin = ctx.audio.loop('spin', { volume: 0.60, rate: 0.9 });
  const rear = rig.anchor('wheelRear');
  const grit = S.fx.stream(S.layers.front, 'dust', null, S.car.x + rear.x, ground(S.car.x + rear.x), 90);
  await along(ctx, 940, (t) => {
    S.setCarX(stall + Math.sin(t * 35) * 6);
    puffAtExhaust();
  });
  grit.stop();
  strain.stop();
  spin();
  engine();
  ctx.audio.sfx('skid', { volume: 0.64 });
  const stop = hayX + 83 - rig.anchor('back').x;
  await S.driveTo(stop, 1540, 'Quad.easeIn');
  rig.play('idle');
  ctx.audio.sfx('thud', { volume: 0.58 });
  S.fx.burst(S.layers.front, 'hay', hayX + 52, -64, 15);
  void S.hop(sheep, sheep.x - 32, sheep.y, 560, 78);
  void ctx.tween({ targets: hay, scaleX: hay.scaleX * 0.76, scaleY: hay.scaleY * 1.12, duration: 130, yoyo: true });
  await S.squash(0.88, 1.06, 135);
  rig.play('dizzy');
  ctx.audio.sfx('sad', { volume: 0.44 });
  await ctx.wait(WS_RUN.failHoldMs);
});
