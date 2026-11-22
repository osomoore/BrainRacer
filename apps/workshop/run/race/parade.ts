/**
 * Parade: a street parade with balloons and bunting in the target colour (red / green / rainbow by parade.color level) and a gap
 * in the line. Side view (a simple top version exists too).
 * Pass: the car joins the line matching the balloons; confetti falls, the whole parade rolls on and the crowd cheers.
 * Fail: the marshal holds up a colour card and shakes his head; the car is waved aside, backs out of the line, a balloon floats away.
 */
import { PAL, circ, fl, ol, prop, rr, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { T, TopStage } from '../common/top';

const COLORS = ['', 'red', 'green', 'rainbow'];
const HEX: Record<string, string> = { red: '#e8434a', green: '#2fb84f', rainbow: 'rainbow' };

export default racePlayer('parade', async (ctx) => {
  const plan = planStage(ctx, ['parade.color']);
  const lv = Math.min(3, plan.level('parade.color', 1));
  const col = COLORS[lv], hex = HEX[col];
  const rig = ctx.rig;

  if (ctx.stage.view === 'top') {
    const S = new TopStage(ctx, { carMaxLateral: 140 });
    const { w, h } = S;
    S.bg((g) => { g.fillStyle = '#7a8794'; g.fillRect(0, h * 0.35, w, h * 0.3); g.fillStyle = PAL.ink; g.fillRect(0, h * 0.35 - 6, w, 6); g.fillRect(0, h * 0.65, w, 6); });
    const floatsKey = (c: string) => spec(`ptop:${c}`, 260, 150, (g) => { ol(g, c === 'rainbow' ? '#ffd23f' : c, rr(8, 8, 244, 134, 18)); for (let i = 0; i < 4; i++) ol(g, ['#e8434a', '#ffd23f', '#2fb84f', '#2b8cff'][i], circ(50 + i * 54, 75, 22), 3); }, 130, 75);
    const slotX = w * 0.55, cy = h * 0.5;
    const fl1 = S.put('mid', floatsKey(hex), slotX - 330, cy), fl2 = S.put('mid', floatsKey(hex), slotX + 330, cy);
    const marshal = S.put('front', T.cone(), slotX, h * 0.3, 1.4);
    S.car.setPosition(-S.carLen, cy).setRotation(0);
    rig.play('drive');
    await along(ctx, 2600, (t) => { S.car.x = -S.carLen + (slotX + S.carLen) * t; }, 'Sine.easeOut');
    if (plan.ok) {
      S.fx.burst(S.layers.front, 'confetti', slotX, cy - 100);
      ctx.audio.sfx('cheer');
      const xs = [fl1.x, fl2.x, S.car.x];
      await along(ctx, 2500, (t) => { fl1.x = xs[0] + 900 * t; fl2.x = xs[1] + 900 * t; S.car.x = xs[2] + 900 * t; }, 'Sine.easeIn');
    } else {
      void marshal;
      ctx.audio.sfx('sad', { volume: 0.5 });
      const y0 = S.car.y;
      await along(ctx, 1400, (t) => { S.car.y = y0 + (h * 0.84 - y0) * t; S.car.rotation = 0.6 * t; S.car.x -= 2; }, 'Sine.easeInOut');
      await ctx.wait(1200);
    }
    return;
  }

  const S = new SideStage(ctx, { worldW: 3800, ground: ['#b9bfc8', '#9aa3b0', '#838c99'], sky: ['#74cfff', '#fdf6e6'], clouds: 5, sun: true, hills: [{ color: '#d8c8e8', h: 280, f: 0.1 }, { color: '#bfe0b0', h: 190, f: 0.25, seed: 17 }] });
  for (let x = 150; x < 3600; x += 620) S.put('back', P.house(3, ['#f2d9a0', '#bfe3ff', '#ffd0d8'][x % 3 | 0] ?? '#f2d9a0'), x, -4, 0.95);
  for (let x = 200; x < 3600; x += 480) S.put('back', P.bunting(480, hex), x - 240, -330, 1);
  for (let x = 120; x < 3600; x += 330) S.put('mid', P.balloon(hex), x + (x % 3) * 20, -170, 1);
  const slotX = 1900;
  const f1 = S.put('mid', P.floatWagon(hex), slotX - 500, 0), f2 = S.put('mid', P.floatWagon(hex), slotX + 560, 0);
  const band = S.put('mid', P.band(), slotX + 1000, 0);
  const marshal = S.put('front', P.person('#ffd23f', '#e8434a', 'down'), slotX - 40, 0, 1.1);
  const card = S.put('front', P.marshalCard(col), slotX - 40, 0, 1.2);
  card.setVisible(false);
  void band;
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.35 });
  await S.driveTo(slotX - 140 - Math.abs(rig.anchor('front').x), 3200, 'Sine.easeOut');
  if (plan.ok) {
    rig.play('happy');
    ctx.audio.sfx('cheer', { volume: 0.7 });
    S.fx.burst(S.layers.front, 'confetti', S.car.x, -300);
    S.fx.burst(S.layers.front, 'confetti', S.car.x + 300, -300);
    S.follow = null;
    const xs = [f1.x, f2.x, S.car.x, band.x];
    await along(ctx, 2600, (t) => { const d = 520 * t * t; f1.x = xs[0] + d; f2.x = xs[1] + d; S.car.x = xs[2] + d; band.x = xs[3] + d; }, 'Linear');
    eng();
    await ctx.wait(500);
    return;
  }
  eng();
  rig.play('idle');
  ctx.audio.sfx('honk', { volume: 0.5 });
  await ctx.wait(300);
  card.setPosition(marshal.x + 30, -170).setVisible(true);
  marshal.setPosition(S.car.x + rig.anchor('front').x + 120, 0);
  void along(ctx, 900, (t) => { marshal.rotation = Math.sin(t * 18) * 0.07; card.rotation = Math.sin(t * 18) * 0.12; card.x = marshal.x + 50; });
  ctx.audio.sfx('sad', { volume: 0.5 });
  await ctx.wait(1000);
  // waved aside: backs out and parks behind the signpost
  const x0 = S.car.x;
  S.follow = null;
  rig.play('drive');
  const b = S.put('front', P.balloon(hex), S.car.x + 300, -250, 1);
  void ctx.tween({ targets: b, y: -900, x: b.x + 120, duration: 2500, ease: 'Sine.easeIn' });
  await along(ctx, 1500, (t) => { S.car.x = x0 - 460 * t; }, 'Sine.easeInOut');
  rig.play('dizzy');
  await ctx.wait(800);
  void prop; void fl;
});
