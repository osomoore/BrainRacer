import { raceGeom, raceLooks } from '../../art/race/geometry';
import { BUMPER } from '../../art/race/looks';
import { WS_RUN } from '../../config';
import { crossingStop, facetTime, hopLift } from '../common/choreography';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { raceSpectator } from '../common/raceSpectator';
import { SideStage } from '../common/side';

const cfg = WS_RUN.rocks;

export default racePlayer('rocks', async (ctx) => {
  const plan = planStage(ctx, ['rocks.tough', 'rocks.clearance', 'rocks.log']);
  const { rig } = ctx;
  const looks = raceLooks(ctx.model), geo = raceGeom(looks);
  const nose = rig.anchor('front');
  const axle = rig.anchor('wheelFront');
  const bellyY = (geo.bottom - geo.rideRaise) * looks.scale;
  const last = plan.plays.at(-1)?.facet;
  const phaseMs = (facet: string): number => facetTime(cfg.actionMs, plan.plays.length, facet === last);
  const S = new SideStage(ctx, {
    worldW: 5400, ground: ['#8cb964', '#98724b', '#715235'], sky: ['#90d8d3', '#f2fcf3'], clouds: 3,
    hills: [{ color: '#89c899', h: 300, f: 0.12 }, { color: '#55a97b', h: 210, f: 0.28, seed: 11 }],
  });
  S.fx.seed(ctx.rng);
  for (let x = 150; x < 5200; x += 470) {
    S.put('back', P.pine(), x + ctx.rng.int(-65, 65), 0, ctx.rng.range(0.8, 1.17));
    S.put('back', P.bush(), x + 180, 0, 0.73);
  }

  let obstacleX = 1050;
  const spots = new Map<string, number>();
  for (const p of plan.all) {
    spots.set(p.facet, obstacleX);
    const length = p.facet === 'rocks.tough' ? cfg.count[Math.min(p.level, 3) - 1] * 230 : 490;
    obstacleX += length + 435;
  }
  const toughX = spots.get('rocks.tough') ?? 1050;
  const clearX = spots.get('rocks.clearance') ?? 1050;
  const logX = spots.get('rocks.log') ?? 1050;
  const tough = Math.min(3, plan.level('rocks.tough')) - 1;
  const clearance = Math.min(2, plan.level('rocks.clearance')) - 1;
  const push = Math.min(2, plan.level('rocks.log')) - 1;
  const rockH = cfg.rockHeight[tough];
  const rockbed = plan.has('rocks.tough') ? Array.from({ length: cfg.count[tough] }, (_, i) =>
    S.put('mid', P.rock(80 + tough * 17, rockH - i % 2 * 12, ctx.rng.int(1, 999)), toughX + i * 230, 3)) : [];
  const peakW = Math.round((axle.x - rig.anchor('wheelRear').x) * 0.54);
  const catches = plan.gag?.facet === 'rocks.clearance';
  const peakH = Math.round(catches
    ? Math.max(-bellyY + 31 + clearance * 15, cfg.boulderHeight[clearance] * 0.47)
    : Math.max(18, Math.min(-bellyY - 16, cfg.boulderHeight[clearance] * 0.43)));
  if (plan.has('rocks.clearance')) S.put('mid', P.boulder(peakW, peakH), clearX, 2);
  const log = plan.has('rocks.log') ? S.put('mid', P.log(cfg.logLength[push], cfg.logHeight[push]), logX, 4) : null;
  const squirrel = log ? S.put('front', P.squirrel(), logX + 48, -cfg.logHeight[push] + 8, 1.22) : null;
  const turtle = plan.has('rocks.clearance') ? S.put('back', P.turtle(), clearX + 340, 0, 0.85) : null;
  const watchers = new Map(plan.all.map((p, i) => [
    p.facet, raceSpectator(S, spots.get(p.facet)! + 330, ['#ed8651', '#a45cc1', '#4697bc'][i], '#f6d15c'),
  ]));
  S.put('back', P.signpost('#f0c75a'), 590);
  const finishX = obstacleX - 275;
  S.put('back', P.checker(), finishX, 0, 1.25);
  S.place(490);
  rig.play('idle');
  await ctx.wait(850);
  const engine = ctx.audio.loop('engine', { volume: 0.4 });

  await plan.run({
    'rocks.tough': async (p) => {
      const ms = phaseMs(p.facet), first = rockbed[0];
      const tireLead = axle.x + geo.wheelRadius * looks.scale * 0.66;
      await S.driveTo(crossingStop(first.x - first.displayWidth * 0.28, tireLead, 2), ms * 0.36, 'Quad.easeIn');
      if (p.pass) {
        const x0 = S.car.x, x1 = rockbed.at(-1)!.x + 280;
        let next = 0;
        await along(ctx, ms * 0.64, (t) => {
          const x = x0 + (x1 - x0) * t;
          // Each axle lifts from the same rock. The difference tips the body over the bump.
          const lift = (wheelX: number): number => rockbed.reduce((h, rock) =>
            Math.max(h, hopLift((x + wheelX - rock.x + 91) / 182, rock.displayHeight * 0.65)), 0);
          const front = lift(axle.x), rear = lift(rig.anchor('wheelRear').x);
          S.car.setPosition(x, -(front + rear) / 2).setRotation(Math.atan2(rear - front, rig.width * 0.65));
          if (next < rockbed.length && x + axle.x > rockbed[next].x - 50) {
            ctx.audio.sfx('thud', { volume: 0.42, rate: 1.5 });
            S.fx.burst(S.layers.front, 'dust', rockbed[next].x, -38, 5);
            next++;
          }
        });
        watchers.get(p.facet)?.cheer();
        return;
      }

      watchers.get(p.facet)?.gasp();
      ctx.audio.sfx('thud', { volume: 0.8 });
      S.dust(11);
      void S.squash(0.87, 1.1, 105);
      rig.play('idle');
      const wheel = S.put('front', P.hubcap(), S.car.x + axle.x, axle.y, 1.24);
      S.fx.bits.add({ obj: wheel, vx: 390, vy: -570, vr: 12, floorY: -20, bounce: 0.5 });
      await along(ctx, ms * 0.25, (t) => { S.car.rotation = Math.sin(t * 24) * 0.11 * (1 - t); });
      S.put('front', P.bandage(), S.car.x + nose.x - 18, nose.y - 12, 0.9);
      await ctx.wait(ms * 0.39);
    },
    'rocks.clearance': async (p) => {
      const ms = phaseMs(p.facet);
      await S.driveTo(clearX - rig.width * 0.68, ms * 0.34);
      const start = S.car.x, end = p.pass ? clearX + rig.width * 0.72 : clearX;
      const axleBack = rig.anchor('wheelRear');
      const perched = Math.max(0, peakH + bellyY - 2);
      await along(ctx, ms * (p.pass ? 0.66 : 0.36), (t) => {
        const x = start + (end - start) * t;
        const wheelLift = (wheelX: number): number => hopLift((x + wheelX - clearX + peakW * 0.69) / (peakW * 1.38), peakH);
        const front = wheelLift(axle.x), rear = wheelLift(axleBack.x);
        const contact = p.pass ? 0 : perched * Math.max(0, (t - 0.63) / 0.37);
        S.car.setPosition(x, -Math.max(contact, (front + rear) * 0.56));
        S.car.rotation = Math.atan2(rear - front, axle.x - axleBack.x);
      }, 'Sine.easeInOut');
      if (p.pass) {
        S.fx.burst(S.layers.front, 'sparkle', clearX, -peakH - 18, 8);
        watchers.get(p.facet)?.cheer();
        return;
      }
      watchers.get(p.facet)?.gasp();
      ctx.audio.sfx('thud', { volume: 0.64 });
      const spin = ctx.audio.loop('spin', { volume: 0.5 });
      rig.play('spinWheels');
      if (turtle) void S.hop(turtle, turtle.x + 100, 0, 650, 32);
      await along(ctx, ms * 0.30, (t) => {
        S.car.rotation = Math.sin(t * 25) * 0.064 * (1 - t);
      });
      spin();
    },
    'rocks.log': async (p) => {
      const ms = phaseMs(p.facet), trunk = log!, rider = squirrel!;
      const bumper = BUMPER[ctx.model.bumpers] ?? BUMPER['bumpers.small'];
      const bumperReach = nose.x + (bumper.depth - 6) * looks.scale;
      const touch = crossingStop(trunk.x - cfg.logLength[push] / 2, bumperReach, -5);
      await S.driveTo(touch, ms * 0.37, 'Quad.easeIn');
      const x = S.car.x, start = trunk.x;
      ctx.audio.sfx('thud', { volume: 0.7 });
      if (p.pass) {
        S.fx.burst(S.layers.front, 'leaves', trunk.x, -cfg.logHeight[push], 12);
        await along(ctx, ms * 0.63, (t) => {
          const shove = 490 * t;
          const release = Math.max(0, (t - 0.6) / 0.4);
          S.car.x = x + shove - 95 * release;
          trunk.setPosition(start + shove + 135 * release, 4 + 96 * release - hopLift(release, 45))
            .setRotation(Math.sin(t * Math.PI * 2) * 0.08 + 0.11 * release);
          rider.setPosition(trunk.x + 48, trunk.y - cfg.logHeight[push] + 4 - hopLift(release, 84));
        }, 'Sine.easeInOut');
        S.layers.back.add([trunk, rider]);
        watchers.get(p.facet)?.cheer();
        return;
      }
      watchers.get(p.facet)?.gasp();
      rig.play('spinWheels');
      const spin = ctx.audio.loop('spin', { volume: 0.5 });
      const dust = S.spray('dust', 'wheelRear', {}, 105);
      await along(ctx, ms * 0.40, (t) => {
        const shudder = Math.sin(t * 38) * (1 - t);
        S.car.x = x + shudder * 7;
        trunk.rotation = shudder * 0.016;
        rider.rotation = shudder * 0.1;
      });
      spin();
      dust.stop();
      rig.play('idle');
      ctx.audio.sfx('boing', { volume: 0.67 });
      await along(ctx, ms * 0.23, (t) => S.car.setPosition(x - 150 * t, -hopLift(t, 40)), 'Quad.easeOut');
    },
  });
  engine();
  if (plan.ok) {
    await S.driveTo(Math.max(finishX, S.car.x + 145), 720);
    await S.cheer(780);
    await S.exit(590);
  } else {
    rig.play('dizzy');
    const stars = S.dizzy();
    ctx.audio.sfx('sad', { volume: 0.54 });
    await ctx.wait(WS_RUN.failHoldMs);
    stars.stop();
  }
});
