/** Read the height marker, duck under the striped lintel or rebound when the tall roof hits it. */
import type Phaser from 'phaser';
import { WS_RUN } from '../../config';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { clearanceGap } from '../common/terrain';

export default racePlayer('lowBridge', async (ctx) => {
  const cfg = WS_RUN.lowBridge;
  const plan = planStage(ctx, ['lowBridge.height']);
  const lv = plan.level('lowBridge.height');
  const rig = ctx.rig;
  const S = new SideStage(ctx, {
    worldW: 3080, groundFrac: 0.75, sky: ['#74cfff', '#e9f8ff'], clouds: 4, sun: true,
    hills: [{ color: '#b3e6a6', h: 280, f: 0.15 }, { color: '#86d684', h: 190, f: 0.3, seed: 8 }],
  });
  S.fx.seed(ctx.rng);
  S.place(250);
  rig.play('idle');
  const roof = rig.anchor('roof');
  const tallExtra = ctx.model.extra === 'extra.roofRack' || ctx.model.extra === 'extra.snorkel';
  const rack = tallExtra ? rig.parts.extra?.[0] as Phaser.GameObjects.Image | undefined : undefined;
  const carBounds = S.car.getBounds();
  const roofHeight = (S.groundY - carBounds.top) / S.k;
  const under = clearanceGap(roofHeight, lv, plan.ok, cfg.clearance, cfg.overlap);
  const archW = cfg.length[Math.min(lv, cfg.length.length) - 1];
  const entry = 1200, exit = entry + archW, archX = (entry + exit) / 2;
  S.put('back', P.tree(), 276, 0, 1.12);
  S.put('back', P.bush(), 580);
  S.put('back', P.tree(), exit + 630);
  S.put('back', P.roadWarning('height'), entry - 310);
  const tunnel = S.scene.add.rectangle(entry - 24, -under - 15, archW + 48, under + 15, 0x625671).setOrigin(0);
  S.add('back', tunnel);
  S.put('back', P.arch(under, archW), archX, 0);
  const marker = S.put('front', P.clearanceBar(archW + 64), entry - 32, -under);
  const pigeon = S.put('front', P.pigeon(), entry + 35, -under - 168, 1.1).setFlipX(true);
  const friend = S.put('back', P.squirrel(), exit + 195, 0, 1.22).setFlipX(true);

  await ctx.wait(570);
  const engine = ctx.audio.loop('engine', { volume: 0.4 });
  const front = rig.anchor('front').x;
  await S.driveTo(entry - front - 90, 1690);
  rig.play('idle');
  void ctx.tween({ targets: pigeon, rotation: -0.27, duration: 215, yoyo: true });
  await ctx.wait(420);

  if (plan.ok) {
    ctx.audio.sfx('wobble', { volume: 0.47 });
    rig.play('drive');
    const from = S.car.x, to = exit + Math.abs(rig.anchor('back').x) + 74;
    let ducked = false;
    await along(ctx, 2600, (t) => {
      const duck = Math.sin(t * Math.PI);
      S.car.x = from + (to - from) * t;
      S.car.setScale(1 + 0.035 * duck, 1 - 0.105 * duck);
      if (!ducked && S.car.x + roof.x >= entry) {
        ducked = true;
        ctx.audio.sfx('rustle', { volume: 0.38 });
      }
    }, 'Sine.easeInOut');
    S.car.setScale(1);
    ctx.audio.sfx('pop', { volume: 0.5 });
    engine();
    void S.hop(pigeon, exit + 40, pigeon.y, 640, 105).then(() => pigeon.setFlipX(false));
    void S.hop(friend, friend.x + 35, friend.y, 590, 89);
    await S.squash(1.08, 0.85, 120);
    await S.cheer(920);
    await S.exit(680);
    return;
  }

  const contact = entry - 32 - (rack ? rig.focus('extra').x : roof.x + 26);
  await S.driveTo(contact, 820, 'Quad.easeInOut');
  engine();
  rig.play('idle');
  ctx.audio.sfx('thud', { volume: 0.67 });
  S.fx.burst(S.layers.front, 'dust', entry - 30, -under, 7);
  void ctx.tween({ targets: marker, y: marker.y - 7, duration: 75, yoyo: true, repeat: 1 });
  void S.hop(pigeon, pigeon.x - 92, pigeon.y, 530, 110);
  if (rack) {
    const rotation = rack.rotation;
    void along(ctx, 1040, (t) => { rack.rotation = rotation + Math.sin(t * 25) * (1 - t) * 0.31; });
  }
  void S.squash(0.84, 0.89, 140);
  await along(ctx, 850, (t) => {
    S.car.x = contact - 188 * t;
    S.car.rotation = -0.11 * Math.sin(t * Math.PI * 2) * (1 - t);
    S.car.y = -24 * Math.sin(t * Math.PI);
  }, 'Quad.easeOut');
  S.car.setRotation(0).setY(0);
  ctx.audio.sfx('boing', { volume: 0.53 });
  ctx.audio.sfx('flap', { volume: 0.45 });
  await S.hop(pigeon, S.car.x + roof.x - 30, 0, 670, 96);
  pigeon.setFlipX(false);
  rig.play('dizzy');
  ctx.audio.sfx('sad', { volume: 0.43 });
  const stars = S.dizzy();
  await ctx.wait(WS_RUN.failHoldMs);
  stars.stop();
});
