/**
 * Chase a speedy lizard, TOP view (chase.speed, chase.quiet). Level sets the lizard speed.
 * Speed pass: the dino catches up before the hole and scoops the lizard up (nom puff, happy hop). Speed fail: the lizard stays ahead, dives
 * into its hole and sticks its tongue out; the dino skids to a stop in a dust cloud and spins dizzy.
 * Quiet pass: the dino creeps up on a napping lizard and gulps it (tiny nom puff, a snore bubble pops). Quiet fail: a twig snaps, the lizard
 * zips away and the dino freezes mid-tiptoe with a sheepish grin.
 */
import { chaseSpeed, image, scenario, swap } from './kit';

export default scenario('chase', async (a) => {
  // grassy field seen from above
  a.rect(0x86d96a, -20, a.top - 20, a.W + 40, a.bottom - a.top + 40);
  const cy = a.gy;
  for (let i = 0; i < 9; i++) a.img('tuftTop', a.rng.range(60, a.W - 60), a.rng.range(a.top + 60, a.bottom - 60), a.rng.range(0.8, 1.6));
  for (let i = 0; i < 14; i++) a.img('flowerTop', a.rng.range(40, a.W - 40), a.rng.range(a.top + 40, a.bottom - 40), a.rng.range(0.7, 1.2));
  for (const [fx, fy, k] of [[0.22, -0.34, 1.1], [0.46, 0.36, 0.9], [0.7, -0.3, 1.0], [0.34, 0.3, 0.7]] as const) a.img('rockTop', a.W * fx, cy + fy * (a.bottom - a.top), k);
  const quiet = a.has('chase.quiet'), speed = a.has('chase.speed');
  const quietFail = a.failed('chase.quiet'), speedFail = a.failed('chase.speed');
  const rigW = a.rig.width * a.rs;
  const hx = a.W * 0.9;
  a.img('hole:top', hx, cy, Math.max(0.8, rigW / 420));
  const ls = Math.max(0.5, (rigW * 0.55) / 280);
  const lizX = quiet ? a.W * 0.55 : a.W * 0.36;
  const liz = image(a.scene, quiet ? 'lizardTop:sleep' : 'lizardTop:happy', lizX, cy, ls);
  a.world.add(liz);

  a.place(a.W * 0.08, 1, cy);
  const mouthLen = (): number => Math.hypot(a.pt('mouth').x - a.root.x, a.pt('mouth').y - a.root.y);
  const L = mouthLen();
  const point = (x: number, y: number): void => { a.root.rotation = Math.atan2(y - a.root.y, x - a.root.x); };
  const gulp = async (): Promise<void> => {
    a.play('chomp');
    a.sfx('chomp');
    const m = a.pt('mouth');
    await a.tw({ targets: liz, x: m.x, y: m.y, scale: ls * 0.1 / 1.5, duration: 160, ease: 'Quad.easeIn' });
    liz.setVisible(false);
    void a.puff(m.x, m.y, 0.8);
    void a.burst('spark', m.x, m.y, { n: 5, spread: 120, up: 140, ms: 600, scale: 0.6 });
    a.sfx('gulp');
  };

  // ------------------------------------------------ the tiptoe (quiet)
  let lx = lizX;
  if (quiet) {
    const stopX = speed ? lizX - 430 : lizX - L - rigW * 0.12;
    a.play('walk');
    await a.tw({ targets: a.root, x: stopX - 120, duration: 1900 });
    if (quietFail) {
      const twig = image(a.scene, 'p:twig', a.root.x + rigW * 0.35, cy + rigW * 0.15, 1.1);
      a.world.add(twig);
      await a.tw({ targets: a.root, x: stopX, duration: 600 });
      a.sfx('pop');
      void a.burst('twig', twig.x, twig.y, { n: 3, spread: 90, up: 120, ms: 500, scale: 0.9 });
      twig.destroy();
      a.play('idle');
      swap(a.scene, liz, 'lizardTop:scared');
      void a.floatIcon('p:exclaim', lizX, cy - 90, 1, 50, 900);
      a.sfx('giggle', { rate: 1.3 });
      await a.wait(250);
      void a.tw({ targets: liz, x: hx, y: cy + 80, duration: 900, ease: 'Quad.easeIn', onUpdate: () => { liz.rotation = 0.1; } }).then(() => { liz.setVisible(false); });
      await a.wait(900);
      void a.burst('sweat', a.pt('headTop').x, a.pt('headTop').y, { n: 3, spread: 80, up: 100, gravity: 400, ms: 700 });
      a.sfx('wobble', { volume: 0.5 });
      await a.hold(1500);
      return;
    }
    await a.tw({ targets: a.root, x: stopX, duration: 600 });
    a.play('idle');
    if (!speed) {
      a.sfx('wobble', { volume: 0.4 });
      await a.wait(300);
      a.play('crouch');
      await a.wait(250);
      void a.floatIcon('p:snore', liz.x, liz.y - 50, 0.9, 40, 700);
      await a.tw({ targets: a.root, x: a.root.x + L * 0.25, duration: 180, ease: 'Quad.easeIn' });
      liz.setPosition(a.pt('mouth').x, a.pt('mouth').y);
      await gulp();
      await a.wait(400);
      await a.celebrate(1000);
      return;
    }
    // wakes up with a yawn and bolts
    swap(a.scene, liz, 'lizardTop:happy');
    void a.floatIcon('p:exclaim', liz.x, liz.y - 90, 0.9, 40, 800);
    await a.wait(300);
    lx = liz.x;
  }

  // ------------------------------------------------ the chase (speed)
  const sp = chaseSpeed(a.lv('chase.speed'));
  const T = Math.max(2300, Math.min(4800, ((hx - lx) / sp) * 1000));
  const amp = Math.min(115, (a.bottom - a.top) * 0.12);
  const P = (t: number): { x: number; y: number; h: number } => ({
    x: lx + (hx - lx) * t, y: cy + Math.sin(t * Math.PI * 2.5) * amp * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2),
    h: Math.atan2(Math.cos(t * Math.PI * 2.5) * amp * Math.PI * 2.5, hx - lx),
  });
  const d0 = { x: a.root.x, y: a.root.y };
  const tc = speedFail ? 0.6 : 0.74;
  const catchPt = P(tc);
  const dEnd = { x: catchPt.x - L * 0.95, y: catchPt.y };
  a.play('run');
  a.sfx('whoosh');
  const t = { v: 0 };
  const total = speedFail ? T : T * tc;
  await a.tw({
    targets: t, v: 1, duration: total, ease: 'Linear',
    onUpdate: () => {
      const tl = speedFail ? t.v : t.v * tc;
      const p = P(tl);
      liz.setPosition(p.x, p.y).setRotation(p.h);
      const k = Math.pow(tl / tc, 1.05);
      const dxn = d0.x + (dEnd.x - d0.x) * Math.min(1, k), dyn = d0.y + (dEnd.y - d0.y) * Math.min(1, k);
      a.root.setPosition(dxn, dyn);
      point(p.x, p.y);
    },
  });
  if (!speedFail) {
    liz.setPosition(a.pt('mouth').x, a.pt('mouth').y);
    await gulp();
    a.play('happy');
    await a.wait(300);
    await a.celebrate(1000);
    return;
  }
  // the lizard dives into the hole; the dino skids and spins dizzy
  a.sfx('giggle', { rate: 1.2 });
  await a.tw({ targets: liz, x: hx, y: cy, scale: ls * 0.2 / 1.5, duration: 300, ease: 'Quad.easeIn' });
  liz.setVisible(false);
  void a.dust(a.root.x, a.root.y, 5, 1.1);
  a.sfx('skid');
  a.play('idle');
  await a.tw({ targets: a.root, x: a.root.x + rigW * 0.25, duration: 360, ease: 'Quad.easeOut' });
  a.play('dizzy');
  const rot0 = a.root.rotation;
  await a.tw({ targets: a.root, rotation: rot0 + Math.PI * 4, duration: 1000, ease: 'Sine.easeOut' });
  const stop = a.stars(a.root.x, a.root.y, 3, rigW * 0.2, rigW * 0.2);
  await a.hold(1500);
  stop();
});
