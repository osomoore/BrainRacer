/**
 * Push a log off the path (log.push). Level = log size (small, thick, bus-sized). Friends wait behind it.
 * Success: the dino leans in, the log rolls away, friends cheer and run past. Fail: feet slide in place, the log only wobbles once,
 * the dino flops flat and pants.
 */
import { Friend, backdrop, image, logSize, scenario } from './kit';

export default scenario('log', async (a) => {
  backdrop(a, 'forest', { clouds: 1 });
  const rigH = a.rig.height * a.rs;
  const ls = logSize(a.lv('log.push'));
  const r = Math.max(60, ls.thick * rigH * 1.4);
  const lx = a.W * 0.52;
  for (let i = 0; i < 4; i++) a.img('trunk', a.W * (0.1 + i * 0.3) + a.rng.range(-30, 30), a.gy + 10, 0.95).setTint(0x4f8a5a).setAlpha(0.5);
  const f1 = new Friend(a, Math.min(a.W * 0.84, lx + r + 220), a.gy, (rigH / 300) * 0.9);
  const f2 = new Friend(a, Math.min(a.W * 0.93, lx + r + 360), a.gy, (rigH / 300) * 0.8, 'friend2');
  f1.box.scaleX = -1; f2.box.scaleX = -1;
  const s1 = f1.wave(), s2 = f2.wave(300);
  const box = a.scene.add.container(lx, a.gy - r);
  a.world.add(box);
  box.add(image(a.scene, 'logEnd', 0, r, r / 146));

  a.place(a.W * 0.08);
  const frontDx = a.rig.anchor('front').x * a.rs;
  const stopX = lx - r - frontDx - 10;
  await a.walkTo(stopX, 1600, 'walk');
  a.play('crouch');
  await a.wait(300);
  a.play('run');
  a.root.rotation = 0.1;
  a.sfx('stomp');
  if (!a.failed('log.push')) {
    const t0 = box.x;
    void a.tw({ targets: a.root, x: stopX + 260, duration: 1500, ease: 'Quad.easeIn' });
    void a.tw({ targets: box, x: t0 + 1100 + r, duration: 2200, ease: 'Quad.easeIn', onUpdate: () => { box.rotation = (box.x - t0) / r; } });
    a.sfx('wobble');
    await a.wait(900);
    void f1.cheer(40, 2);
    await f2.cheer(40, 2);
    a.root.rotation = 0;
    a.play('happy');
    a.sfx('cheer');
    void a.sparkle(8);
    s1(); s2();
    void a.tw({ targets: f1.box, x: a.W + 200, duration: 1500, ease: 'Sine.easeIn' });
    void a.tw({ targets: f2.box, x: a.W + 300, duration: 1700, ease: 'Sine.easeIn' });
    await a.wait(1300);
    await a.celebrate(900);
    return;
  }
  // fail: skid in place
  for (let i = 0; i < 4; i++) {
    void a.dust(a.root.x - 40, a.gy, 2, 0.7);
    a.sfx('stomp', { volume: 0.5, rate: 1.1 });
    await a.shake(a.root, 8, 40, 3);
  }
  a.sfx('wobble');
  await a.wobble(box, 0.05, 140, 1);
  a.root.rotation = 0;
  a.play('idle');
  a.sfx('sad');
  await a.tw({ targets: a.root, scaleY: a.rs * 0.72, scaleX: a.dir * a.rs * 1.16, duration: 420, ease: 'Quad.easeIn' });
  void a.dust(a.root.x, a.gy, 4, 1);
  const h = a.pt('headTop');
  for (let i = 0; i < 3; i++) {
    void a.burst('sweat', h.x, h.y + 20, { n: 3, spread: 120, up: 120, gravity: 600, ms: 700, scale: 0.9 });
    await a.pop(a.root, 1.05, 220);
  }
  await a.hold(900);
});
