/**
 * Fly across a deep canyon (canyon.fly). Level sets the gap width and the wind. Friends wait on the far cliff.
 * Pass: flaps across and lands with a little hop. Fail (no wings): flaps its arms at the edge and steps back. Fail (too heavy): flaps across
 * halfway, gets tired and floats down onto a big soft bush on the start side (never into the canyon).
 */
import { Friend, backdrop, canyonGap, cliff, image, scenario } from './kit';

export default scenario('canyon', async (a) => {
  backdrop(a, 'canyon', { clouds: 2, sunAt: [a.W * 0.5, 170, 0.8] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const cg = canyonGap(a.lv('canyon.fly'));
  const gap = Math.max(rigW * 0.9, Math.min(a.W * 0.46, cg.gap * rigW));
  const lx = a.W * 0.5 - gap / 2, rx = lx + gap;
  const wings = a.ctx.computed.tags.has('canFly');
  const pass = !a.failed('canyon.fly');

  // the canyon: dark walls below the ground line, cliffs left and right
  const dark = cliff(a, lx, a.gy - 24, gap, a.bottom + 60, 'red', null);
  dark.forEach((d) => d.setTint(0x8a5a4a));
  a.rect(0x2a1520, lx, a.bottom - 160, gap, 220, 0.55);
  cliff(a, -40, a.gy, lx + 40, a.bottom + 60, 'red', 'e0a070');
  cliff(a, rx, a.gy, a.W - rx + 40, a.bottom + 60, 'red', 'e0a070');
  // broken bridge stumps
  a.img('plank', lx - 40, a.gy - 8, 0.45);
  const pr = a.img('plank', rx + 40, a.gy - 8, 0.45); pr.setScale(-pr.scaleX, pr.scaleY);
  // soft bush on a little ledge of the start wall
  const bushX = lx + 70, bushY = a.gy + 150;
  a.img('rock:c', bushX, bushY + 30, 0.9);
  a.img('bush', bushX, bushY + 4, 0.8);
  // friends on the far cliff
  const f1 = new Friend(a, rx + 140, a.gy - 4, (rigH / 300) * 0.85);
  const f2 = new Friend(a, rx + 270, a.gy - 4, (rigH / 300) * 0.75, 'friend2');
  f1.box.scaleX = -1; f2.box.scaleX = -1;
  f1.wave(); f2.wave(330);
  // wind streaks
  for (let i = 0; i < cg.wind; i++) {
    const w = image(a.scene, 'windline', lx - 100 + a.rng.range(0, gap), a.gy - 150 - a.rng.range(0, 260), 1).setAlpha(0.8);
    a.fore.add(w);
    a.loop({ targets: w, x: w.x + 360, alpha: { from: 0.85, to: 0 }, duration: 1100 + i * 140, delay: i * 180 });
  }

  a.place(a.W * 0.08);
  const edge = lx - rigW * 0.35;
  await a.walkTo(edge, 1700, 'walk');
  a.play('idle');
  await a.wait(350);
  if (!wings) {
    // no wings: flap the arms, nothing happens, step back
    for (let i = 0; i < 3; i++) { a.play('flap'); void a.hop(26, 300); a.sfx('flap'); await a.wait(330); }
    void a.burst('sweat', a.pt('headTop').x, a.pt('headTop').y, { n: 3, spread: 100, up: 140, gravity: 500, ms: 700 });
    a.sfx('wobble');
    a.play('walk');
    await a.tw({ targets: a.root, x: edge - 120, duration: 700 });
    a.play('idle');
    void a.floatIcon('p:question', a.pt('headTop').x, a.pt('headTop').y - 30, 1.2, 70, 1500);
    await a.hold(1500);
    return;
  }
  a.play('flap');
  a.sfx('flap');
  const land = rx + rigW * 0.4;
  if (pass) {
    a.sfx('whoosh');
    const flap = a.loop({ targets: a.root, scaleY: { from: a.rs, to: a.rs * 0.96 }, duration: 160, yoyo: true });
    await a.arc(land, a.gy, 150 + gap * 0.08, Math.max(1800, gap * 3.2), 0.12);
    flap();
    a.root.setScale(a.dir * a.rs, a.rs);
    a.sfx('land', { volume: 0.5 });
    void a.dust(a.root.x, a.gy, 3, 0.9);
    await a.hop(46, 380);
    f1.box.setScale(f1.box.scaleX, 1);
    void f1.cheer(24, 2);
    await f2.cheer(24, 2);
    await a.celebrate(900);
    return;
  }
  // too heavy: halfway, then floats down onto the bush on the start side
  const mid = lx + gap * 0.5;
  await a.arc(mid, a.gy - 110, 120, 1700, 0.12);
  a.play('flap');
  void a.burst('sweat', a.pt('headTop').x, a.pt('headTop').y, { n: 4, spread: 120, up: 160, gravity: 500, ms: 800 });
  a.sfx('wobble');
  await a.wait(500);
  a.sfx('sad', { volume: 0.5 });
  const sway = a.loop({ targets: a.root, rotation: { from: -0.12, to: 0.12 }, duration: 520, yoyo: true, ease: 'Sine.easeInOut' });
  await a.arc(bushX + 10, bushY - 6, -40, 2300, 0);
  sway();
  a.root.rotation = 0;
  a.play('idle');
  a.sfx('boing');
  void a.burst('leaf', a.root.x, a.root.y - 40, { n: 8, spread: 220, up: 240, gravity: 500, ms: 900 });
  await a.tw({ targets: a.root, scaleY: a.rs * 0.8, scaleX: a.dir * a.rs * 1.1, duration: 130, yoyo: true, repeat: 1 });
  a.root.setScale(a.dir * a.rs, a.rs);
  await a.hold(1500);
});
