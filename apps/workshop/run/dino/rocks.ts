/**
 * Climb the big rocks (rocks.climb, rocks.tough). Level sets the wall height (relative to the dino) and the pebble size.
 * Climb pass: up the pile, plants its feet at the top, sparkles. Climb fail: halfway it loses grip and slides down slowly like on a slide.
 * Tough pass: pebbles bounce off its back, boing boing. Tough fail: bonk bonk, it covers its head and hops back down, stars.
 */
import { Ramp, backdrop, image, rockWall, scenario } from './kit';

export default scenario('rocks', async (a) => {
  backdrop(a, 'meadow', { sunAt: [a.W * 0.1, 150, 0.7] });
  const rigH = a.rig.height * a.rs, rigW = a.rig.width * a.rs;
  const wall = rockWall(a.lv('rocks.climb'));
  const climbFail = a.failed('rocks.climb'), toughFail = a.failed('rocks.tough');
  const tough = a.has('rocks.tough');
  const H = Math.min(a.gy - a.top - 260, wall.height * rigH * 1.15);
  const slopeW = Math.min(a.W * 0.42, Math.max(rigW * 1.1, H * 1.25));
  const x0 = a.W * 0.34;
  const ramp = new Ramp(a, 'rock', x0, slopeW, H, Math.max(a.W * 0.16, rigW * 0.7));
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.4) / 5;
    a.img(i % 2 ? 'rock:c' : 'rock:d', x0 + slopeW * t - 20, ramp.y(x0 + slopeW * t) + 36 + (i % 2) * 14, 0.55 + t * 0.25);
  }
  a.img('rock:b', x0 - 70, a.gy + 6, 0.7);

  a.place(a.W * 0.08);
  await a.walkTo(x0 + 10, 1500, 'walk');
  a.play('run');
  const topX = ramp.topX + rigW * 0.25;
  const pebbleScale = tough ? (a.lv('rocks.tough') >= 2 ? 3.4 : 1.8) : 1;
  // a pebble rolls down the slope from the top toward the dino
  const rollPebble = async (hitX: number): Promise<{ x: number; y: number }> => {
    const pb = image(a.scene, 'pebble', ramp.topX + 40, ramp.topY - 16, pebbleScale);
    a.world.add(pb);
    const t0 = { v: 0 };
    const sx = ramp.topX + 40;
    await a.tw({
      targets: t0, v: 1, duration: 900, ease: 'Quad.easeIn',
      onUpdate: () => { const x = sx + (hitX - sx) * t0.v; pb.setPosition(x, ramp.y(Math.max(x, x0)) - 12 * pebbleScale); pb.rotation = -t0.v * 8; },
    });
    const at = { x: pb.x, y: pb.y };
    pb.destroy();
    return at;
  };
  const bounceOver = (at: { x: number; y: number }): void => {
    const pb = image(a.scene, 'pebble', at.x, at.y, pebbleScale);
    a.fore.add(pb);
    a.sfx('boing');
    void a.arc2(pb, at.x, at.y, x0 - 120, a.gy - 10, 150, 900, -9).then(() => pb.destroy());
  };

  if (climbFail) {
    // climb to about half way with a pebble or two, then lose grip and slide down
    await ramp.climbTo(x0 + slopeW * 0.52, 1700, 0.9);
    if (tough && toughFail) { /* the tough gag below handles the pebbles first */ }
    a.play('dizzy');
    a.sfx('wobble');
    await a.wait(350);
    a.sfx('sad', { volume: 0.6 });
    a.play('idle');
    await ramp.climbTo(x0 - 40, 1500, 1.3, 'Sine.easeIn');
    a.root.rotation = 0;
    void a.dust(a.root.x, a.gy, 4, 1);
    a.sfx('thud');
    await a.tw({ targets: a.root, scaleY: a.rs * 0.86, scaleX: a.dir * a.rs * 1.1, duration: 110, yoyo: true });
    a.play('dizzy');
    await a.hold(1500);
    return;
  }
  if (tough) {
    await ramp.climbTo(x0 + slopeW * 0.3, 1100, 0.9);
    if (toughFail) {
      const hit = await rollPebble(a.root.x + rigW * 0.25);
      a.sfx('thud');
      void a.burst('pebble', hit.x, hit.y, { n: 3, spread: 160, up: 200, ms: 700, scale: 0.8 });
      a.play('crouch');
      await a.wait(250);
      const hit2 = await rollPebble(a.root.x + rigW * 0.25);
      a.sfx('thud', { rate: 0.9 });
      void a.burst('pebble', hit2.x, hit2.y, { n: 3, spread: 160, up: 200, ms: 700, scale: 0.8 });
      const stop = a.stars(a.pt('headTop').x, a.pt('headTop').y - 16);
      await a.wait(400);
      a.face(1);
      await ramp.climbTo(x0 - 30, 1100, 0.9, 'Sine.easeIn');
      a.root.rotation = 0;
      a.play('dizzy');
      await a.hold(1500);
      stop();
      return;
    }
    for (let i = 0; i < 2; i++) {
      const hit = await rollPebble(a.root.x + rigW * 0.3);
      bounceOver(hit);
      await a.pop(a.root, 1.06, 120);
      await ramp.climbTo(a.root.x + slopeW * 0.18, 700, 0.9);
    }
  }
  await ramp.climbTo(ramp.topX + 20, tough ? 900 : 2600, 0.9);
  await ramp.climbTo(topX, 600, 0);
  a.root.rotation = 0;
  a.play('stand');
  a.sfx('thud', { volume: 0.5 });
  void a.dust(a.root.x, a.root.y, 3, 0.8);
  await a.wait(500);
  await a.celebrate(1100);
});
