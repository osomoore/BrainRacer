/** A quiet campsite and a separate hide-and-seek beat for the paint check. */
import { ensureTexture } from '../../art/bake';
import { WS_RUN } from '../../config';
import { PAL, bakeKey, circ, ell, eyes, fl, line, ol, poly, prop, spec } from '../common/draw';
import { along } from '../common/fx';
import { planStage, racePlayer } from '../common/phases';
import { P } from '../common/props';
import { SideStage } from '../common/side';

function owl(awake: boolean) {
  return spec(`night:owl:${awake}`, 126, 158, (g) => {
    ol(g, '#b27c75', poly([[18, 67], [17, 23], [52, 45], [81, 45], [109, 22], [106, 74]]), 6);
    ol(g, '#b27c75', ell(63, 89, 50, 59), 7);
    ol(g, '#f5c39c', ell(63, 100, 35, 40), 4);
    for (const x of [42, 84]) ol(g, awake ? '#fff0c4' : '#dca28b', circ(x, 70, 19), 4);
    if (awake) eyes(g, 63, 69, 11, 21);
    else for (const x of [42, 84]) {
      g.beginPath();
      g.arc(x, 66, 11, 0.22, Math.PI - 0.22);
      g.strokeStyle = PAL.ink;
      g.lineWidth = 5;
      g.stroke();
    }
    ol(g, '#ffb55a', poly([[55, 81], [71, 81], [63, 95]]), 3);
    for (const x of [44, 81]) ol(g, '#e9ae67', ell(x, 147, 13, 6), 3);
  }, 63, 151);
}

function tent(lit: boolean) {
  return spec(`night:tent:${lit}`, 312, 217, (g) => {
    ol(g, '#4e7294', poly([[6, 203], [123, 15], [216, 30], [303, 203]]), 7);
    ol(g, '#7097ae', poly([[123, 15], [242, 203], [6, 203]]), 7);
    ol(g, lit ? '#ffda85' : '#293c59', poly([[121, 65], [200, 200], [43, 200]]), 6);
    line(g, 16, 205, 295, 205, 7);
    line(g, 216, 36, 288, 206, 4, '#bbbac4');
  }, 156, 207);
}

const flashlight = spec('night:flashlight', 104, 56, (g) => {
  ol(g, '#dba965', poly([[5, 17], [52, 17], [84, 6], [84, 50], [52, 39], [5, 39]]), 6);
  ol(g, '#fff3b8', ell(85, 28, 9, 21), 5);
}, 83, 28);

const soundWave = spec('night:sound', 142, 139, (g) => {
  for (const r of [25, 45, 65]) {
    g.beginPath();
    g.arc(10, 70, r, -1.16, 1.16);
    g.strokeStyle = PAL.ink;
    g.lineWidth = 11;
    g.stroke();
    g.strokeStyle = '#ffce81';
    g.lineWidth = 6;
    g.stroke();
  }
}, 10, 70);

