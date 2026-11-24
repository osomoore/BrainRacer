/**
 * Jump up onto a high ledge (ledge.jump). Level sets the ledge height (relative to the dino so a failing build always looks too high).
 * Success: big spring, dust puff, high-five with the friend. Fail: misses the edge, slides down the wall, tumbles backward onto its
 * tail and a pebble bonks it on the head.
 */
import { Friend, backdrop, cliff, ledgeHeight, scenario } from './kit';

export default scenario('ledge', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.12, 160, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const pass = !a.failed('ledge.jump');
  const H = ledgeHeight(a.lv('ledge.jump'), pass) * rigH;
  const cx = a.W * 0.5;
  cliff(a, cx, a.gy - H, a.W - cx + 40, a.bottom + 40, 'cliff');
  a.img('rock:c', cx - 70, a.gy + 4, 0.8);
  a.img('bush', a.W * 0.34, a.gy + 6, 0.8);
  const land = cx + rigW * 0.4;
  const friend = new Friend(a, Math.min(a.W - 100, land + rigW * 0.5 + 110), a.gy - H - 6, (rigH / 300) * 0.95);
  friend.box.scaleX = -1;
  const stopWave = friend.wave();

  a.place(a.W * 0.08);
  const frontDx = a.rig.anchor('front').x * a.rs;
  const takeoff = cx - rigW * 0.75 - frontDx;
  await a.walkTo(takeoff - 220, 1100, 'walk');
  await a.walkTo(takeoff, 600, 'run', 'Quad.easeIn');
  a.sfx('whoosh');
  if (pass) {
    a.play('run');
    await a.arc(land, a.gy - H, H * 0.5 + 140, 1000, 0.35);
    a.sfx('land', { volume: 0.7 });
    void a.dust(a.root.x, a.root.y, 4, 1);
    a.play('happy');
    stopWave();
    void friend.cheer(30, 2);
    a.sfx('giggle');
    await a.wait(400);
    void a.sparkle(8);
    await a.celebrate(1000);
    return;
  }
  // miss: up the wall, slide down, tumble backward, pebble bonk
  a.play('run');
  const hitX = cx - frontDx - 14;
  await a.arc(hitX, a.gy - H * 0.82, 90, 700, 0.3);
  a.sfx('thud');
  void a.puff(cx - 20, a.gy - H * 0.82, 0.7);
  a.play('idle');
  await a.wait(250);
  await a.tw({ targets: a.root, y: a.gy, duration: 1000, ease: 'Sine.easeIn', scaleY: { from: a.rs, to: a.rs * 0.94 } });
  a.root.scaleY = a.rs;
  void a.dust(a.root.x, a.gy, 3, 0.8);
  a.sfx('land', { volume: 0.5 });
  a.play('tumble');
  await a.tw({ targets: a.root, x: a.root.x - 220, duration: 1250, ease: 'Sine.easeOut' });
  a.play('dizzy');
  const h = a.pt('headTop');
  const pebble = a.img('pebble', h.x, h.y - 420, 1.3, a.fore);
  void a.burst('dust', cx, a.gy - H, { n: 3, spread: 60, up: 20, gravity: 300, ms: 500, scale: 0.7 });
  await a.tw({ targets: pebble, y: h.y - 10, duration: 380, ease: 'Quad.easeIn' });
  a.sfx('thud');
  const stop = a.stars(h.x, h.y - 20);
  void a.tw({ targets: pebble, x: h.x - 90, y: a.gy - 10, rotation: 6, duration: 600, ease: 'Bounce.easeOut' });
  await a.hold(1500);
  stop();
});
