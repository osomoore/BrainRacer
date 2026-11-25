import { WS_RUN } from '../../config';
import { hopLift } from '../common/choreography';
import { PAL, line, spec } from '../common/draw';
import { along } from '../common/fx';
import { type PathPose, RoundedPath, trackVerts } from '../common/path';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { raceSpectator } from '../common/raceSpectator';
import { SideStage } from '../common/side';
import { T, TopStage } from '../common/top';
import type { StageContext } from '../types';

const cfg = WS_RUN.turn;

async function topTurn(ctx: StageContext, level: number, passed: boolean): Promise<void> {
  const S = new TopStage(ctx, { carMaxLateral: 109 - level * 5 });
  const { w, h } = S;
  const roadW = cfg.roadWidth[level];
  const path = new RoundedPath(trackVerts(w, h, level + 1), cfg.radius[level]);
  const end = path.length - 190;
  S.fx.seed(ctx.rng);
  S.bg((g) => {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const [color, width] of [[PAL.ink, roadW + 16], ['#e3caa4', roadW + 8], ['#545f70', roadW]] as const) {
      g.beginPath();
      path.pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.strokeStyle = color;
      g.lineWidth = width;
      g.stroke();
    }
    for (let d = 190; d < end - 50; d += 56) {
      const a = path.at(d), b = path.at(d + 24);
      line(g, a.x, a.y, b.x, b.y, 6, '#fff6be');
    }
    const finish = path.at(end - 50);
    g.save();
    g.translate(finish.x, finish.y);
    g.rotate(finish.a);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#242638' : '#fff';
      g.fillRect(j * 20 - 20, (i - 5) * roadW / 10, 20.5, roadW / 10 + 0.5);
    }
    g.restore();
  }, ['#82cb72', '#76c367']);

  const roadSamples = Array.from({ length: Math.ceil(path.length / 40) }, (_, i) => path.at(i * 40));
  const far = (x: number, y: number, margin: number): boolean =>
    roadSamples.every((p) => Math.hypot(p.x - x, p.y - y) > margin);
  for (let i = 0, count = 0; i < 60 && count < 8; i++) {
    const x = ctx.rng.range(64, w - 64), y = ctx.rng.range(68, h - 68), d = ctx.rng.int(79, 125);
    if (far(x, y, roadW / 2 + d / 2 + 45)) {
      S.put('back', T.treeTop(d, count % 2 ? '#44a862' : '#60b75d'), x, y);
      count++;
    }
  }
  const cones: ReturnType<typeof S.put>[] = [];
  for (const c of path.corners) for (const d of [c.s0 + 35, (c.s0 + c.s1) / 2, c.s1 - 14]) {
    const p = path.at(d);
    for (const side of [-1, 1]) {
      const offset = side * (roadW / 2 - 15);
      const x = p.x - Math.sin(p.a) * offset, y = p.y + Math.cos(p.a) * offset;
      if (cones.every((cone) => Math.hypot(cone.x - x, cone.y - y) >= 44)) {
        cones.push(S.put('mid', T.cone(), x, y, 0.72));
      }
    }
  }
  const corner = path.corners[[0, 1, 3][level]];
  const cx = corner.vertex.x + corner.din.x * (roadW / 2 + 62);
  const cy = corner.vertex.y + corner.din.y * (roadW / 2 + 62);
  const heading = Math.atan2(corner.din.y, corner.din.x);
  const bales = [-1, 0, 1].map((i) => S.put('mid', T.hayTop(), cx - corner.din.y * i * 105,
    cy + corner.din.x * i * 105, 0.82, heading + Math.PI / 2));
  const audience = [
    S.put('front', T.squirrelTop(), cx + corner.din.x * 68 - corner.din.y * 85, cy + corner.din.y * 68 + corner.din.x * 85, 1.6, heading + Math.PI),
    S.put('front', T.squirrelTop(), cx + corner.din.x * 70 + corner.din.y * 76, cy + corner.din.y * 70 - corner.din.x * 76, 1.3, heading + Math.PI),
  ];
  const watch = (cheer: boolean): void => {
    audience.forEach((squirrel, i) => {
      void ctx.tween({ targets: squirrel, angle: squirrel.angle + (i ? -24 : 24), duration: 220, yoyo: true, repeat: 1 });
      S.fx.burst(S.layers.front, cheer ? 'sparkle' : 'leaves', squirrel.x, squirrel.y, 6);
    });
  };
  const start = 174;
  S.setPose(path.at(start));
  ctx.rig.play('idle');
  await ctx.wait(870);
  ctx.audio.sfx('engineRev', { volume: 0.44 });
  const engine = ctx.audio.loop('engine', { volume: 0.45 });
  ctx.rig.play('drive');

  if (passed) {
    const trace = path.corners.flatMap((c) => [0.12, 0.38, 0.64, 0.9].map((part) => {
      const d = c.s0 + (c.s1 - c.s0) * part;
      const p = path.at(d);
      const mark = ctx.scene.add.rectangle(p.x, p.y, 28, 8, 0x98ffbb, 0.94).setRotation(p.a).setVisible(false);
      S.layers.back.add(mark);
      return { mark, d };
    }));
    let previousCorner = -1;
    await along(ctx, cfg.driveMs[level], (t) => {
      const d = start + (end - start) * t, p = path.at(d);
      const tireLine = path.corners.findIndex((c) => d >= c.s0 && d <= c.s1);
      S.setPose(p);
      if (tireLine >= 0 && tireLine !== previousCorner) {
        previousCorner = tireLine;
        ctx.audio.sfx('skid', { volume: 0.23, rate: 1.65 });
      }
      trace.forEach(({ mark, d: at }) => { if (!mark.visible && d > at + S.carLen / 2) mark.setVisible(true); });
    }, 'Sine.easeInOut');
    engine();
    const finish = path.at(end);
    watch(true);
    S.fx.burst(S.layers.front, 'confetti', finish.x, finish.y, 24);
    ctx.audio.sfx('cheer', { volume: 0.66 });
    ctx.audio.sfx('sparkle');
    ctx.rig.play('celebrate');
    await ctx.wait(1150);
    return;
  }

  const slideStart = corner.s0 + 22;
  await along(ctx, cfg.driveMs[level] * 0.57, (t) => S.setPose(path.at(start + (slideStart - start) * t)), 'Quad.easeIn');
  ctx.audio.sfx('skid', { volume: 0.85 });
  const from = path.at(slideStart);
  const hitX = cx - corner.din.x * (S.carLen * 0.42 + 16);
  const hitY = cy - corner.din.y * (S.carLen * 0.42 + 16);
  const drift = (t: number): PathPose => ({
    x: from.x + (hitX - from.x) * t,
    y: from.y + (hitY - from.y) * t,
    a: from.a + corner.turn * Math.sin(t * Math.PI / 2) * 0.92,
  });
  const marks = Array.from({ length: 10 }, (_, i) => {
    const at = i / 11;
    const p = drift(at);
    return [-1, 1].map((side) => {
      const offset = side * S.carWid * 0.33;
      const m = ctx.scene.add.rectangle(p.x - Math.sin(p.a) * offset - Math.cos(p.a) * S.carLen * 0.24,
        p.y + Math.cos(p.a) * offset - Math.sin(p.a) * S.carLen * 0.24, 24, 8, 0x242638, 0.66)
        .setRotation(p.a).setVisible(false);
      S.layers.back.add(m);
      return m;
    });
  });
  await along(ctx, cfg.slideMs, (t) => {
    const p = drift(t);
    S.setPose(p);
    marks.forEach((pair, i) => pair.forEach((m) => m.setVisible(t > i / 11)));
  }, 'Quad.easeOut');
  engine();
  watch(false);
  ctx.audio.sfx('thud', { volume: 0.7 });
  S.fx.burst(S.layers.front, 'hay', cx, cy, 26);
  bales.forEach((bale, i) => {
    void ctx.tween({ targets: bale, x: bale.x + corner.din.x * 36, y: bale.y + corner.din.y * 36,
      rotation: bale.rotation + (i - 1) * 0.36, duration: 330, ease: 'Quad.easeOut' });
  });
  cones.filter((cone) => Math.hypot(cone.x - hitX, cone.y - hitY) < 160).forEach((cone) => {
    void ctx.tween({ targets: cone, x: cone.x + corner.din.x * 56, y: cone.y + corner.din.y * 56, scaleY: cone.scaleY * 0.54,
      duration: 410, ease: 'Quad.easeOut' });
  });
  const stars = S.fx.dizzy(S.layers.front, hitX, hitY, 76);
  stars.follow(S.car, -12);
  ctx.rig.play('dizzy');
  ctx.audio.sfx('sad', { volume: 0.57 });
  await ctx.wait(WS_RUN.failHoldMs + 350);
  stars.stop();
}