export default racePlayer('night', async (ctx) => {
  const plan = planStage(ctx, ['night.quiet', 'night.hide']);
  const cfg = WS_RUN.night;
  const lv = Math.min(2, plan.level('night.quiet')) - 1;
  const rig = ctx.rig;
  const quiet = plan.has('night.quiet'), hide = plan.has('night.hide');
  const glade = quiet ? 1140 + (cfg.campsites[lv] - 1) * 290 + 470 : 1060;
  const hidingPlace = glade + 520, seekerX = glade + 880;
  const S = new SideStage(ctx, {
    worldW: seekerX + 1320, groundFrac: 0.74, ground: ['#4c6176', '#354458', '#29364b'],
    sky: ['#121a39', '#46557f'],
    hills: [{ color: '#343e68', h: 283, f: 0.12 }, { color: '#293655', h: 181, f: 0.23, seed: 18 }],
  });
  S.fx.seed(ctx.rng);
  const sc = ctx.scene;
  for (let x = 0; x < ctx.size.w; x += 620) prop(sc, S.backdrop, P.stars(), x, 0, 1.23).setOrigin(0);
  prop(sc, S.backdrop, P.moon(), ctx.size.w * 0.79, 172, 1.25);
  for (let x = 140; x < seekerX + 850; x += 335) {
    S.put('back', P.tree(x % 3 ? '#304c59' : '#2f4658'), x, -34, ctx.rng.range(0.82, 1.34));
    S.put('back', P.bush('#395765'), x + 109, -17, 0.95);
  }

  const asleep = owl(false), awake = owl(true), lit = tent(true);
  ensureTexture(sc, awake);
  ensureTexture(sc, lit);
  const owlX = 910;
  const bird = quiet ? S.put('back', asleep, owlX, -230, 1.2) : null;
  if (bird) S.put('back', P.log(183, 22), owlX, -213, 0.94);
  const camp = Array.from({ length: quiet ? cfg.campsites[lv] : 0 }, (_, i) => {
    const x = 1140 + i * 290;
    return {
      shelter: S.put('back', tent(false), x, -21, 0.94),
      camper: S.put('back', P.grandpa(), x - 31, -19, 0.92).setVisible(false),
    };
  });
  if (bird) void ctx.tween({ targets: bird, scaleY: bird.scaleY * 0.94, duration: 950, yoyo: true, repeat: -1 });

  const shadow = bakeKey(sc, 'night:shadow', 512, 512, (g) => {
    const fade = g.createRadialGradient(256, 256, 15, 256, 256, 248);
    fade.addColorStop(0, 'rgba(10,16,43,0.96)');
    fade.addColorStop(0.54, 'rgba(10,16,43,0.68)');
    fade.addColorStop(1, 'rgba(10,16,43,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, 512, 512);
  });
  const beamKey = bakeKey(sc, 'night:beam', 760, 302, (g) => {
    const fade = g.createLinearGradient(0, 150, 760, 150);
    fade.addColorStop(0, 'rgba(255,242,179,0.82)');
    fade.addColorStop(0.72, 'rgba(255,242,179,0.30)');
    fade.addColorStop(1, 'rgba(255,242,179,0)');
    fl(g, '#fff4bd', circ(13, 151, 12));
    g.fillStyle = fade;
    g.beginPath();
    poly([[9, 146], [759, 3], [759, 299], [9, 156]])(g);
    g.fill();
  });
  const shade = sc.add.image(hidingPlace, -91, shadow).setDisplaySize(650, 400);
  const spot = sc.add.image(hidingPlace, -106, bakeKey(sc, 'night:spot', 256, 256, (g) => {
    const fade = g.createRadialGradient(128, 128, 18, 128, 128, 124);
    fade.addColorStop(0, 'rgba(255,231,157,0.53)');
    fade.addColorStop(1, 'rgba(255,231,157,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, 256, 256);
  })).setDisplaySize(630, 490).setAlpha(0);
  S.layers.mid.addAt(spot, 0);
  const seeker = S.put('front', P.person('#c2946c', '#8b8aaf', 'wave'), seekerX + 64, 8, 1.19);
  const torch = S.put('front', flashlight, seekerX, -135, 1.05).setFlipX(true);
  const beam = sc.add.image(seekerX, -135, beamKey).setOrigin(0, 0.5).setVisible(false);
  S.add('front', shade);
  S.add('front', beam);
  for (const img of [shade, seeker, torch]) img.setVisible(hide);
  S.place(230);

  await ctx.wait(580);
  await plan.run({
    'night.quiet': async ({ pass }) => {
      S.lead = 0.71;
      const engine = ctx.audio.loop('engine', { volume: pass ? 0.13 : 0.34 });
      await S.driveTo(615, 1050, 'Sine.easeInOut');
      engine();
      const motor = ctx.audio.loop(pass ? 'engine' : 'engineRev', { volume: pass ? 0.12 : 0.73 });
      const from = S.car.x;
      const warning = S.put('front', soundWave, 0, 0).setVisible(!pass);
      let woken = 0;
      const targets = [owlX, ...camp.map(({ shelter }) => shelter.x)];
      await along(ctx, cfg.quietMs[lv], (t) => {
        const step = Math.abs(Math.sin(t * (20 + lv * 8)));
        S.car.x = from + (glade - 180 - from) * t;
        S.car.setY(-step * (pass ? 13 : 8)).setRotation(Math.sin(t * 30) * (pass ? 0.019 : 0.037));
        S.car.setScale(1 + step * 0.045, 1 - step * 0.047);
        warning.setPosition(S.car.x + rig.anchor('front').x + 18, -108).setAlpha(0.48 + step * 0.5);
        if (!pass && woken < targets.length && S.car.x + 240 >= targets[woken]) {
          if (woken === 0 && bird) {
            bird.setTexture(awake.key);
            void S.hop(bird, bird.x, bird.y, 570, 132);
            S.fx.burst(S.layers.front, 'dust', bird.x, bird.y, 8);
            ctx.audio.sfx('flap', { volume: 0.53 });
          } else {
            const { shelter, camper } = camp[woken - 1];
            shelter.setTexture(lit.key);
            camper.setVisible(true);
            void S.hop(camper, camper.x - 24, camper.y, 550, 88);
            ctx.audio.sfx('pop', { volume: 0.55, rate: 0.95 + woken * 0.17 });
          }
          woken++;
        }
      }, 'Sine.easeInOut');
      warning.setVisible(false);
      motor();
      S.car.setScale(1).setY(0).setRotation(0);
      rig.play('idle');
      if (!pass) {
        ctx.audio.sfx('giggle', { volume: 0.48 });
        ctx.audio.sfx('sad', { volume: 0.38 });
        await ctx.wait(WS_RUN.failHoldMs + 460);
      } else if (!hide) {
        await S.squash(1.08, 0.89, 145);
        await S.cheer(1120, false);
      }
    },
    'night.hide': async ({ pass }) => {
      const engine = ctx.audio.loop('engine', { volume: 0.18 });
      // Frame the seeker, the dark grove, and the entire car together during the sweep.
      S.lead = 0.42;
      await S.driveTo(hidingPlace, quiet ? cfg.combinedHideApproachMs : cfg.hideApproachMs, 'Sine.easeInOut');
      engine();
      rig.play('idle');
      shade.setAlpha(pass ? 0.66 : 0.27);
      rig.root.setAlpha(pass ? cfg.shadowAlpha : 1);
      ctx.buddySearch?.(true);
      beam.setVisible(true);
      ctx.audio.sfx('pop', { volume: 0.42 });
      const target = Math.PI + Math.atan((-rig.height * 0.52 - beam.y) / (hidingPlace - seekerX));
      await along(ctx, cfg.beamMs, (t) => {
        const angle = pass ? Math.PI + 0.72 - 0.97 * t : Math.PI + 0.66 + (target - Math.PI - 0.66) * t;
        beam.setRotation(angle);
        torch.setRotation(angle - Math.PI);
        if (!pass) spot.alpha = t * t;
        rig.root.setScale(1 + 0.05 * Math.sin(t * Math.PI), 1 - 0.095 * Math.sin(t * Math.PI));
      }, 'Sine.easeInOut');
      ctx.buddySearch?.(false);
      if (pass) {
        ctx.audio.sfx('sniff', { volume: 0.54 });
        beam.setVisible(false);
        await S.hop(seeker, seeker.x + 34, seeker.y, 550, 28);
        rig.root.setAlpha(1);
        await S.squash(1.065, 0.89, 120);
      } else {
        ctx.audio.sfx('giggle', { volume: 0.57 });
        S.fx.burst(S.layers.front, 'sparkle', hidingPlace, -rig.height * 0.82, 17);
        void S.hop(seeker, seeker.x - 23, seeker.y, 570, 93);
        await S.squash(0.92, 1.08, 140);
        ctx.audio.sfx('sad', { volume: 0.38 });
        await ctx.wait(WS_RUN.failHoldMs + (quiet ? -180 : 540));
      }
    },
  });
  if (plan.ok) await S.exit(quiet && hide ? 680 : 960);
});
