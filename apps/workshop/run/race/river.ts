/** Give the stream a readable waterline, then let the fitted crossing gear do its job. */
import type Phaser from 'phaser';
import { WS_RUN } from '../../config';
import { ell, fl, line, ol, poly, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { waterEnvelope } from '../common/choreography';

const crossingSign = spec('river:sign', 156, 232, (g) => {
  line(g, 78, 104, 78, 222, 14, '#805330');
  ol(g, '#ffdb62', poly([[78, 6], [149, 78], [78, 149], [7, 78]]), 7);
  for (const y of [65, 84, 103]) {
    g.beginPath();
    g.moveTo(41, y);
    g.quadraticCurveTo(53, y - 13, 66, y);
    g.quadraticCurveTo(78, y + 13, 90, y);
    g.quadraticCurveTo(103, y - 13, 115, y);
    g.strokeStyle = '#256ca0';
    g.lineWidth = 6;
    g.stroke();
  }
}, 78, 224);

const ripple = spec('river:ripple', 154, 24, (g) => {
  fl(g, '#82d8fa', ell(77, 12, 72, 8));
  fl(g, '#e4faff', ell(77, 9, 52, 3));
}, 77, 12);

export default racePlayer('river', async (ctx) => {
  const plan = planStage(ctx, ['river.cross']);
  const lv = Math.min(2, plan.level('river.cross')) - 1;
  const cfg = WS_RUN.river;
  const rig = ctx.rig;
  const entry = 1080, width = cfg.width[lv], bank = entry + width;
  const S = new SideStage(ctx, {
    worldW: bank + 1740, groundFrac: 0.72, segments: [[-800, entry], [bank, bank + 2600]],
    sky: ['#65c4f4', '#f0f8de'], clouds: 4, sun: true,
    hills: [{ color: '#aed9ab', h: 286, f: 0.12 }, { color: '#79c68a', h: 195, f: 0.25, seed: 13 }],
  });
  S.fx.seed(ctx.rng);
  S.add('back', S.scene.add.rectangle(entry, 4, width, 900, 0x319ac9).setOrigin(0));
  S.pool({ x0: entry, x1: bank, depth: 300, kind: 'water', frontAlpha: 0.66 });
  for (const x of [145, 515, bank + 390, bank + 700]) S.put('back', P.tree(), x, -4, 0.95);
  S.put('back', crossingSign, entry - 305);
  for (const x of [entry - 35, bank + 28, bank + 116]) S.put('back', P.reeds(), x, -12, 1.22);
  S.put('mid', P.rock(178, 72, 3), bank - 112, 6);
  const turtle = S.put('mid', P.turtle(), bank - 98, -45, 1.18).setFlipX(true);
  const frog = S.put('front', P.frog(), entry + width * 0.54, -2, 1.5);
  const frogScale = frog.scaleX;
  S.put('mid', P.lily(), frog.x, 5, 1.42);
  for (let i = 0; i < 3 + lv * 2; i++) {
    const x = entry + 68 + i * (width - 120) / (2 + lv * 2);
    const wave = S.put('front', ripple, x, 30 + ctx.rng.range(8, 65), ctx.rng.range(0.5, 1.04));
    void ctx.tween({ targets: wave, x: x + 28, alpha: 0.5, duration: 900 + i * 85, yoyo: true, repeat: -1 });
  }
  const fish = S.put('front', P.fish(), entry + 104, 110, 1.3).setAlpha(0.7);
  void ctx.tween({ targets: fish, x: entry + width * 0.48, y: 143, duration: 1450, yoyo: true, repeat: -1 });

  const front = rig.anchor('front').x;
  const roof = rig.anchor('roof');
  const axleDepth = -rig.anchor('wheelFront').y + 6 + lv * 9;
  const hasFloaties = ctx.computed.tags.has('canFloat');
  S.place(245);
  await ctx.wait(570);
  const engine = ctx.audio.loop('engine', { volume: 0.38 });
  await S.driveTo(entry - front - 24, cfg.approachMs, 'Sine.easeOut');
  rig.play('idle');
  void S.hop(frog, frog.x, frog.y, 420, 38);
  await S.squash(1.045, 0.92, 190);
  rig.play('drive');

  const splash = (x: number, count: number): void => {
    ctx.audio.sfx('splash', { volume: 0.65 });
    S.fx.burst(S.layers.front, 'splash', x, 0, count);
  };
  const from = S.car.x;
  if (plan.ok) {
    const rear = rig.anchor('wheelRear').x;
    const to = bank + Math.abs(rig.anchor('back').x) + 45;
    const snorkel = rig.focus('extra');
    const wake = hasFloaties
      ? S.fx.stream(S.layers.front, 'drops', null, entry, 2, 110)
      : S.fx.stream(S.layers.front, 'bubbles', S.car, snorkel.x, snorkel.y, 120);
    splash(entry, 20);
    if (hasFloaties) {
      ctx.audio.sfx('boing', { volume: 0.5 });
      for (const float of rig.parts.extra ?? []) {
        const image = float as Phaser.GameObjects.Image;
        void ctx.tween({ targets: image, scaleY: image.scaleY * 1.23, duration: 240, yoyo: true });
      }
    }
    let farSplash = false;
    await along(ctx, cfg.crossingMs[lv], (t) => {
      const envelope = waterEnvelope(t);
      S.car.x = from + (to - from) * t;
      S.car.y = envelope * (hasFloaties ? cfg.floatDepth + Math.sin(t * 25) * cfg.bob[lv] : axleDepth + 34);
      S.car.rotation = envelope * Math.sin(t * 25) * (hasFloaties ? 0.075 : 0.025);
      if (hasFloaties) wake.setPos(Math.max(entry, Math.min(bank, S.car.x + rear)), 2);
      if (!farSplash && S.car.x + front >= bank) {
        farSplash = true;
        splash(bank, 13);
        void S.hop(turtle, turtle.x, turtle.y, 510, 65);
      }
    }, 'Sine.easeInOut');
    wake.stop();
    engine();
    S.car.setY(0).setRotation(0);
    await S.squash(1.08, 0.87, 130);
    await S.cheer(760);
    await S.exit(700);
    return;
  }

  splash(entry, 22);
  const stop = entry + width * 0.31;
  const bubbles = S.spray('bubbles', 'wheelFront', { angle: { min: 250, max: 290 } }, 160);
  await along(ctx, 1620, (t) => {
    S.car.x = from + (stop - from) * t;
    S.car.y = axleDepth * t;
    S.car.rotation = 0.17 * Math.sin(t * Math.PI);
  }, 'Quad.easeOut');
  engine();
  rig.play('idle');
  ctx.audio.sfx('wobble', { volume: 0.53 });
  await S.squash(1.05, 0.94, 170);
  await S.hop(frog, S.car.x + roof.x, S.car.y + roof.y - 4, 660, 147);
  ctx.audio.sfx('pop', { volume: 0.54 });
  bubbles.stop();
  ctx.audio.sfx('sad', { volume: 0.43 });
  await along(ctx, WS_RUN.failHoldMs, (t) => {
    const stretch = Math.sin(t * Math.PI * 4) * 0.06;
    frog.setScale(frogScale * (1 + stretch), frogScale * (1 - stretch));
  });
});
