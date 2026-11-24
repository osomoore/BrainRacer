/**
 * Crack a giant nut (nut.crack). Level = nut look (hard / coconut / rock-hard giant).
 * Success: CRACK, the shell splits, the treat pops out and the dino munches it. Fail: its teeth go "boing", a head bonk
 * only gives it stars, and the nut rolls away unharmed.
 */
import { backdrop, image, nutSize, scenario } from './kit';

export default scenario('nut', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.84, 150, 0.7] });
  const rigH = a.rig.height * a.rs;
  const lv = Math.min(3, a.lv('nut.crack'));
  const sc = (nutSize(lv) * 1.5 * rigH) / 236;
  const nx = a.W * 0.68;
  a.img('bush', a.W * 0.9, a.gy + 6, 0.9);
  a.img('bush', a.W * 0.4, a.gy + 6, 0.7);
  const box = a.scene.add.container(nx, a.gy - 118 * sc);
  a.world.add(box);
  const nut = image(a.scene, `nut:${lv}`, 0, 118 * sc, sc);
  box.add(nut);

  a.place(a.W * 0.1);
  const mouthDx = a.pt('mouth').x - a.root.x;
  const stopX = nx - 120 * sc - mouthDx - 6;
  await a.walkTo(stopX - 150, 1700, 'walk');
  a.play('crouch');
  await a.wait(300);
  a.play('chomp');
  await a.tw({ targets: a.root, x: stopX, duration: 220, ease: 'Quad.easeIn' });
  const pass = !a.failed('nut.crack');
  if (pass) {
    a.sfx('chomp');
    await a.wait(300);
    a.sfx('pop');
    a.sfx('chomp', { rate: 0.7 });
    nut.setVisible(false);
    const mk = (key: string, dx: number): Phaser.GameObjects.Image => { const im = image(a.scene, key, nx + dx, a.gy, sc); a.world.add(im); return im; };
    const L = mk('nutHalfL', 0), R = mk('nutHalfR', 0);
    void a.tw({ targets: L, x: nx + 150, y: a.gy - 20, rotation: 0.5, duration: 400, ease: 'Quad.easeOut' });
    void a.tw({ targets: R, x: nx + 330, y: a.gy - 20, rotation: 1.1, duration: 400, ease: 'Quad.easeOut' });
    void a.burst('dust', nx, a.gy - 80 * sc, { n: 5, spread: 200, up: 160, ms: 600, scale: 0.8 });
    void a.burst('spark', nx, a.gy - 100 * sc, { n: 6, spread: 160, up: 260, gravity: 600, ms: 800, scale: 0.8 });
    const treat = image(a.scene, 'treat', nx, a.gy - 100 * sc, 1.1);
    a.fore.add(treat);
    await a.arc2(treat, nx - 20, a.gy - 100 * sc, a.pt('mouth').x + 10, a.pt('mouth').y, 200, 550);
    treat.destroy();
    a.sfx('gulp');
    a.play('chomp');
    await a.wait(700);
    a.sfx('chomp', { volume: 0.6 });
    a.play('happy');
    await a.celebrate(1100);
    return;
  }
  // fail: boing teeth, head bonk, stars, nut rolls away
  a.sfx('boing');
  await a.tw({ targets: a.root, scaleX: a.rs * 0.88, scaleY: a.rs * 1.1, duration: 90, yoyo: true, repeat: 1 });
  a.root.setScale(a.rs, a.rs);
  await a.tw({ targets: a.root, x: stopX - 90, duration: 300, ease: 'Sine.easeOut' });
  a.play('idle');
  await a.wait(150);
  await a.tw({ targets: a.root, x: stopX + 12, duration: 150, ease: 'Quad.easeIn' });
  a.sfx('thud');
  void a.wobble(box, 0.06, 80, 3);
  const h = a.pt('headTop');
  const stop = a.stars(h.x, h.y - 16);
  void a.burst('star', h.x, h.y, { n: 3, spread: 90, up: 160, ms: 600, scale: 0.7 });
  a.play('dizzy');
  await a.wait(700);
  a.sfx('wobble');
  await a.tw({ targets: box, x: a.W + 300, rotation: 12, duration: 1700, ease: 'Quad.easeIn' });
  stop();
  await a.hold(800);
});
