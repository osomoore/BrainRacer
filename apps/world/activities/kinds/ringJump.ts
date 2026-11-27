import type Phaser from 'phaser';
import { WORLD_ACTIVITIES } from '../../config';
import type { ActivityKindDef, ActivityRun, HexLive, WorldContext } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { startRingJump, stepRingJump } from '../kit/ringJump';

const TUNING = WORLD_ACTIVITIES.ringJump;
const DEPTH_IDLE = 12;
const DEPTH_RUN = 14;
type RingSprite = Phaser.GameObjects.GameObject & { setVisible(visible: boolean): unknown };

export function ringPositions(site: ActivitySite, live: HexLive, count: number): Vec[] {
  const ramp = live.plan.features
    .filter(feature => feature.kind === 'jump')
    .sort((a, b) => Math.hypot(a.at.x - site.at.x, a.at.y - site.at.y)
      - Math.hypot(b.at.x - site.at.x, b.at.y - site.at.y))[0];
  if (!ramp) return site.targets.slice(0, count).map(target => target.at);
  const angle = ramp.dir;
  return site.targets.slice(0, count).map((_, i) => ({
    x: ramp.at.x + Math.cos(angle) * (TUNING.firstRingOffset + i * TUNING.ringSpacing),
    y: ramp.at.y + Math.sin(angle) * (TUNING.firstRingOffset + i * TUNING.ringSpacing),
  }));
}

/** Static Phaser primitives avoid rebuilding a Graphics path on every rendered frame. */
function drawRing(ctx: WorldContext, at: Vec, size: number, depth: number, active = false): RingSprite[] {
  const radius = size / 2;
  const outer = ctx.scene.add.circle(at.x, at.y, radius, 0xffd34e, active ? 0.28 : 0.07)
    .setStrokeStyle(active ? 8 : 5, 0xffd34e, active ? 1 : 0.35).setDepth(depth);
  const inner = ctx.scene.add.circle(at.x, at.y, radius - 9, 0xffffff, 0)
    .setStrokeStyle(3, 0xffffff, active ? 0.95 : 0.35).setDepth(depth + 0.01);
  const star = ctx.scene.add.star(at.x, at.y, 5, size * 0.11, size * 0.23, 0xfff2a6, active ? 0.95 : 0.3)
    .setDepth(depth + 0.02);
  return [outer, inner, star];
}

function destroyAll(sprites: RingSprite[]): void {
  sprites.forEach(sprite => sprite.destroy());
}

const ringJump: ActivityKindDef = {
  kind: 'ringJump',

  decorate(ctx, site, live) {
    const sprites = ringPositions(site, live, 3)
      .flatMap(at => drawRing(ctx, at, TUNING.ringSize, DEPTH_IDLE));
    return () => destroyAll(sprites);
  },

  start(ctx, site, player, live): ActivityRun {
    const count = TUNING.ringCountByJump[Math.max(0, Math.min(3, player.traits.jump))];
    const positions = ringPositions(site, live, count);
    let progress = startRingJump();
    const markers = positions.flatMap(at => drawRing(ctx, at, TUNING.ringSize + 12, DEPTH_RUN, true));
    markers.forEach(marker => ctx.showOnlyTo(marker, player));

    return {
      update(dt) {
        const result = stepRingJump(
          progress, player.move, player.move.airborne, dt, positions,
          TUNING.catchRadius, TUNING.timeoutSeconds,
        );
        progress = result.progress;
        if (result.collected !== undefined) {
          // Each marker group is outer circle, inner circle, star.
          markers.slice(result.collected * 3, result.collected * 3 + 3).forEach(marker => marker.setVisible(false));
          if (progress.outcome === 'running') ctx.bus.emit('ui:banner', { player, text: 'Nice jump!' });
        }
        return progress.outcome;
      },
      destroy() { destroyAll(markers); },
    };
  },
};

export default ringJump;
