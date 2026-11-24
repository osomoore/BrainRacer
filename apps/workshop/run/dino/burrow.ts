/**
 * Squeeze into a small burrow (burrow.fit, burrow.dig, burrow.dark). Level sets how small the hole is (relative to the dino, so a failing
 * build always looks too big). Phases run in order: dig (dirt piles block the door), fit (squeeze in), dark (glow spots light the tunnel).
 * Fit fail: stuck, legs kicking, the friend pushes it out with a boing. Dig fail: tiny dent, a clump lands on its nose.
 * Dark fail: bonks the wall, little stars, backs out rubbing its head.
 */
import { Friend, backdrop, holeFraction, image, scenario } from './kit';

export default scenario('burrow', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.1, 150, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const fit = a.has('burrow.fit'), dig = a.has('burrow.dig'), dark = a.has('burrow.dark');
  const fitFail = a.failed('burrow.fit'), digFail = a.failed('burrow.dig'), darkFail = a.failed('burrow.dark');
  const d = (fit ? holeFraction(a.lv('burrow.fit'), !fitFail) : 0.62) * rigH;
  const k = Math.max(0.85, Math.min(1.3, rigH / 330));
  const dx = Math.min(a.W * 0.7, Math.max(a.W * 0.62, rigW * 0.4 + 330 * k + 200));
  a.img('dome', dx, a.gy + 6, k);
  const hx = dx - 190 * k, hy = a.gy - d * 0.5 - 2;
  a.img('hole', hx, hy, d / 188);
  const glow = a.img('glow', hx, hy, (d * 1.5) / 60).setAlpha(0);
  glow.setTint(0xffee88);
  const friend = new Friend(a, hx, a.gy - d * 0.18, d / 260);
  friend.box.setScale(0).setAlpha(1);
  a.img('bush', a.W * 0.34, a.gy + 6, 0.7);

  // dirt piles in front of the door
  const piles: Phaser.GameObjects.Image[] = [];
  if (dig) {
    for (const [o, sc] of [[-d * 0.5, 1], [-d * 0.05, 1.05]] as const) piles.push(a.img('dirt', hx + o, a.gy + 4, (d * 1.0 * sc) / 110, a.fore));
  }

  a.place(a.W * 0.08);
  const frontDx = a.rig.anchor('front').x * a.rs;
  const stopX = hx - d * 0.62 - frontDx - (dig ? d * 0.7 : 0);
  await a.walkTo(stopX, 1700, 'walk');

  // ---- dig
  if (dig) {
    a.play('crouch');
    await a.wait(250);
    a.play('run');
    const px = a.pt('front').x, py = a.gy - 10;
    const dirtBurst = (): void => { void a.burst('dust', px, py, { n: 3, spread: 160, up: 220, gravity: 800, dir: -1, ms: 600, scale: 0.7 }); void a.burst('pebble', px, py, { n: 3, spread: 200, up: 260, gravity: 900, dir: -1, ms: 700, scale: 0.8 }); };
    if (!digFail) {
      for (let i = 0; i < 5; i++) { dirtBurst(); a.sfx('rustle', { volume: 0.6 }); await a.shake(a.root, 4, 40, 3); }
      for (const p of piles) void a.tw({ targets: p, scaleX: 0, scaleY: 0, duration: 450, ease: 'Back.easeIn' });
      a.sfx('pop');
      await a.wait(500);
    } else {
      for (let i = 0; i < 3; i++) { dirtBurst(); a.sfx('rustle', { volume: 0.5 }); await a.shake(a.root, 4, 40, 3); }
      for (const p of piles) { await a.tw({ targets: p, scaleX: p.scaleX * 0.93, duration: 150, yoyo: true }); }
      a.play('idle');
      const m = a.pt('mouth');
      const clump = image(a.scene, 'dirt', m.x, m.y - 360, 0.3);
      a.fore.add(clump);
      await a.tw({ targets: clump, y: m.y - 12, duration: 350, ease: 'Quad.easeIn' });
      a.sfx('thud');
      void a.burst('dust', m.x, m.y - 10, { n: 4, spread: 140, up: 100, ms: 500, scale: 0.6 });
      const stop = a.stars(a.pt('headTop').x, a.pt('headTop').y - 20);
      await a.tw({ targets: clump, alpha: 0, y: a.gy - 6, duration: 600 });
      await a.hold(1400);
      stop();
      return;
    }
  }

  // ---- fit
  const targetX = hx - d * 0.62 - frontDx;
  a.play('walk');
  await a.tw({ targets: a.root, x: targetX, duration: dig ? 800 : 500 });
  if (fit && fitFail) {
    a.play('run');
    a.root.scaleX = a.dir * a.rs * 0.86;
    a.sfx('wobble');
    await a.tw({ targets: a.root, x: targetX + d * 0.55, duration: 600, ease: 'Quad.easeIn' });
    a.sfx('thud', { volume: 0.6 });
    for (let i = 0; i < 4; i++) { void a.dust(a.root.x - 20, a.gy, 1, 0.5); await a.shake(a.root, 5, 60, 2); }
    await a.tw({ targets: friend.box, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    a.sfx('boing');
    a.root.setScale(a.dir * a.rs, a.rs);
    void a.puff(hx, hy, 0.8);
    void friend.cheer(14, 1);
    a.play('dizzy');
    await a.arc(a.root.x - 330, a.gy, 120, 800, 0);
    void a.dust(a.root.x, a.gy, 4, 1);
    a.sfx('thud');
    await a.tw({ targets: a.root, scaleY: a.rs * 0.85, scaleX: a.dir * a.rs * 1.1, duration: 100, yoyo: true });
    await a.tw({ targets: friend.box, scaleX: 0, scaleY: 0, duration: 250, delay: 300 });
    await a.hold(1200);
    return;
  }
  // squeeze in with a wiggle and a pop
  a.sfx('wobble');
  void a.tw({ targets: a.root, rotation: { from: -0.08, to: 0.08 }, duration: 110, yoyo: true, repeat: 3 });
  await a.tw({ targets: a.root, x: hx - d * 0.25, y: hy + d * 0.05, scaleX: a.dir * a.rs * 0.5, scaleY: a.rs * 0.5, duration: 900, ease: 'Sine.easeIn' });
  a.root.rotation = 0;
  a.sfx('pop');
  await a.tw({ targets: a.root, x: hx, y: hy, scaleX: a.dir * a.rs * 0.12, scaleY: a.rs * 0.12, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
  void a.puff(hx, hy, 0.8);

  // ---- dark
  if (dark && darkFail) {
    await a.wait(400);
    a.sfx('thud');
    const stop = a.stars(hx, hy - d * 0.55, 3, d * 0.35, d * 0.1);
    await a.wait(700);
    a.root.setPosition(hx, hy).setAlpha(1);
    a.play('dizzy');
    await a.tw({ targets: a.root, x: hx - d * 1.2, y: a.gy, scaleX: a.dir * a.rs, scaleY: a.rs, duration: 900, ease: 'Sine.easeOut' });
    stop();
    a.sfx('sad', { volume: 0.6 });
    const s2 = a.stars(a.pt('headTop').x, a.pt('headTop').y - 14);
    await a.hold(1500);
    s2();
    return;
  }
  if (dark) {
    a.sfx('sparkle');
    await a.tw({ targets: glow, alpha: 0.95, duration: 500 });
    a.go({ targets: glow, alpha: 0.6, duration: 400, yoyo: true, repeat: -1 });
  }
  friend.box.setScale(0);
  await a.tw({ targets: friend.box, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.easeOut' });
  a.sfx('cheer');
  void a.burst('spark', hx, hy - d * 0.3, { n: 8, spread: 220, up: 260, gravity: 500, ms: 1000, scale: 0.9 });
  void a.burst('heart', hx, hy - d * 0.4, { n: 3, spread: 120, up: 200, gravity: 200, ms: 1100, scale: 0.9 });
  await friend.cheer(24, 3);
  await a.wait(500);
});
