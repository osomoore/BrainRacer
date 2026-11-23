/**
 * Shoo the pesky birds away (birds.roar). Level = how many birds (a few, a flock, a huge flock).
 * Success: a big ROAR with sound rings, the birds flutter off in a puff of feathers, the nest is safe, the dino puffs its chest.
 * Fail: a tiny squeak, the birds look at each other and laugh, one lands on the dino head.
 */
import { Bird, backdrop, birdCount, image, scenario } from './kit';

export default scenario('birds', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.9, 150, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const nx = a.W * 0.64, rockK = Math.max(0.9, rigH / 330);
  a.img('rock:a', nx, a.gy + 6, rockK);
  const ny = a.gy - 215 * rockK;
  a.img('nestBack', nx, ny + 8, 0.9);
  const eggs = [-52, 0, 52].map((dx, i) => a.img('egg', nx + dx, ny + 10 + (i === 1 ? 4 : 0), 0.85));
  a.img('nestFront', nx, ny + 14, 0.9);
  a.img('bush', a.W * 0.9, a.gy + 6, 0.8);

  const n = birdCount(a.lv('birds.roar'));
  const birds: Bird[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (-Math.PI * 0.95) + (Math.PI * 0.9 * (i + 0.5)) / n;
    const rad = 70 + (i % 3) * 55 + a.rng.range(0, 25);
    const b = new Bird(a, nx + Math.cos(ang) * rad * 1.4, ny - 40 + Math.sin(ang) * rad * 0.8, 1.15 + a.rng.range(0, 0.2), 'peck');
    if (Math.cos(ang) < 0) b.box.scaleX = -1;
    b.flap(110 + (i % 3) * 25);
    a.loop({ targets: b.body, y: 12, duration: 260 + (i % 4) * 40, yoyo: true, ease: 'Sine.easeInOut', delay: i * 70 });
    birds.push(b);
  }
  eggs.forEach((e, i) => a.loop({ targets: e, angle: { from: -5, to: 5 }, duration: 160, yoyo: true, delay: i * 50 }));

  a.place(Math.max(rigW * 0.6, nx - 330 - rigW * 0.5));
  a.play('idle');
  await a.wait(1000);
  const mouth = a.pt('mouth');
  const ring = (k: number, delay: number, tiny = false): void => {
    const r = image(a.scene, 'p:ring', mouth.x + 20, mouth.y, 0.3);
    a.fore.add(r);
    void a.tw({ targets: r, scaleX: (tiny ? 0.8 : k) / 1.5, scaleY: (tiny ? 0.8 : k) / 1.5, x: mouth.x + (tiny ? 80 : 260 * k), alpha: { from: 0.9, to: 0 }, duration: 700, delay, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  };
  if (!a.failed('birds.roar')) {
    a.play('stand');
    await a.wait(350);
    a.sfx('roar');
    void a.roarText(a.pt('headTop').x, a.pt('headTop').y - 90);
    ring(2.2, 0); ring(3.2, 160); ring(4.2, 320);
    await a.shake(a.root, 5, 40, 4);
    await a.wait(150);
    for (const [i, b] of birds.entries()) {
      b.mood('happy');
      b.box.scaleX = 1;
      void a.burst('feather', b.box.x, b.box.y, { n: 2, spread: 160, up: 100, gravity: 200, ms: 900, scale: 0.8 });
      void a.tw({ targets: b.box, x: a.W + 250 + i * 40, y: a.top - 140 - i * 20, duration: 1400 + i * 60, ease: 'Quad.easeIn' });
    }
    void a.puff(nx, ny - 60, 1.1);
    await a.pop(a.root, 1.1, 200);
    await a.wait(900);
    a.play('happy');
    await a.celebrate(900);
    return;
  }
  // squeak
  a.sfx('pop', { rate: 2.2, volume: 0.7 });
  ring(0.8, 0, true);
  await a.wait(900);
  for (const b of birds) b.mood('laugh');
  a.sfx('giggle');
  for (const b of birds) void a.wobble(b.box, 0.12, 100, 4);
  await a.wait(700);
  const pick = birds[0];
  const h = a.pt('headTop');
  pick.box.scaleX = 1;
  await a.arc2(pick.box, pick.box.x, pick.box.y, h.x, h.y + 8, 60, 700);
  pick.rest();
  pick.mood('laugh');
  a.sfx('boing', { volume: 0.5 });
  a.play('dizzy');
  await a.hold(1500);
});
