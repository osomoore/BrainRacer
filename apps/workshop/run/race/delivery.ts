/**
 * Delivery: a loading dock with a pile of soft boxes (more per delivery.load level) and, for delivery.power, a steep loading
 * ramp up to the store.
 * Load pass: boxes plop onto the car one by one, all fit, the car drives off and the shopkeeper waves.
 * Load fail: the tower grows until it wobbles and boxes tumble off around the car (soft, they bounce); some are left behind.
 * Power pass: the loaded car chugs up the ramp and parks at the store door. Power fail: it strains, rolls back down and bumps
 * gently into the box pile.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { slopeProfile } from '../common/terrain';

const BOXES = [0, 4, 6, 8];
const COLORS = ['#ffb347', '#6ec8ff', '#ff7eb6', '#9bde6a', '#ffd23f', '#b98cff'];
const BOX_S = 0.7;

export default racePlayer('delivery', async (ctx) => {
  const plan = planStage(ctx, ['delivery.load', 'delivery.power']);
  const hasLoad = plan.has('delivery.load'), hasPower = plan.has('delivery.power');
  const lv = Math.min(3, plan.level('delivery.load', 1));
  const n = hasLoad ? BOXES[lv] : 4;
  const rig = ctx.rig;
  const spec = { x0: 1700, length: 900, tan: 0.42, ease: 140 };
  const f = hasPower ? slopeProfile(spec) : undefined;
  const topX = spec.x0 + spec.length;
  const S = new SideStage(ctx, { worldW: hasPower ? topX + 1300 : 3200, terrain: f, sky: ['#7dd0ff', '#ecf8ff'], clouds: 4, hills: [{ color: '#c7e8b8', h: 250, f: 0.12 }, { color: '#9ddc90', h: 170, f: 0.25, seed: 9 }] });
  S.followY = hasPower;
  const gy = (x: number): number => (f ? f(x) : 0);
  // loading dock on the left with the pile
  const dockX = 120, dockW = 360, dockH = 56;
  const dock = ctx.scene.add.rectangle(dockX, -dockH, dockW, dockH + 20, 0xc98a4b).setOrigin(0, 0).setStrokeStyle(5, 0x1b1b3a);
  S.add('back', dock);
  S.put('back', P.person('#ff7a59', '#ffd23f', 'wave'), dockX + 60, -dockH, 1);
  const pile: ReturnType<typeof S.put>[] = [];
  for (let i = 0; i < n; i++) pile.push(S.put('mid', P.box(COLORS[i % COLORS.length]), dockX + 170 + (i % 3) * 62, -dockH - Math.floor(i / 3) * 62, BOX_S));
  S.put('back', P.tree(), 1250, -4, 0.9);
  S.put('back', P.bush(), 1500, 0, 0.8);
  if (hasPower) {
    S.put('back', P.store(), topX + 380, gy(topX + 380));
    S.put('back', P.person('#5aa0ff', '#fff', 'wave'), topX + 620, gy(topX + 620));
    S.put('back', P.flag('#e8434a'), topX + 150, gy(topX + 150));
  }
  const carX = 760;
  S.place(carX);
  S.follow = null;
  S.camX = 0;
  const roof = rig.anchor('roof');
  const tower = ctx.scene.add.container(roof.x, roof.y);
  rig.root.add(tower);
  const slot = (i: number): { x: number; y: number } => ({ x: (i % 2) * 66 - 33, y: -6 - Math.floor(i / 2) * 63 });
  const placeBox = (i: number): ReturnType<typeof S.put> => {
    const b = ctx.scene.add.image(0, 0, pile[i].texture.key).setOrigin(0.5, 0.93).setScale(BOX_S);
    tower.add(b);
    const s = slot(i);
    b.setPosition(s.x, s.y);
    return b as unknown as ReturnType<typeof S.put>;
  };
  const eng = ctx.audio.loop('engine', { volume: 0.35 });
  rig.play('idle');
  const placed: ReturnType<typeof S.put>[] = [];

  const loadBoxes = async (count: number, wobble: boolean): Promise<void> => {
    for (let i = 0; i < count; i++) {
      const src = pile[n - 1 - i], s = slot(i);
      const lx = S.car.x + roof.x + s.x, ly = S.car.y + roof.y + s.y;
      ctx.audio.sfx('pop', { volume: 0.5, rate: 0.9 + i * 0.05 });
      await S.hop(src, lx, ly, 380, 150);
      src.setVisible(false);
      const b = placeBox(i);
      placed.push(b);
      ctx.audio.sfx('thud', { volume: 0.4 });
      void S.squash(1.01, 0.97, 60);
      if (wobble && i >= 2) {
        const amp = 0.015 * (i - 1);
        void along(ctx, 380, (t) => { tower.rotation = Math.sin(t * 22) * amp * (1 - t); });
      }
      await ctx.wait(170);
    }
  };

  const driveOffLoaded = async (): Promise<void> => {
    rig.play('drive');
    await S.driveTo(carX + 700, 1400, 'Sine.easeInOut');
  };

  await plan.run({
    'delivery.load': async (p) => {
      if (p.pass) {
        await loadBoxes(n, false);
        await ctx.wait(200);
        rig.play('happy');
        ctx.audio.sfx('cheer', { volume: 0.5 });
        await ctx.wait(500);
      } else {
        const cap = Math.max(2, Math.floor(n * 0.6));
        await loadBoxes(Math.min(n, cap + 2), true);
        // the tower wobbles harder and tumbles
        ctx.audio.sfx('wobble', { volume: 0.7 });
        await along(ctx, 900, (t) => { tower.rotation = Math.sin(t * 16) * (0.05 + 0.1 * t); });
        ctx.audio.sfx('crash', { volume: 0.4, rate: 1.4 });
        placed.forEach((b, i) => {
          const wx = S.car.x + roof.x + b.x, wy = S.car.y + roof.y + b.y;
          tower.remove(b);
          S.layers.front.add(b);
          b.setPosition(wx, wy);
          S.fx.bits.add({ obj: b, vx: (i % 2 ? 1 : -1) * (160 + i * 40), vy: -500 - i * 60, vr: (i % 2 ? 1 : -1) * 4, floorY: 0, bounce: 0.5 });
        });
        tower.rotation = 0;
        rig.play('dizzy');
        ctx.audio.sfx('sad', { volume: 0.5 });
        S.dizzy();
        await ctx.wait(1900);
      }
    },
    'delivery.power': async (p) => {
      if (!hasLoad) {
        // already loaded: just place the boxes
        for (let i = 0; i < n; i++) { pile[i].setVisible(false); placed.push(placeBox(i)); }
      }
      S.follow = S.car;
      rig.play('drive');
      const puffs = S.spray('smoke', 'exhaust', { speed: { min: 20, max: 70 }, angle: { min: 170, max: 200 } }, 130);
      await S.driveTo(spec.x0 - 80, 2000, 'Sine.easeIn');
      if (p.pass) {
        await S.driveTo(topX + 360, 3800, 'Linear');
        puffs.stop(); eng();
        ctx.audio.sfx('honk', { volume: 0.5 });
        await S.cheer(800);
      } else {
        const stall = spec.x0 + spec.length * 0.5;
        await S.driveTo(stall, 2300, 'Sine.easeOut');
        const spin = ctx.audio.loop('spin', { volume: 0.6 });
        rig.play('spinWheels');
        await ctx.wait(800);
        spin(); puffs.stop(); eng();
        rig.play('idle');
        ctx.audio.sfx('sad', { volume: 0.5 });
        const x0 = S.car.x, back = rig.anchor('back');
        const stopX = dockX + dockW + 80 + Math.abs(back.x);
        await along(ctx, 2200, (t) => { S.setCarX(x0 + (stopX - x0) * t); }, 'Quad.easeIn');
        ctx.audio.sfx('thud', { volume: 0.6 });
        void S.squash(0.93, 1.05, 100);
        pile.slice(0, 3).forEach((b, i) => { if (b.visible) S.fx.bits.add({ obj: b, vx: -60 - i * 40, vy: -380, vr: -3, floorY: -dockH, bounce: 0.4 }); });
        rig.play('dizzy');
        await ctx.wait(1500);
      }
    },
  });
  eng();
  if (plan.ok && !hasPower) {
    await driveOffLoaded();
    await S.cheer(600);
    S.follow = null;
    await S.exit();
  } else if (plan.ok) {
    await ctx.wait(300);
  }
});
