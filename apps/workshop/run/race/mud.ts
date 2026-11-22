/**
 * Mud: farm road with a barn, a mud pit (width by mud.grip level) and an optional stuck tractor (mud.pull).
 * Pass grip: churns through with mud spray, shakes like a wet dog. Fail grip: wheels spin, sinks to the doors, a frog hops on the hood.
 * Pass pull: the winch cable hooks the tractor, it pops out ("schlurp"), the farmer throws his hat up.
 * Fail pull: no winch -> the nose bumps the tractor and slides back; with a winch -> the cable goes tight and drags the car into the mud.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { Cable, SideStage } from '../common/side';

const GRIP_W = [0, 520, 700, 900];
const PIT_DEPTH = [0, 110, 140, 170];
const SINK_PASS = [0, 8, 18, 28];
const SINK_FAIL = [0, 44, 58, 72];

export default racePlayer('mud', async (ctx) => {
  const plan = planStage(ctx, ['mud.grip', 'mud.pull']);
  const lv = Math.min(3, plan.level('mud.grip', 1));
  const hasPull = plan.has('mud.pull');
  const hasGrip = plan.has('mud.grip');
  const S = new SideStage(ctx, { worldW: 4200, sky: ['#74cfff', '#e9f8ff'], clouds: 5, sun: true, hills: [{ color: '#a6e39a', h: 300, f: 0.15 }, { color: '#7fd27a', h: 200, f: 0.3, seed: 4 }] });
  const rig = ctx.rig;
  const { fx } = S;
  const x0 = 1150;
  const gripW = GRIP_W[lv];
  if (hasGrip) S.pool({ x0, x1: x0 + gripW, depth: PIT_DEPTH[lv], kind: 'mud' });
  S.put('back', P.barn(), 260, 0);
  [700, 1000, 2300, 2650].forEach((x) => S.put('back', P.tree(), x + ctx.rng.int(-40, 40), -6, 0.9));
  for (let x = 40; x < 4000; x += 160) if (!(hasGrip && x > x0 - 80 && x < x0 + gripW + 80)) S.put('back', P.fence(), x, 0, 0.9);
  for (let i = 0; i < 6; i++) S.put('back', P.bush(), 500 + i * 640 + ctx.rng.int(-40, 40), 0, 0.8);
  const px0 = hasGrip ? x0 + gripW + 700 : 1100;
  const pullW = 640;
  let tractor: ReturnType<typeof S.put> | null = null;
  if (hasPull) {
    S.pool({ x0: px0, x1: px0 + pullW, depth: 130, kind: 'mud' });
    tractor = S.put('mid', P.tractor(), px0 + pullW * 0.55, 62);
    S.put('back', P.person('#5aa0ff', '#d9a066', 'wave'), px0 + pullW + 90, 0);
    S.put('back', P.fence(), px0 + pullW + 260, 0, 0.9);
  }

  S.place(280);
  rig.play('drive');
  const engine = ctx.audio.loop('engine', { volume: 0.4 });

  await plan.run({
    'mud.grip': async (p) => {
      if (p.pass) {
        await S.driveTo(x0 - 160, 1700, 'Sine.easeIn');
        ctx.audio.sfx('splat', { volume: 0.8 });
        const sp = S.spray('mud', 'wheelRear', { speed: { min: 200, max: 520 }, angle: { min: -170, max: -105 } });
        const xs = rig.root.x, xe = x0 + gripW + 160, sink = SINK_PASS[lv];
        await along(ctx, 2400 + lv * 350, (t) => {
          const e = Math.min(1, t * 6, (1 - t) * 6);
          S.setCarX(xs + (xe - xs) * t);
          S.car.y = sink * e;
          S.car.rotation = Math.sin(t * 22) * 0.025 * e;
        });
        sp.stop();
        S.car.rotation = 0;
        fx.burst(S.layers.front, 'mud', S.car.x, -90, 10);
        rig.play('happy');
        await along(ctx, 800, (t) => { S.car.rotation = Math.sin(t * 40) * 0.05 * (1 - t); });
        S.splatter(6);
      } else {
        await S.driveTo(x0 + 220, 1800, 'Sine.easeIn');
        const spin = ctx.audio.loop('spin', { volume: 0.7 });
        ctx.audio.sfx('splat');
        rig.play('spinWheels');
        const sp = S.spray('mud', 'wheelRear', { speed: { min: 260, max: 620 }, angle: { min: -170, max: -100 } }, 45);
        const sink = SINK_FAIL[lv];
        const frog = S.put('front', P.frog(), x0 + gripW + 20, -4, 1.4);
        const bx = S.car.x;
        await along(ctx, 2600, (t) => {
          S.car.y = sink * Math.min(1, t * 1.4);
          S.car.rotation = 0.035 * t;
          S.car.x = bx + Math.sin(t * 70) * 3;
        });
        sp.stop(); spin();
        rig.play('idle');
        ctx.audio.sfx('sad', { volume: 0.5 });
        const fr = rig.anchor('front');
        ctx.audio.sfx('boing', { volume: 0.5, rate: 1.6 });
        await S.hop(frog, S.car.x + fr.x * 0.55, S.car.y + fr.y - 20, 700, 140);
        await along(ctx, 300, (t) => frog.setScale(1.4 + Math.sin(t * Math.PI * 2) * 0.17, 1.4 - Math.sin(t * Math.PI * 2) * 0.17));
        await ctx.wait(1500);
      }
    },
    'mud.pull': async (p) => {
      const tr = tractor!;
      const parkX = px0 - 300;
      await S.driveTo(parkX, 1900);
      rig.play('idle');
      const fr = rig.anchor('front');
      const cable = new Cable(S.scene, S.layers.front);
      const setCable = (): void => cable.set(S.car.x + fr.x, S.car.y + fr.y * 0.5, tr.x - 120, tr.y - 40);
      if (p.pass) {
        ctx.audio.sfx('click');
        setCable();
        await ctx.wait(500);
        rig.play('spinWheels');
        const tx0 = tr.x, ty0 = tr.y, targetX = px0 - 20;
        await along(ctx, 2200, (t) => { tr.x = tx0 + (targetX - tx0) * t; tr.y = ty0 * (1 - Math.min(1, t * 1.15)); S.car.x = parkX - 18 * Math.sin(t * Math.PI); setCable(); }, 'Sine.easeInOut');
        ctx.audio.sfx('pop', { rate: 0.7 });
        fx.burst(S.layers.front, 'mud', tr.x, 0, 14);
        rig.play('happy');
        cable.destroy();
        const hat = S.put('front', P.hat(), px0 + pullW + 90, -150);
        await along(ctx, 1100, (t) => { hat.y = -150 - Math.sin(t * Math.PI) * 220; hat.rotation = t * 9; });
        fx.burst(S.layers.front, 'sparkle', tr.x, -130);
        ctx.audio.sfx('cheer', { volume: 0.6 });
        await ctx.wait(400);
      } else {
        if (ctx.model.extra === 'extra.winch') {
          setCable();
          ctx.audio.sfx('click');
          await ctx.wait(400);
          const sp = ctx.audio.loop('spin', { volume: 0.5 });
          rig.play('spinWheels');
          const x1 = S.car.x;
          await along(ctx, 1800, (t) => { S.car.x = x1 + t * 230; S.car.y = 70 * Math.max(0, (S.car.x - (px0 - 40)) / 60); S.car.rotation = Math.sin(t * 50) * 0.012; setCable(); });
          sp();
        } else {
          await S.driveTo(tr.x - 380 - rig.width * 0.15, 1500);
          ctx.audio.sfx('thud', { volume: 0.7 });
          void S.squash(1.08, 0.92, 90);
          rig.play('spinWheels');
          const sp = ctx.audio.loop('spin', { volume: 0.5 });
          const xs = S.car.x;
          await along(ctx, 1500, (t) => { S.car.x = xs - 140 * Math.sin(Math.min(1, t * 1.2) * Math.PI / 2); });
          sp();
        }
        rig.play('idle');
        ctx.audio.sfx('sad', { volume: 0.5 });
        const d = S.dizzy();
        await ctx.wait(1500);
        d.stop();
        cable.destroy();
      }
    },
  });
  engine();
  if (plan.ok) {
    await S.cheer(700);
    await S.exit();
  }
});
