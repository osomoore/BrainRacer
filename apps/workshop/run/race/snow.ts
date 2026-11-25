/** Tires dig into layered snow. With grip the car climbs out, without it the tires spin and slide back. */
import { WS_RUN } from '../../config';
import { prop } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

export default racePlayer('snow', async (ctx) => {
  const cfg = WS_RUN.snow;
  const plan = planStage(ctx, ['snow.grip']);
  const lv = Math.min(cfg.length.length, plan.level('snow.grip')) - 1;
  const rig = ctx.rig;
  const S = new SideStage(ctx, {
    worldW: 3340, groundFrac: 0.73, ground: ['#f4fbff', '#dcefff', '#bcd8ee'],
    sky: ['#82b3df', '#ebf8ff'], clouds: 4,
    hills: [{ color: '#dfeefa', h: 320, f: 0.12 }, { color: '#a5c8e7', h: 220, f: 0.28, seed: 7 }],
  });
  S.fx.seed(ctx.rng);
  const start = 930, length = cfg.length[lv], end = start + length, depth = cfg.depth[lv];
  [160, 410, 745, end + 290, end + 630].forEach((x, i) =>
    S.put('back', P.pine(true), x, -8, i % 2 ? 0.92 : 1.18));
  S.put('back', P.roadWarning('snow'), start - 260);
  if (lv === 2) S.put('back', P.ice(435), start + 85, 3);
  for (const part of [0.2, 0.52, 0.83]) {
    S.put('back', P.snowbank(Math.round(length * 0.48), depth + 30), start + length * part, 12);
    S.put('front', P.snowbank(Math.round(length * 0.42), Math.round(depth * 0.46)), start + length * part, 34);
  }
  const drift = S.put('front', P.snowbank(220, depth + 18), plan.ok ? end + 85 : start - 415, 44);
  const snowmanX = plan.ok ? end + 325 : start - 180;
  const snowman = S.put('back', P.snowman(false), snowmanX, -28, 1.0);
  const hat = S.put('front', P.hat(), snowmanX, -214, 0.79);
  const onlookerX = plan.ok ? start - 370 : start + length * 0.8;
  const friend = S.put('back', P.puppy(false), onlookerX, -10, 1.12).setFlipX(!plan.ok);

  S.place(260);
  rig.play('idle');
  await ctx.wait(540);
  const engine = ctx.audio.loop('engine', { volume: 0.36 });
  await S.driveTo(start - 140, 1530);
  const entry = S.car.x;
  const spray = S.spray('snow', 'wheelRear', {
    speed: { min: 155, max: 330 }, angle: { min: 195, max: 250 },
    scale: { start: 2.9, end: 0.8 }, tint: [0xffffff, 0xc4e6fb],
  }, cfg.sprayMs[lv]);
  const wheel = rig.anchor('wheelRear');
  const kickSnow = (n: number): void => {
    for (let i = 0; i < n; i++) {
      const clump = S.put('front', P.snowChunk(), S.car.x + wheel.x, S.car.y + wheel.y, ctx.rng.range(0.48, 0.95));
      S.fx.bits.add({ obj: clump, vx: ctx.rng.range(-370, -160), vy: ctx.rng.range(-370, -215),
        vr: ctx.rng.range(-5, 5), floorY: 21, bounce: 0.28,
        onSettle: () => void ctx.tween({ targets: clump, alpha: 0, duration: 350 }),
      });
    }
  };
  kickSnow(5);
  ctx.audio.sfx('rustle', { volume: 0.64 });

  if (plan.ok) {
    await along(ctx, 2660, (t) => {
      S.car.x = entry + (end + 178 - entry) * t;
      const load = Math.sin(t * Math.PI);
      S.car.y = load * (cfg.sink[lv] + Math.sin(t * 38) * 8);
      S.car.rotation = Math.sin(t * 30) * 0.035 * load;
    });
    kickSnow(6);
    spray.stop();
    ctx.audio.sfx('pop', { volume: 0.72 });
    await S.driveTo(end + 306, 580, 'Cubic.easeOut');
    engine();
    void S.hop(snowman, snowmanX + 30, snowman.y, 650, 83);
    void S.hop(hat, snowmanX + 30, hat.y, 650, 112);
    await S.squash(1.12, 0.85, 120);
    await S.cheer(900);
    await S.exit(700);
    return;
  }

  const stall = start + length * 0.3;
  await along(ctx, 1160, (t) => {
    S.car.x = entry + (stall - entry) * t;
    S.car.y = cfg.sink[lv] * t;
    S.car.rotation = 0.09 * t;
  }, 'Quad.easeOut');
  rig.play('spinWheels');
  const spin = ctx.audio.loop('spin', { volume: 0.62 });
  kickSnow(9);
  void S.hop(friend, friend.x + 26, friend.y, 520, 70);
  await along(ctx, 950, (t) => {
    S.car.x = stall + Math.sin(t * 42) * 7;
    S.car.y = cfg.sink[lv] + Math.sin(t * 42) * 5;
  });
  ctx.audio.sfx('skid', { volume: 0.7 });
  const retreat = start - 304;
  await along(ctx, 1280, (t) => {
    S.car.x = stall + (retreat - stall) * t;
    S.car.y = cfg.sink[lv] * (1 - t) + Math.sin(t * Math.PI) * 17;
    S.car.rotation = 0.09 - 0.21 * t;
  }, 'Quad.easeIn');
  engine();
  spin();
  spray.stop();
  rig.play('idle');
  ctx.audio.sfx('thud', { volume: 0.44 });
  S.fx.burst(S.layers.front, 'snow', drift.x + 52, -25, 18, { scale: { start: 2.4, end: 0.5 } });
  void ctx.tween({ targets: snowman, rotation: 0.09, duration: 170, yoyo: true });
  void S.squash(0.9, 1.08);
  S.car.setRotation(0);
  const roof = rig.anchor('roof');
  await S.hop(hat, S.car.x + roof.x, roof.y - 20, 620, 85);
  // Attach the borrowed hat for the final hold so it follows the body.
  const worn = prop(ctx.scene, rig.bodyMount?.() ?? S.car, P.hat(), roof.x, roof.y - 20, 0.79);
  hat.destroy();
  worn.rotation = -0.15;
  ctx.audio.sfx('boing', { volume: 0.46 });
  ctx.audio.sfx('sad', { volume: 0.4 });
  await ctx.wait(1250);
});
