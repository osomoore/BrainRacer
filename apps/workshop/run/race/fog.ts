/** A marked crossing, a full stop, and a duck family that only crosses when it can see the car. */
import Phaser from 'phaser';
import { WS_RUN } from '../../config';
import { PAL, bakeKey, circ, ell, fl, line, ol, poly, rr, spec } from '../common/draw';
import { addFog } from '../common/fogFx';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { T, TopStage } from '../common/top';
import { crossingStop } from '../common/choreography';

const crossingSign = spec('fog:duckSign', 157, 226, (g) => {
  line(g, 78, 110, 78, 220, 13, '#626478');
  ol(g, '#ffd66b', poly([[78, 7], [151, 80], [78, 153], [6, 80]]), 7);
  fl(g, PAL.ink, ell(69, 96, 29, 15));
  fl(g, PAL.ink, circ(87, 74, 14));
  fl(g, PAL.ink, poly([[92, 69], [117, 76], [95, 83]]));
  fl(g, '#ffd66b', circ(90, 71, 3));
}, 78, 220);

const sideCrosswalk = spec('fog:sideCrossing', 258, 142, (g) => {
  for (let i = 0; i < 5; i++) {
    const x = 67 + i * 28;
    fl(g, '#eceada', poly([[x, 5], [x + 15, 5], [x + 12 + (i - 2) * 19, 128], [x - 14 + (i - 2) * 19, 128]]));
  }
  line(g, 23, 7, 235, 7, 5, '#dbe5d6');
}, 129, 6);

