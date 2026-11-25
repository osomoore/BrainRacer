/** The judges compare the body paint with their pennants before waving the car into the procession. */
import { ensureTexture } from '../../art/bake';
import { WS_RUN } from '../../config';
import { PAL, circ, fl, line, ol, poly, rr, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { TopStage } from '../common/top';

const hues = ['#e8434a', '#ff9a3c', '#ffd23f', '#2fb84f', '#2b8cff', '#a35cff'];
const crowdColors = ['#ed864e', '#658ade', '#d66299', '#84bb68', '#ffd76a'];

function banner(color: string) {
  return spec(`parade:banner:${color}`, 320, 144, (g) => {
    const shape = poly([[12, 16], [308, 16], [308, 107], [254, 107], [160, 135], [66, 107], [12, 107]]);
    ol(g, color === 'rainbow' ? '#fff5cf' : color, shape, 8);
    if (color === 'rainbow') {
      g.save();
      g.beginPath();
      shape(g);
      g.clip();
      hues.forEach((hue, i) => { g.fillStyle = hue; g.fillRect(17 + i * 48, 22, 48, 103); });
      g.restore();
    }
    for (const x of [68, 160, 252]) fl(g, '#fff5cf', circ(x, 63, x === 160 ? 22 : 13));
    line(g, 6, 12, 314, 12, 10, '#68405b');
  }, 160, 10);
}

function floatTop(color: string) {
  return spec(`parade:topFloat:${color}`, 236, 148, (g) => {
    ol(g, color === 'rainbow' ? '#ffcc4a' : color, rr(6, 12, 224, 124, 24), 8);
    ol(g, '#fff1d0', rr(19, 28, 198, 92, 18), 5);
    for (let i = 0; i < 5; i++) ol(g, color === 'rainbow' ? hues[i] : color, circ(42 + i * 38, 72, 17), 3);
  }, 118, 74);
}

export default racePlayer('parade', async (ctx) => {
  const plan = planStage(ctx, ['parade.color']);
  const cfg = WS_RUN.parade;
  const lv = Math.min(3, plan.level('parade.color')) - 1;
  const color = cfg.colors[lv];
  const top = ctx.stage.view === 'top';
  const stage = top ? new TopStage(ctx, { carMaxLateral: 116 }) : new SideStage(ctx, {
    worldW: 3450, groundFrac: 0.74, ground: ['#a8aabd', '#767b93', '#616680'],
    sky: ['#6ac7f1', '#fdf0d9'], clouds: 4, sun: true,
    hills: [{ color: '#cfc2e3', h: 270, f: 0.1 }, { color: '#afd9b6', h: 205, f: 0.23, seed: 17 }],
  });
  stage.fx.seed(ctx.rng);
  const { car, layers, fx } = stage;
  const { rig } = ctx;
  const scale = stage instanceof TopStage ? stage.cs : 1;
  const slot = stage instanceof TopStage ? stage.w * 0.52 : 1130;
  const lane = top ? ctx.size.h * 0.51 : 0;
  const audienceY = top ? lane - 154 : -30;
  const judgeX = slot + (top ? 22 : 110);
  const floatX = slot + (top ? 267 : 595);
  const crowdCount = top ? 7 : 10;
  const spacing = top ? 74 : 111;
  const judgeCheers = P.person('#574fb1', '#f3c65a', 'up');
  ensureTexture(ctx.scene, judgeCheers);

  if (stage instanceof TopStage) {
    stage.bg((g, w, h) => {
      g.fillStyle = '#e8cdb4';
      g.fillRect(0, lane - 222, w, 469);
      g.fillStyle = '#858da3';
      g.fillRect(0, lane - 105, w, 235);
      for (let x = 20; x < w; x += 135) {
        fl(g, '#eed7a9', rr(x, lane + 37, 70, 7, 3));
        line(g, x, lane - 221, x, lane - 105, 3, '#bb9d8e');
      }
      line(g, 0, lane - 105, w, lane - 105, 7, PAL.ink);
      line(g, 0, lane + 130, w, lane + 130, 7, PAL.ink);
      g.fillStyle = '#d5dfb8';
      g.fillRect(0, h * 0.82, w, h * 0.18);
    });
    stage.put('back', P.bunting(440, color), slot - 220, lane - 380, 1);
    stage.put('back', banner(color), slot, lane - 482, 0.95);
    car.setPosition(-40, lane);
  } else {
    for (let i = 0, x = 125; x < 3200; i++, x += 315) {
      stage.put('back', P.house(3, ['#f6db9c', '#b5dff1', '#f4c2cc', '#d8c4f0'][i % 4]), x, -50, 1.06);
    }
    for (let x = 25; x < 3050; x += 510) stage.put('back', P.bunting(510, color), x, -427);
    stage.put('back', banner(color), slot + 105, -461, 1.18);
    for (let x = 100; x < 3300; x += 155) {
      stage.add('back', ctx.scene.add.rectangle(x, 26, 80, 7, 0xeed7a9, 0.79));
    }
    stage.place(225);
  }

  const audience = Array.from({ length: crowdCount }, (_, i) => {
    const shirt = crowdColors[i % crowdColors.length];
    const cheer = P.person(shirt, null, 'up');
    ensureTexture(ctx.scene, cheer);
    const x = slot - spacing * Math.floor(crowdCount / 2) + i * spacing;
    const y = audienceY + ctx.rng.range(-14, 9);
    const size = ctx.rng.range(top ? 0.53 : 0.91, top ? 0.65 : 1.18);
    return { cheer, y, img: stage.put('back', P.person(shirt, null, 'down'), x, y, size) };
  });
  const judges = Array.from({ length: cfg.judges[lv] }, (_, i) => {
    const x = judgeX + (i - (cfg.judges[lv] - 1) / 2) * (top ? 70 : 103);
    const y = top ? lane + 241 : 197 + (i % 2) * 14;
    const judge = stage.put('front', P.person('#574fb1', '#f3c65a', 'down'), x, y, top ? 0.68 : 1.09);
    const swatch = stage.put('front', P.marshalCard(color), x + (top ? 27 : 43), y - (top ? 82 : 126), top ? 0.82 : 1.23);
    return { judge, swatch, y };
  });
  const balloons = Array.from({ length: 4 }, (_, i) =>
    stage.put('back', P.balloon(color), slot + (i < 2 ? -1 : 1) * (235 + (i % 2) * 96),
      audienceY - 135 - (i % 2) * 46, top ? 0.71 : 1.04));
  const lead = stage.put('mid', top ? floatTop(color) : P.floatWagon(color), floatX, lane, top ? 0.83 : 1.18);
  const band = stage.put('mid', P.band(), floatX + (top ? 146 : 250), top ? lane - 22 : lane, top ? 0.57 : 1.02);
  const from = car.x;
  const stop = slot - (top ? 35 : 136);
  await ctx.wait(550);
  rig.play('drive');
  const engine = ctx.audio.loop('engine', { volume: 0.3 });
  await along(ctx, cfg.approachMs, (t) => {
    car.x = from + (stop - from) * t;
    for (const [i, balloon] of balloons.entries()) balloon.rotation = 0.085 * Math.sin(7 * t + i);
  }, 'Sine.easeInOut');
  engine();
  rig.play('idle');

  ctx.audio.sfx('rustle', { volume: 0.44 });
  await along(ctx, 780, (t) => {
    for (const { swatch } of judges) {
      swatch.rotation = -0.23 * Math.sin(Math.PI * t);
    }
    car.setScale(scale * (1 + 0.045 * Math.sin(t * Math.PI)), scale * (1 - 0.085 * Math.sin(t * Math.PI)));
  });

  if (plan.ok) {
    ctx.audio.sfx('cheer', { volume: 0.74 });
    for (const { judge } of judges) judge.setTexture(judgeCheers.key);
    for (const { img, cheer } of audience) img.setTexture(cheer.key);
    for (const x of [car.x - 75, car.x + 85, slot + 235]) {
      fx.burst(layers.front, 'confetti', x, top ? lane - 160 : lane - 340, 20);
    }
    const start = [car.x, lead.x, band.x];
    const tailX = car.x - (top ? 300 : 595);
    const tail = stage.put('mid', top ? floatTop(color) : P.floatWagon(color), tailX - 115, lane, top ? 0.79 : 1.12);
    if (stage instanceof SideStage) stage.follow = null;
    rig.play('drive');
    await along(ctx, cfg.processionMs, (t) => {
      const advance = (top ? 250 : 620) * t;
      const lift = Math.abs(Math.sin(t * 19));
      car.setPosition(start[0] + advance, lane - (top ? 2 : 14) * lift);
      car.setScale(scale * (1 + 0.045 * lift), scale * (1 - 0.07 * lift));
      lead.setPosition(start[1] + advance, lane - lift * 10);
      tail.setPosition(tailX - 115 * (1 - t) + advance, lane - lift * 8);
      band.setPosition(start[2] + advance, (top ? lane - 22 : lane) - lift * 16);
      audience.forEach(({ img, y }, i) => { img.y = y - Math.abs(Math.sin(t * 19 + i * 0.6)) * (top ? 15 : 37); });
      judges.forEach(({ judge, y }, i) => { judge.y = y - Math.abs(Math.sin(t * 17 + i)) * 23; });
    }, 'Sine.easeInOut');
    car.setPosition(car.x, lane).setScale(scale);
    rig.play('happy');
    fx.burst(layers.front, 'confetti', car.x, lane - (top ? 115 : 320), 22);
    await ctx.wait(WS_RUN.winHoldMs);
    return;
  }

  ctx.audio.sfx('wobble', { volume: 0.56 });
  for (const { judge, swatch } of judges) {
    void ctx.tween({ targets: [judge, swatch], rotation: -0.135, duration: 160, yoyo: true, repeat: 2 });
  }
  const loose = balloons[balloons.length - 2];
  void ctx.tween({ targets: loose, x: loose.x + 95, y: loose.y - 345, rotation: 0.4, duration: 1890, ease: 'Sine.easeInOut' });
  await ctx.wait(620);
  rig.play('drive');
  await along(ctx, 1160, (t) => {
    car.setPosition(stop - (top ? 140 : 210) * t, lane + (top ? 123 : 0) * t);
    car.setRotation(top ? -0.21 * Math.sin(t * Math.PI) : 0.035 * Math.sin(t * Math.PI * 4));
  }, 'Sine.easeInOut');
  rig.play('idle');
  ctx.audio.sfx('sad', { volume: 0.4 });
  await ctx.wait(WS_RUN.failHoldMs);
});
