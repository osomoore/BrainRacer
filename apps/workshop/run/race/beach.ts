/** A late-afternoon trip with a real gauge to watch and a towel waiting at the end. */
import { WS_RUN } from '../../config';
import { PAL, circ, ell, fl, line, ol, poly, prop, rr, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { fuelReading } from '../common/choreography';

const gaugeFace = spec('beach:gauge', 226, 160, (g) => {
  ol(g, '#fff3d8', rr(5, 5, 216, 150, 32), 8);
  g.beginPath();
  g.arc(113, 101, 70, -2.7, -0.44);
  g.strokeStyle = '#dfd0b8';
  g.lineWidth = 14;
  g.stroke();
  for (let i = 0; i < 5; i++) {
    const a = -2.7 + i * 0.565;
    const col = i === 0 ? PAL.red : i < 3 ? '#af752c' : '#32936a';
    line(g, 113 + 59 * Math.cos(a), 101 + 59 * Math.sin(a), 113 + 78 * Math.cos(a), 101 + 78 * Math.sin(a), 8, col);
  }
  ol(g, PAL.ink, circ(113, 101, 8), 2);
  ol(g, PAL.red, rr(96, 116, 25, 26, 4), 3);
  fl(g, '#fff3d8', rr(101, 121, 15, 9, 2));
  line(g, 121, 137, 130, 137, 3);
  line(g, 130, 137, 130, 119, 3);
  line(g, 130, 119, 125, 114, 3);
}, 113, 101);

const needleSpec = spec('beach:needle', 84, 20, (g) => {
  ol(g, PAL.red, poly([[6, 5], [78, 10], [6, 15]]), 3);
  ol(g, PAL.ink, circ(8, 10, 6), 2);
}, 8, 10);

const tide = spec('beach:tide', 720, 172, (g) => {
  ol(g, '#68c8db', ell(360, 86, 350, 76), 5);
  fl(g, '#ade8ec', ell(375, 73, 308, 39));
  for (const x of [96, 260, 460, 582]) line(g, x, 88 + x % 23, x + 70, 88 + x % 23, 7, '#f6fcf0');
}, 360, 140);

const sign = spec('beach:sign', 204, 227, (g) => {
  line(g, 103, 112, 103, 218, 13, '#855a44');
  ol(g, '#ffe086', poly([[7, 36], [139, 36], [196, 79], [139, 122], [7, 122]]), 7);
  ol(g, PAL.red, (c) => { c.arc(68, 82, 29, Math.PI, 0); c.closePath(); }, 4);
  line(g, 68, 81, 68, 106, 5);
  line(g, 115, 79, 154, 79, 7);
  line(g, 144, 69, 154, 79, 7);
  line(g, 154, 79, 144, 89, 7);
}, 103, 220);

export default racePlayer('beach', async (ctx) => {
  const plan = planStage(ctx, ['beach.load', 'beach.range']);
  const cfg = WS_RUN.beach;
  const lv = Math.min(3, plan.level('beach.range')) - 1;
  const rig = ctx.rig;
  const shore = cfg.distance[lv], towelX = shore + 375;
  const S = new SideStage(ctx, {
    worldW: shore + 1700, groundFrac: 0.73, segments: [[-800, shore]],
    ground: ['#85949a', '#6e7984', '#58616a'], sky: ['#66bbe5', '#fff2cb'], clouds: 4,
    hills: [{ color: '#b9dfb5', h: 245, f: 0.12 }, { color: '#90c898', h: 176, f: 0.25, seed: 12 }],
  });
  S.fx.seed(ctx.rng);
  const { w, h } = ctx.size;
  const sun = prop(ctx.scene, S.backdrop, P.sun(), w * 0.64, h * 0.19, 1.34);
  const evening = ctx.scene.add.rectangle(0, 0, w, h, 0xe77c5f, 0).setOrigin(0);
  S.overlay.add(evening);
  const sand = S.scene.add.rectangle(shore, -23, 2600, 1500, 0xf6d48a).setOrigin(0);
  S.add('back', sand);
  S.put('back', tide, shore + 620, -26, 1.35);
  S.put('back', P.umbrella(), towelX + 95, -33, 1.55);
  S.put('mid', P.sandcastle(), towelX + 280, -4, 1.05);
  S.put('front', P.towel(), towelX + 38, 30, 2.05);
  S.put('back', P.gasPump(), 440, 0, 1.18);
  S.put('back', sign, 690, 0, 0.94);
  S.put('back', sign, shore - 156, 0, 0.94);
  for (let i = 1, x = 920; x < shore - 480; i++, x += 565) {
    S.put('back', P.mileSign(1 + (i - 1) % 6), x, -8);
    S.put('back', P.tree(i % 2 ? '#579d72' : '#82ba70'), x + 225, -13, ctx.rng.range(0.78, 1.13));
  }
  const gull = S.put('front', P.gull(), 522, -170, 1.05).setFlipX(true);
  const crab = S.put('front', P.crab(), towelX + 128, 9, 1.5);
  const crabScale = crab.scaleX;
  const roof = rig.anchor('roof');
  const toys = plan.has('beach.load') ? [P.umbrella(), P.bucket(), P.beachBall(), P.shovel()].map((toy, i) =>
    prop(S.scene, rig.root, toy, roof.x - 60 + i * 37, roof.y - 4, i === 0 ? 0.52 : 1.05)) : [];
  const dropToys = (forward: boolean): void => {
    toys.forEach((toy, i) => {
      const { x, y } = toy;
      rig.root.remove(toy);
      S.add('front', toy).setPosition(S.car.x + x, S.car.y + y);
      S.fx.bits.add({
        obj: toy, vx: (forward ? 1 : -1) * (145 + i * 55), vy: -300 - i * 25,
        vr: (forward ? 1 : -1) * (1.6 + i * 0.35), floorY: forward ? 15 + i * 4 : 0, bounce: 0.35,
      });
    });
  };

  const gaugeX = w - 148, gaugeY = 145;
  prop(S.scene, S.overlay, gaugeFace, gaugeX, gaugeY);
  const needle = prop(S.scene, S.overlay, needleSpec, gaugeX, gaugeY);
  const setGauge = (reading: number): void => { needle.rotation = -2.7 + reading * 2.26; };
  setGauge(1);
  S.place(240);
  await ctx.wait(580);
  const engine = ctx.audio.loop('engine', { volume: 0.37 });
  void S.hop(gull, 1020, -310, 1450, 125);
  await plan.run({
    'beach.load': async ({ pass }) => {
      if (pass) return;
      await S.driveTo(860, 1680, 'Sine.easeIn');
      ctx.audio.sfx('rustle', { volume: 0.65 });
      dropToys(false);
      await S.driveTo(1315, 1000, 'Quad.easeOut');
      engine();
      rig.play('idle');
      await S.squash(1.08, 0.89, 160);
      ctx.audio.sfx('sad', { volume: 0.48 });
      await ctx.wait(WS_RUN.failHoldMs + 1070);
    },
    'beach.range': async ({ pass }) => { await travel(pass); },
  });
  if (plan.ok && !plan.has('beach.range')) await travel(true);

  async function travel(pass: boolean): Promise<void> {
    const from = S.car.x;
    const to = pass ? towelX - 156 : shore - Math.max(cfg.shortfall[lv], rig.anchor('front').x + 165);
    rig.play('drive');
    await along(ctx, cfg.cruiseMs, (t) => {
      S.car.x = from + (to - from) * t;
      setGauge(fuelReading(t, pass ? cfg.fuelLeft[lv] : 0));
      sun.setPosition(w * (0.64 + 0.11 * t), h * (0.19 + 0.37 * t));
      evening.setFillStyle(0xe77c5f, t * (0.15 + lv * 0.045));
    }, 'Sine.easeInOut');
    engine();
    rig.play('idle');
    if (pass) {
      await S.squash(1.095, 0.86, 165);
      ctx.audio.sfx('honk', { volume: 0.42, rate: 1.25 });
      if (toys.length) dropToys(true);
      void S.hop(crab, towelX + 40, 11, 600, 88);
      await S.cheer(1650);
      return;
    }
    ctx.audio.sfx('wobble', { volume: 0.57 });
    const smoke = S.spray('smoke', 'exhaust', { speed: { min: 28, max: 88 } }, 140);
    await along(ctx, 670, (t) => {
      const shake = Math.sin(t * 29) * (1 - t);
      S.car.setRotation(shake * 0.029).setX(to + (1 - (1 - t) ** 2) * 18);
      needle.rotation = -2.7 + shake * 0.12;
    });
    smoke.stop();
    const start = S.car.x;
    const rear = start + rig.anchor('back').x - 45;
    const crabFrom = crab.x;
    await along(ctx, 920, (t) => {
      const sidestep = Math.sin(t * Math.PI);
      crab.setPosition(crabFrom + (rear - crabFrom) * t, 3 + sidestep * 102);
      crab.setRotation(Math.sin(t * 37) * sidestep * 0.12);
    }, 'Sine.easeInOut');
    ctx.audio.sfx('pop', { volume: 0.45 });
    await along(ctx, 720, (t) => {
      const push = Math.sin(t * Math.PI);
      S.car.setX(start + t * 117).setScale(1 - push * 0.045, 1 + push * 0.04);
      crab.setX(rear + t * 117).setScale(crabScale * (1 + push * 0.12), crabScale * (1 - push * 0.17));
    }, 'Sine.easeInOut');
    ctx.audio.sfx('sad', { volume: 0.39 });
    await ctx.wait(WS_RUN.failHoldMs);
  }
});
