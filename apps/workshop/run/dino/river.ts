/**
 * Cross the river (river.swim, river.fish). Level sets the river width and waves (calm / wide with waves / rushing).
 * Swim pass: splashes in, paddles across, climbs out and shakes off water like a dog. Swim fail: sinks to its eyes, blows bubbles,
 * the current carries it back to the start bank where it plops out dripping.
 * Fish pass: the blue dino blends in, a fish swims right up and is gulped (nom puff, bubbly burp). Fish fail: the fish make a face
 * and zigzag away, the dino gets a splash in the face.
 */
import { Bulge, Friend, backdrop, image, riverSize, scenario, swap } from './kit';

export default scenario('river', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.9, 150, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const swimFail = a.failed('river.swim'), fishFail = a.failed('river.fish');
  const fish = a.has('river.fish');
  const rs = riverSize(a.has('river.swim') ? a.lv('river.swim') : 1);
  const rw = Math.max(rigW * 0.9, Math.min(a.W * 0.44, rs.width * rigW));
  const rx0 = a.W * 0.5 - rw / 2, rx1 = rx0 + rw;
  const surface = a.gy + 4;

  // water body behind the dino (fish live here), banks keep the ground line
  const back = a.strip('water', rx0, surface, rw, 512);
  a.rect(0x1f7fd6, rx0, surface + 256, rw, a.bottom - surface);
  const fishes: Phaser.GameObjects.Image[] = [];
  if (fish) {
    for (let i = 0; i < 3; i++) {
      const f = image(a.scene, 'fish:happy', rx0 + rw * (0.25 + 0.25 * i), surface + 70 + i * 28, 0.6);
      a.world.add(f);
      a.loop({ targets: f, x: f.x + 60, y: f.y - 10, duration: 1400 + i * 300, yoyo: true, ease: 'Sine.easeInOut' });
      fishes.push(f);
    }
  }
  void back;
  a.img('rock:c', rx0 - 20, a.gy + 6, 0.6);
  a.img('rock:c', rx1 + 20, a.gy + 6, 0.7);
  const f1 = new Friend(a, rx1 + Math.min(160, (a.W - rx1) * 0.4), a.gy, (rigH / 300) * 0.85);
  const f2 = new Friend(a, rx1 + Math.min(300, (a.W - rx1) * 0.8), a.gy, (rigH / 300) * 0.75, 'friend2');
  f1.box.scaleX = -1; f2.box.scaleX = -1;
  const w1 = f1.wave(), w2 = f2.wave(320);

  // water in front of the dino (translucent) with bobbing wave crests
  const front = a.rect(0x4db6ff, rx0, surface + 6, rw, a.bottom - surface, 0.42, a.fore);
  const crest = a.strip('waveTop', rx0, surface - 10, rw, 512, a.fore);
  crest.tiles.forEach((t, i) => a.loop({ targets: t, y: t.y - rs.wave, duration: 700 / rs.speed + i * 90, yoyo: true, ease: 'Sine.easeInOut' }));
  void front;

  a.place(a.W * 0.06);
  const bankX = rx0 - rigW * 0.3;
  await a.walkTo(bankX, 1400, 'walk');
  a.play('crouch');
  await a.wait(300);
  const sink = swimFail ? rigH * 0.55 : rigH * 0.3;
  const splash = (x: number, big = 1): void => { a.sfx('splash'); void a.burst('drop', x, surface, { n: Math.round(8 * big), spread: 240, up: 320, gravity: 900, ms: 800, scale: 1 }); };
  await a.arc(rx0 + rigW * 0.35, a.gy + sink, 130, 650, 0.2);
  splash(a.root.x);
  a.play('walk');
  const bob = a.loop({ targets: a.root, y: a.gy + sink - 8, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });

  if (swimFail) {
    await a.tw({ targets: a.root, x: rx0 + rw * 0.45, duration: 1700 });
    bob();
    a.play('dizzy');
    await a.tw({ targets: a.root, y: a.gy + rigH * 0.72, duration: 600, ease: 'Sine.easeIn' });
    for (let i = 0; i < 3; i++) { void a.burst('bubble', a.pt('mouth').x, surface + 10, { n: 3, spread: 60, up: 120, gravity: -100, ms: 800, scale: 1.2 }); a.sfx('wobble', { volume: 0.4 }); await a.wait(280); }
    a.sfx('sad', { volume: 0.5 });
    await a.tw({ targets: a.root, x: bankX + rigW * 0.1, duration: 1400, ease: 'Sine.easeInOut' });
    a.face(1);
    a.play('idle');
    await a.arc(bankX - rigW * 0.1, a.gy, 80, 600, 0);
    splash(a.root.x, 0.8);
    a.sfx('boing', { volume: 0.5 });
    for (let i = 0; i < 4; i++) { void a.burst('drop', a.pt('belly').x, a.pt('belly').y + 40, { n: 3, spread: 80, up: 20, gravity: 800, ms: 500, scale: 0.8 }); await a.wait(250); }
    await a.hold(900);
    return;
  }
  // swim to the middle
  await a.tw({ targets: a.root, x: rx0 + rw * 0.5, duration: (rw * 0.5) / (0.16 * rs.speed) });
  if (fish) {
    bob();
    a.play('idle');
    const p = a.pt('mouth');
    if (fishFail) {
      for (const [i, f] of fishes.entries()) {
        swap(a.scene, f, 'fish:scared');
        void a.tw({ targets: f, x: rx0 + rw * (i === 1 ? 0.12 : 0.9), duration: 1100, ease: 'Quad.easeIn' });
      }
      a.sfx('whoosh');
      await a.wait(500);
      splash(p.x, 0.8);
      void a.burst('drop', p.x, p.y, { n: 6, spread: 100, up: 160, gravity: 600, ms: 700, scale: 0.9 });
      a.play('dizzy');
      await a.hold(1500);
      return;
    }
    const target = fishes[1];
    a.sfx('wobble', { volume: 0.4 });
    await a.arc2(target, target.x, target.y, p.x - 20, surface + 10, 60, 600);
    a.sfx('chomp');
    a.play('chomp');
    target.destroy();
    void a.puff(p.x, surface - 10, 0.7);
    await a.wait(400);
    a.sfx('gulp');
    const bulge = new Bulge(a, 'fish:happy', 1);
    const bp = a.pt('belly');
    await bulge.inflate(bp.x, bp.y - 10, (rigH / 330) * 0.9);
    a.sfx('burp');
    void a.burst('bubble', a.pt('mouth').x + 10, a.pt('mouth').y, { n: 5, spread: 100, up: 220, gravity: -150, ms: 900, scale: 1.2 });
    void bulge.deflate();
    await a.wait(500);
    a.play('walk');
  } else {
    bob();
  }
  const bob2 = a.loop({ targets: a.root, y: a.gy + sink - 8, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });
  await a.tw({ targets: a.root, x: rx1 - rigW * 0.35, duration: (rw * 0.5) / (0.16 * rs.speed) });
  bob2();
  // climb out and shake off like a dog
  await a.arc(rx1 + rigW * 0.35, a.gy, 100, 600, 0.2);
  splash(rx1, 0.8);
  w1(); w2();
  a.play('idle');
  a.sfx('wobble');
  void a.burst('drop', a.root.x, a.gy - rigH * 0.5, { n: 12, spread: 360, up: 200, gravity: 800, ms: 900, scale: 1 });
  await a.tw({ targets: a.root, rotation: { from: -0.12, to: 0.12 }, duration: 70, yoyo: true, repeat: 8, onComplete: () => { a.root.rotation = 0; } });
  void f1.cheer(30, 2);
  await f2.cheer(30, 2);
  await a.celebrate(900);
});
