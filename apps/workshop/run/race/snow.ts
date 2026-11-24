/**
 * Snow: snowy mountain pass with pines and a snowman; an icy stretch whose length grows with snow.grip level.
 * Pass: grips and rolls steadily through, snow puffs behind, the snowman hops. Fail: wheels spin on the ice, the car slides
 * sideways in a slow spin and plops nose-first into a snowbank; the snowman's hat lands on the roof.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

const ICE = [0, 520, 760, 1000];

export default racePlayer('snow', async (ctx) => {
  const plan = planStage(ctx, ['snow.grip']);
  const lv = Math.min(3, plan.level('snow.grip', 1));
  const rig = ctx.rig;
  const S = new SideStage(ctx, { worldW: 4000, ground: ['#f4fbff', '#dcefff', '#bcd8ee'], sky: ['#a9c8e8', '#f0f8ff'], clouds: 4, hills: [{ color: '#dfeefa', h: 320, f: 0.12 }, { color: '#c4dcf0', h: 220, f: 0.28, seed: 7 }] });
  const ix = 1100, iw = ICE[lv];
  S.put('back', P.ice(iw), ix + iw / 2, 4);
  [300, 650, 2500, 2900, 3300].forEach((x, i) => S.put('back', P.pine(true), x, -4, 0.9 + (i % 2) * 0.2));
  const snowmanX = ix + iw + 380;
  const snowman = S.put('back', P.snowman(), snowmanX, 0);
  const bankX = ix + iw + 100;
  S.put('front', P.snowbank(320, 120), bankX, 6);
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  const puff = S.spray('snow', 'wheelRear', { speed: { min: 60, max: 200 }, angle: { min: 160, max: 220 } }, 90);

  if (plan.ok) {
    await S.driveTo(ix - 60, 1800);
    await S.driveTo(ix + iw + 460, 3600 + lv * 300, 'Linear');
    puff.stop(); eng();
    void along(ctx, 500, (t) => { snowman.y = -Math.sin(t * Math.PI) * 50; });
    await S.cheer(700);
    await S.exit();
    return;
  }
  await S.driveTo(ix + 80, 2000, 'Sine.easeIn');
  puff.stop();
  const spin = ctx.audio.loop('spin', { volume: 0.5 });
  ctx.audio.sfx('skid', { volume: 0.7 });
  rig.play('spinWheels');
  const wheel = rig.anchor('wheelFront');
  const pitch = 0.3;
  const stuckX = bankX - (wheel.x * Math.cos(pitch) - wheel.y * Math.sin(pitch));
  const x0 = S.car.x, end = stuckX - 40;
  await along(ctx, 2600, (t) => {
    S.car.x = x0 + (end - x0) * (1 - (1 - t) * (1 - t));
    S.car.rotation = Math.sin(t * Math.PI * 1.2) * 0.35 - t * 0.02;
    S.car.y = -Math.abs(Math.sin(t * 9)) * 5;
  }, 'Linear');
  spin(); eng();
  // plop nose-first into the snowbank
  ctx.audio.sfx('thud', { volume: 0.5 });
  const entryAngle = S.car.rotation, entryY = S.car.y;
  await along(ctx, 500, (t) => {
    S.car.rotation = entryAngle + (pitch - entryAngle) * t;
    S.car.y = entryY + (14 - entryY) * t;
    S.car.x = end + (stuckX - end) * t;
  }, 'Quad.easeIn');
  rig.setFrontWheelVisible?.(false);
  S.fx.burst(S.layers.front, 'snow', bankX, -40, 18);
  rig.play('idle');
  const hat = S.put('front', P.hat(), snowmanX, -200);
  const roof = rig.anchor('roof');
  await S.hop(hat, S.car.x + roof.x, S.car.y + roof.y - 20, 900, 260);
  ctx.audio.sfx('sad', { volume: 0.5 });
  rig.play('dizzy');
  await ctx.wait(1500);
});
