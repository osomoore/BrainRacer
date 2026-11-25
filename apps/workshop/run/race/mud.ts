import { raceGeom, raceLooks, winchMount } from '../../art/race/geometry';
import { WS_RUN } from '../../config';
import { facetTime, hopLift, waterEnvelope } from '../common/choreography';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { raceSpectator } from '../common/raceSpectator';
import { Cable, SideStage } from '../common/side';

const cfg = WS_RUN.mud;

export default racePlayer('mud', async (ctx) => {
  const plan = planStage(ctx, ['mud.grip', 'mud.pull']);
  const hasGrip = plan.has('mud.grip'), hasPull = plan.has('mud.pull');
  const grip = Math.min(3, plan.level('mud.grip')) - 1;
  const pull = Math.min(2, plan.level('mud.pull')) - 1;
  const last = plan.plays.at(-1)?.facet;
  const phaseMs = (facet: string): number => facetTime(cfg.actionMs, plan.plays.length, facet === last);
  const { rig } = ctx;
  const nose = rig.anchor('front'), rear = rig.anchor('wheelRear');
  const gripX = 1050, gripEnd = gripX + cfg.width[grip];
  const pullX = hasGrip ? gripEnd + 765 : 1110;
  const pullEnd = pullX + cfg.pullWidth[pull];
  const S = new SideStage(ctx, {
    worldW: Math.max(3250, pullEnd + 1360), sky: ['#73cbf7', '#eaf9ff'], clouds: 5, sun: true,
    hills: [{ color: '#b1df95', h: 285, f: 0.15 }, { color: '#7cc678', h: 195, f: 0.29, seed: 4 }],
  });
  S.fx.seed(ctx.rng);
  S.put('back', P.barn(), 370);
  for (let x = 105; x < S.worldW - 140; x += 181) {
    if ((hasGrip && x > gripX - 130 && x < gripEnd + 120) || (hasPull && x > pullX - 130 && x < pullEnd + 120)) continue;
    S.put('back', P.fence(), x, 0, 0.9);
    if (x % 3 === 0) S.put('back', P.tree(), x + ctx.rng.int(-25, 25), 0, ctx.rng.range(0.74, 0.98));
  }
  if (hasGrip) {
    S.pool({ x0: gripX, x1: gripEnd, depth: cfg.depth[grip], kind: 'mud', frontAlpha: 0.88 });
    S.put('back', P.signpost('#ffd23f'), gripX - 117);
    for (const x of [gripX + 26, gripEnd - 34]) S.put('back', P.reeds(), x, 4, 1.2);
  }
  if (hasPull) {
    S.pool({ x0: pullX, x1: pullEnd, depth: 125 + pull * 43, kind: 'mud', frontAlpha: 0.9 });
    S.put('back', P.reeds(), pullEnd - 32, 0, 1.15);
  }
  const tractor = hasPull ? S.put('mid', P.tractor(), pullX + cfg.pullWidth[pull] * 0.55, 44 + pull * 39, cfg.tractorScale[pull]) : null;
  const gripWatcher = hasGrip ? raceSpectator(S, gripX - 285, '#ec7854', '#ffdf73') : null;
  const farmerX = pullX - 350;
  const farmer = hasPull ? raceSpectator(S, farmerX, '#5495d2', '#e2aa68') : null;
  const frog = hasGrip ? S.put('front', P.frog(), gripX + 107, -6, 1.29) : null;
  const finish = (hasPull ? pullEnd : gripEnd) + 600;
  S.put('back', P.checker(), finish, 0, 1.21);
  S.place(400);
  rig.play('idle');
  await ctx.wait(840);
  const engine = ctx.audio.loop('engine', { volume: 0.37 });
  ctx.audio.sfx('engineRev', { volume: 0.45 });

  await plan.run({
    'mud.grip': async (p) => {
      const ms = phaseMs(p.facet);
      const entry = gripX - nose.x + 16;
      await S.driveTo(entry, ms * 0.33, 'Quad.easeIn');
      const x0 = S.car.x;
      ctx.audio.sfx('splat', { volume: 0.8 });
      S.fx.burst(S.layers.front, 'mud', gripX + 32, 4, 14);
      const spray = S.spray('mud', 'wheelRear', {
        speed: p.pass ? { min: 315, max: 590 } : { min: 160, max: 400 },
        angle: p.pass ? { min: -166, max: -119 } : { min: -129, max: -84 },
      }, p.pass ? 70 - grip * 8 : 56);

      if (p.pass) {
        if (frog) void S.hop(frog, gripX - 86, 0, 730, 115);
        const end = gripEnd - rear.x + 68;
        const tracks = Array.from({ length: 7 }, (_, i) => {
          const mark = ctx.scene.add.rectangle(gripEnd + 24 + i * 29, 6, 18, 8, 0x5b3426, 0.88)
            .setRotation(0.30).setVisible(false);
          return S.add('front', mark);
        });
        await along(ctx, ms * 0.67, (t) => {
          const x = x0 + (end - x0) * t;
          const sink = waterEnvelope(t) * cfg.gripSink[grip];
          S.car.setPosition(x, sink).setRotation(Math.sin(t * 26) * 0.035 * waterEnvelope(t));
          tracks.forEach((mark) => { if (x + rear.x > mark.x) mark.setVisible(true); });
        }, 'Sine.easeInOut');
        spray.stop();
        S.splatter(7, 0x794722);
        S.dust(6);
        gripWatcher?.cheer();
        return;
      }

      const stop = gripX + cfg.width[grip] * 0.37;
      await along(ctx, ms * 0.23, (t) =>
        S.car.setPosition(x0 + (stop - x0) * t, cfg.slipSink[grip] * 0.34 * t), 'Quad.easeOut');
      gripWatcher?.gasp();
      rig.play('spinWheels');
      const spin = ctx.audio.loop('spin', { volume: 0.61 });
      await along(ctx, ms * 0.32, (t) => {
        S.car.setPosition(stop + Math.sin(t * 43) * (1 - t) * 9, cfg.slipSink[grip] * (0.34 + t * 0.66))
          .setRotation(0.09 * t);
      }, 'Sine.easeOut');
      spin();
      spray.stop();
      rig.play('idle');
      S.splatter(9, 0x794722);
      S.fx.burst(S.layers.front, 'bubbles', stop + nose.x - 14, 55, 7);
      if (frog) {
        ctx.audio.sfx('boing', { volume: 0.5, rate: 1.59 });
        await S.hop(frog, stop + nose.x * 0.57, S.car.y + nose.y - 35, ms * 0.12, 128);
      }
    },
    'mud.pull': async (p) => {
      const ms = phaseMs(p.facet), tow = tractor!;
      const x = pullX - nose.x - 104;
      await S.driveTo(x, ms * 0.29);
      rig.play('idle');
      const looks = raceLooks(ctx.model), geo = raceGeom(looks);
      const mount = winchMount(looks, geo);
      const winchX = mount.x * looks.scale;
      const winchY = (mount.y - geo.rideRaise) * looks.scale;
      const tractorHitch = (): number => tow.x - tow.displayWidth * 0.42;
      const hitchY = (): number => tow.y - tow.displayHeight * 0.18;
      const hasWinch = ctx.model.extra === 'extra.winch';

      if (!hasWinch && !p.pass) {
        const bumpX = tractorHitch() - nose.x;
        await along(ctx, ms * 0.38, (t) => {
          const carX = x + (bumpX - x) * t;
          S.car.setPosition(carX, Math.max(0, Math.min(49, (carX - pullX + nose.x) * 0.24)));
        }, 'Quad.easeOut');
        ctx.audio.sfx('thud', { volume: 0.68 });
        S.fx.burst(S.layers.front, 'mud', S.car.x + nose.x, 18, 12);
        const y0 = S.car.y;
        const spin = ctx.audio.loop('spin', { volume: 0.57 });
        rig.play('spinWheels');
        await along(ctx, ms * 0.33, (t) => {
          S.car.setPosition(bumpX - 143 * t + 7 * Math.sin(t * 32), y0 + hopLift(t, 12)).setRotation(hopLift(t, 0.14));
        }, 'Sine.easeInOut');
        spin();
        farmer?.gasp();
        return;
      }

      const cable = new Cable(S.scene, S.layers.front, 0xe2c99e, 10);
      const hook = S.put('front', P.hook(), x + winchX, winchY, 1.32).setTint(0xffd46d);
      await along(ctx, ms * 0.14, (t) => {
        hook.setPosition(x + winchX + (tractorHitch() - x - winchX) * t, winchY + (hitchY() - winchY) * t - hopLift(t, 75));
        cable.set(x + winchX, winchY, hook.x, hook.y);
      });
      ctx.audio.sfx('click', { volume: 0.75 });
      const tx = tow.x, ty = tow.y, stop = ctx.audio.loop('spin', { volume: 0.47 });
      rig.play('spinWheels');
      await along(ctx, ms * 0.57, (t) => {
        const pullProgress = t ** (pull ? 1.65 : 1.18);
        if (p.pass) {
          tow.setPosition(tx + (pullX - 28 - tx) * pullProgress, ty * (1 - pullProgress) - hopLift(Math.max(0, (t - 0.65) / 0.35), 38));
          S.car.x = x - pullProgress * (pull ? 170 : 124);
        } else {
          S.car.setPosition(x + 248 * pullProgress + Math.sin(t * 46) * 5, cfg.slipSink[2] * Math.max(0, (t - 0.48) / 0.52));
          tow.rotation = Math.sin(t * 31) * 0.033 * (1 - t);
        }
        hook.setPosition(tractorHitch(), hitchY());
        cable.set(S.car.x + winchX, S.car.y + winchY, hook.x, hook.y);
      }, 'Sine.easeInOut');
      stop();
      if (p.pass) {
        ctx.audio.sfx('pop', { volume: 0.77, rate: 0.76 });
        S.fx.burst(S.layers.front, 'mud', tow.x + 60, 10, 16);
        farmer?.cheer();
        const hat = S.put('front', P.hat(), farmerX, -167, 1.15);
        void S.hop(hat, hat.x + 47, -176, 850, 162);
        cable.destroy();
        hook.destroy();
      } else {
        farmer?.gasp();
        S.fx.burst(S.layers.front, 'bubbles', S.car.x + nose.x - 35, 48, 8);
      }
    },
  });
  engine();
  if (plan.ok) {
    if (!hasPull) await S.driveTo(finish - 170, 630);
    await S.cheer(1100);
    if (!hasPull) await S.exit(680);
  } else {
    rig.play('idle');
    ctx.audio.sfx('sad', { volume: 0.58 });
    await ctx.wait(WS_RUN.failHoldMs);
  }
});
