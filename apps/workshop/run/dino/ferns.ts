/**
 * Hide in the ferns from the big sniffing dino (ferns.hide, ferns.flowers).
 * Hidden: it sniffs right past, scratches its head, shrugs and wanders off.
 * Found: a friendly lick ("you're it": heart + soggy drops), or a tap on the head for the flower patch.
 */
import { backdrop, bigArrive, bigFindsDino, bigSniffsPast, fernDensity, fernKey, makeBig, scenario } from './kit';

export default scenario('ferns', async (a) => {
  backdrop(a, 'forest', { clouds: 1 });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  for (let i = 0; i < 5; i++) a.img('trunk', a.W * (0.06 + i * 0.22) + a.rng.range(-30, 30), a.gy + 10, 0.95).setTint(0x4f8a5a).setAlpha(0.55);
  const hide = a.has('ferns.hide'), flowers = a.has('ferns.flowers');
  const hideFail = a.failed('ferns.hide');
  const caught = !!a.fail;
  const dens = fernDensity(hide ? a.lv('ferns.hide') : 1);
  const hx = a.W * 0.4;
  const cover = caught ? 0.5 : 0.78;
  const fernScale = (rigH * cover) / 190;

  // scenery ferns behind the dino
  for (let i = 0; i < 6; i++) a.img(fernKey(5), a.W * (0.08 + i * 0.17) + a.rng.range(-40, 40), a.gy - 4, 0.9 + a.rng.range(0, 0.4));
  // cover ferns (and flowers) in front of the hiding spot
  const n = flowers && !hide ? 0 : dens.clumps;
  for (let i = 0; i < n; i++) {
    const x = hx - rigW * 0.62 + ((rigW * 1.24) * (i + 0.5)) / n + a.rng.range(-18, 18);
    const sc = fernScale * a.rng.range(0.8, 1.05);
    a.img(fernKey(dens.leaves), x, a.gy + 10 + (i % 2) * 6, sc, a.fore);
  }
  if (flowers) {
    const m = 3;
    for (let i = 0; i < m; i++) a.img('flowers', hx - rigW * 0.5 + (rigW * (i + 0.5)) / m, a.gy + 12, (rigH * (caught ? 0.55 : 1.0)) / 150, a.fore);
    for (const x of [a.W * 0.14, a.W * 0.78, a.W * 0.9]) a.img('flowers', x, a.gy + 4, 1.0);
  }

  a.place(-rigW * 0.5);
  a.sfx('rustle');
  await a.walkTo(hx, 1400, 'walk');
  void a.burst('leaf', hx, a.gy - rigH * 0.5, { n: 6, spread: 200, up: 160, gravity: 500, ms: 800 });
  a.play('crouch');
  a.sfx('rustle');
  await a.wait(500);

  const big = makeBig(a);
  await bigArrive(a, big, hx + rigW * 0.25, 2300);
  if (caught) {
    await bigFindsDino(a, big, !hideFail ? 'tap' : 'lick');
    await a.hold(1300);
    return;
  }
  await bigSniffsPast(a, big, -500);
  void a.hop(rigH * 0.35, 600);
  await a.wait(300);
  await a.celebrate(1000);
});
