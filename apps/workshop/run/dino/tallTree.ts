/**
 * Get the fruit from a tall tree (tallTree.fruit, tallTree.shake). Level sets how high the fruit hangs (relative to the dino mouth).
 * Fruit pass: stretch, hop, pluck, munch. Fruit fail: stretches and hops, still short, tumbles backward onto its tail, then the fruit
 * drops and bonks its head. Shake pass: shoves the trunk, the fruit drops into the mouth. Shake fail: the tree does not budge, one
 * leaf lands on its nose and it sneezes.
 */
import { backdrop, fruitHeight, image, scenario } from './kit';

export default scenario('tallTree', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.1, 150, 0.7] });
  const fruit = a.has('tallTree.fruit'), shake = a.has('tallTree.shake');
  const rigW = a.rig.width * a.rs;
  a.place(a.W * 0.1);
  const mouth0 = a.pt('mouth');
  const mouthDx = mouth0.x - a.root.x, mouthH = a.gy - mouth0.y;
  const frontDx = a.rig.anchor('front').x * a.rs;
  const fruitFail = a.failed('tallTree.fruit'), shakeFail = a.failed('tallTree.shake');
  const lvF = a.lv('tallTree.fruit'), cap = Math.min(a.gy - a.top - 260, 640);
  const H = Math.min(cap, Math.max(mouthH * 1.35, fruitHeight(lvF, !fruitFail) * mouthH));
  const tx = a.W * 0.74;
  const fx = fruit ? tx - Math.min(170, rigW * 0.4) - 40 : tx - 60;
  const stopX = fruit ? fx - mouthDx : tx - 50 - frontDx;
  const fy = fruit ? a.gy - H : a.gy - Math.min(cap, Math.max(mouthH * 1.9, H));

  // tree (trunk + canopy + fruit sway together)
  const tree = a.scene.add.container(tx, a.gy);
  a.world.add(tree);
  const top = Math.min(cap + 220, a.gy - fy + 190);
  const trunk = image(a.scene, 'trunk', 0, 6, 1); trunk.scaleY *= top / 616; trunk.scaleX *= 0.9;
  const canopy = image(a.scene, 'canopy', -50, -top - 30, 0.85);
  tree.add([trunk, canopy]);
  const twig = image(a.scene, 'p:twig', -20, -(a.gy - fy) - 24, 1); twig.setScale(twig.scaleX * 2.4, twig.scaleY * 1.2);
  tree.add(twig);
  const fr = image(a.scene, 'fruit:ff8a2a', fx - tx, fy - a.gy, 1);
  tree.add(fr);
  a.img('bush', a.W * 0.4, a.gy + 6, 0.7);
  a.img('bush', a.W * 0.93, a.gy + 6, 0.8);

  a.root.x = -rigW * 0.4;
  await a.walkTo(stopX, 1700, 'walk');

  if (fruit) {
    a.play('stand');
    await a.wait(450);
    a.sfx('whoosh');
    if (!fruitFail) {
      const need = Math.max(30, a.gy - fy - mouthH + 16);
      a.play('run');
      await a.hop(need, 700);
      const p = a.pt('mouth');
      a.sfx('chomp');
      await a.tw({ targets: fr, x: p.x - tx, y: p.y - a.gy, scaleX: 0.3, scaleY: 0.3, duration: 220, ease: 'Quad.easeIn' });
      fr.setVisible(false);
      a.play('chomp');
      void a.puff(p.x, p.y - 10, 0.6);
      await a.wait(700);
      a.sfx('gulp');
      a.play('happy');
      if (!shake) { await a.celebrate(1100); return; }
    } else {
      // too short: hop twice, tumble backward, fruit drops and bonks
      const tries = Math.max(60, (a.gy - fy - mouthH) * 0.42);
      await a.hop(tries, 650);
      a.sfx('sad', { volume: 0.5 });
      await a.hop(tries * 1.1, 650);
      a.play('tumble');
      a.sfx('boing');
      await a.tw({ targets: a.root, x: a.root.x - 170, duration: 1250, ease: 'Sine.easeOut' });
      a.play('dizzy');
      await a.wait(500);
      void a.tw({ targets: tree, rotation: { from: -0.03, to: 0.03 }, duration: 100, yoyo: true, repeat: 2, onComplete: () => { tree.rotation = 0; } });
      void a.burst('leaf', fx, fy - 100, { n: 5, spread: 120, up: 40, gravity: 300, ms: 900 });
      a.sfx('rustle');
      const h = a.pt('headTop');
      fr.setVisible(false);
      const f2 = image(a.scene, 'fruit:ff8a2a', fx, fy, 1);
      a.fore.add(f2);
      await a.arc2(f2, fx, fy, h.x, h.y - 8, 0, 650);
      a.sfx('thud');
      const stop = a.stars(h.x, h.y - 20);
      void a.arc2(f2, h.x, h.y - 8, h.x - 120, a.gy - 30, 90, 600, -5);
      await a.hold(1500);
      stop();
      return;
    }
  }
  if (shake) {
    if (fruit) {
      // second fruit for the shake, next to the trunk
      const fr2y = a.gy - Math.min(cap, Math.max(mouthH * 1.9, H));
      fr.setVisible(true).setPosition(-60, fr2y - a.gy).setScale(1 / 1.5);
      a.play('walk');
      a.face(1);
      await a.tw({ targets: a.root, x: tx - 50 - frontDx, duration: 700 });
    }
    a.play('crouch');
    await a.wait(300);
    a.play('run');
    await a.tw({ targets: a.root, x: tx - 50 - frontDx - 70, duration: 300, ease: 'Sine.easeOut' });
    await a.tw({ targets: a.root, x: tx - 46 - frontDx, duration: 180, ease: 'Quad.easeIn' });
    a.sfx('thud');
    const sway = !shakeFail ? 0.05 : 0.004;
    void a.tw({ targets: tree, rotation: { from: -sway, to: sway }, duration: 110, yoyo: true, repeat: shakeFail ? 1 : 5, onComplete: () => { tree.rotation = 0; } });
    if (!shakeFail) {
      void a.burst('leaf', tx - 40, a.gy - 500, { n: 8, spread: 260, up: 60, gravity: 350, ms: 1300 });
      a.sfx('rustle');
      await a.wait(500);
      const p = a.pt('mouth');
      a.play('stand');
      const f2y = fr.y + a.gy, f2x = fr.x + tx;
      fr.setVisible(false);
      const f2 = image(a.scene, 'fruit:ff8a2a', f2x, f2y, 1);
      a.fore.add(f2);
      await a.arc2(f2, f2x, f2y, p.x, p.y, 0, 600);
      f2.destroy();
      a.sfx('chomp');
      a.play('chomp');
      await a.wait(700);
      a.sfx('gulp');
      await a.celebrate(1100);
      return;
    }
    // shake fail: one leaf onto the nose, sneeze
    a.play('idle');
    const p = a.pt('mouth');
    const leaf = image(a.scene, 'p:leaf', p.x + 10, p.y - 330, 1.3);
    a.fore.add(leaf);
    await a.tw({ targets: leaf, x: { from: p.x - 40, to: p.x + 10 }, y: p.y - 10, rotation: 1.6, duration: 1400, ease: 'Sine.easeInOut' });
    await a.wait(300);
    a.sfx('sniff');
    await a.wait(300);
    a.sfx('boing');
    void a.hop(30, 300);
    void a.burst('dust', p.x + 10, p.y, { n: 4, spread: 180, up: 40, gravity: 200, dir: 1, ms: 500, scale: 0.6 });
    await a.tw({ targets: leaf, x: p.x + 160, y: p.y - 30, rotation: 8, alpha: 0, duration: 600 });
    await a.hold(1300);
  }
});
