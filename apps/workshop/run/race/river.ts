/**
 * River: level 1 a deep stream (water to the windows, fish), level 2 a wide river with lily pads and a turtle.
 * Pass L1 (snorkel): drives under water, bubbles from the snorkel, a fish hops on the roof. Pass L2 (floaties): bobs across like a duck, the turtle waves.
 * Fail L1: glug-glug and bubbles, stops, a fish peeks in the window. Fail L2: sinks until only the roof shows, a frog sits on it. A tow rope pulls it back out.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { Cable, SideStage } from '../common/side';

export default racePlayer('river', async (ctx) => {
  const plan = planStage(ctx, ['river.cross']);
  const lv = Math.min(2, plan.level('river.cross', 1));
  const rig = ctx.rig;
  const W = lv === 1 ? 700 : 1150;
  const x0 = 1100, x1 = x0 + W;
  const S = new SideStage(ctx, { worldW: x1 + 1700, segments: [[-800, x0], [x1, x1 + 2600]], sky: ['#74cfff', '#e9f8ff'], clouds: 5, sun: true, hills: [{ color: '#a6e39a', h: 280, f: 0.15 }, { color: '#7fd27a', h: 190, f: 0.3, seed: 13 }] });
  const deep = ctx.scene.add.rectangle(x0, 0, W, 900, 0x3b9cff).setOrigin(0, 0);
  S.add('back', deep);
  S.pool({ x0, x1, depth: 300, kind: 'water', frontAlpha: plan.ok ? 0.5 : 0.72 });
  [500, 800, x1 + 400, x1 + 900].forEach((x) => S.put('back', P.tree(), x, -4, 0.9));
  if (lv === 2) {
    for (let i = 0; i < 5; i++) S.put('mid', P.lily(), x0 + 120 + i * 210, 4, 1.1);
    S.put('mid', P.rock(180, 90, 3), x0 + W / 2, 8);
  }
  const turtle = lv === 2 ? S.put('mid', P.turtle(), x0 + W / 2, -70, 0.9) : null;
  const fish = S.put('mid', P.fish(), x0 + 300, 90, 1.2);
  void ctx.tween({ targets: fish, x: x0 + 460, y: 120, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  const sink = lv === 1 ? 95 : Math.max(70, rig.height - 60);
  const roof = rig.anchor('roof');

  await S.driveTo(x0 - 80, 1800, 'Sine.easeIn');
  if (plan.ok) {
    ctx.audio.sfx('splash', { volume: 0.8 });
    S.fx.burst(S.layers.front, 'splash', x0, 0, 16);
    const bub = S.spray('bubbles', 'roof', { speed: { min: 30, max: 90 }, angle: { min: 260, max: 280 } }, 150);
    const xs = S.car.x, xe = x1 + 200;
    await along(ctx, lv === 1 ? 3200 : 4000, (t) => {
      const e = Math.min(1, t * 7, (1 - t) * 7);
      S.setCarX(xs + (xe - xs) * t);
      S.car.y = lv === 1 ? sink * e : 6 * e + Math.sin(t * 20) * 6 * e;
      S.car.rotation = lv === 1 ? 0 : Math.sin(t * 14) * 0.03 * e;
      if (turtle && t > 0.4) turtle.rotation = Math.sin(t * 30) * 0.08;
    }, 'Linear');
    bub.stop();
    ctx.audio.sfx('splash', { volume: 0.5, rate: 1.3 });
    S.car.y = 0; S.car.rotation = 0;
    if (lv === 1) {
      const f = S.put('front', P.fish(), S.car.x + roof.x, S.car.y + roof.y - 20, 1.2);
      f.y = 40;
      await S.hop(f, S.car.x + roof.x, S.car.y + roof.y - 10, 500, 120);
      ctx.audio.sfx('pop', { volume: 0.48, rate: 1.25 });
      await ctx.wait(300);
      await S.hop(f, S.car.x + 400, 60, 600, 160);
      ctx.audio.sfx('splash', { volume: 0.45, rate: 1.4 });
    }
    eng();
    await S.cheer(700);
    await S.exit();
    return;
  }
  ctx.audio.sfx('splash', { volume: 0.8 });
  S.fx.burst(S.layers.front, 'splash', x0, 0, 16);
  rig.play('idle'); eng();
  const bub = S.spray('bubbles', 'roof', { speed: { min: 30, max: 90 }, angle: { min: 260, max: 280 } }, 120);
  const xs = S.car.x, xe = x0 + W * (lv === 1 ? 0.3 : 0.4);
  await along(ctx, 2300, (t) => { S.car.x = xs + (xe - xs) * Math.sin(t * Math.PI / 2); S.car.y = sink * Math.min(1, t * 1.6); S.car.rotation = Math.sin(t * 12) * 0.02; }, 'Linear');
  ctx.audio.sfx('wobble', { volume: 0.6 });
  if (lv === 1) {
    fish.setVisible(false);
    const f = S.put('front', P.fish(), S.car.x + roof.x + 100, 30, 1.4);
    await S.hop(f, S.car.x + roof.x + 30, S.car.y + roof.y + 40, 600, 60);
    ctx.audio.sfx('pop', { volume: 0.42, rate: 1.4 });
  } else {
    const fr = S.put('front', P.frog(), S.car.x + roof.x + 200, 0, 1.4);
    await S.hop(fr, S.car.x + roof.x, S.car.y + roof.y - 8, 700, 120);
    ctx.audio.sfx('pop', { volume: 0.46, rate: 1.1 });
    fr.setDepth(5);
  }
  ctx.audio.sfx('sad', { volume: 0.5 });
  await ctx.wait(700);
  bub.stop();
  // tow rope pulls it back out
  const cable = new Cable(S.scene, S.layers.front);
  const xa = S.car.x;
  ctx.audio.sfx('rustle');
  await along(ctx, 1400, (t) => {
    S.car.x = xa - 230 * t; S.car.y = sink * (1 - t);
    cable.set(x0 - 400, -30, S.car.x + rig.anchor('back').x, S.car.y - 50);
  }, 'Sine.easeInOut');
  cable.destroy();
  ctx.audio.sfx('pop');
  rig.play('dizzy');
  await ctx.wait(800);
});
