/**
 * Beach: a long road with mile signs and a gas pump, the beach with an umbrella far away (distance grows with beach.range level);
 * beach.load: beach toys (bucket, shovel, ball, towel, umbrella) ride on the roof.
 * Pass range: cruises past sign after sign and parks on the sand; a crab pinches the antenna flag. Pass load: toys spill onto the sand.
 * Fail range: sputters to a stop halfway, fuel icon on E, a seagull lands on the car. Fail load: toys fall off the back and roll down the road.
 */
import { type FacetPlay } from '../common/plan';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

export default racePlayer('beach', async (ctx) => {
  const plan = planStage(ctx, ['beach.load', 'beach.range']);
  const hasLoad = plan.has('beach.load');
  const lv = Math.min(3, plan.level('beach.range', 1));
  const rig = ctx.rig;
  const len = [0, 4200, 6200, 8400][lv];
  const sandX = len + 400;
  const S = new SideStage(ctx, { worldW: sandX + 1800, ground: ['#8b97a5', '#6b7684', '#5b6573'], sky: ['#6ec8ff', '#f2fbff'], clouds: 6, sun: true, hills: [{ color: '#b9e8c0', h: 260, f: 0.1 }, { color: '#8ad88f', h: 180, f: 0.25, seed: 15 }] });
  // sand and sea at the end
  const sand = ctx.scene.add.rectangle(sandX, -30, 2600, 1500, 0xf4d58a).setOrigin(0, 0).setStrokeStyle(0);
  S.add('back', sand);
  S.add('back', ctx.scene.add.rectangle(sandX + 1000, -300, 1600, 270, 0x4fb8ff).setOrigin(0, 0));
  S.put('back', P.umbrella(), sandX + 500, -4, 1.3);
  S.put('back', P.sandcastle(), sandX + 900, -4, 1.3);
  S.put('back', P.gasPump(), 500, 0);
  for (let x = 800, i = 1; x < len; x += 700, i++) S.put('back', P.mileSign(1 + (i % 6)), x, 0);
  for (let x = 400; x < len; x += 900) S.put('back', P.tree(), x + 300, -4, 0.8);
  const crab = S.put('mid', P.crab(), sandX + 700, 0);
  const roof = rig.anchor('roof'), back = rig.anchor('back');
  const toys: { img: ReturnType<typeof S.put>; x: number; y: number }[] = [];
  if (hasLoad) {
    const list = [P.umbrella(), P.bucket(), P.beachBall(), P.towel(), P.shovel()];
    const sc = [0.45, 1, 1, 1, 1];
    list.forEach((s, i) => {
      const x = roof.x - 40 + i * 28, y = roof.y - 2;
      const im = S.put('mid', s, 0, 0, sc[i]);
      rig.root.add(im);
      im.setPosition(x, y);
      toys.push({ img: im, x, y });
    });
  }
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.4 });

  const phases: Record<string, (p: FacetPlay) => Promise<void>> = {
    'beach.load': async (p: { pass: boolean }) => {
      if (p.pass) return;
      await S.driveTo(1200, 2600, 'Sine.easeIn');
      ctx.audio.sfx('rustle', { volume: 0.6 });
      toys.forEach((t, i) => {
        const wx = S.car.x + t.x * 0, wy = S.car.y + t.y;
        rig.root.remove(t.img);
        S.layers.front.add(t.img);
        t.img.setPosition(S.car.x + t.x, wy + wx * 0);
        S.fx.bits.add({ obj: t.img, vx: -380 - i * 90, vy: -520 - i * 40, vr: -6 - i, floorY: 0, bounce: 0.5 });
      });
      await S.driveTo(S.car.x + 500, 1100, 'Sine.easeOut');
      rig.play('idle'); eng();
      ctx.audio.sfx('sad', { volume: 0.5 });
      void back;
      await ctx.wait(1600);
    },
    'beach.range': async (p: { pass: boolean }) => {
      const stopX = p.pass ? sandX + 260 : len * 0.55;
      await S.driveTo(stopX, p.pass ? 5200 : 4200, p.pass ? 'Sine.easeInOut' : 'Sine.easeOut');
      if (p.pass) {
        eng(); rig.play('idle');
        ctx.audio.sfx('honk', { volume: 0.5, rate: 1.4 });
        await ctx.wait(300);
        await S.hop(crab, S.car.x + roof.x + 40, S.car.y + roof.y - 10, 700, 120);
        ctx.audio.sfx('pop');
        if (hasLoad) toys.forEach((t, i) => { rig.root.remove(t.img); S.layers.front.add(t.img); t.img.setPosition(S.car.x + t.x, S.car.y + t.y); S.fx.bits.add({ obj: t.img, vx: 160 + i * 70, vy: -480, vr: 4, floorY: 0, bounce: 0.4 }); });
        await S.cheer(900);
      } else {
        // sputter
        rig.play('idle'); eng();
        const smoke = S.spray('smoke', 'exhaust', { speed: { min: 30, max: 90 }, angle: { min: 170, max: 200 } }, 160);
        ctx.audio.sfx('wobble', { volume: 0.5 });
        const x0 = S.car.x;
        await along(ctx, 900, (t) => { S.car.x = x0 + Math.abs(Math.sin(t * 14)) * 14 * (1 - t); S.car.rotation = Math.sin(t * 30) * 0.015; }, 'Linear');
        smoke.stop();
        const fuel = S.put('front', P.fuel(), S.car.x + roof.x, S.car.y + roof.y - 150, 1.2);
        fuel.setAlpha(0);
        void ctx.tween({ targets: fuel, alpha: 1, duration: 300 });
        const gull = S.put('front', P.gull(), S.car.x + 500, -520, 1.2);
        ctx.audio.sfx('flap', { volume: 0.5 });
        await S.hop(gull, S.car.x + roof.x + 60, S.car.y + roof.y - 10, 900, 100);
        ctx.audio.sfx('sad', { volume: 0.5 });
        await ctx.wait(1500);
      }
    },
  };
  await plan.run(phases);
  if (plan.ok && !plan.has('beach.range')) await phases['beach.range']({ facet: 'beach.range', level: 1, pass: true, gag: false });
  eng();
  if (plan.ok) { rig.play('happy'); await ctx.wait(500); }
});