async function sideTurn(ctx: StageContext, level: number, passed: boolean): Promise<void> {
  const start = 425, spacing = 350, gateCount = level + 2;
  const end = start + (gateCount + 1) * spacing;
  const S = new SideStage(ctx, {
    worldW: end + 1130, groundFrac: 0.76, ground: ['#919383', '#a37950', '#845d3e'],
    clouds: 4, hills: [{ color: '#a4d78e', h: 220, f: 0.21 }, { color: '#78bd76', h: 140, f: 0.34 }],
  });
  S.fx.seed(ctx.rng);
  const amplitude = 57 + level * 11;
  const track = (x: number): number => -65 + Math.sin((x - start) * Math.PI / spacing) * amplitude;
  const road = spec('turn:side:' + level, spacing * 2, 420, (g) => {
    g.fillStyle = '#555f6b';
    g.fillRect(0, 0, spacing * 2, 420);
    for (const y of [-185, 178]) {
      line(g, 0, y + 210, spacing * 2, y + 210, 12, '#ddd9c9');
    }
    for (let x = 22; x < spacing * 2 - 24; x += 44) line(g, x, 210 + track(x), x + 21, 210 + track(x + 21), 7, '#fff3aa');
  }, 0, 210);
  for (let x = 0; x < S.worldW; x += spacing * 2) S.put('back', road, x, 0);
  const gates = Array.from({ length: gateCount }, (_, i) => {
    const x = start + (i + 0.63) * spacing;
    const lane = 102 - level * 10;
    return [
      S.put('back', P.cone(), x, track(x) - lane, 0.8),
      S.put('front', P.cone(), x, track(x) + lane, 0.95),
    ];
  });
  for (let x = 145; x < end + 835; x += 535) {
    S.put('back', P.tree(), x + ctx.rng.int(-55, 55), -196, 0.8);
    S.put('back', P.fence(), x + 178, -198, 0.88);
  }
  const cornerX = start + (gateCount - 0.37) * spacing;
  const baleX = cornerX + 208, baleY = 151;
  const bales = [-1, 0, 1].map((i) => S.put('front', P.hay(), baleX + i * 105, baleY + i * 11, 1.05));
  const marshal = raceSpectator(S, baleX - 90, '#e9993f', '#fff172', -197);
  const fan = raceSpectator(S, end + 64, '#b676eb', '#ffd23f', -197);
  S.put('back', P.checker(), end - 70, -165, 1.12);
  const set = (x: number): void => {
    S.car.setPosition(x, track(x)).setRotation(Math.atan2(track(x + 30) - track(x - 30), 60) * 0.23);
  };
  S.place(start);
  set(start);
  ctx.rig.play('idle');
  await ctx.wait(870);
  const engine = ctx.audio.loop('engine', { volume: 0.43 });
  ctx.rig.play('drive');
  if (passed) {
    let gate = 0;
    await along(ctx, cfg.driveMs[level], (t) => {
      const x = start + (end - start) * t;
      set(x);
      if (gates[gate] && x > gates[gate][0].x) {
        ctx.audio.sfx('skid', { volume: 0.22, rate: 1.6 });
        S.fx.burst(S.layers.front, 'dust', x - 90, S.car.y, 4);
        gate++;
      }
    }, 'Sine.easeInOut');
    engine();
    marshal.cheer();
    fan.cheer();
    S.fx.burst(S.layers.front, 'confetti', end, S.car.y - 220, 24);
    await S.cheer(1050);
    return;
  }
  const slideX = cornerX - 228;
  await along(ctx, cfg.driveMs[level] * 0.55, (t) => set(start + (slideX - start) * t), 'Sine.easeIn');
  const nose = ctx.rig.anchor('front');
  const impactX = baleX - Math.max(134, nose.x + 54);
  const startY = S.car.y;
  const cloud = S.spray('dust', 'wheelRear', {}, 70);
  ctx.audio.sfx('skid', { volume: 0.82 });
  await along(ctx, cfg.slideMs, (t) => {
    S.car.setPosition(slideX + (impactX - slideX) * t, startY + (baleY - startY - 19) * t ** 1.6)
      .setRotation(0.24 * Math.sin(t * Math.PI * 0.5));
  }, 'Quad.easeOut');
  engine();
  cloud.stop();
  marshal.gasp();
  ctx.audio.sfx('thud', { volume: 0.69 });
  S.fx.burst(S.layers.front, 'hay', impactX + nose.x, S.car.y - 38, 25);
  const fallen = gates.at(-1)![1];
  void ctx.tween({ targets: fallen, x: fallen.x + 130, rotation: 1.14, duration: 430, ease: 'Quad.easeOut' });
  bales.forEach((bale, i) => {
    void S.hop(bale, bale.x + 63 - i * 11, bale.y + 12, 480, 32 - i * 8);
  });
  const y = S.car.y;
  await along(ctx, 360, (t) => S.car.setPosition(impactX - 55 * t, y - hopLift(t, 20)).setRotation(0.24 * (1 - t)), 'Quad.easeOut');
  ctx.rig.play('dizzy');
  const stars = S.dizzy();
  ctx.audio.sfx('sad', { volume: 0.55 });
  await ctx.wait(WS_RUN.failHoldMs);
  stars.stop();
}

export default racePlayer('turn', async (ctx) => {
  const plan = planStage(ctx, ['turn.handling']);
  const level = Math.min(3, plan.level('turn.handling')) - 1;
  await (ctx.stage.view === 'top' ? topTurn : sideTurn)(ctx, level, plan.ok);
});
