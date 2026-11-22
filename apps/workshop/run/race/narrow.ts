/**
 * Narrow (top view): a forest path squeezing between two big trees. The gap is drawn from the car's own width
 * (level only changes how many trees line the path), so "fits" and "wedges" read exactly.
 * Pass: slips straight through, leaves rustle, a squirrel waves. Fail: wedges between the trees, wiggles left and right,
 * pops backwards out like a cork; leaves float down onto it.
 */
import { PAL } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { T, TopStage } from '../common/top';

export default racePlayer('narrow', async (ctx) => {
  const plan = planStage(ctx, ['narrow.width']);
  const lv = Math.min(3, plan.level('narrow.width', 1));
  const S = new TopStage(ctx, { carMaxLateral: 150 });
  const { w, h } = S;
  const cy = h * 0.5;
  const gapX = w * 0.58;
  const gap = Math.round(plan.ok ? S.carWid + 52 : S.carWid - 26);
  const R = 150;
  const pathW = Math.round(S.carWid * 2.4);
  S.bg((g) => {
    g.fillStyle = '#c9a36b'; g.fillRect(0, cy - pathW / 2, w, pathW);
    g.fillStyle = '#b48a52';
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, cy - pathW / 2 + ((i * 53) % pathW), 22, 7);
    g.fillStyle = PAL.ink; g.fillRect(0, cy - pathW / 2 - 4, w, 4); g.fillRect(0, cy + pathW / 2, w, 4);
  }, ['#4fae55', '#47a24e']);
  // rows of trees along the path
  const rowTrees = 3 + lv;
  for (let i = 0; i < rowTrees; i++) {
    for (const sy of [-1, 1]) {
      const x = ((i + 0.5) / rowTrees) * w * 0.98 + ctx.rng.range(-30, 30);
      if (Math.abs(x - gapX) < R * 2 + 40) continue;
      S.put('back', T.treeTop(ctx.rng.int(110, 150), '#3f9f48'), x, cy + sy * (pathW / 2 + ctx.rng.range(80, 120)));
    }
  }
  // the two pinch trees
  const t1 = S.put('mid', T.treeTop(R * 2, '#3fae4a'), gapX, cy - (gap / 2 + R));
  const t2 = S.put('mid', T.treeTop(R * 2, '#47b84f'), gapX + 20, cy + (gap / 2 + R));
  const squirrel = S.put('front', T.squirrelTop(), gapX + 30, cy - (gap / 2 + R) + 40, 1.2);
  const carStart = -S.carLen;
  S.car.setPosition(carStart, cy).setRotation(0);
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  ctx.rig.play('drive');

  if (plan.ok) {
    let rustled = false;
    await along(ctx, 5200, (t) => {
      S.car.x = carStart + (w + S.carLen * 1.2 - carStart) * t;
      if (!rustled && S.car.x > gapX - S.carLen * 0.6) {
        rustled = true;
        ctx.audio.sfx('rustle', { volume: 0.7 });
        S.fx.burst(S.layers.front, 'leaves', gapX, cy - gap / 2 - 30, 10);
        S.fx.burst(S.layers.front, 'leaves', gapX, cy + gap / 2 + 30, 10);
        void ctx.tween({ targets: [t1, t2], scaleX: 1.05 * t1.scaleX, scaleY: 1.05 * t1.scaleY, yoyo: true, duration: 180, repeat: 2 });
        void ctx.tween({ targets: squirrel, rotation: 0.4, yoyo: true, duration: 160, repeat: 3 });
      }
    }, 'Sine.easeInOut');
    eng();
    ctx.audio.sfx('sparkle', { volume: 0.6 });
    return;
  }

  const wedgeX = gapX - S.carLen * 0.5 + 40;
  await along(ctx, 3000, (t) => { S.car.x = carStart + (wedgeX - carStart) * t; }, 'Sine.easeIn');
  ctx.audio.sfx('thud', { volume: 0.6 });
  S.fx.burst(S.layers.front, 'leaves', gapX, cy - gap / 2 - 40, 12);
  S.fx.burst(S.layers.front, 'leaves', gapX, cy + gap / 2 + 40, 12);
  ctx.rig.play('spinWheels');
  // wiggle
  await along(ctx, 1300, (t) => {
    S.car.rotation = Math.sin(t * 34) * 0.07 * (1 - t * 0.3);
    S.car.y = cy + Math.sin(t * 34 + 1) * 8;
    S.car.x = wedgeX + Math.sin(t * 20) * 5 + t * 8;
  }, 'Linear');
  eng();
  // pop out like a cork
  ctx.audio.sfx('pop', { volume: 0.8 });
  ctx.rig.play('idle');
  const x1 = S.car.x;
  await along(ctx, 600, (t) => { S.car.x = x1 - 300 * t; S.car.rotation = 0.0; S.car.y = cy - Math.sin(t * Math.PI) * 10; }, 'Back.easeOut');
  S.car.y = cy;
  S.fx.burst(S.layers.front, 'dust', S.car.x + 60, cy, 6);
  // leaves float down onto the roof
  for (let i = 0; i < 3; i++) {
    const leaf = S.put('front', P.leaf(i % 2 ? '#4cb34f' : '#8ad24a'), S.car.x + ctx.rng.range(-60, 60), cy - 260 - i * 40, 1.3);
    void along(ctx, 1400 + i * 250, (t) => { leaf.y = cy - 260 - i * 40 + (260 + i * 40) * t; leaf.x += Math.sin(t * 12) * 1.2; leaf.rotation = t * 5; });
  }
  ctx.rig.play('dizzy');
  ctx.audio.sfx('sad', { volume: 0.5 });
  await ctx.wait(1700);
});
