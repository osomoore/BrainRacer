/**
 * Fog: a pond road in thick gray fog; a mother duck and three ducklings wait at the roadside. Side or top view.
 * Pass (fog.bright met): the bright car glows through the fog; the ducks see it, quack and waddle across in a line; the car toots and drives on.
 * Fail: the dull car fades into the fog; the ducks do not notice it, the car honks (note puffs) twice, nobody moves, a duckling falls asleep.
 */
import Phaser from 'phaser';
import { PAL, bakeKey, prop } from '../common/draw';
import { addFog } from '../common/fogFx';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';
import { T, TopStage } from '../common/top';
import { WS_FOG } from '../../config';
import type { StageContext } from '../types';

function glowTexture(ctx: StageContext): string {
  return bakeKey(ctx.scene, 'fog:glow', 256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    gr.addColorStop(0, 'rgba(255,240,150,0.95)'); gr.addColorStop(0.5, 'rgba(255,230,120,0.35)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
}

export default racePlayer('fog', async (ctx) => {
  const plan = planStage(ctx, ['fog.bright']);
  const bright = plan.ok;
  const rig = ctx.rig;
  const glowKey = glowTexture(ctx);
  const sc = ctx.scene;
  const carAlpha = bright ? 1 : WS_FOG.dullCarAlpha;

  if (ctx.stage.view === 'top') {
    const S = new TopStage(ctx, { carMaxLateral: 130 });
    const { w, h } = S;
    const ry = h * 0.5, rw = 260, cx = w * 0.62;
    S.bg((g) => {
      g.fillStyle = '#7a8794'; g.fillRect(0, ry - rw / 2, w, rw);
      g.fillStyle = PAL.ink; g.fillRect(0, ry - rw / 2 - 6, w, 6); g.fillRect(0, ry + rw / 2, w, 6);
      g.setLineDash([40, 34]); g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, ry); g.lineTo(w, ry); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 7; i++) { g.fillStyle = '#fff'; g.fillRect(cx - 80 + (i % 2) * 0, ry - rw / 2 + 12 + i * ((rw - 24) / 7), 160, 18); }
    });
    S.put('back', T.puddle(w * 0.42, 220), w * 0.28, h * 0.84);
    S.put('back', T.treeTop(150), w * 0.9, h * 0.18);
    S.put('back', T.treeTop(120), w * 0.15, h * 0.16);
    const ducks: ReturnType<typeof S.put>[] = [];
    [1.5, 1, 1, 1].forEach((s, i) => ducks.push(S.put('mid', T.duckTop(s), cx - 40 + i * 26, ry - rw / 2 - 40 - i * 50, 1, Math.PI / 2)));
    const carX = cx - S.carLen / 2 - 150;
    S.car.setPosition(-S.carLen, ry + rw * 0.22).setRotation(0);
    if (bright) { const gl = sc.add.image(0, 0, glowKey).setScale(4.2).setBlendMode(Phaser.BlendModes.ADD); rig.root.addAt(gl, 0); }
    rig.root.setAlpha(carAlpha);
    addFog(ctx, S.layers.back, S.layers.front, bright);
    const eng = ctx.audio.loop('engine', { volume: 0.4 });
    rig.play('drive');
    await along(ctx, 2600, (t) => { S.car.x = -S.carLen + (carX + S.carLen) * t; }, 'Sine.easeOut');
    rig.play('idle'); eng();
    await finish(ctx, rig, ducks.map((d) => ({ o: d, x: d.x, y: d.y })), (o, i) => ({ x: o.x + (i ? 0 : 0), y: ry + rw / 2 + 80 + i * 30 }), S.layers.front, () => S.car, bright, () => along(ctx, 1500, (t) => { S.car.x = carX + (w + S.carLen - carX) * t; }, 'Quad.easeIn'));
    return;
  }

  const S = new SideStage(ctx, { worldW: 3400, ground: ['#8b97a5', '#6b7684', '#5b6573'], sky: ['#c9d4dc', '#eef2f4'], hills: [{ color: '#b6c6c0', h: 260, f: 0.15 }, { color: '#9fb4aa', h: 180, f: 0.3, seed: 2 }] });
  const crossX = 1500;
  // pond and reeds behind the road
  const pond = sc.add.ellipse(crossX + 200, -34, 900, 90, 0x6fb5d8).setStrokeStyle(5, 0x1b1b3a);
  S.add('back', pond);
  [crossX - 120, crossX + 60, crossX + 520].forEach((x) => S.put('back', P.reeds(), x, -20, 1.2));
  [400, 800, 2400, 2900].forEach((x) => S.put('back', P.tree('#7fa08c'), x, -4, 0.9));
  S.put('back', P.signpost('#ffd23f', false), crossX - 330, 0, 0.8);
  // ducks wait in front (near side of the road)
  const ducks: ReturnType<typeof S.put>[] = [];
  [1.25, 0.8, 0.8, 0.8].forEach((s, i) => ducks.push(S.put('front', P.duck(s), crossX - 80 + i * 70, 118, 1)));
  const carStop = crossX - rig.width * 0.5 - 130;
  S.place(200);
  if (bright) { const gl = sc.add.image(0, -rig.height * 0.4, glowKey).setScale(3.6).setBlendMode(Phaser.BlendModes.ADD); rig.root.addAt(gl, 0); }
  rig.root.setAlpha(carAlpha);
  addFog(ctx, S.backdrop, S.overlay, bright);
  const eng = ctx.audio.loop('engine', { volume: 0.4 });
  rig.play('drive');
  await S.driveTo(carStop, 2600, 'Sine.easeOut');
  rig.play('idle'); eng();
  const xs = ducks.map((d) => d.x);
  await finish(ctx, rig, ducks.map((d, i) => ({ o: d, x: xs[i], y: d.y })), (_o, i) => ({ x: xs[i] + 80, y: -50 }), S.layers.front, () => S.car, bright, async () => { await S.exit(1400); });
});

