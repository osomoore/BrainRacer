import type Phaser from 'phaser';
import { WORLD_ACTIVITIES } from '../../config';
import type { ActivityKindDef, ActivityRun } from '../../core/runtime';
import { CATALOGS } from '../../../workshop/content';
import { computeModel } from '../../../workshop/logic/stats';
import { sniffingDinoX, updateHideSeek, type HideSeekState } from './hideSeekState';

const def: ActivityKindDef = {
  kind: 'hideSeek',
  decorate(ctx, site) {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const hideouts = site.targets.filter(t => t.role === 'hideout');
    for (const { at } of hideouts) {
      objects.push(ctx.scene.add.ellipse(at.x - 32, at.y + 6, 112, 88, 0x43894b).setDepth(10));
      objects.push(ctx.scene.add.ellipse(at.x + 30, at.y - 7, 104, 98, 0x5aa457).setDepth(10));
      objects.push(ctx.scene.add.line(at.x, at.y - 25, 0, 12, 0, 50, 0x356f42, 1).setLineWidth(8).setDepth(11));
      for (const [dx, dy] of [[0, 0], [17, 0], [-17, 0], [0, 17], [0, -17]] as const) {
        objects.push(ctx.scene.add.circle(at.x + dx, at.y - 44 + dy, 12, 0xffe5a2).setDepth(11));
      }
      objects.push(ctx.scene.add.circle(at.x, at.y - 44, 9, 0xf2b742).setDepth(12));
    }
    return () => objects.forEach(o => o.destroy());
  },
  start(ctx, site, player, live): ActivityRun {
    const cfg = WORLD_ACTIVITIES.hideSeek;
    const spots = site.targets.filter(t => t.role === 'hideout');
    const hideout = (spots.length ? spots : [{ at: site.at }]).map(t => t.at)
      .sort((a, b) => Math.hypot(a.x - player.move.x, a.y - player.move.y) - Math.hypot(b.x - player.move.x, b.y - player.move.y))[0];
    const { workshop, model } = player.creation;
    const { tags } = computeModel(CATALOGS[workshop], model);
    const camouflaged = tags.has('color:green') || tags.has('camo:forest')
      || (live.plan.biome === 'jungle' && tags.has('camo:grass'))
      || (live.plan.biome === 'darkwood' && tags.has('color:black'));
    const passDistance = cfg.dinoPassDistance;
    const body = ctx.scene.add.ellipse(hideout.x - passDistance, hideout.y, 116, 76, 0xf18b75).setStrokeStyle(8, 0x9f574d).setDepth(12);
    const head = ctx.scene.add.circle(hideout.x - passDistance + 53, hideout.y - 17, 37, 0xf7a18b).setStrokeStyle(6, 0x9f574d).setDepth(13);
    const snout = ctx.scene.add.ellipse(hideout.x - passDistance + 78, hideout.y - 5, 38, 27, 0xffc2a8).setDepth(14);
    const nostrils = [0, 1].map(i => ctx.scene.add.circle(hideout.x - passDistance + 76 + i * 9, hideout.y - 5, 3, 0x9f574d).setDepth(15));
    const eye = ctx.scene.add.circle(hideout.x - passDistance + 60, hideout.y - 28, 6, 0x302a28).setDepth(15);
    const tail = ctx.scene.add.triangle(hideout.x - passDistance - 63, hideout.y + 2, 0, 28, 74, 0, 0, -28, 0xa96359).setDepth(11);
    const dinoParts = [body, head, snout, ...nostrils, eye, tail];
    dinoParts.forEach(o => ctx.showOnlyTo(o, player));
    let elapsed = 0;
    let finished = false;
    const state: HideSeekState = { crossingStillSeconds: 0 };
    return {
      update(dt) {
        elapsed += Math.max(0, dt);
        const pass = cfg.passSeconds + player.traits.stealth * 0.35;
        const x = sniffingDinoX(elapsed, hideout.x, passDistance, pass, cfg.requiredSeconds);
        const y = hideout.y + Math.sin(elapsed * 2.2) * 32;
        body.setPosition(x, y); head.setPosition(x + 53, y - 17); snout.setPosition(x + 78, y - 5);
        nostrils.forEach((n, i) => n.setPosition(x + 76 + i * 9, y - 5));
        eye.setPosition(x + 60, y - 28); tail.setPosition(x - 63, y + 2).setRotation(-Math.sin(elapsed * 2.2) * 0.15);
        const outcome = updateHideSeek({ elapsed: elapsed - Math.max(0, dt), dt, player: player.move,
          vx: player.move.vx, vy: player.move.vy, hideout, stealth: player.traits.stealth,
          hideRadius: cfg.hideRadius + player.traits.stealth * 12, passSeconds: pass, passDistance,
          caughtDistance: cfg.caughtDistance, requiredSeconds: cfg.requiredSeconds, maxSeconds: cfg.maxSeconds, camouflaged,
        }, state);
        if (outcome !== 'running' && !finished) {
          finished = true;
          if (outcome === 'fail') {
            const puff = ctx.scene.add.circle(x + 98, y - 5, 20, 0xfff4d4).setDepth(16);
            ctx.showOnlyTo(puff, player);
            ctx.scene.tweens.add({ targets: puff, alpha: 0, scale: 2.2, duration: 550, onComplete: () => puff.destroy() });
          }
        }
        return outcome;
      },
      destroy() { dinoParts.forEach(o => o.destroy()); },
    };
  },
};
export default def;
