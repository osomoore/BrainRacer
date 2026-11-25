import { playWorkshopSfx } from '../../audio/manifest';
import { WS_RUN } from '../../config';
import { hopLift } from '../common/choreography';
import { fl, line, ol, poly, rr, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { raceSpectator } from '../common/raceSpectator';
import { SideStage } from '../common/side';

const cfg = WS_RUN.jump;

function ravine(width: number) {
  return spec('jump:ravine:' + width, width, 650, (g) => {
    g.fillStyle = '#976343';
    g.fillRect(0, 0, width, 650);
    fl(g, '#755039', poly([[42, 0], [width - 54, 0], [width - 30, 650], [30, 650]]));
    for (let y = 52; y < 360; y += 76) {
      line(g, 4, y, 47, y + 20, 9, '#b68155');
      line(g, width - 65, y + 20, width - 4, y, 9, '#b68155');
    }
    fl(g, '#53bce6', poly([[26, 330], [width - 25, 332], [width - 27, 650], [28, 650]]));
    for (let x = 64; x < width - 75; x += 118) line(g, x, 355 + x % 36, x + 62, 355 + x % 36, 6, '#b8efff');
  }, 0, 0);
}

function landingPad() {
  return spec('jump:pad', 535, 60, (g) => {
    ol(g, '#455366', rr(6, 12, 523, 42, 8));
    for (let x = 22; x < 508; x += 36) line(g, x, 23, x + 17, 43, 10, '#ffd25d');
  }, 0, 14);
}

export default racePlayer('jump', async (ctx) => {
  const plan = planStage(ctx, ['jump.speed', 'jump.landing']);
  const speed = Math.min(3, plan.level('jump.speed')) - 1;
  const landing = plan.has('jump.landing') ? Math.min(2, plan.level('jump.landing')) : 0;
  const speedFail = plan.gag?.facet === 'jump.speed';
  const landingFail = plan.gag?.facet === 'jump.landing';
  const gap = cfg.gap[speed], rampH = cfg.rampHeight[landing], rampW = 400;
  const rampX = 880, lip = rampX + rampW, far = lip + gap, worldW = far + 1620;
  const S = new SideStage(ctx, {
    worldW, groundFrac: 0.66, segments: [[-800, lip], [far, worldW + 800]],
    sky: ['#73c6f7', '#f1faff'], sun: true, clouds: 4,
    hills: [{ color: '#b6ddab', h: 285, f: 0.15 }, { color: '#82bd84', h: 190, f: 0.28, seed: 5 }],
  });
  S.fx.seed(ctx.rng);
  S.put('back', ravine(gap), lip, 0);
  S.put('mid', P.haystack(), lip + gap * 0.52, 466, 1.38);
  S.put('back', P.ramp(rampW, rampH), rampX, 0);
  S.put('back', landingPad(), far + 12, 0);
  for (const x of [200, 510, far + 800, far + 1170]) S.put('back', P.tree(), x, 0, ctx.rng.range(0.8, 1));
  for (const x of [rampX - 172, rampX - 96, far + 472]) S.put('back', P.cone(), x, 0);
  S.put('back', P.signpost('#ffd23f'), rampX - 276, 0);
  S.put('back', P.checker(), far + 615, 0, 1.25);
  S.put('back', P.flag('#ffd23f'), lip - 20, -rampH);
  S.put('back', P.flag('#2fb84f'), far + 32);
  const starter = raceSpectator(S, rampX - 345, '#db527e', '#ffe16b');
  const judge = raceSpectator(S, far + 720, '#3e83bb', '#e64c55');
  const gull = S.put('back', P.gull(), lip + gap * 0.46, -330, 1.28);

  const { rig } = ctx;
  S.place(260);
  rig.play('idle');
  await ctx.wait(850);
  starter.cheer();
  ctx.audio.sfx('engineRev', { volume: 0.6 });
  const engine = ctx.audio.loop('engine', { volume: 0.45 });
  rig.play('drive');
  const streaks = Array.from({ length: 6 }, (_, i) =>
    S.add('front', S.scene.add.rectangle(0, 0, 50 + i * 14, 5 + i % 2 * 3, 0xffffff)).setAlpha(0));
  const showSpeed = (strength: number, t: number): void => {
    const tail = rig.anchor('back');
    streaks.forEach((stroke, i) => {
      const age = (t * 3.8 + i / streaks.length) % 1;
      stroke.setPosition(S.car.x + tail.x - 38 - age * 255, S.car.y - 45 - i * 19)
        .setScale(0.55 + strength * age, 1).setAlpha(strength * (1 - age) * 0.94);
    });
  };
  await along(ctx, cfg.runUpMs, (t) => {
    S.car.x = 260 + (rampX - 260) * t;
    showSpeed(t * (speedFail ? 0.27 : 0.85), t);
  }, 'Cubic.easeIn');
  const angle = Math.atan2(rampH, rampW);
  await along(ctx, speedFail ? 720 : 480, (t) => {
    S.car.setPosition(rampX + rampW * t, -rampH * t).setRotation(-angle * Math.min(1, t * 4));
    showSpeed(speedFail ? 0.27 : 0.92, t);
  });
  ctx.audio.sfx('whoosh', { volume: speedFail ? 0.4 : 0.75 });
  engine();
  const landX = speedFail ? lip + gap * 0.52 : far + 266;
  const landY = speedFail ? 200 : 0;
  await along(ctx, speedFail ? 1190 : cfg.flightMs[speed], (t) => {
    S.car.setPosition(lip + (landX - lip) * t, -rampH + (landY + rampH) * t - hopLift(t, speedFail ? 68 : 165 + speed * 30));
    S.car.rotation = -angle * (1 - t) + 0.24 * t;
    gull.y = -330 - hopLift(t, 105);
    gull.x = lip + gap * 0.46 + 260 * t;
    showSpeed((speedFail ? 0.2 : 0.8) * (1 - t), t);
  });
  S.car.rotation = 0;
  rig.play('idle');

  if (speedFail) {
    starter.gasp();
    for (const [height, duration] of [[145, 530], [69, 390], [26, 280]]) {
      ctx.audio.sfx('boing', { volume: 0.6, rate: 1.25 });
      S.fx.burst(S.layers.front, 'hay', landX, landY + 8, 13);
      await along(ctx, duration, (t) => { S.car.y = landY - hopLift(t, height); });
    }
  } else {
    playWorkshopSfx(ctx.audio, 'land', { volume: landingFail ? 0.9 : 0.62 });
    S.dust(10);
    if (landingFail) {
      judge.gasp();
      await S.squash(1.24, 0.71, 140);
      ctx.audio.sfx('boing', { volume: 0.7 });
      const flipHeight = Math.max(174 + landing * 20, rig.height + 45);
      await along(ctx, 920, (t) => {
        S.car.setPosition(landX + 160 * t, -hopLift(t, flipHeight)).setRotation(Math.PI * 2 * t);
      }, 'Sine.easeInOut');
      S.dust(8);
    } else {
      for (const [height, roll, ms] of [[cfg.landingBounce[landing], 125, 530], [16, 67, 370]]) {
        const x = S.car.x;
        await along(ctx, 170, (t) => rig.setSuspensionCompression?.(Math.sin(t * Math.PI)), 'Sine.easeInOut');
        ctx.audio.sfx('boing', { volume: 0.48, rate: 1.35 });
        S.fx.burst(S.layers.front, 'sparkle', S.car.x, -35, 8);
        await along(ctx, ms, (t) => S.car.setPosition(x + roll * t, -hopLift(t, height)));
      }
      judge.cheer();
      await S.driveTo(far + 623, 820);
      await S.cheer(820);
      await S.exit(650);
      return;
    }
  }
  rig.play('dizzy');
  const stars = S.dizzy();
  ctx.audio.sfx('sad', { volume: 0.55 });
  await ctx.wait(WS_RUN.failHoldMs);
  stars.stop();
});
