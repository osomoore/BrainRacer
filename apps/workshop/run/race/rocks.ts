/**
 * Rocks: forest trail. Obstacles in order: rocks (rocks.tough, more/bigger per level), a high boulder (rocks.clearance),
 * a fallen log (rocks.log). Any combination can appear in one stage.
 * Pass: bonks happily over rocks / belly passes over the boulder / pushes the log away (a squirrel rides it).
 * Fail: bonk, hubcap rolls away and a bandage appears / stuck on the boulder like a turtle / log will not budge, boing back.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

export default racePlayer('rocks', async (ctx) => {
  const plan = planStage(ctx, ['rocks.tough', 'rocks.clearance', 'rocks.log']);
  const rig = ctx.rig;
  const S = new SideStage(ctx, { worldW: 5200, ground: ['#7bbf5a', '#8a6a42', '#6a4e2e'], sky: ['#8fd3c8', '#eefaf0'], clouds: 3, hills: [{ color: '#7fc08a', h: 300, f: 0.12 }, { color: '#4fa468', h: 210, f: 0.28, seed: 11 }] });
  for (const x of [250, 700, 2300, 3300, 4300, 4800]) S.put('back', x % 200 ? P.pine() : P.tree('#3f9f48'), x, -4, 1);
  let cursor = 1000;
  const spots: Record<string, number> = {};
  for (const p of plan.all) { spots[p.facet] = cursor; cursor += 1100; }
  const roof = rig.anchor('roof'), front = rig.anchor('front');
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  const rockH = (lv: number): number => 40 + lv * 22;
  const rocks: ReturnType<typeof S.put>[] = [];
  let boulder: ReturnType<typeof S.put> | null = null, log: ReturnType<typeof S.put> | null = null;
  let boulderH = 0;
  if (plan.has('rocks.tough')) {
    const lv = plan.level('rocks.tough'), n = 2 + lv, x0 = spots['rocks.tough'];
    for (let i = 0; i < n; i++) rocks.push(S.put('mid', P.rock(90 + lv * 20, rockH(lv) - (i % 2) * 12, i + 1), x0 + i * 230, 4));
  }
  if (plan.has('rocks.clearance')) {
    const lv = plan.level('rocks.clearance'); boulderH = 150 + lv * 40;
    boulder = S.put('mid', P.boulder(360, boulderH), spots['rocks.clearance'], 4);
  }
  if (plan.has('rocks.log')) {
    const lv = plan.level('rocks.log');
    log = S.put('mid', P.log(300 + lv * 60, 80 + lv * 30), spots['rocks.log'], 4);
  }
  const dome = (x: number, c: number, w: number, h: number): number => (Math.abs(x - c) > w / 2 ? 0 : h * Math.cos(((x - c) / (w / 2)) * Math.PI / 2) ** 0.8);

  const ride = (to: number, ms: number): Promise<void> => S.driveTo(to, ms, 'Sine.easeInOut');

  await plan.run({
    'rocks.tough': async (p) => {
      const x0 = spots['rocks.tough'];
      await ride(x0 - 220, 1600);
      if (p.pass) {
        for (let i = 0; i < rocks.length; i++) {
          const rx = rocks[i].x;
          const sx = S.car.x;
          await along(ctx, 850, (t) => { S.car.x = sx + (rx + 160 - sx) * t; S.car.y = -Math.sin(Math.min(1, Math.max(0, (S.car.x - rx + 120) / 240)) * Math.PI) * (rockH(plan.level('rocks.tough')) * 0.6); S.car.rotation = -Math.sin(t * Math.PI * 2) * 0.05; }, 'Linear');
          ctx.audio.sfx('thud', { volume: 0.35, rate: 1.4 }); ctx.audio.sfx('boing', { volume: 0.3 });
          S.car.y = 0;
        }
      } else {
        await ride(rocks[0].x - Math.abs(front.x) - 110, 1100);
        ctx.audio.sfx('thud', { volume: 0.9 });
        ctx.audio.sfx('crash', { volume: 0.4, rate: 1.6 });
        void S.squash(0.92, 1.05, 100);
        rig.play('idle');
        const hc = S.put('front', P.hubcap(), S.car.x + rig.anchor('wheelFront').x, -40, 1.2);
        S.fx.bits.add({ obj: hc, vx: 420, vy: -700, vr: 12, floorY: -10, bounce: 0.5 });
        const band = S.put('front', P.bandage(), S.car.x + front.x - 24, S.car.y + front.y + 10, 1);
        void band;
        ctx.audio.sfx('sad', { volume: 0.5 });
        await along(ctx, 700, (t) => { S.car.rotation = Math.sin(t * 30) * 0.04 * (1 - t); });
        S.dizzy();
        await ctx.wait(1500);
      }
    },
    'rocks.clearance': async (p) => {
      const c = boulder!.x, w = 360;
      await ride(c - w / 2 - 260, 1700);
      const sx = S.car.x;
      if (p.pass) {
        await along(ctx, 2200, (t) => { S.car.x = sx + (c + w / 2 + 260 - sx) * t; const lift = dome(S.car.x, c, w + 60, boulderH * 0.8); S.car.y = -lift; S.car.rotation = -Math.sin((S.car.x - c) / (w / 2) * Math.PI) * 0.0 + (S.car.x < c ? -0.12 : 0.12) * (lift > 4 ? 1 : 0); }, 'Linear');
      } else {
        const stopX = c - 40;
        await ride(stopX, 1800);
        const top = -boulderH * 0.85;
        ctx.audio.sfx('thud', { volume: 0.7 });
        await along(ctx, 500, (t) => { S.car.y = top * t; S.car.rotation = -0.2 * t; }, 'Quad.easeOut');
        const spin = ctx.audio.loop('spin', { volume: 0.5 });
        rig.play('spinWheels');
        await ctx.wait(1500);
        spin(); eng();
        ctx.audio.sfx('sad', { volume: 0.5 });
        await ctx.wait(700);
      }
    },
    'rocks.log': async (p) => {
      const lg = log!;
      const lw = lg.displayWidth;
      await ride(lg.x - lw / 2 - Math.abs(front.x) - 40 + 60, 1700);
      if (p.pass) {
        const sq = S.put('front', P.squirrel(), lg.x, -120, 0.9);
        ctx.audio.sfx('thud', { volume: 0.6 });
        const x0 = S.car.x, l0 = lg.x;
        await along(ctx, 2400, (t) => { S.car.x = x0 + 520 * t; lg.x = l0 + 700 * t; lg.rotation = 0; sq.x = lg.x; sq.y = -lg.displayHeight - 6; }, 'Sine.easeInOut');
        ctx.audio.sfx('cheer', { volume: 0.5 });
        await along(ctx, 1000, (t) => { lg.x += 8 + t * 20; sq.x = lg.x; });
      } else {
        ctx.audio.sfx('thud', { volume: 0.8 });
        const sp = ctx.audio.loop('spin', { volume: 0.5 });
        rig.play('spinWheels');
        const x0 = S.car.x;
        await along(ctx, 1100, (t) => { S.car.x = x0 + Math.sin(t * 40) * 3; S.car.rotation = Math.sin(t * 28) * 0.012; });
        sp();
        rig.play('idle');
        ctx.audio.sfx('boing', { volume: 0.8 });
        void S.squash(0.9, 1.04, 140);
        await along(ctx, 600, (t) => { S.car.x = x0 - 150 * Math.sin(t * Math.PI / 2); }, 'Quad.easeOut');
        S.dizzy();
        ctx.audio.sfx('sad', { volume: 0.5 });
        await ctx.wait(1500);
      }
    },
  });
  eng();
  if (plan.ok) {
    rig.play('drive');
    await S.driveTo(S.car.x + 400, 900);
    await S.cheer(600);
    await S.exit();
  }
  void roof; void rocks;
});