export default racePlayer('fog', async (ctx) => {
  const { ok: bright } = planStage(ctx, ['fog.bright']);
  const cfg = WS_RUN.fog;
  const rig = ctx.rig;
  const sc = ctx.scene;
  const top = ctx.stage.view === 'top';
  const stage = top ? new TopStage(ctx, { carMaxLateral: 112, baseScale: 0.63 }) : new SideStage(ctx, {
    worldW: 3300, groundFrac: 0.71, ground: ['#a6aaa4', '#647b80', '#506872'],
    sky: ['#c4d3db', '#e8eee6'],
    hills: [{ color: '#adbfba', h: 252, f: 0.13 }, { color: '#94aaa3', h: 198, f: 0.24, seed: 2 }],
  });
  stage.fx.seed(ctx.rng);
  const { car, layers, fx } = stage;
  const cross = stage instanceof TopStage ? stage.w * 0.64 : 1200;
  const roadY = top ? ctx.size.h * 0.51 : 0;
  const carScale = stage instanceof TopStage ? stage.cs : 1;
  const gap = top ? cfg.stopGap * 0.55 : cfg.stopGap;
  const stop = crossingStop(cross - (top ? 77 : 129), rig.anchor('front').x * carScale, gap);

  if (stage instanceof TopStage) {
    stage.bg((g, w) => {
      ol(g, '#819093', rr(-35, roadY - 112, w + 70, 226, 6), 7);
      for (let x = 20; x < w; x += 152) fl(g, '#d9d2a7', rr(x, roadY - 4, 68, 8, 3));
      for (let i = 0; i < 7; i++) fl(g, '#f3eed9', rr(cross - 77, roadY - 106 + i * 31, 154, 17, 3));
      line(g, cross - 97, roadY - 106, cross - 97, roadY + 105, 6, '#dce3db');
    }, ['#99b5a4', '#9ebba9']);
    stage.put('back', T.puddle(ctx.size.w * 0.46, 164), cross + 35, roadY - 304);
    stage.put('back', T.treeTop(155, '#779993'), ctx.size.w * 0.13, roadY - 278);
    stage.put('back', T.treeTop(132, '#779993'), ctx.size.w * 0.93, roadY + 292);
    stage.put('back', crossingSign, cross - 162, roadY + 283, 0.66);
    car.setPosition(26, roadY + 43);
    addFog(ctx, layers.back, layers.front, bright);
  } else {
    stage.put('back', T.puddle(560, 108), cross + 145, -109);
    for (const x of [cross - 175, cross + 124, cross + 418]) stage.put('back', P.reeds(), x, -65, 1.12);
    for (const x of [275, 690, 1760, 2110]) stage.put('back', P.tree('#779c91'), x, -46, ctx.rng.range(0.86, 1.08));
    stage.put('back', crossingSign, cross - 276, -12, 1.04);
    stage.add('back', sc.add.rectangle(0, 151, 4100, 680, 0x8da593).setOrigin(0));
    stage.add('back', sc.add.rectangle(0, 147, 4100, 7, 0x596b6a).setOrigin(0));
    stage.put('back', sideCrosswalk, cross);
    stage.place(204);
    addFog(ctx, stage.backdrop, stage.overlay, bright);
  }

  const ducks = Array.from({ length: 4 }, (_, i) => {
    const size = i ? 0.94 : 1.53;
    const x = cross + (top ? 41 - i * 18 : 77 - i * 52);
    const y = top ? roadY + 165 + i * 36 : 203 + (i % 2) * 29;
    const img = stage.put('front', top ? T.duckTop(size) : P.duck(size), x, y, 1, top ? -Math.PI / 2 : 0);
    if (!top) img.setFlipX(true);
    return { img, x, y, scale: img.scaleX };
  });
  const glow = bakeKey(sc, 'fog:paintGlow', 256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 20, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255,235,151,0.62)');
    grad.addColorStop(0.6, 'rgba(255,238,161,0.25)');
    grad.addColorStop(1, 'rgba(255,245,207,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
  const halo = sc.add.image(0, top ? 0 : -rig.height * 0.46, glow)
    .setDisplaySize(rig.width * 1.6, rig.height * 2.55)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  rig.root.addAt(halo, 0);
  const from = car.x, lane = car.y;
  await ctx.wait(600);
  const engine = ctx.audio.loop('engine', { volume: 0.33 });
  rig.play('drive');
  await along(ctx, cfg.approachMs, (t) => {
    car.x = from + (stop - from) * t;
    car.alpha = bright ? 1 : 1 - (1 - cfg.dullAlpha) * t;
    halo.alpha = bright ? 0.8 * t : 0;
  }, 'Sine.easeInOut');
  engine();
  rig.play('idle');
  const mother = ducks[0];
  ctx.audio.sfx('quack', { volume: 0.52 });
  await along(ctx, 550, (t) => {
    const lean = Math.sin(t * Math.PI);
    mother.img.rotation = (top ? -Math.PI / 2 : 0) - lean * 0.22;
    car.setScale(carScale * (1 + lean * 0.045), carScale * (1 - lean * 0.075));
  });

  if (bright) {
    ctx.audio.sfx('sparkle', { volume: 0.55 });
    fx.burst(layers.front, 'sparkle', car.x, lane - (top ? 42 : rig.height * 0.7), 10);
    await Promise.all(ducks.map(async ({ img, x, y, scale }, i) => {
      if (i) await ctx.wait(i * cfg.duckIntervalMs);
      ctx.audio.sfx('quack', { volume: 0.48, rate: 0.9 + i * 0.19 });
      const dx = top ? 0 : 12 + i * 13;
      const destY = top ? roadY - 162 - (3 - i) * 28 : -115 - (3 - i) * 14;
      await along(ctx, cfg.crossingMs, (t) => {
        const stride = Math.sin(t * Math.PI * 12);
        img.setPosition(x + dx * t, y + (destY - y) * t - (top ? 0 : 12 * Math.abs(stride)));
        img.setRotation((top ? -Math.PI / 2 : 0) + stride * 0.13);
        const size = scale * (top ? 1 : 1 - 0.22 * t);
        img.setScale(size * (1 + 0.05 * stride), size * (1 - 0.05 * stride));
      }, 'Sine.easeInOut');
      if (top) img.setRotation(0);
    }));
    ctx.audio.sfx('honk', { volume: 0.43, rate: 1.22 });
    rig.play('happy');
    await ctx.wait(600);
    if (stage instanceof SideStage) await stage.exit(1030);
    else {
      rig.play('drive');
      await along(ctx, 1030, (t) => { car.x = stop + (stage.w + stage.carLen - stop) * t; }, 'Quad.easeIn');
    }
    return;
  }

  // Mother checks the fog, then settles the family together on the same verge.
  ctx.audio.sfx('rustle', { volume: 0.46 });
  await along(ctx, 980, (t) => {
    const peek = Math.sin(t * Math.PI);
    mother.img.setPosition(mother.x - (top ? 12 : 19) * peek, mother.y - 13 * peek);
    mother.img.setRotation((top ? -Math.PI / 2 : 0) - 0.30 * peek);
  });
  ctx.audio.sfx('quack', { volume: 0.42, rate: 0.78 });
  await along(ctx, 720, (t) => {
    for (let i = 1; i < ducks.length; i++) {
      const { img, x, y, scale } = ducks[i];
      img.setPosition(x + (top ? 12 : 17) * t, y + (top ? -10 : 5) * t);
      img.setScale(scale * (1 + 0.08 * t), scale * (1 - 0.15 * t));
    }
  }, 'Sine.easeInOut');
  ctx.audio.sfx('sad', { volume: 0.38 });
  await ctx.wait(WS_RUN.failHoldMs);
});
