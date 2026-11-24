/**
 * Snack time: gulp a cartoon critter (snack.bite, snack.bigGulp).
 * Success: snap, the critter vanishes whole, belly bulge, "nom" puff, burp, happy.
 * Fail (bite): soft teeth tickle, the critter giggles and skips away. Fail (bigGulp): only its nose fits, it sneezes, the dino
 * pops backward onto its tail and the beetle rolls away laughing.
 */
import { Bulge, Critter, backdrop, scenario, snackCritter } from './kit';

export default scenario('snack', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.86, 150, 0.7] });
  const big = a.has('snack.bigGulp');
  const spec = snackCritter(big ? a.lv('snack.bigGulp') : a.lv('snack.bite'), big);
  const ref = (a.rig.height * a.rs) / 300;
  const cx = a.W * 0.7;
  if (!big) a.img('stump', cx, a.gy + 6, 1);
  const sc = spec.scale * ref * (big ? 1.1 : 1.35);
  const critter = new Critter(a, spec.kind, cx, big ? a.gy + 4 : a.gy - 116, sc, 'happy');
  critter.box.scaleX = -1;
  const stopBounce = critter.bounce(6);
  // sniff the leaves
  for (const [x, k] of [[a.W * 0.42, 0.9], [a.W * 0.9, 1.1]] as const) a.img('bush', x, a.gy + 6, k);

  a.place(a.W * 0.12);
  const mouthDx = a.pt('mouth').x - a.root.x;
  const frontHalf = (spec.kind === 'lizard' ? 118 : spec.kind === 'frog' ? 60 : 80) * sc;
  const stopX = cx - frontHalf - mouthDx - 8;
  await a.walkTo(stopX - 160, 1700, 'walk');
  // wind-up
  a.play('crouch');
  await a.wait(320);
  const lungeX = stopX;
  const biteFail = a.failed('snack.bite');
  const bigFail = a.failed('snack.bigGulp');
  a.sfx('whoosh');
  a.play('chomp');
  await a.tw({ targets: a.root, x: lungeX, duration: 200, ease: 'Quad.easeIn' });
  const mouth = a.pt('mouth');

  if (!biteFail && !bigFail) {
    // GULP: the critter flies into the mouth, belly bulges, burp
    stopBounce();
    a.sfx('chomp');
    await a.tw({ targets: critter.box, x: mouth.x, y: mouth.y, scaleX: -sc * 0.15, scaleY: sc * 0.15, duration: 160, ease: 'Quad.easeIn' });
    critter.box.setVisible(false);
    void a.puff(mouth.x, mouth.y - 20, 0.9);
    void a.burst('spark', mouth.x, mouth.y, { n: 5, spread: 120, up: 160, ms: 600, scale: 0.6 });
    await a.wait(200);
    a.sfx('gulp');
    const bulge = new Bulge(a, `${spec.kind}:happy`, 1);
    const bp = a.pt('belly');
    // The bulge sits in front of the body, so keep it low and small enough to stay clear of the neck and head.
    const bs = (a.rig.height * a.rs) / 330 * (big ? 1.05 : 0.8);
    await bulge.inflate(bp.x - a.rig.width * a.rs * 0.04, bp.y + a.rig.height * a.rs * 0.05, bs);
    a.play('happy');
    await a.wait(500);
    a.sfx('burp', { volume: big ? 1 : 0.8 });
    const m2 = a.pt('mouth');
    void a.puff(m2.x + 30, m2.y - 10, big ? 1.5 : 1);
    void a.burst('leaf', m2.x + 70, m2.y, { n: big ? 8 : 4, spread: 240, up: 90, gravity: 300, dir: 1, ms: 900 });
    void bulge.deflate();
    await a.pop(a.root, 1.1, 150);
    await a.wait(500);
    await a.celebrate(1000);
    return;
  }

  if (bigFail) {
    // only the nose fits: sneeze, pop back onto the tail
    stopBounce();
    critter.mood('oops');
    a.sfx('wobble');
    await a.wait(260);
    await a.shake(critter.body, 6, 40, 4);
    critter.mood('giggle');
    a.sfx('giggle');
    void a.burst('drop', critter.box.x - 60 * sc, critter.box.y - 80 * sc, { n: 6, spread: 200, up: 90, gravity: 700, dir: -1, ms: 600 });
    a.play('tumble');
    a.sfx('boing');
    await a.tw({ targets: a.root, x: Math.max(a.W * 0.04, a.root.x - 340), duration: 1100, ease: 'Sine.easeOut' });
    void a.dust(a.root.x, a.gy, 4, 1);
    a.play('dizzy');
    const stop = a.stars(a.pt('headTop').x, a.pt('headTop').y - 10);
    void critter.skipTo(a.W + 260, 1100, 3, 40);
    await a.tw({ targets: critter.body, angle: 360, duration: 1100 });
    await a.hold(900);
    stop();
    return;
  }

  // soft teeth: tickle, giggle, escape
  stopBounce();
  await a.wait(120);
  await critter.giggle(7);
  a.sfx('giggle');
  critter.mood('giggle');
  a.play('idle');
  void a.floatIcon('p:question', a.pt('headTop').x, a.pt('headTop').y - 30, 1.1, 60, 1300);
  await critter.skipTo(a.W + 240, 1300, 4, 70);
  await a.hold(800);
});
