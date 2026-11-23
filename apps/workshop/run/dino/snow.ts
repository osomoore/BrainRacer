/**
 * Walk over the snowy mountain (snow.warm, snow.slope). Level sets the snowfall (calm / blizzard) and the ice wall height.
 * Warm pass: strolls cozy and smiling, flakes land on it and melt. Warm fail: shivers, teeth chatter, an icicle on its nose,
 * it turns around and hurries back. Slope pass: grips the ice and climbs. Slope fail: slips and slides back down on its belly like
 * a sled, spinning to a stop in a snow pile.
 */
import { Ramp, backdrop, iceWall, image, scenario, snowFlakes } from './kit';

export default scenario('snow', async (a) => {
  backdrop(a, 'snow', { clouds: 2 });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const warm = a.has('snow.warm'), slope = a.has('snow.slope');
  const warmFail = a.failed('snow.warm'), slopeFail = a.failed('snow.slope');
  const wl = warm ? a.lv('snow.warm') : 1;
  const flakes = snowFlakes(wl);
  a.img('snowmound', a.W * 0.2, a.gy + 8, 0.9);
  a.img('snowmound', a.W * 0.9, a.gy + 8, 1.1);
  const H = Math.min(a.gy - a.top - 240, iceWall(a.lv('snow.slope')) * rigH * 1.15);
  const x0 = a.W * 0.5, slopeW = Math.min(a.W * 0.34, Math.max(rigW, H * 1.3));
  const ramp = slope ? new Ramp(a, 'ice', x0, slopeW, H, Math.max(a.W * 0.14, rigW * 0.6)) : null;
  if (ramp) a.img('snowmound', x0 - 60, a.gy + 8, 0.8);

  // snowfall: each flake loops from the top to the ground (fore layer, in front of everything)
  const area = a.W;
  for (let i = 0; i < flakes; i++) {
    const f = image(a.scene, 'p:snow', a.rng.range(0, area), a.top - 20, a.rng.range(0.6, 1.2));
    a.fore.add(f);
    const dur = wl >= 2 ? a.rng.range(1500, 2400) : a.rng.range(2600, 4200);
    a.loop({ targets: f, y: a.gy + 40, x: f.x + (wl >= 2 ? 240 : 60), duration: dur, delay: a.rng.range(0, dur), ease: 'Linear' });
  }

  a.place(-rigW * 0.4);
  const endX = ramp ? x0 - 40 : a.W * 0.84;
  if (warm) {
    if (!warmFail) {
      await a.walkTo(a.W * 0.34, 1700, 'walk');
      // flakes land on the dino and melt
      for (let i = 0; i < 3; i++) {
        const b = a.pt('belly');
        const fl = image(a.scene, 'p:snow', b.x + a.rng.range(-80, 80), b.y - 160, 1.4);
        a.fore.add(fl);
        void a.tw({ targets: fl, y: b.y - 40, duration: 500 }).then(() => a.burst('drop', fl.x, fl.y, { n: 2, spread: 40, up: 30, gravity: 300, ms: 400, scale: 0.5 }).then(() => fl.destroy()));
      }
      a.play('happy');
      a.sfx('giggle', { volume: 0.5 });
      await a.wait(700);
      await a.walkTo(endX, ramp ? 1500 : 2200, 'walk');
      if (!slope) { a.sfx('sparkle'); await a.celebrate(1000); return; }
    } else {
      await a.walkTo(a.W * 0.4, 1500, 'walk');
      a.play('chomp');
      const m = a.rig.anchor('mouth');
      const ice = image(a.scene, 'icicle', m.x + 4, m.y - 8, 0.5);
      a.root.add(ice);
      a.sfx('wobble');
      for (let i = 0; i < 4; i++) { a.play('chomp'); await a.shake(a.root, 6, 45, 4); }
      void a.burst('snow', a.pt('headTop').x, a.pt('headTop').y, { n: 5, spread: 120, up: 80, gravity: 200, ms: 800 });
      a.face(-1);
      a.sfx('sad', { volume: 0.5 });
      await a.walkTo(a.W * 0.2, 1400, 'run');
      a.play('chomp');
      await a.shake(a.root, 5, 45, 5);
      await a.hold(1200);
      return;
    }
  } else {
    a.root.x = x0 - rigW * 0.7;
  }
  if (ramp) {
    // icy climb
    a.play('run');
    a.face(1);
    await a.walkTo(x0 + 10, 400, 'run');
    if (slopeFail) {
      await ramp.climbTo(x0 + slopeW * 0.55, 1700, 0.9);
      a.play('dizzy');
      a.sfx('wobble');
      await a.wait(300);
      a.play('idle');
      a.sfx('whoosh');
      // belly-slide like a sled
      await ramp.climbTo(x0 - 160, 1100, 1.0, 'Quad.easeIn');
      a.root.rotation = 0;
      await a.tw({ targets: a.root, rotation: -Math.PI * 4, x: a.root.x - 120, duration: 900, ease: 'Sine.easeOut' });
      a.root.rotation = 0;
      a.play('dizzy');
      void a.burst('snow', a.root.x, a.gy - 40, { n: 10, spread: 280, up: 260, gravity: 700, ms: 900, scale: 1.2 });
      const stop = a.stars(a.pt('headTop').x, a.pt('headTop').y - 14);
      await a.hold(1500);
      stop();
      return;
    }
    await ramp.climbTo(ramp.topX + 20, 2800, 0.9);
    await ramp.climbTo(ramp.topX + rigW * 0.3, 500, 0);
    a.root.rotation = 0;
    a.play('stand');
    void a.burst('snow', a.root.x, a.root.y - 30, { n: 8, spread: 200, up: 220, gravity: 500, ms: 900, scale: 1.1 });
    await a.wait(400);
    await a.celebrate(1100);
  }
});
