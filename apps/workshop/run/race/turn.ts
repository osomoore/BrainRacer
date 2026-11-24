/**
 * Turn (top view): race track with sharp corners lined with hay bales and cones; corners by turn.handling level
 * (1 = one corner, 2 = zig-zag, 3 = hairpins).
 * Pass: zips round every corner on the line with little skid marks, checkered finish. Fail: takes a corner too wide,
 * slides straight on into the hay bales (poof, hay rains down, a straw sticks out of the window), dizzy stars.
 */
import { PAL } from '../common/draw';
import { along } from '../common/fx';
import { type Pt, RoundedPath, trackVerts } from '../common/path';
import { planStage, racePlayer } from '../common/phases';
import { T, TopStage } from '../common/top';

export default racePlayer('turn', async (ctx) => {
  const plan = planStage(ctx, ['turn.handling']);
  const lv = Math.min(3, plan.level('turn.handling', 1));
  const S = new TopStage(ctx, { carMaxLateral: 120 });
  const { w, h } = S;
  const roadW = 210;
  const path = new RoundedPath(trackVerts(w, h, lv), 150);
  S.bg((g) => {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const trace = (): void => { g.beginPath(); path.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
    trace(); g.strokeStyle = PAL.ink; g.lineWidth = roadW + 18; g.stroke();
    trace(); g.strokeStyle = '#c9b88c'; g.lineWidth = roadW + 8; g.stroke();
    trace(); g.strokeStyle = '#6b7280'; g.lineWidth = roadW - 6; g.stroke();
    g.setLineDash([34, 30]); trace(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.setLineDash([]);
    // finish line near the end
    const fp = path.at(path.length - 300), n = { x: -Math.sin(fp.a), y: Math.cos(fp.a) };
    for (let i = -5; i < 5; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const cx = fp.x + n.x * (i + 0.5) * (roadW / 10) + Math.cos(fp.a) * (j - 0.5) * 24, cy = fp.y + n.y * (i + 0.5) * (roadW / 10) + Math.sin(fp.a) * (j - 0.5) * 24;
      g.save(); g.translate(cx, cy); g.rotate(fp.a); g.fillRect(-12, -roadW / 20, 24, roadW / 10); g.restore();
    }
  });
  // decor: trees away from the road
  const far = (x: number, y: number, m: number): boolean => path.pts.every((p) => Math.hypot(p.x - x, p.y - y) > m);
  for (let i = 0, n = 0; i < 60 && n < 9; i++) {
    const x = ctx.rng.range(60, w - 60), y = ctx.rng.range(60, h - 60), d = ctx.rng.int(110, 170);
    if (far(x, y, roadW / 2 + d / 2 + 30)) { S.put('back', T.treeTop(d, i % 2 ? '#3fae4a' : '#4cbd57'), x, y); n++; }
  }
  // hay bales on the outside of every corner (runoff) and cones along the first straight
  const bales: { img: ReturnType<typeof S.put>; cx: number; cy: number }[][] = [];
  path.corners.forEach((c) => {
    const row: { img: ReturnType<typeof S.put>; cx: number; cy: number }[] = [];
    const out = { x: c.din.x - c.dout.x, y: c.din.y - c.dout.y };
    const ol = Math.hypot(out.x, out.y) || 1;
    // runoff barrier: straight ahead of the incoming direction, beyond the corner vertex
    const bx = c.vertex.x + c.din.x * (roadW / 2 + 70), by = c.vertex.y + c.din.y * (roadW / 2 + 70);
    const perp = { x: -c.din.y, y: c.din.x };
    for (const k of [-1, 0, 1]) {
      const x = bx + perp.x * k * 128 + (out.x / ol) * 0, y = by + perp.y * k * 128;
      const img = S.put('mid', T.hayTop(), x, y, 1, Math.atan2(perp.y, perp.x) + Math.PI / 2 - Math.PI / 2);
      row.push({ img, cx: x, cy: y });
    }
    bales.push(row);
  });
  const cone0 = path.at(260);
  for (const k of [-1, 1]) S.put('mid', T.cone(), cone0.x - Math.sin(cone0.a) * k * (roadW / 2 + 22), cone0.y + Math.cos(cone0.a) * k * (roadW / 2 + 22), 0.9);

  S.setPose(path.at(0));
  ctx.audio.sfx('engineRev', { volume: 0.4 });
  const eng = ctx.audio.loop('engine', { volume: 0.45 });
  const speed = 640;
  const skid = (d: number, p: { x: number; y: number; a: number }): void => {
    if (!path.corners.some((c) => d > c.s0 && d < c.s1)) return;
    for (const k of [-1, 1]) {
      const m = ctx.scene.add.rectangle(p.x - Math.sin(p.a) * k * (S.carWid * 0.32) - Math.cos(p.a) * S.carLen * 0.3, p.y + Math.cos(p.a) * k * (S.carWid * 0.32) - Math.sin(p.a) * S.carLen * 0.3, 18, 7, 0x1b1b3a, 0.28).setRotation(p.a);
      S.layers.back.add(m);
    }
  };

  if (plan.ok) {
    let finished = false;
    let lastSkid = 0;
    let sk = false;
    const ms = Math.max(4500, Math.min(8500, (path.length / speed) * 1000));
    ctx.rig.play('drive');
    await along(ctx, ms, (t) => {
      const d = path.length * t;
      const p = path.at(d);
      S.setPose(p);
      if (!sk && path.corners.some((c) => d > c.s0 && d < c.s1)) { sk = true; ctx.audio.sfx('skid', { volume: 0.5 }); }
      if (sk && !path.corners.some((c) => d > c.s0 && d < c.s1)) sk = false;
      if (d - lastSkid > 26) { lastSkid = d; skid(d, p); }
      if (t > 0.82 && !finished) { finished = true; S.fx.burst(S.layers.front, 'sparkle', p.x, p.y); ctx.audio.sfx('cheer', { volume: 0.6 }); ctx.audio.sfx('sparkle'); }
    }, 'Sine.easeInOut');
    eng();
    await ctx.wait(150);
    return;
  }

  // fail: follow the track to the chosen corner, then slide straight on
  const ci = Math.min(path.corners.length - 1, lv - 1);
  const c = path.corners[ci];
  const dFail = c.s0 + 40;
  let lastSkid = 0;
  ctx.rig.play('drive');
  await along(ctx, Math.max(2200, (dFail / speed) * 1000), (t) => {
    const d = dFail * t;
    const p = path.at(d);
    S.setPose(p);
    if (d - lastSkid > 26) { lastSkid = d; skid(d, p); }
  }, 'Sine.easeIn');
  ctx.audio.sfx('skid', { volume: 0.8 });
  const p0 = path.at(dFail);
  const row = bales[ci];
  const hit = (): Pt => ({ x: row[1].cx - c.din.x * (S.carLen * 0.5 + 62), y: row[1].cy - c.din.y * (S.carLen * 0.5 + 62) });
  const h1 = hit();
  const dist = Math.hypot(h1.x - p0.x, h1.y - p0.y);
  const turnDir = c.turn;
  await along(ctx, 900 + dist * 0.6, (t) => {
    S.car.x = p0.x + (h1.x - p0.x) * t; S.car.y = p0.y + (h1.y - p0.y) * t;
    S.car.rotation = p0.a + turnDir * 0.5 * Math.sin(t * Math.PI * 0.5) * 1.1;
    if (Math.round(t * 40) % 3 === 0) skid(c.s0 + 1, { x: S.car.x, y: S.car.y, a: S.car.rotation });
  }, 'Quad.easeOut');
  eng();
  ctx.audio.sfx('thud', { volume: 0.7 });
  ctx.audio.sfx('crash', { volume: 0.4, rate: 1.6 });
  S.fx.burst(S.layers.front, 'hay', h1.x + c.din.x * 70, h1.y + c.din.y * 70, 24);
  S.fx.burst(S.layers.front, 'dust', h1.x + c.din.x * 70, h1.y + c.din.y * 70, 6);
  row.forEach((b, i) => { void ctx.tween({ targets: b.img, x: b.cx + c.din.x * 36 + (i - 1) * 14, y: b.cy + c.din.y * 36, rotation: (i - 1) * 0.35, duration: 260, ease: 'Quad.easeOut' }); });
  ctx.rig.play('dizzy');
  void along(ctx, 200, (t) => S.car.setScale(S.cs * (1 - 0.1 * Math.sin(t * Math.PI)), S.cs * (1 + 0.06 * Math.sin(t * Math.PI))));
  // straw in the window
  const straw = ctx.scene.add.rectangle(ctx.rig.anchor('roof').x, ctx.rig.anchor('roof').y * 0.2, 54, 5, 0xf2cf5a).setRotation(-0.5).setStrokeStyle(2, 0x1b1b3a);
  S.car.add(straw);
  const d = S.fx.dizzy(S.layers.front, S.car.x, S.car.y, 80);
  d.follow(S.car, -10);
  ctx.audio.sfx('sad', { volume: 0.6 });
  await ctx.wait(1500);
  d.stop();
});

