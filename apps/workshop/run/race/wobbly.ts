/** The rope and planks sag as a single deck. A heavy car makes it bow, pauses and backs off intact. */
import { WS_RUN } from '../../config';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { Cable, SideStage } from '../common/side';
import { sagProfile } from '../common/terrain';

export default racePlayer('wobbly', async (ctx) => {
  const cfg = WS_RUN.wobbly;
  const plan = planStage(ctx, ['wobbly.weight']);
  const lv = Math.min(cfg.span.length, plan.level('wobbly.weight')) - 1;
  const rig = ctx.rig;
  const start = 940, span = cfg.span[lv], end = start + span;
  const S = new SideStage(ctx, {
    worldW: 3200, groundFrac: 0.66, segments: [[-800, start], [end, 4000]],
    sky: ['#7dd0ff', '#ecf8ff'], clouds: 4,
    hills: [{ color: '#b9e8b0', h: 260, f: 0.15 }, { color: '#8ad88a', h: 180, f: 0.3, seed: 4 }],
  });
  S.fx.seed(ctx.rng);
  S.add('back', ctx.scene.add.rectangle(start + span / 2, 629, span, 650, 0x3e9dd9));
  const creek = S.pool({ x0: start, x1: end, depth: 420, surface: 278, kind: 'creek', frontAlpha: 0.55 });
  creek.back.y = creek.surface;
  S.put('back', P.tree(), 350);
  S.put('back', P.bush(), 625);
  S.put('back', P.roadWarning('bridge'), 740);
  S.put('back', P.bush(), end + 460);
  S.put('back', P.tree(), end + 690);
  for (const x of [start + 52, end - 75]) S.put('front', P.lily(), x, 281, 1.2);
  const duck = S.put('front', P.duck(), start + span * 0.56, 289, 1.28);
  const duckling = S.put('front', P.duck(), duck.x - 87, 291, 0.79);

  const style = (['wood', 'rope', 'stick'] as const)[lv];
  const plankCount = 20;
  const step = span / plankCount;
  const ropeY = -118;
  const ropes = Array.from({ length: plankCount }, () => new Cable(S.scene, S.layers.back, 0xd7a063, 10));
  const hangers = Array.from({ length: plankCount / 2 - 1 }, () => new Cable(S.scene, S.layers.back, 0xca945b, 7));
  const plankLength = 900 / 22 + 10;
  const plankSpec = P.plank(plankLength, style);
  const planks = Array.from({ length: plankCount }, (_, i) => {
    const plank = S.put('back', plankSpec, start + (i + 0.5) * step, 0);
    plank.scaleX *= (step + 5) / plankLength;
    return plank;
  });
  for (const x of [start - 9, end + 9]) S.put('front', P.postTall(), x, 0, 1.1);
  const bird = S.put('front', P.pigeon(), start - 9, -133, 0.96);
  const farBird = S.put('front', P.pigeon(), end + 9, -133, 0.96).setFlipX(true);

  const profile = sagProfile(start, end, 1);
  let load = 0, wave = 0;
  const deck = (x: number): number => profile(x) * (cfg.restSag[lv] + load + Math.sin((x - start) * 0.016 + wave) * load * 0.12);
  const paintDeck = (): void => {
    planks.forEach((plank, i) => {
      const x0 = start + i * step, x1 = x0 + step;
      const y0 = deck(x0), y1 = deck(x1);
      plank.y = deck(plank.x) + 8;
      plank.rotation = Math.atan2(y1 - y0, step);
      ropes[i].set(x0, y0 + ropeY, x1, y1 + ropeY);
    });
    hangers.forEach((hanger, i) => {
      const x = start + (i + 1) * step * 2, y = deck(x);
      hanger.set(x, y + ropeY, x, y + 8);
    });
  };
  const a = rig.anchor('wheelRear'), b = rig.anchor('wheelFront');
  const pose = (x: number, amount: number, phase: number): void => {
    load = amount;
    wave = phase;
    paintDeck();
    const rear = deck(x + a.x), front = deck(x + b.x);
    S.car.setPosition(x, (rear + front) / 2);
    S.car.rotation = Math.atan2(front - rear, b.x - a.x);
  };
  S.place(260);
  rig.play('idle');
  paintDeck();
  await along(ctx, 610, (t) => pose(S.car.x, Math.sin(t * Math.PI) * 9, t * 8));
  const engine = ctx.audio.loop('engine', { volume: 0.37 });
  await S.driveTo(start - b.x - 45, 1410);
  const approach = S.car.x;
  const landing = end + Math.abs(a.x) + 120;
  ctx.audio.sfx('wobble', { volume: 0.58, rate: 1.24 });
  void S.hop(bird, bird.x - 45, bird.y, 570, 76);

  if (plan.ok) {
    void S.squash(1.045, 0.93, 145);
    await along(ctx, 3440, (t) => {
      const x = approach + (landing - approach) * t;
      pose(x, cfg.passSag[lv] * profile(x), t * 34);
    }, 'Sine.easeInOut');
    engine();
    ctx.audio.sfx('honk', { volume: 0.4, rate: 1.23 });
    void S.hop(farBird, farBird.x + 66, farBird.y, 650, 95);
    void S.hop(duck, duck.x + 80, duck.y, 650, 55);
    void S.hop(duckling, duckling.x + 66, duckling.y, 620, 32);
    ctx.audio.sfx('quack', { volume: 0.42 });
    await S.squash(1.13, 0.82, 125);
    await S.cheer(860);
    await S.exit(720);
    return;
  }

  const stop = start + span * 0.33;
  await along(ctx, 1550, (t) => pose(approach + (stop - approach) * t, cfg.failSag[lv] * 0.78 * t, t * 17), 'Quad.easeOut');
  rig.play('idle');
  ctx.audio.sfx('wobble', { volume: 0.82, rate: 0.69 });
  ctx.audio.sfx('quack', { volume: 0.6 });
  S.fx.burst(S.layers.front, 'splash', duck.x, 280, 7, { speed: { min: 45, max: 170 } });
  void S.hop(duck, duck.x + 125, duck.y, 680, 42);
  void S.hop(duckling, duckling.x + 103, duckling.y, 650, 29);
  void S.squash(1.08, 0.89, 195);
  await along(ctx, 900, (t) => pose(stop, cfg.failSag[lv] * (0.78 + 0.22 * t), 17 + t * 13));
  ctx.audio.sfx('engineRev', { volume: 0.53, rate: 0.84 });
  rig.play('drive');
  const retreat = approach - 95;
  await along(ctx, 1560, (t) => {
    const x = stop + (retreat - stop) * t;
    const springBack = (1 - t) * Math.sin(t * 37) * 15;
    pose(x, cfg.failSag[lv] * (1 - t) + springBack, 30 + t * 25);
  }, 'Sine.easeInOut');
  pose(retreat, 0, 0);
  engine();
  rig.play('idle');
  ctx.audio.sfx('boing', { volume: 0.45 });
  await S.hop(bird, start - 9, -133, 500, 40);
  ctx.audio.sfx('sad', { volume: 0.39 });
  await ctx.wait(WS_RUN.failHoldMs);
});
