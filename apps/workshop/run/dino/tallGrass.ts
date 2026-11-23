/**
 * Find the nest in the tall grass (tallGrass.peek, tallGrass.sneak). Level sets how tall the grass is (relative to the dino).
 * Peek pass: the dino rises above the grass, spots the nest (a little arrow) and trots straight to it, the eggs wobble happily.
 * Peek fail: it cannot see over the grass and wanders in circles, a question mark pops up, it ends where it started.
 * Sneak: a nosy big dino looks around. Pass: it looks right at the dino, sees only grass and walks off. Fail: it points, the dino giggles and pops up.
 */
import { backdrop, bigArrive, bigFindsDino, bigSniffsPast, grassHeight, grassKey, image, makeBig, nestFraction, scenario } from './kit';

export default scenario('tallGrass', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.1, 150, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const peek = a.has('tallGrass.peek'), sneak = a.has('tallGrass.sneak');
  const peekFail = a.failed('tallGrass.peek'), sneakFail = a.failed('tallGrass.sneak');
  const G = grassHeight(peek ? a.lv('tallGrass.peek') : 1, !peekFail) * rigH;
  const sc = G / 260;
  const nx = a.W * nestFraction(Math.round(a.rng.range(0, 8)));
  const spacing = Math.max(52, 84 * sc);

  // nest with eggs, then back row of grass, dino, front row of grass
  a.img('nestBack', nx, a.gy - 4, 0.8);
  const eggs = [-44, 0, 44].map((o, i) => a.img('egg', nx + o, a.gy - 6 + (i === 1 ? 3 : 0), 0.75));
  a.img('nestFront', nx, a.gy, 0.8);
  const blades: Phaser.GameObjects.Image[] = [];
  const row = (parent: typeof a.world, yOff: number, off: number, shade: number): void => {
    for (let x = -30 + off; x < a.W + 60; x += spacing) {
      if (Math.abs(x - nx) < (parent === a.fore ? 150 : 100)) continue;
      const im = a.img(grassKey((shade + Math.round(x / spacing)) % 3), x, a.gy + yOff, sc * a.rng.range(0.9, 1.1), parent);
      blades.push(im);
    }
  };
  row(a.world, 0, 0, 0);
  row(a.fore, 14, spacing / 2, 1);
  a.fore.setAlpha(1);
  const sway = a.loop({ targets: blades.filter((_, i) => i % 3 === 0), angle: { from: -2, to: 2 }, duration: 900, yoyo: true });
  void sway;

  a.place(-rigW * 0.4);
  const startX = a.W * 0.28;
  await a.walkTo(startX, 1500, 'walk');
  a.sfx('rustle');

  if (peek && peekFail) {
    // lost in the grass: back and forth in circles, question mark
    const legs = [startX + 230, startX - 90, startX + 160, startX];
    for (const [i, x] of legs.entries()) {
      await a.walkTo(x, 650, 'walk');
      void a.burst('leaf', a.root.x, a.gy - rigH * 0.5, { n: 3, spread: 120, up: 120, gravity: 400, ms: 700 });
      a.sfx('rustle', { volume: 0.5 });
      if (i === 1) void a.floatIcon('p:question', a.pt('headTop').x, a.pt('headTop').y - 30, 1.2, 70, 1500);
    }
    a.play('idle');
    a.sfx('wobble');
    void a.floatIcon('p:question', a.pt('headTop').x + 20, a.pt('headTop').y - 30, 1.3, 70, 1500);
    await a.hold(1500);
    return;
  }
  if (peek) {
    // rise above the grass, spot the nest, little arrow, trot over
    a.play('stand');
    await a.wait(300);
    await a.hop(rigH * 0.25, 500);
    a.sfx('pop');
    const arrow = image(a.scene, 'arrow', nx, a.gy - rigH * 0.9 - 40, 0.8);
    a.fore.add(arrow);
    a.loop({ targets: arrow, y: arrow.y - 24, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });
    await a.wait(700);
  }
  if (sneak) {
    const big = makeBig(a);
    const sx = peek ? a.root.x : startX;
    await a.walkTo(sx + (peek ? 0 : 160), 500, 'walk');
    a.play('crouch');
    await bigArrive(a, big, a.root.x + rigW * 0.2, 2200);
    if (sneakFail) {
      await bigFindsDino(a, big, 'tap');
      await a.hold(1300);
      return;
    }
    await bigSniffsPast(a, big, a.W + 500);
    a.play('stand');
    await a.wait(300);
  }
  // trot to the nest
  const front = a.rig.anchor('front').x * a.rs;
  await a.walkTo(nx - front - 50, 1800, 'run');
  a.play('happy');
  eggs.forEach((e, i) => a.loop({ targets: e, angle: { from: -7, to: 7 }, duration: 150, yoyo: true, delay: i * 40 }));
  a.sfx('giggle');
  void a.burst('heart', nx, a.gy - 80, { n: 3, spread: 100, up: 220, gravity: 250, ms: 1100, scale: 0.9 });
  await a.celebrate(1000);
});
