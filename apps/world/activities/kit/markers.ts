import type Phaser from 'phaser';
import { DEPTH, type WorldContext, type WorldPlayer } from '../../core/runtime';
import type { ActivityKind, ActivitySite } from '../../core/types';

// Each path fits in a 64 px badge. The stroke keeps the icons readable on busy terrain.
const icons: Record<ActivityKind, string> = {
  duckParade: 'M13 34 Q19 38 23 35 Q23 24 30 20 Q39 16 43 23 L51 27 L43 31 Q45 47 30 47 Q17 47 13 34 Z M35 24 h1',
  hideSeek: 'M31 49 Q13 45 16 27 Q19 16 24 18 Q23 30 31 36 Q31 23 43 15 Q51 27 46 38 Q41 45 31 49 Z M31 49 L41 28',
  ringJump: 'M47 32 A15 15 0 1 0 17 32 A15 15 0 1 0 47 32 M32 22 L34 29 L42 29 L36 34 L38 41 L32 37 L26 41 L28 34 L22 29 L30 29 Z',
  boulderPush: 'M15 39 L21 23 L36 17 L49 27 L50 41 L40 48 L23 47 Z M21 23 L29 33 L49 27 M29 33 L23 47',
  fruitShake: 'M32 26 C16 15 12 36 21 46 Q25 51 32 46 Q39 51 43 46 C52 36 48 15 32 26 Z M32 26 Q31 17 39 14',
  digSpot: 'M34 18 L41 12 L47 18 L41 25 Z M37 22 L27 34 M25 29 L34 38 L25 47 Q20 50 15 46 Q11 41 15 38 Z',
  islandSwim: 'M13 38 Q18 34 23 38 T33 38 T43 38 T53 38 M13 47 Q18 43 23 47 T33 47 T43 47 T53 47 M21 31 Q32 14 43 31 Z',
  gateDash: 'M17 48 V19 H47 V48 M17 25 H47 M24 19 V25 M32 19 V25 M40 19 V25',
  lanternCave: 'M27 20 Q27 14 32 14 Q37 14 37 20 M24 23 H40 L45 46 H19 Z M32 31 V39 M28 35 H36',
  herdSheep: 'M21 44 Q13 45 13 37 Q10 29 19 27 Q19 20 27 20 Q32 15 39 22 Q48 21 49 29 L53 39 L45 44 H21 Z M24 44 V50 M43 44 V50 M43 31 h1',
};

type Badge = ActivityKind | 'prompt' | 'claimed';
const size = 64;

function badgeTexture(scene: Phaser.Scene, badge: Badge): string {
  const key = `world-activity-${badge}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, size, size)!;
  const art = texture.context;
  art.translate(size / 2, size / 2);
  art.beginPath();
  art.arc(0, 0, 29, 0, Math.PI * 2);
  art.fillStyle = badge === 'claimed' ? '#ffce59' : badge === 'prompt' ? '#247547' : '#172f33';
  art.fill();
  art.strokeStyle = badge === 'claimed' ? '#fff7c7' : '#ffdf8c';
  art.lineWidth = 3;
  art.stroke();
  art.translate(-size / 2, -size / 2);
  art.lineJoin = 'round';
  art.lineCap = 'round';
  art.lineWidth = 3.5;
  if (badge === 'prompt') {
    art.fillStyle = '#fff8de';
    art.font = 'bold 42px sans-serif';
    art.textAlign = 'center';
    art.textBaseline = 'middle';
    art.fillText('A', 32, 34);
  } else {
    art.strokeStyle = badge === 'claimed' ? '#172f33' : '#fff8de';
    art.stroke(new Path2D(badge === 'claimed' ? 'M19 32 L28 41 L46 23' : icons[badge]));
  }
  texture.refresh();
  return key;
}

export interface SiteMarker {
  playerView(player: WorldPlayer, angle: number, claimed: boolean): void;
  destroy(): void;
}

/** Adapter for the per-player interaction badge. Replace this implementation with ABadge at integration. */
export function createActivityPrompt(ctx: WorldContext, player: WorldPlayer) {
  const badge = ctx.scene.add.image(0, 0, badgeTexture(ctx.scene, 'prompt'))
    .setDepth(DEPTH.popups).setVisible(false);
  ctx.showOnlyTo(badge, player);
  let shown = false;
  return {
    show() { shown = true; },
    hide() { shown = false; },
    update() {
      badge.setVisible(shown);
      if (!shown) return;
      const angle = -ctx.viewRotation(player);
      const zoom = player.camera.zoom || 1;
      const lift = 108 / zoom;
      const pulse = 1 + 0.08 * Math.sin(ctx.time * 2 * Math.PI / 1.1);
      badge.setPosition(player.move.x + lift * Math.sin(angle), player.move.y - lift * Math.cos(angle))
        .setRotation(angle).setScale(pulse / zoom);
    },
    destroy() { badge.destroy(); },
  };
}

export function markSite(ctx: WorldContext, site: ActivitySite): SiteMarker {
  const { x, y } = site.at;
  const ring = ctx.scene.add.circle(x, y, site.radius, 0xffdb84, 0.06)
    .setStrokeStyle(5, 0xffdb84, 0.77).setDepth(DEPTH.decals);
  const views = new Map(ctx.players.map(player => {
    const icon = ctx.scene.add.image(x, y, badgeTexture(ctx.scene, site.kind))
      .setDepth(DEPTH.objects).setDisplaySize(56, 56);
    const check = ctx.scene.add.image(x, y, badgeTexture(ctx.scene, 'claimed'))
      .setDepth(DEPTH.popups).setDisplaySize(28, 28).setVisible(false);
    for (const badge of [icon, check]) ctx.showOnlyTo(badge, player);
    return [player, { icon, check }];
  }));
  return {
    playerView(player, angle, claimed) {
      const { icon, check } = views.get(player)!;
      icon.setRotation(angle);
      check.setVisible(claimed);
      if (claimed) {
        check.setPosition(x + 25 * Math.cos(angle) + 22 * Math.sin(angle),
          y + 25 * Math.sin(angle) - 22 * Math.cos(angle)).setRotation(angle);
      }
    },
    destroy() {
      ring.destroy();
      for (const { icon, check } of views.values()) {
        icon.destroy();
        check.destroy();
      }
    },
  };
}
