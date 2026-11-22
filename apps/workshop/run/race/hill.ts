/**
 * Hill: grassy hill with a picnic on top; slope steepness by hill.power level (3 = almost a wall) with a flag at the top.
 * Pass: chugs steadily up with exhaust puffs, reaches the picnic blanket and hops happily.
 * Fail: slows halfway, wheels spin, rolls gently backwards to a hay bale at the bottom; a sheep watches and chews.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { slopeProfile } from '../common/terrain';

const TAN = [0, 0.34, 0.54, 0.76];

export default racePlayer('hill', async (ctx) => {
  const plan = planStage(ctx, ['hill.power']);
  const lv = Math.min(3, plan.level('hill.power', 1));
  const spec = { x0: 900, length: 1150, tan: TAN[lv], ease: 160 };
  const f = slopeProfile(spec);
  const topX = spec.x0 + spec.length;
  const S = new SideStage(ctx, { worldW: topX + 1300, terrain: f, sky: ['#6ec8ff', '#f4fbff'], clouds: 5, sun: true, hills: [{ color: '#bdeab0', h: 260, f: 0.12 }, { color: '#92dc8c', h: 170, f: 0.25, seed: 6 }] });
  const rig = ctx.rig;
  S.followY = true;
  for (const x of [250, 560]) S.put('back', P.tree(), x, f(x) - 4, 0.9);
  for (let x = spec.x0 + 250; x < topX - 150; x += 330) S.put('back', P.bush('#3fa046'), x + ctx.rng.int(-40, 40), f(x) + 4, 0.7);
  S.put('back', P.hay(), 600, 0, 0.9);
  S.put('back', P.sheep(), 780, 0, 0.9);
  S.put('back', P.flag('#e8434a'), topX + 200, f(topX + 200));
  S.put('back', P.towel(), topX + 520, f(topX + 520) + 2, 1.5);
  S.put('back', P.umbrella(), topX + 760, f(topX + 760), 0.9);
  S.put('back', P.crate('#f2cf5a'), topX + 640, f(topX + 640), 0.6);
  S.put('back', P.tree(), topX + 1000, f(topX + 1000) - 4);
  S.place(180);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.45 });
  const puffs = S.spray('smoke', 'exhaust', { speed: { min: 20, max: 70 }, angle: { min: 170, max: 200 } }, 120);

  if (plan.ok) {
    await S.driveTo(spec.x0 - 60, 1400, 'Sine.easeIn');
    ctx.audio.sfx('engineRev', { volume: 0.5 });
    await S.driveTo(topX + 140, 3700 + lv * 400, 'Linear');
    puffs.stop(); eng();
    ctx.audio.sfx('honk', { volume: 0.5 });
    await S.driveTo(topX + 420, 800, 'Sine.easeOut');
    await S.cheer(900);
    await ctx.wait(300);
    await S.exit();
    return;
  }
  // fail: climbs part way, then slides back
  await S.driveTo(spec.x0 - 40, 1300, 'Sine.easeIn');
  const stall = spec.x0 + spec.length * (0.48 + 0.04 * (3 - lv));
  await S.driveTo(stall, 2600, 'Sine.easeOut');
  const spin = ctx.audio.loop('spin', { volume: 0.6 });
  rig.play('spinWheels');
  const dustS = S.spray('dust', 'wheelRear', { speed: { min: 60, max: 200 }, angle: { min: 140, max: 200 } }, 80);
  await ctx.wait(900);
  dustS.stop();
  spin(); puffs.stop(); eng();
  rig.play('idle');
  ctx.audio.sfx('sad', { volume: 0.5 });
  // roll back to the hay bale
  const x0 = S.car.x, back = rig.anchor('back');
  const stopX = 600 + 60 + Math.abs(back.x) + 14;
  await along(ctx, 2200, (t) => { S.setCarX(x0 + (stopX - x0) * t); }, 'Quad.easeIn');
  ctx.audio.sfx('thud', { volume: 0.7 });
  S.fx.burst(S.layers.front, 'hay', 600, -70, 16);
  void S.squash(0.92, 1.06, 100);
  S.dust(5);
  rig.play('dizzy');
  await ctx.wait(1500);
});
