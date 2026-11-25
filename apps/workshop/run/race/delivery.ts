import { raceGeom, raceLooks } from '../../art/race/geometry';
import { WS_RUN } from '../../config';
import { facetTime, hopLift } from '../common/choreography';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { raceSpectator } from '../common/raceSpectator';
import { SideStage } from '../common/side';
import { slopeProfile } from '../common/terrain';

const cfg = WS_RUN.delivery;
const colors = ['#ffb547', '#70caff', '#f18bb9', '#abe072', '#ffda55', '#bc9afd'];

export default racePlayer('delivery', async (ctx) => {
  const plan = planStage(ctx, ['delivery.load', 'delivery.power']);
  const hasLoad = plan.has('delivery.load'), hasPower = plan.has('delivery.power');
  const level = Math.min(3, plan.level('delivery.load')) - 1;
  const count = cfg.boxes[level];
  const last = plan.plays.at(-1)?.facet;
  const phaseMs = (facet: string): number => facetTime(cfg.actionMs, plan.plays.length, facet === last);
  const { rig } = ctx;
  const slope = { x0: 1580, length: 910, tan: cfg.slope + (hasLoad ? level * 0.04 : 0), ease: 155 };
  const top = slope.x0 + slope.length;
  const S = new SideStage(ctx, {
    worldW: hasPower ? top + 1470 : 3250, terrain: hasPower ? slopeProfile(slope) : undefined,
    sky: ['#7acdfa', '#eff9ff'], clouds: 4, sun: true,
    hills: [{ color: '#c7e6b1', h: 240, f: 0.13 }, { color: '#9ed38d', h: 169, f: 0.25, seed: 9 }],
  });
  S.fx.seed(ctx.rng);
  S.followY = hasPower;
  const dock = { x: 120, width: 420, height: 64 };
  S.add('back', ctx.scene.add.rectangle(dock.x, -dock.height, dock.width, dock.height + 18, 0xc98a4b)
    .setOrigin(0, 0).setStrokeStyle(5, 0x1b1b3a));
  for (let x = dock.x + 65; x < dock.x + dock.width; x += 90) {
    S.put('back', P.postTall(), x, 0, 0.44);
  }
  S.put('back', P.store(), 210, -dock.height, 0.9);
  const loader = raceSpectator(S, 495, '#ea7f53', '#ffe16c', -dock.height);
  const destination = hasPower ? top + 390 : 2020;
  S.put('back', P.store(), destination, S.groundAt(destination));
  const receiver = raceSpectator(S, destination + 158, '#5c91e4', '#f2da87');
  S.put('back', P.checker(), destination - 185, S.groundAt(destination - 185), 1.1);
  for (const x of [616, 1135, slope.x0 - 120, top + 730]) {
    S.put('back', P.tree(), x + ctx.rng.int(-34, 34), S.groundAt(x), ctx.rng.range(0.75, 1.02));
  }
  if (hasPower) for (const x of [slope.x0 + 150, slope.x0 + 365, slope.x0 + 590, top - 100]) {
    S.put('back', P.cone(), x, S.groundAt(x), 0.82);
  }
  const start = 804;
  S.place(start);
  S.follow = null;
  rig.play('idle');

  // Cargo sits inside a pickup bed where there is one, otherwise on the roof.
  const looks = raceLooks(ctx.model), geo = raceGeom(looks);
  const bed = geo.bed;
  const roof = rig.anchor('roof');
  const cargoX = bed ? (bed[0].x + bed[1].x) / 2 * looks.scale : roof.x;
  const cargoY = bed ? (bed[2].y + bed[3].y) / 2 * looks.scale - 4 : roof.y - (ctx.model.extra === 'extra.roofRack' ? 27 : 0);
  const space = bed ? (bed[1].x - bed[0].x) * looks.scale : (geo.cabinTopRange[1] - geo.cabinTopRange[0]) * looks.scale;
  const boxScale = Math.min(cfg.boxScale, Math.max(0.48, space / 164));
  const columns = space >= 90 ? 2 : 1;
  const slot = (i: number) => ({
    x: (i % columns - (columns - 1) / 2) * boxScale * 83,
    y: -Math.floor(i / columns) * boxScale * 79,
  });
  const tower = ctx.scene.add.container(cargoX, cargoY);
  (rig.bodyMount?.() ?? rig.root).add(tower);
  const pile = Array.from({ length: count }, (_, i) => S.put('mid', P.box(colors[i % colors.length]),
    238 + (i % 3) * 71, -dock.height - Math.floor(i / 3) * 59, cfg.boxScale));
  const placed: (typeof pile)[number][] = [];
  const putCargo = (source: (typeof pile)[number], index: number): void => {
    const { x, y } = slot(index);
    const box = ctx.scene.add.image(x, y, source.texture.key)
      .setOrigin(source.originX, source.originY).setScale(source.scaleX * boxScale / cfg.boxScale);
    tower.add(box);
    placed[index] = box;
    source.setVisible(false);
  };
  const cargoWorld = (x: number, y: number): { x: number; y: number } => {
    const world = tower.getWorldTransformMatrix().transformPoint(x, y);
    return S.world.getWorldTransformMatrix().applyInverse(world.x, world.y);
  };
  const load = async (ms: number, wobble: boolean): Promise<void> => {
    const interval = ms * 0.74 / count, flight = ms * 0.22;
    await Promise.all(pile.map(async (_, i) => {
      await ctx.wait(i * interval);
      const source = pile[count - 1 - i], at = slot(i);
      const target = cargoWorld(at.x, at.y);
      await S.hop(source, target.x, target.y, flight, 88 + (i % 2) * 38, 'Sine.easeInOut');
      putCargo(source, i);
      ctx.audio.sfx('thud', { volume: 0.35, rate: 1.10 + i * 0.07 });
      if (wobble && i >= count / 2) ctx.audio.sfx('wobble', { volume: 0.3, rate: 1.2 });
    }));
  };
  const dropCargo = (from: number): void => {
    for (let i = placed.length - 1; i >= from; i--) {
      const box = placed[i], at = cargoWorld(box.x, box.y);
      const side = i % 2 ? 1 : -1;
      tower.remove(box);
      S.layers.front.add(box.setPosition(at.x, at.y).setRotation(tower.rotation));
      S.fx.bits.add({ obj: box, vx: side * ctx.rng.int(155, 330), vy: ctx.rng.int(-510, -340),
        vr: side * ctx.rng.range(2.6, 4.4), floorY: S.groundAt(at.x), bounce: 0.43 });
    }
  };

  await ctx.wait(870);
  await plan.run({
    'delivery.load': async (p) => {
      const ms = phaseMs(p.facet);
      if (p.pass) {
        await load(ms * 0.8, false);
        S.fx.burst(S.layers.front, 'sparkle', S.car.x + cargoX, cargoY - Math.ceil(count / columns) * 58, 12);
        loader.cheer();
        if (hasPower) {
          rig.play('idle');
          await ctx.wait(ms * 0.22);
        } else {
          S.follow = S.car;
          const rev = ctx.audio.loop('engine', { volume: 0.4 });
          await S.driveTo(destination - 124, ms * 0.25);
          rev();
        }
        return;
      }

      await load(ms * 0.68, true);
      loader.gasp();
      ctx.audio.sfx('wobble', { volume: 0.7 });
      await along(ctx, ms * 0.32, (t) => {
        tower.rotation = Math.sin(t * 19) * (0.05 + 0.25 * t);
        rig.setSuspensionCompression?.(hopLift(t, 0.75));
      });
      dropCargo(Math.max(1, count - 4));
      tower.rotation = 0;
      ctx.audio.sfx('thud', { volume: 0.7, rate: 1.5 });
    },
    'delivery.power': async (p) => {
      const ms = phaseMs(p.facet);
      if (!hasLoad) {
        // The short loading beat still establishes the cargo for a power-only run.
        await load(ms * 0.27, false);
        loader.cheer();
      }
      const driveMs = ms * (hasLoad ? 1 : 0.73);
      S.follow = S.car;
      const engine = ctx.audio.loop('engine', { volume: 0.41 });
      await S.driveTo(slope.x0 + 40, driveMs * 0.24, 'Sine.easeIn');
      ctx.audio.sfx('engineRev', { volume: 0.65, rate: p.pass ? 1.17 : 0.74 });
      const exhaust = S.spray('smoke', 'exhaust', {
        speed: { min: 30, max: 94 }, angle: { min: 185, max: 239 },
        tint: p.pass ? 0xe3e9ee : 0x7e8391,
      }, p.pass ? 145 : 76);
      if (p.pass) {
        await S.driveTo(destination - 63, driveMs * 0.76, 'Sine.easeInOut');
        exhaust.stop();
        engine();
        ctx.audio.sfx('honk', { volume: 0.52 });
        return;
      }

      const stallX = slope.x0 + slope.length * cfg.stallProgress;
      await S.driveTo(stallX, driveMs * 0.30, 'Quad.easeOut');
      rig.play('spinWheels');
      const spin = ctx.audio.loop('spin', { volume: 0.57 });
      const stallAngle = S.car.rotation;
      await along(ctx, driveMs * 0.22, (t) => {
        const tremor = Math.sin(t * 34);
        S.car.x = stallX + tremor * 7;
        S.car.rotation = stallAngle + tremor * 0.023;
        tower.rotation = Math.sin(t * 19) * 0.116;
      });
      exhaust.stop();
      spin();
      engine();
      ctx.audio.sfx('wobble', { volume: 0.57 });
      rig.play('drive');
      const stopX = slope.x0 - 255;
      await along(ctx, driveMs * 0.24, (t) => {
        S.setCarX(stallX + (stopX - stallX) * t);
        tower.rotation = Math.sin(t * 13) * 0.16;
      }, 'Quad.easeIn');
      ctx.audio.sfx('thud', { volume: 0.56 });
      void S.squash(0.93, 1.06, 130);
      dropCargo(count - 1);
      tower.rotation = 0;
      loader.gasp();
    },
  });

  if (plan.ok) {
    receiver.cheer();
    S.fx.burst(S.layers.front, 'confetti', S.car.x + 110, S.car.y - 232, 24);
    await S.cheer(1080);
  } else {
    rig.play('dizzy');
    const stars = S.dizzy();
    ctx.audio.sfx('sad', { volume: 0.55 });
    await ctx.wait(WS_RUN.failHoldMs);
    stars.stop();
  }
});