type Duck = { o: { x: number; y: number; setScale(s: number): unknown; rotation: number }; x: number; y: number };

/** Shared ending: success = ducks cross in a line, car toots and leaves; fail = honk honk, nobody moves, a duckling sleeps. */
async function finish(ctx: StageContext, rig: StageContext['rig'], ducks: Duck[], dest: (o: Duck['o'], i: number) => { x: number; y: number }, layer: Phaser.GameObjects.Container, car: () => { x: number; y: number }, bright: boolean, leave: () => Promise<unknown>): Promise<void> {
  const sc = ctx.scene;
  const top = ctx.stage.view === 'top';
  const note = (): void => {
    const c = car();
    const em = sc.add.particles(c.x + rig.width * 0.45, c.y - rig.height * 0.4, 'wsr:fx:note', { speed: { min: 80, max: 160 }, angle: { min: 270, max: 330 }, lifespan: 900, scale: { start: 1.3, end: 0.8 }, alpha: { start: 1, end: 0 }, tint: 0x1b1b3a, emitting: false });
    layer.add(em); em.explode(3);
    sc.time.delayedCall(1200, () => { if (em.scene) em.destroy(); });
  };
  if (bright) {
    ctx.audio.sfx('quack', { volume: 0.7 });
    await ctx.wait(400);
    ctx.audio.sfx('quack', { volume: 0.5, rate: 1.3 });
    await Promise.all(ducks.map(async (d, i) => {
      await ctx.wait(i * 260);
      const to = dest(d.o, i);
      const x0 = d.o.x, y0 = d.o.y;
      await along(ctx, 2300, (t) => {
        d.o.x = x0 + (to.x - x0) * t; d.o.y = y0 + (to.y - y0) * t - Math.abs(Math.sin(t * 17)) * 12;
        if (top) d.o.rotation = Math.PI / 2 + Math.sin(t * 17) * 0.18; else d.o.rotation = Math.sin(t * 17) * 0.1;
        if (!top) d.o.setScale(1 - 0.25 * t);
      });
    }));
    ctx.audio.sfx('honk', { volume: 0.6, rate: 1.2 });
    note();
    rig.play('happy');
    await ctx.wait(700);
    await leave();
    return;
  }
  // fail: honk honk
  for (let i = 0; i < 2; i++) {
    await ctx.wait(700);
    ctx.audio.sfx('honk', { volume: 0.8 });
    note();
    void along(ctx, 200, (t) => ctx.rig.root.setScale(1 + 0.05 * Math.sin(t * Math.PI)));
  }
  await ctx.wait(800);
  // the last duckling falls asleep: sinks a little and a "z" rises
  const sleepy = ducks[ducks.length - 1];
  const z = prop(sc, layer, P.zzz(), sleepy.o.x + 10, sleepy.o.y - 90);
  z.setAlpha(0.9);
  void along(ctx, 1600, (t) => { z.y = sleepy.o.y - 90 - t * 50; z.setAlpha(1 - t * 0.7); });
  await along(ctx, 600, (t) => { sleepy.o.setScale(1 - 0.12 * t); sleepy.o.rotation += (top ? 0 : 0.0005); });
  ctx.audio.sfx('sad', { volume: 0.5 });
  await ctx.wait(1500);
}
