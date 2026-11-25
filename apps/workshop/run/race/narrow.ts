/** Cones mark the pinch point. Fold the mirrors, then slip through or pop back out of the gap. */
import { WS_RUN } from '../../config';
import { PAL, prop } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { clearanceGap } from '../common/terrain';
import { T, TopStage } from '../common/top';

export default racePlayer('narrow', async (ctx) => {
  const cfg = WS_RUN.narrow;
  const plan = planStage(ctx, ['narrow.width']);
  const lv = plan.level('narrow.width');
  const S = new TopStage(ctx, { carMaxLateral: 148 });
  S.fx.seed(ctx.rng);
  const { w, h } = S;
  const cy = h * 0.49;
  const gap = clearanceGap(S.carWid, lv, plan.ok, cfg.clearance, cfg.overlap);
  const gateLength = cfg.length[Math.min(lv, cfg.length.length) - 1];
  const gate = Math.min(w * 0.58, w - S.carLen - gateLength - 30);
  const gateEnd = gate + gateLength;
  const roadW = 360;
  const coneRadius = 25;
  const coneY = gap / 2 + coneRadius;
  S.bg((g) => {
    g.fillStyle = PAL.ink;
    g.fillRect(0, cy - roadW / 2 - 5, w, roadW + 10);
    g.fillStyle = '#d7b883';
    g.fillRect(0, cy - roadW / 2, w, roadW);
    g.fillStyle = '#c8a476';
    g.fillRect(0, cy - roadW / 2, w, 18);
    g.fillRect(0, cy + roadW / 2 - 18, w, 18);
    for (let i = 0; i < 36; i++) g.fillRect((i * 173) % w, cy - roadW / 2 + ((i * 53) % roadW), 25, 5);
  }, ['#5ca950', '#65b45a']);

  for (const side of [-1, 1]) {
    for (let x = 90; x < w; x += 240) {
      S.put('back', T.treeTop(ctx.rng.int(142, 207), side < 0 ? '#42a448' : '#3e9746'),
        x + ctx.rng.range(-38, 38), cy + side * (roadW / 2 + ctx.rng.range(102, 158)));
    }
    for (const [dx, dy] of [[-164, 63], [-100, 38], [-50, 20], [gateLength + 62, 28]]) {
      S.put('back', T.cone(), gate + dx, cy + side * (coneY + dy), 0.84);
    }
    S.put('back', T.wall(gateLength + 74, 78), gate + gateLength / 2, cy + side * (gap / 2 + 79));
    S.put('front', T.cone(), gate + gateLength / 2, cy + side * coneY);
    S.put('front', T.cone(), gateEnd, cy + side * coneY);
  }
  const entryCones = [-1, 1].map((side) => S.put('front', T.cone(), gate, cy + side * coneY));
  const squirrel = S.put('front', T.squirrelTop(), gateEnd + 38, cy - roadW / 2 - 32, 1.55, Math.PI * 0.75);
  const duck = S.put('front', T.duckTop(), gateEnd + 58, cy + roadW / 2 + 38, 1.32, -Math.PI * 0.6);

  const carStart = S.carLen * 0.52 + 12;
  S.car.setPosition(carStart, cy);
  const nose = ctx.rig.anchor('front').x * S.cs;
  const frontAxle = ctx.rig.anchor('wheelFront').x * S.cs;
  const mirrorX = (frontAxle - S.carLen * 0.16) / S.cs;
  const mirrorY = (S.carWid * 0.44) / S.cs;
  const mirrors = [-1, 1].map((side) => prop(S.scene, S.car, T.mirror(), mirrorX, side * mirrorY, 0.88));
  const foldMirrors = (t: number): void => {
    mirrors.forEach((mirror, i) => {
      const side = i === 0 ? -1 : 1;
      mirror.setPosition(mirrorX - 31 * t, side * (mirrorY - 14 * t));
      mirror.rotation = (side > 0 ? Math.PI : 0) - side * t * 1.47;
    });
  };
  foldMirrors(0);
  const drive = (to: number, ms: number, ease = 'Sine.easeInOut'): Promise<void> => {
    const from = S.car.x;
    return along(ctx, ms, (t) => { S.car.x = from + (to - from) * t; }, ease);
  };
  const react = (happy: boolean): void => {
    for (const [i, friend] of [squirrel, duck].entries()) {
      const dir = i === 0 ? -1 : 1;
      void ctx.tween({ targets: friend, y: friend.y + dir * (happy ? 60 : 42), rotation: friend.rotation + dir * 0.45,
        duration: 210, yoyo: true, repeat: happy ? 1 : 0, ease: 'Sine.easeOut' });
    }
    ctx.audio.sfx(happy ? 'quack' : 'wobble', { volume: 0.41 });
  };

  ctx.rig.play('idle');
  await ctx.wait(580);
  const engine = ctx.audio.loop('engine', { volume: 0.38 });
  ctx.rig.play('drive');
  await drive(gate - nose - 25, 1490);
  ctx.rig.play('idle');
  ctx.audio.sfx('wobble', { volume: 0.54, rate: 1.26 });
  await along(ctx, 590, foldMirrors, 'Back.easeOut');
  foldMirrors(1);
  await ctx.wait(310);

  if (plan.ok) {
    ctx.rig.play('drive');
    const from = S.car.x;
    const finish = gateEnd + S.carLen * 0.5 + 19;
    await along(ctx, 2410, (t) => {
      S.car.x = from + (finish - from) * t;
      S.car.scaleY = S.cs * (1 - 0.07 * Math.sin(t * Math.PI));
    }, 'Sine.easeInOut');
    S.car.setScale(S.cs);
    engine();
    ctx.audio.sfx('pop', { volume: 0.48 });
    react(true);
    void along(ctx, 460, (t) => foldMirrors(1 - t), 'Back.easeOut');
    await ctx.tween({ targets: S.car, scaleX: S.cs * 0.94, scaleY: S.cs * 1.12, duration: 145, yoyo: true });
    await S.cheer(930);
    ctx.rig.play('drive');
    await drive(w + S.carLen * 0.65, 710, 'Quad.easeIn');
    return;
  }

  ctx.rig.play('drive');
  const wedge = gate - frontAxle + 2;
  await drive(wedge, 650, 'Quad.easeIn');
  ctx.audio.sfx('thud', { volume: 0.61 });
  react(false);
  for (const [i, cone] of entryCones.entries()) {
    const dir = i === 0 ? -1 : 1;
    const slide = ctx.rng.range(39, 58), bounce = ctx.rng.range(52, 82);
    const scale = cone.scaleX;
    void along(ctx, 730, (t) => {
      cone.setPosition(gate + slide * t, cy + dir * (coneY + bounce * t));
      cone.setScale(scale * (1 + 0.43 * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t)));
      cone.rotation = dir * t * 3;
    }, 'Quad.easeOut');
  }
  ctx.rig.play('spinWheels');
  await along(ctx, 1120, (t) => {
    const wiggle = Math.sin(t * 35);
    S.car.setPosition(wedge + wiggle * 6, cy + wiggle * 7);
    S.car.rotation = 0.074 * wiggle;
    S.car.scaleX = S.cs * (1 - 0.075 * Math.abs(wiggle));
  });
  engine();
  const from = S.car.x;
  const back = Math.max(carStart, gate - nose - 155);
  ctx.audio.sfx('pop', { volume: 0.7 });
  S.fx.burst(S.layers.front, 'dust', gate - 36, cy, 8);
  ctx.rig.play('idle');
  await along(ctx, 760, (t) => {
    S.car.setPosition(from + (back - from) * t, cy);
    S.car.setScale(S.cs * (1 + 0.11 * Math.sin(t * Math.PI)), S.cs * (1 - 0.12 * Math.sin(t * Math.PI)));
    S.car.rotation = (1 - t) * 0.08 * Math.sin(t * Math.PI * 2);
    foldMirrors(1 - t * 0.52);
  }, 'Quad.easeOut');
  ctx.audio.sfx('sad', { volume: 0.4 });
  await ctx.wait(WS_RUN.failHoldMs);
});
