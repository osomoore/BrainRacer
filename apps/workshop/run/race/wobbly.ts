/**
 * Wobbly bridge: an old bridge (level 1 wooden planks, 2 rope, 3 sticks) over a gentle creek; it sways more with the level.
 * Pass: the light car tiptoes across, the bridge wobbles a little, birds keep sitting on the post.
 * Fail: the bridge sags lower and lower with a long creak until the car slides gently down into the shallow creek (splash),
 * water up to the wheels; a duck paddles past.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { sagProfile } from '../common/terrain';

export default racePlayer('wobbly', async (ctx) => {
  const plan = planStage(ctx, ['wobbly.weight']);
  const lv = Math.min(3, plan.level('wobbly.weight', 1));
  const rig = ctx.rig;
  const bx0 = 1000, bx1 = 1900, deckY = -26;
  const S = new SideStage(ctx, { worldW: 3600, segments: [[-800, bx0], [bx1, 4400]], sky: ['#7dd0ff', '#ecf8ff'], clouds: 4, hills: [{ color: '#b9e8b0', h: 260, f: 0.15 }, { color: '#8ad88a', h: 180, f: 0.3, seed: 4 }] });
  S.add('back', ctx.scene.add.rectangle(bx0, 0, bx1 - bx0, 900, 0x3b9cff).setOrigin(0, 0));
  S.pool({ x0: bx0, x1: bx1, depth: 150, kind: 'creek', frontAlpha: 0.55 });
  const style = (['wood', 'rope', 'stick'] as const)[lv - 1];
  const N = 22, plen = (bx1 - bx0) / N + 10;
  const planks = Array.from({ length: N }, (_, i) => S.put('mid', P.plank(plen, style), bx0 + (i + 0.5) * ((bx1 - bx0) / N), deckY));
  S.put('back', P.postTall(), bx0 - 10, 0); S.put('back', P.postTall(), bx1 + 10, 0);
  const bird = S.put('front', P.pigeon(), bx0 - 10, -128, 0.8);
  S.put('front', P.pigeon(), bx1 + 10, -128, 0.8);
  void bird;
  [400, 700, 2300, 2800].forEach((x, i) => S.put('back', i % 2 ? P.bush() : P.tree(), x, -4, 0.9));
  const sagMax = plan.ok ? 22 + lv * 8 : 190;
  let amount = 0, shake = 0;
  const deck = (x: number): number => deckY + sagProfile(bx0, bx1, 1)(x) * amount + Math.sin((x - bx0) * 0.012 + shake) * 4 * Math.min(1, amount / 20) * Math.sin((x - bx0) / (bx1 - bx0) * Math.PI);
  const upd = (): void => {
    planks.forEach((pl, i) => { const x = pl.x; pl.y = deck(x); pl.rotation = Math.atan2(deck(x + 20) - deck(x - 20), 40); void i; });
  };
  S.scene.events.on('update', upd);
  ctx.layer.once('destroy', () => S.scene.events.off('update', upd));
  const onDeck = (x: number): void => {
    S.car.x = x;
    const a = rig.anchor('wheelRear'), b = rig.anchor('wheelFront');
    const yr = deck(x + a.x), yf = deck(x + b.x);
    S.car.y = (yr + yf) / 2 - 10;
    S.car.rotation = Math.atan2(yf - yr, b.x - a.x);
  };
  S.place(250);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.35 });
  await S.driveTo(bx0 - 120, 1900, 'Sine.easeIn');
  if (plan.ok) {
    rig.play('walk');
    const x0 = S.car.x, x1 = bx1 + 160;
    ctx.audio.sfx('wobble', { volume: 0.4 });
    await along(ctx, 4200, (t) => {
      amount = sagMax * Math.sin(Math.min(1, Math.max(0, (S.car.x - bx0) / (bx1 - bx0))) * Math.PI);
      shake = t * 40;
      const x = x0 + (x1 - x0) * t;
      if (x > bx0 - 100 && x < bx1 + 100) onDeck(x); else { S.car.x = x; S.car.y = 0; S.car.rotation = 0; }
    }, 'Sine.easeInOut');
    amount = 0;
    eng();
    await S.cheer(700);
    await S.exit();
    return;
  }
  rig.play('drive');
  const x0 = S.car.x, mid = (bx0 + bx1) / 2 - 120;
  ctx.audio.sfx('wobble', { volume: 0.7 });
  await along(ctx, 3200, (t) => {
    amount = sagMax * Math.min(1, ((S.car.x - bx0) / (mid - bx0)) ** 1.2 || 0);
    shake = t * 30;
    onDeck(x0 + (mid - x0) * (t * (2 - t)));
  }, 'Linear');
  rig.play('idle'); eng();
  ctx.audio.sfx('splash', { volume: 0.9 });
  S.fx.burst(S.layers.front, 'splash', S.car.x, 20, 18);
  // slide gently into the creek
  const cx = S.car.x, cyy = S.car.y;
  await along(ctx, 800, (t) => { S.car.x = cx + 80 * t; S.car.y = cyy + 60 * t; S.car.rotation = 0.18 * t; }, 'Quad.easeIn');
  const duck = S.put('front', P.duck(1.2), bx1 - 40, 12);
  void ctx.tween({ targets: duck, x: bx0 + 100, duration: 2600, ease: 'Sine.easeInOut' });
  ctx.audio.sfx('quack', { volume: 0.6 });
  ctx.audio.sfx('sad', { volume: 0.5 });
  rig.play('dizzy');
  await ctx.wait(1700);
});
