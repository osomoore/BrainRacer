import { WORLD_ACTIVITIES } from '../config';
import type { ActivityKindDef, ActivityRun, HexLive, WorldContext, WorldModule, WorldPlayer } from '../core/runtime';
import { ACTIVITY_KINDS, type ActivitySite, type HexCoord } from '../core/types';
import { hexKey, hexToWorld } from '../gen/hex';
import { nearbyHexes } from '../host/liveWorld';
import { createActivityPrompt, markSite, type SiteMarker } from './kit/markers';
import { nearestActivity, placeAtActivity } from './kit/quickSpawn';

const kindFiles = import.meta.glob<{ default?: ActivityKindDef }>(['./kinds/*.ts', '!./kinds/*.test.ts'], { eager: true });
const kinds = new Map(ACTIVITY_KINDS.flatMap(kind => {
  const def = kindFiles[`./kinds/${kind}.ts`]?.default;
  return def?.kind === kind ? [[kind, def] as const] : [];
}));

type Active = { site: ActivitySite; run: ActivityRun; ownsBusy: boolean };
type SiteView = { site: ActivitySite; live: HexLive; marker: SiteMarker; cleanup: () => void };

export default class ActivitiesModule implements WorldModule {
  static order = 200;
  private ctx!: WorldContext;
  private readonly views = new Map<string, SiteView[]>();
  private readonly active = new Map<WorldPlayer, Active>();
  private readonly completed = new Map<WorldPlayer, Set<string>>();
  private readonly prompts = new Map<WorldPlayer, ReturnType<typeof createActivityPrompt>>();
  private readonly quickSites = new Map<WorldPlayer, ActivitySite>();
  private centers = '';
  private unsubscribe?: () => void;

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    for (const player of ctx.players) {
      this.completed.set(player, new Set(player.save.claimed));
      this.prompts.set(player, createActivityPrompt(ctx, player));
    }
    this.unsubscribe = ctx.bus.on('player:respawn', ({ player }) => {
      if (this.active.has(player)) this.finish(player, false);
    });
    if (!import.meta.env.DEV && import.meta.env.VITE_QA_QUICK_MAPS !== '1') return;
    const params = new URLSearchParams(location.search);
    if (params.get('play') !== '1' && params.get('play') !== '2') return;
    const kind = ACTIVITY_KINDS.find(id => id === params.get('activity'));
    if (!kind || !kinds.has(kind)) return;
    for (const player of ctx.players) {
      const home = ctx.world.homeFor(player.profileId);
      const site = nearestActivity(ctx.world, home ? hexToWorld(home) : player.move, kind);
      if (site) this.quickSites.set(player, site);
    }
  }

  update(dt: number): void {
    const { bus, players, world } = this.ctx;
    for (const [player, site] of this.quickSites) {
      placeAtActivity(world, player, site);
      bus.emit('player:respawn', { player, at: { x: player.move.x, y: player.move.y } });
    }
    this.quickSites.clear();
    const centers = players.map(player => hexKey(player.hex)).join('|');
    if (centers !== this.centers) {
      this.centers = centers;
      this.refreshSites(nearbyHexes(world, players, WORLD_ACTIVITIES.nearbyRings));
    }

    for (const player of players) {
      const active = this.active.get(player);
      const prompt = this.prompts.get(player)!;
      prompt.hide();
      if (active) {
        if (!player.busy || active.ownsBusy) {
          const result = active.run.update(dt);
          active.ownsBusy = player.busy;
          if (this.active.get(player) === active && result !== 'running') this.finish(player, result === 'success');
        }
      } else if (!player.busy) {
        const candidate = this.siteAt(player);
        if (candidate && player.controls.pressed.a) {
          player.controls.pressed.a = false;
          const { site, live } = candidate;
          const run = kinds.get(site.kind)!.start(this.ctx, site, player, live);
          this.active.set(player, { site, run, ownsBusy: player.busy });
          bus.emit('activity:start', { player, site });
        } else if (candidate) prompt.show();
      }
      prompt.update();
      const rotation = -this.ctx.viewRotation(player);
      const claims = this.completed.get(player)!;
      for (const sites of this.views.values()) {
        for (const { site, marker } of sites) {
          marker.playerView(player, rotation, claims.has(site.id));
        }
      }
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    for (const player of this.active.keys()) this.releaseRun(player);
    this.refreshSites(new Map());
    for (const prompt of this.prompts.values()) prompt.destroy();
    this.prompts.clear();
    this.completed.clear();
    this.quickSites.clear();
  }

  private siteAt(player: WorldPlayer): SiteView | undefined {
    let nearest: SiteView | undefined;
    let bestDistance = Infinity;
    for (const sites of this.views.values()) {
      for (const view of sites) {
        const { site } = view;
        const distance = Math.hypot(player.move.x - site.at.x, player.move.y - site.at.y);
        if (distance <= site.radius && distance < bestDistance) {
          nearest = view;
          bestDistance = distance;
        }
      }
    }
    return nearest;
  }

  private refreshSites(nearby: Map<string, HexCoord>): void {
    for (const [key, sites] of this.views) {
      if (nearby.has(key)) continue;
      for (const { cleanup, marker } of sites) {
        cleanup();
        marker.destroy();
      }
      this.views.delete(key);
    }
    for (const [key, coord] of nearby) {
      if (this.views.has(key)) continue;
      const live = this.ctx.world.live(coord);
      const views: SiteView[] = [];
      for (const site of live.plan.activities) {
        const kind = kinds.get(site.kind);
        if (kind) views.push({ site, live, marker: markSite(this.ctx, site), cleanup: kind.decorate(this.ctx, site, live) });
      }
      this.views.set(key, views);
    }
  }

  private releaseRun(player: WorldPlayer): void {
    const active = this.active.get(player);
    if (!active) return;
    this.active.delete(player);
    active.run.destroy();
    if (active.ownsBusy) player.busy = false;
  }

  private finish(player: WorldPlayer, success: boolean): void {
    const { site } = this.active.get(player)!;
    this.releaseRun(player);
    const { bus } = this.ctx;
    if (success) {
      this.ctx.award(player, site.stars, site.id, site.at, 'activity');
      this.completed.get(player)!.add(site.id);
    }
    bus.emit('activity:end', { player, site, success });
    bus.emit('ui:banner', { player, text: success ? 'Yay!' : 'Try again!' });
  }
}
