/**
 * Hot sandy desert (desert.hide, desert.cool).
 * Hide: the big sniffing dino walks past (or finds the dino and taps it, "found you"). Cool: a relaxed stroll in sunglasses,
 * or too hot: sweat, red face, hopping from foot to foot, runs back to the palm tree's shade.
 */
import { backdrop, bigArrive, bigFindsDino, bigSniffsPast, duneCount, heatLines, image, makeBig, scenario } from './kit';

export default scenario('desert', async (a) => {
  backdrop(a, 'desert', { clouds: 0, sunAt: [a.W * 0.78, 190, 1.5] });
  const rigW = a.rig.width * a.rs;
  const hide = a.has('desert.hide'), cool = a.has('desert.cool');
  const hx = a.W * 0.5;
  // dunes (fewer on flat open sand), cacti, palm (shade)
  const nd = hide ? duneCount(a.lv('desert.hide')) : 3;
  for (let i = 0; i < nd; i++) a.img('dune', a.W * ((i + 0.5) / nd) + a.rng.range(-60, 60), a.gy + 6, a.rng.range(0.7, 1.05));
  const palmX = a.W * 0.1;
  a.img('shade', palmX + 60, a.gy + 8, 1);
  a.img('palm', palmX, a.gy + 8, 1);
  a.img('cactus', a.W * 0.9, a.gy + 6, 1.1);
  a.img('cactus', a.W * 0.27, a.gy + 6, 0.8);
  const heat: ReturnType<typeof a.img>[] = [];
  if (cool) {
    const n = heatLines(a.lv('desert.cool'));
    for (let i = 0; i < n; i++) {
      const h = a.img('heat', a.W * ((i + 0.5) / n), a.gy - 20, 1.4, a.fore).setAlpha(0.5);
      a.loop({ targets: h, y: h.y - 14, alpha: 0.2, duration: 700 + i * 90, yoyo: true, ease: 'Sine.easeInOut' });
      heat.push(h);
    }
  }

  // sunglasses / red face live on the rig root so they follow the dino
  const head = a.rig.anchor('headTop'), mouth = a.rig.anchor('mouth');
  const ex = head.x + (mouth.x - head.x) * 0.22, ey = head.y + (mouth.y - head.y) * 0.12;
  const headLen = Math.hypot(mouth.x - head.x, mouth.y - head.y);
  const shades = image(a.scene, 'shades', ex, ey, (headLen * 0.9) / 110);
  const glint = image(a.scene, 'p:spark', ex + 8, ey - 8, 0.5);
  const blush = image(a.scene, 'p:dust', ex, ey + 4, (headLen * 1.8) / 80).setTint(0xff3b30).setAlpha(0);
  a.root.add([blush]);

  a.place(-rigW * 0.5);
  if (hide) {
    await a.walkTo(hx, 1500, 'walk');
    a.play('crouch');
    await a.wait(400);
    const big = makeBig(a);
    await bigArrive(a, big, hx + rigW * 0.2, 2300);
    if (a.failed('desert.hide')) { await bigFindsDino(a, big, 'tap'); await a.hold(1300); return; }
    await bigSniffsPast(a, big, -500);
    a.play('stand');
    await a.wait(350);
    if (!cool) { await a.celebrate(1000); return; }
  } else {
    a.root.x = a.W * 0.2;
  }
  // the hot walk
  const coolFail = a.failed('desert.cool');
  a.root.add([shades, glint]);
  if (!coolFail) {
    glint.setAlpha(0);
    a.go({ targets: glint, alpha: { from: 0, to: 1 }, scale: { from: 0.2, to: 0.7 }, duration: 600, yoyo: true, repeat: 2, delay: 900 });
    await a.walkTo(a.W * 0.86, 3200, 'walk');
    a.play('idle');
    a.sfx('sparkle');
    await a.celebrate(900);
    return;
  }
  shades.setVisible(false); glint.setVisible(false);
  await a.walkTo(a.W * 0.6, 1500, 'walk');
  a.play('dizzy');
  a.go({ targets: blush, alpha: 0.75, duration: 500 });
  const h = a.pt('headTop');
  a.sfx('wobble');
  void a.burst('sweat', h.x, h.y, { n: 6, spread: 160, up: 200, gravity: 700, ms: 900 });
  await a.wait(500);
  a.play('run');
  for (let i = 0; i < 3; i++) { await a.hop(40, 280); if (i === 1) a.sfx('boing', { volume: 0.5 }); }
  void a.burst('sweat', a.pt('headTop').x, a.pt('headTop').y, { n: 6, spread: 160, up: 200, gravity: 700, ms: 900 });
  await a.walkTo(palmX + 220, 1600, 'run');
  a.play('crouch');
  a.sfx('sad');
  a.go({ targets: blush, alpha: 0.15, duration: 900 });
  await a.hold(1500);
});
