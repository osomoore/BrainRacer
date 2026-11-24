/**
 * Low bridge: an old stone arch over the road with a pigeon on top. The gap under it is drawn from the car's own height,
 * so "fits" and "bonks" read exactly (level only changes how snug it looks).
 * Pass: slides under with a hair to spare; the pigeon peeks down and flaps. Fail: the roof (rack, snorkel...) bonks the arch,
 * the car bounces back like rubber, rack items tumble off (they bounce), the pigeon lands on the roof.
 */
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

export default racePlayer('lowBridge', async (ctx) => {
  const plan = planStage(ctx, ['lowBridge.height']);
  const lv = Math.min(3, plan.level('lowBridge.height', 1));
  const rig = ctx.rig;
  const S = new SideStage(ctx, { worldW: 3600, sky: ['#74cfff', '#e9f8ff'], clouds: 5, sun: true, hills: [{ color: '#b3e6a6', h: 280, f: 0.15 }, { color: '#86d684', h: 190, f: 0.3, seed: 8 }] });
  const carH = rig.height;
  const under = Math.round(plan.ok ? carH + 30 - (lv - 1) * 6 : carH - 34);
  const archW = 560;
  const archX = 1500;
  const arch = S.put('front', P.arch(under, archW), archX, 0);
  // the back wall of the tunnel (dark) so the car looks like it goes under
  const dark = ctx.scene.add.rectangle(archX - archW / 2, -under, archW, under, 0x3b3550, 0.55).setOrigin(0, 0);
  S.add('back', dark);
  [300, 760, 2500, 3000].forEach((x, i) => S.put('back', i % 2 ? P.bush() : P.tree(), x, -4, 0.9));
  S.put('back', P.signpost('#ffd23f'), archX - archW / 2 - 330, 0, 0.9);
  const pigeon = S.put('front', P.pigeon(), archX + 60, -(under + 168), 1.1);
  void arch;
  S.place(200);
  rig.play('drive');
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  const roof = rig.anchor('roof');
  const entry = archX - archW / 2;

  if (plan.ok) {
    await S.driveTo(entry - 150, 2200, 'Sine.easeIn');
    // under the arch, slowly
    void ctx.tween({ targets: pigeon, y: pigeon.y + 12, rotation: 0.35, duration: 400, yoyo: true, ease: 'Sine.easeInOut' });
    ctx.audio.sfx('flap', { volume: 0.4 });
    await S.driveTo(archX + archW / 2 + 260, 2700, 'Linear');
    ctx.audio.sfx('honk', { volume: 0.4, rate: 1.4 });
    eng();
    await S.cheer(700);
    await S.exit();
    return;
  }

  await S.driveTo(entry - roof.x - 4, 2300, 'Sine.easeIn');
  eng();
  // BONK
  ctx.audio.sfx('thud', { volume: 0.9 });
  ctx.audio.sfx('boing', { volume: 0.6, rate: 1.5 });
  S.fx.burst(S.layers.front, 'dust', archX - archW / 2, -under, 8);
  S.fx.burst(S.layers.front, 'sparkle', archX - archW / 2, -under + 10, 8);
  rig.play('idle');
  void S.squash(0.9, 0.88, 110);
  // rack items fly off and bounce (soft boxes)
  const cols = ['#ffb347', '#6ec8ff', '#ff7eb6'];
  for (let i = 0; i < 3; i++) {
    const b = S.put('front', P.box(cols[i]), S.car.x + roof.x + i * 30, S.car.y + roof.y - 20, 0.7);
    S.fx.bits.add({ obj: b, vx: -240 - i * 120, vy: -820 - i * 90, vr: -5 + i * 4, floorY: 0, bounce: 0.5 });
  }
  const x0 = S.car.x;
  await along(ctx, 520, (t) => { S.car.x = x0 - 170 * Math.sin(t * Math.PI / 2); S.car.y = -Math.sin(t * Math.PI) * 26; S.car.rotation = -0.05 * Math.sin(t * Math.PI); }, 'Quad.easeOut');
  S.car.rotation = 0; S.car.y = 0;
  // pigeon flutters over and lands on the roof
  ctx.audio.sfx('flap', { volume: 0.6 });
  await S.hop(pigeon, S.car.x + roof.x, S.car.y + roof.y - 24, 800, 160);
  pigeon.setRotation(0);
  ctx.audio.sfx('sad', { volume: 0.5 });
  rig.play('dizzy');
  const dz = S.dizzy();
  await along(ctx, 1500, (t) => { pigeon.x = S.car.x + roof.x; pigeon.y = S.car.y + roof.y - 24 + Math.sin(t * 30) * 1.5; });
  dz.stop();
});
