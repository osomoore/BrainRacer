/**
 * Night: a sleepy town under the moon, lit windows, a sleeping puppy on a porch, a stroller; for night.hide a hide-and-seek
 * seeker with a flashlight waits at the end of the street.
 * Quiet pass: glides past with tiny "zzz" puffs, nobody wakes. Quiet fail: roars past; windows light up one by one, the puppy pops
 * awake with ears up, a sleepy grandpa opens a window in a nightcap.
 * Hide pass: the beam sweeps right past the dark car and the seeker scratches his head. Hide fail: the beam finds the car at once
 * and it lights up; the seeker points.
 */
import Phaser from 'phaser';
import { bakeKey, prop } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

export default racePlayer('night', async (ctx) => {
  const plan = planStage(ctx, ['night.quiet', 'night.hide']);
  const rig = ctx.rig;
  const S = new SideStage(ctx, { worldW: 5200, ground: ['#3a4a6a', '#2c3856', '#222c46'], sky: ['#0f1535', '#2a3466'], hills: [{ color: '#1f2a52', h: 260, f: 0.1 }, { color: '#18224a', h: 170, f: 0.25, seed: 19 }] });
  const sc = ctx.scene;
  for (let i = 0; i < 4; i++) prop(sc, S.backdrop, P.stars(), i * 512 * 2, 0, 2).setOrigin(0, 0);
  prop(sc, S.backdrop, P.moon(), ctx.size.w * 0.8, 160);
  // street
  const hx = [700, 1200, 1700, 2200];
  const winLit = [false, false, false, false];
  const wins: ReturnType<typeof S.put>[] = [];
  hx.forEach((x, i) => { S.put('back', P.house(i === 1 ? 1 : 0, '#6a7aa8', '#7a3a5a'), x, -4, 0.9); const w = S.put('back', P.window(false), x + 70, -190, 0.8); wins.push(w); });
  const puppy = S.put('mid', P.puppy(true), 1480, 0, 1);
  S.put('mid', P.stroller(), 1000, 0, 1);
  const zs: ReturnType<typeof S.put>[] = [];
  void winLit;
  // hide-and-seek zone
  const seekerX = 3000, carHideX = 3900;
  const hasHide = plan.has('night.hide');
  const seeker = hasHide ? S.put('mid', P.person('#ffd23f', '#222', 'down'), seekerX, 0) : null;
  const coneKey = bakeKey(sc, 'night:cone', 700, 300, (g) => {
    const gr = g.createLinearGradient(0, 150, 700, 150); gr.addColorStop(0, 'rgba(255,250,200,0.8)'); gr.addColorStop(1, 'rgba(255,250,200,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 150); g.lineTo(700, 0); g.lineTo(700, 300); g.closePath(); g.fill();
  });
  const cone = hasHide ? sc.add.image(seekerX + 30, -110, coneKey).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false) : null;
  if (cone) S.add('front', cone);
  [380, 2700, 3400, 4300].forEach((x) => S.put('back', P.bush('#1f4a3a'), x, 0, 1));
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.25 });

  await plan.run({
    'night.quiet': async (p) => {
      if (p.pass) {
        await S.driveTo(1000, 1400, 'Sine.easeInOut');
        const z = S.spray('smoke', 'roof', { speed: { min: 10, max: 30 }, angle: { min: 260, max: 280 }, tint: 0x9fb4ff, lifespan: 1200 }, 700);
        hx.forEach((x) => { const zz = S.put('front', P.zzz(), x + 160, -250, 1); zs.push(zz); void ctx.tween({ targets: zz, y: -330, alpha: 0.3, duration: 1800, yoyo: true, repeat: -1 }); });
        await S.driveTo(2500, 3600, 'Linear');
        z.stop();
      } else {
        eng();
        const loud = ctx.audio.loop('engineRev', { volume: 0.8 });
        rig.play('spinWheels');
        const sm = S.spray('smoke', 'exhaust', { speed: { min: 60, max: 160 }, angle: { min: 160, max: 200 } }, 70);
        await S.driveTo(1000, 1200, 'Sine.easeIn');
        rig.play('drive');
        const lit = (i: number) => { wins[i].setTexture('wsr:win:true'); ctx.audio.sfx('pop', { volume: 0.4, rate: 1 + i * 0.15 }); };
        const x0 = S.car.x;
        let n = 0;
        await along(ctx, 2300, (t) => { S.car.x = x0 + 1100 * t; if (n < 4 && t > 0.15 + n * 0.2) lit(n++); }, 'Linear');
        loud(); sm.stop();
        rig.play('idle');
        puppy.setTexture('wsr:puppy:false');
        ctx.audio.sfx('giggle', { volume: 0.5 });
        void along(ctx, 500, (t) => { puppy.y = -Math.sin(t * Math.PI) * 60; });
        const gp = S.put('front', P.grandpa(), hx[2] + 70, -190, 1);
        void ctx.tween({ targets: gp, scale: { from: 0.1, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        ctx.audio.sfx('sad', { volume: 0.5 });
        await ctx.wait(1700);
      }
    },
    'night.hide': async (p) => {
      eng();
      rig.root.setAlpha(p.pass ? 0.3 : 1);
      rig.play('drive');
      await S.driveTo(carHideX - 500, 2200, 'Sine.easeInOut');
      rig.play('idle');
      const glow = p.pass ? null : sc.add.image(0, -rig.height * 0.4, bakeKey(sc, 'night:glow', 256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 126); gr.addColorStop(0, 'rgba(255,240,150,0.9)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); })).setScale(3.4).setBlendMode(Phaser.BlendModes.ADD);
      cone!.setVisible(true);
      ctx.buddySearch?.(true);
      const target = Math.atan2(-rig.height * 0.4 + 110, S.car.x - seekerX - 30);
      if (p.pass) {
        await along(ctx, 2200, (t) => { cone!.rotation = -0.5 + t * 1.0; }, 'Sine.easeInOut');
        cone!.setVisible(false);
        const sx = seeker!.x;
        await along(ctx, 800, (t) => { seeker!.rotation = Math.sin(t * 20) * 0.06; seeker!.x = sx + 40 * t; });
        ctx.audio.sfx('sniff', { volume: 0.5 });
      } else {
        await along(ctx, 700, (t) => { cone!.rotation = -0.4 + (target + 0.4) * t; }, 'Quad.easeOut');
        rig.root.addAt(glow!, 0);
        ctx.audio.sfx('honk', { volume: 0.5 });
        const ex = S.put('front', P.exclaim(), seekerX + 20, -260, 1);
        void ex;
        ctx.audio.sfx('giggle', { volume: 0.6 });
        await ctx.wait(1700);
      }
      ctx.buddySearch?.(false);
    },
  });
  eng();
  if (plan.ok) {
    rig.root.setAlpha(1);
    rig.play('drive');
    await S.exit();
  }
});
