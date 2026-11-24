/**
 * Jump: ramp at the end of the road, a canyon gap (width by jump.speed level) with a stream far below and a soft hay pit,
 * ramp height by jump.landing level (higher ramp = bigger drop).
 * Pass: speed trail, big arc, lands, boings twice, flags wave. Fail speed: short arc, drops into the hay pit and bounces on it.
 * Fail landing: lands with a thud, wheels splay (squash), boings up, spins once, dizzy stars.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

const GAP = [0, 520, 760, 1060];
const RAMP_H = [0, 130, 170, 210];

export default racePlayer('jump', async (ctx) => {
  const plan = planStage(ctx, ['jump.speed', 'jump.landing']);
  const sl = Math.min(3, plan.level('jump.speed', 1));
  const ll = plan.has('jump.landing') ? Math.min(2, plan.level('jump.landing', 1)) : 0;
  const gapW = GAP[sl];
  const rampH = RAMP_H[1 + ll];
  const rampLen = 380;
  const rx = 900, g0 = rx + rampLen + 40, g1 = g0 + gapW;
  const worldW = g1 + 1700;
  const S = new SideStage(ctx, { worldW, sky: ['#6ec8ff', '#f2fbff'], clouds: 5, sun: true, segments: [[-800, g0], [g1, worldW + 800]], groundFrac: 0.6, hills: [{ color: '#b9e8c0', h: 280, f: 0.15 }, { color: '#8ad88f', h: 190, f: 0.3, seed: 5 }] });
  const rig = ctx.rig;
  const sc = S.scene;
  // canyon
  const wall = 0x8a5a30;
  const canyon = sc.add.rectangle(g0, 0, gapW, 1300, wall).setOrigin(0, 0);
  const deep = sc.add.rectangle(g0 + 40, 70, gapW - 80, 1300, 0x6a4524).setOrigin(0, 0);
  const water = sc.add.rectangle(g0 + 40, 400, gapW - 80, 300, 0x4fb8ff).setOrigin(0, 0);
  const ink = sc.add.rectangle(g0, 0, 6, 1300, 0x1b1b3a).setOrigin(0, 0);
  const ink2 = sc.add.rectangle(g1 - 6, 0, 6, 1300, 0x1b1b3a).setOrigin(0, 0);
  S.add('back', canyon); S.add('back', deep); S.add('back', water); S.add('back', ink); S.add('back', ink2);
  const hayX = g0 + gapW * 0.5, hayTop = 270;
  S.put('back', P.haystack(), hayX, hayTop + 330, 1.5);
  S.put('back', P.ramp(rampLen, rampH), rx, 0);
  const flagsL = [S.put('back', P.flag('#e8434a'), g0 - 30, 0), S.put('back', P.flag('#ffd23f'), g0 - 130, 0)];
  const flagsR = [S.put('back', P.flag('#2fb84f'), g1 + 40, 0), S.put('back', P.flag('#2b8cff'), g1 + 150, 0)];
  [100, 460, g1 + 700, g1 + 1100].forEach((x) => S.put('back', P.tree(), x, -4, 0.9));
  S.put('back', P.signpost('#ffd23f'), rx - 160, 0);
  S.put('back', P.bush(), g1 + 450, 0, 0.8);
  void water;
  const wave = (arr: typeof flagsL): void => { arr.forEach((f, i) => { void ctx.tween({ targets: f, rotation: 0.08, duration: 300 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }); };
  wave(flagsL); wave(flagsR);

  S.place(200);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.45 });
  const speedFail = plan.gag?.facet === 'jump.speed';
  const landFail = plan.gag?.facet === 'jump.landing';

  // run-up and ramp
  await S.driveTo(rx - 40, 1700, 'Quad.easeIn');
  const ang = Math.atan2(rampH, rampLen);
  ctx.audio.sfx('engineRev', { volume: 0.6 });
  rig.play('drive');
  await along(ctx, 520, (t) => { S.car.x = rx - 40 + (rampLen + 40) * t; S.car.y = -rampH * Math.max(0, (S.car.x - rx) / rampLen); S.car.rotation = -ang * Math.min(1, Math.max(0, (S.car.x - rx + 40) / 60)); });
  ctx.audio.sfx('whoosh', { volume: 0.7 });
  const trail = S.spray('smoke', 'wheelRear', { speed: { min: 10, max: 60 }, angle: { min: 170, max: 190 }, lifespan: 500 }, 40);
  const sx = S.car.x, sy = S.car.y;
  // landing spot
  const landX = speedFail ? g0 + gapW * 0.52 : g1 + 340;
  const landY = speedFail ? hayTop - 10 : 0;
  const hangMs = speedFail ? 1150 : 1000 + sl * 150;
  const apex = speedFail ? 120 : 210 + sl * 40;
  await along(ctx, hangMs, (t) => {
    S.car.x = sx + (landX - sx) * t;
    const dy = landY - sy;
    S.car.y = sy + dy * t * t * 0.55 + dy * t * 0.45 - Math.sin(t * Math.PI) * apex;
    S.car.rotation = -ang * (1 - t) * 1.1 + t * 0.35 * (speedFail ? 1.6 : 1);
  }, 'Linear');
  trail.stop();
  S.car.rotation = 0;

  if (speedFail) {
    // bounce in the hay like a trampoline
    eng();
    ctx.audio.sfx('boing', { volume: 0.8 });
    S.fx.burst(S.layers.front, 'hay', S.car.x, hayTop + 10, 20);
    let by = S.car.y;
    for (const h of [190, 110, 50]) {
      await along(ctx, 380 + h, (t) => { S.car.y = by - Math.sin(t * Math.PI) * h; S.car.rotation = Math.sin(t * Math.PI) * 0.12; }, 'Linear');
      ctx.audio.sfx('boing', { volume: 0.5, rate: 1.2 });
      S.fx.burst(S.layers.front, 'hay', S.car.x, hayTop + 20, 6);
      by = S.car.y;
    }
    rig.play('dizzy');
    S.dizzy();
    ctx.audio.sfx('sad', { volume: 0.6 });
    await ctx.wait(1500);
    return;
  }

  // landed on the far side
  S.car.y = 0;
  ctx.audio.sfx('thud', { volume: 0.8 });
  S.dust(8);
  if (landFail) {
    eng();
    rig.play('idle');
    await S.squash(1.45, 0.55, 140);
    ctx.audio.sfx('boing', { volume: 0.8 });
    await along(ctx, 750, (t) => { S.car.y = -Math.sin(t * Math.PI) * 230; S.car.rotation = t * Math.PI * 2; }, 'Sine.easeInOut');
    S.car.rotation = 0; S.car.y = 0;
    ctx.audio.sfx('thud', { volume: 0.6 });
    S.dust(6);
    await S.squash(1.25, 0.75, 100);
    rig.play('dizzy');
    S.dizzy();
    ctx.audio.sfx('sad', { volume: 0.6 });
    await ctx.wait(1500);
    return;
  }
  // pass: two gentle boings and roll on
  for (const [h, roll] of [[34, 150], [16, 80]]) {
    const bx = S.car.x;
    await Promise.all([S.squash(1.1, 0.88, 90), along(ctx, 300, (t) => { S.car.y = -Math.sin(t * Math.PI) * h; S.car.x = bx + roll * t; })]);
    ctx.audio.sfx('boing', { volume: 0.45, rate: 1.4 });
  }
  S.car.y = 0;
  rig.play('drive');
  await S.driveTo(S.car.x + 360, 900, 'Sine.easeOut');
  eng();
  await S.cheer(800);
  await S.exit();
});
