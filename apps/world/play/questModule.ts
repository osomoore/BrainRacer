import type Phaser from 'phaser';
import { BUTTONS, QUESTS, WORLD_PLAY, WORLD_QUEST_HUD as HUD } from '../config';
import { DEPTH, type HexLive, type WorldContext, type WorldEvents, type WorldModule, type WorldPlayer } from '../core/runtime';
import type { HexPlan, ItemSpot, Quest, Vec } from '../core/types';
import { isPathLog, touchesPath } from '../gen/errandSites';
import { hexKey } from '../gen/hex';
import { hexInset } from '../gen/layout';
import { nearbyHexes } from '../host/liveWorld';
import { ABadge } from '../hud/aBadge';
import { QuestDialog, padConnected } from '../hud/questDialog';
import { questItemTexture } from '../hud/questItemArt';
import { reactToObject } from '../render/objectsReactions';
import {
  acceptQuest, canOffer, completeQuest, localQuestDate, pickupQuestItem, recordOffer,
} from '../quests/track';
import { deliveryPoint, nearestBear, nearestInteraction, offerAt } from './questModuleRules';

type Delivery = { quest: Quest; at: Vec; image: Phaser.GameObjects.Image };
type View = {
  player: WorldPlayer;
  badge: ABadge;
  deliveries: Map<Quest, Delivery>;
  offer?: { quest: Quest; date: number };
  choice?: 'accept' | 'decline';
  nextHonk: number;
};

export default class QuestModule implements WorldModule {
  static order = 190;
  private ctx!: WorldContext;
  private dialog!: QuestDialog;
  private readonly views = new Map<WorldPlayer, View>();
  /** Players whose honk/roar fired this frame (W9c `player:honk`; B may be another special). */
  private readonly honked = new Set<WorldPlayer>();
  private readonly playing = new Set<WorldPlayer>();
  private readonly fieldItems = new Map<string, {
    live: HexLive; items: Map<string, Phaser.GameObjects.Image>; canopy?: string;
  }>();
  private readonly apples = new Map<string, ItemSpot>();
  private readonly regrowAt = new Map<string, number>();
  private readonly logOnPath = new Map<string, boolean>();
  private readonly off: (() => void)[] = [];
  private centers = '';

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.dialog = new QuestDialog(ctx, (player, choice) => {
      const view = this.views.get(player);
      if (view?.offer) view.choice ??= choice;
    });
    for (const player of ctx.players) {
      this.views.set(player, {
        player, badge: new ABadge(ctx, player), deliveries: new Map(), nextHonk: 0,
      });
    }
    this.off.push(
      ctx.bus.on('player:respawn', ({ player }) => {
        const view = this.views.get(player);
        if (view?.offer) this.close(view);
      }),
      ctx.bus.on('activity:start', ({ player }) => this.playing.add(player)),
      ctx.bus.on('activity:end', ({ player }) => this.playing.delete(player)),
      ctx.bus.on('obstacle:effect', event => this.obstacleEffect(event)),
      ctx.bus.on('player:honk', ({ player }) => this.honked.add(player)),
    );
  }

  update(): void {
    const pads = padConnected();
    this.showFieldItems();
    for (const view of this.views.values()) {
      view.badge.hide();
      this.step(view, pads);
      view.badge.update();
    }
  }

  destroy(): void {
    this.off.forEach(off => off());
    for (const view of this.views.values()) {
      if (view.offer) this.close(view);
      view.badge.destroy();
      view.deliveries.forEach(({ image }) => image.destroy());
    }
    for (const { items } of this.fieldItems.values()) items.forEach(image => image.destroy());
    this.fieldItems.clear();
    this.views.clear();
    this.playing.clear();
    this.dialog.destroy();
  }

  private step(view: View, pads: boolean): void {
    const { player, offer } = view;
    const { move, save, controls: { pressed } } = player;
    const honked = this.honked.delete(player);
    if (offer) {
      const choice = view.choice ?? (pressed.b || pressed.menu ? 'decline' : pressed.a ? 'accept' : undefined);
      if (!choice) return;
      pressed.a = pressed.b = pressed.x = pressed.y = pressed.menu = false;
      this.close(view);
      if (choice === 'accept' && acceptQuest(save, offer.quest, player.reading, player.traits, offer.date)) {
        this.ctx.save(player);
        this.ctx.bus.emit('quest:accept', { player, quest: offer.quest });
      }
      return;
    }
    const { world } = this.ctx;
    const center = world.hexAt(move.x, move.y);
    const live = world.live(center);
    const { plan } = live;
    const plans = hexInset(plan.center, move) < Math.max(HUD.pickupHintRadius * 2, QUESTS.bearRadius)
      ? world.hexesNear(move.x, move.y, 1).map(coord => world.live(coord)) : [live];
    this.showDeliveries(view, plans);
    if (player.busy || this.playing.has(player)) return;

    // Saved deliveries from before the rework used arrival at a hex or home instead of a pond.
    if (save.quests.some(({ quest, carrying }) => carrying && (quest.goal.kind === 'biome' || quest.goal.kind === 'home'))) {
      const home = plan.home && Math.hypot(move.x - plan.home.at.x, move.y - plan.home.at.y) <= WORLD_PLAY.homeRadius
        ? plan.home.id : undefined;
      const old = completeQuest(save, { biome: plan.biome, homeId: home });
      if (old) this.finish(player, old);
    }

    if (honked && this.ctx.time >= view.nextHonk) {
      view.nextHonk = this.ctx.time + BUTTONS.honk.cooldown;
      this.honk(player, plans);
    }
    const hit = nearestInteraction(plans, move, this.apples);
    let delivery: Delivery | undefined;
    let best = hit ? Math.hypot(move.x - hit.at.x, move.y - hit.at.y) : Infinity;
    for (const candidate of view.deliveries.values()) {
      const distance = Math.hypot(move.x - candidate.at.x, move.y - candidate.at.y);
      if (move.flying || distance > HUD.pickupRadius || distance > best) continue;
      best = distance;
      delivery = candidate;
    }
    if (pressed.y || pressed.menu || (!delivery && (!hit || hit.kind === 'activity'))) return;
    view.badge.show('hand', pads);
    if (!pressed.a) return;
    pressed.a = false;
    if (delivery) {
      this.ctx.bus.emit('player:interact', { player, target: { kind: 'item', id: delivery.quest.item } });
      const picked = !move.flying && pickupQuestItem(save, { biome: plan.biome, giverId: delivery.quest.giverId },
        player.carrying.length, player.traits, delivery.quest.id);
      if (picked) this.picked(player, picked);
      else this.react(player, delivery.at, delivery.image);
      return;
    }
    if (!hit) return;
    this.emitInteraction(player, hit);
    const completed = completeQuest(save, hit.contact);
    if (completed) {
      this.finish(player, completed);
      this.reactToHit(player, hit);
      return;
    }
    if (hit.kind === 'giver') {
      this.talk(view, hit.live.plan);
      return;
    }
    if ((hit.spot || hit.errand?.kind === 'hay') && !player.move.flying) {
      const picked = pickupQuestItem(save, hit.contact, player.carrying.length, player.traits);
      if (picked) {
        if (hit.spot?.item === 'apple') {
          this.apples.delete(hit.spot.id);
          this.regrowAt.set(hit.spot.id, this.ctx.time + QUESTS.appleRegrowSeconds);
        } else if (hit.spot) hit.live.takenItems.add(hit.spot.id);
        this.picked(player, picked);
        if (hit.errand) this.reactToHit(player, hit);
        return;
      }
    }
    this.reactToHit(player, hit);
  }

  private emitInteraction(player: WorldPlayer, hit: NonNullable<ReturnType<typeof nearestInteraction>>): void {
    const { bus } = this.ctx;
    if (hit.spot) bus.emit('player:interact', { player, target: { kind: 'item', id: hit.spot.item } });
    else if (hit.errand) bus.emit('player:interact', { player, target: { kind: 'errand', id: hit.errand.kind } });
    else if (hit.obstacle) bus.emit('player:interact', { player, target: { kind: 'obstacle', id: hit.obstacle.kind } });
    else if (hit.kind === 'giver' && hit.live.plan.giver) {
      bus.emit('player:interact', { player, target: { kind: 'giver', id: hit.live.plan.giver.who } });
    } else if (hit.kind === 'pond' || hit.kind === 'treasure') {
      bus.emit('player:interact', { player, target: { kind: hit.kind } });
    }
  }

  private honk(player: WorldPlayer, plans: readonly HexLive[]): void {
    const hit = nearestBear(plans, player.move);
    if (!hit) return;
    const completed = completeQuest(player.save, { biome: hit.live.plan.biome, target: 'bear', action: 'honk' });
    if (completed) this.finish(player, completed);
    reactToObject(this.ctx.scene, hit.bear.id, hit.bear.at, completed ? 'wake' : 'snore');
  }

  private obstacleEffect({ player, hex, obstacle, effect }: WorldEvents['obstacle:effect']): void {
    if (effect === 'push' && isPathLog(obstacle)) {
      const { plan } = this.ctx.world.live(hex);
      const original = plan.obstacles.find(prop => prop.id === obstacle.id);
      const wasOnPath = this.logOnPath.get(obstacle.id) ?? (original && touchesPath(plan, original));
      const onPath = touchesPath(plan, obstacle);
      this.logOnPath.set(obstacle.id, onPath);
      if (!wasOnPath || onPath || player.busy || this.playing.has(player)) return;
      const completed = completeQuest(player.save, { biome: plan.biome, target: 'pathLog', action: 'push' });
      if (completed) this.finish(player, completed);
      return;
    }
    if (effect !== 'pass' || obstacle.kind !== 'appleCanopy' || player.busy || this.playing.has(player)
      || this.apples.has(obstacle.id) || this.ctx.time < (this.regrowAt.get(obstacle.id) ?? 0)) return;
    const dx = player.move.x - obstacle.at.x, dy = player.move.y - obstacle.at.y;
    const scale = QUESTS.appleDropDistance / (Math.hypot(dx, dy) || 1);
    const at = { x: obstacle.at.x + dx * scale, y: obstacle.at.y + dy * scale };
    this.regrowAt.delete(obstacle.id);
    this.apples.set(obstacle.id, { id: obstacle.id, item: 'apple', at });
    const tree = this.ctx.world.live(hex).plan.obstacles.find(prop => prop.kind === 'appleTree');
    if (tree) reactToObject(this.ctx.scene, tree.id, tree.at, 'shake');
  }

  private reactToHit(player: WorldPlayer, hit: NonNullable<ReturnType<typeof nearestInteraction>>): void {
    const { scene } = this.ctx;
    if (hit.errand) {
      const { id, kind, at } = hit.errand;
      const reaction = { bell: 'ring', frog: 'croak', bear: 'snore', doggy: 'hop',
        barn: 'shake', hay: 'shake', cowPen: 'shake' } as const;
      reactToObject(scene, id, at, reaction[kind]);
    } else if (hit.obstacle?.kind === 'log' || hit.obstacle?.kind === 'appleTree') {
      reactToObject(scene, hit.obstacle.id, hit.at, 'shake');
    } else {
      this.react(player, hit.at, hit.spot && this.fieldItems.get(hexKey(hit.live.plan.coord))?.items.get(hit.spot.id));
    }
  }

  private talk(view: View, plan: HexPlan): void {
    const { player } = view;
    const { save, reading } = player;
    const giver = plan.giver!;
    const date = localQuestDate();
    const offer = canOffer(save, giver.id, reading, date) && offerAt(this.ctx.world, plan, date, player.traits);
    if (!offer) {
      this.ctx.bus.emit('ui:banner', { player, text: 'Hello!' });
      this.react(player, giver.at);
      return;
    }
    if (!this.dialog.show(player, offer.text[reading])) return;
    recordOffer(save, giver.id, date);
    this.ctx.save(player);
    view.offer = { quest: offer, date };
    player.busy = true;
    view.badge.hide();
  }

  private close(view: View): void {
    view.offer = undefined;
    view.choice = undefined;
    view.player.busy = false;
    this.dialog.hide(view.player);
  }

  private picked(player: WorldPlayer, quest: Quest): void {
    this.persist(player);
    this.ctx.bus.emit('quest:pickup', { player, quest });
  }

  private finish(player: WorldPlayer, quest: Quest): void {
    this.persist(player);
    this.ctx.award(player, 1, quest.id, player.move, 'quest');
    this.ctx.bus.emit('quest:complete', { player, quest });
    this.ctx.bus.emit('ui:banner', { player, text: 'Quest done!' });
  }

  private persist(player: WorldPlayer): void {
    player.carrying = player.save.quests.filter(active => active.carrying).map(active => active.quest.item);
    this.ctx.save(player);
  }

  private react(player: WorldPlayer, at: Vec, image?: Phaser.GameObjects.Image): void {
    const { scene } = this.ctx;
    const hop = scene.add.ellipse(at.x, at.y, 35, 30, 0xffe896, 0.24)
      .setStrokeStyle(4, 0xfff5bb).setDepth(DEPTH.popups);
    this.ctx.showOnlyTo(hop, player);
    scene.tweens.add({ targets: hop, scale: 2.4, alpha: 0, duration: 360, onComplete: () => hop.destroy() });
    if (image) {
      scene.tweens.killTweensOf(image);
      image.setAngle(0);
      scene.tweens.add({ targets: image, angle: { from: -15, to: 15 }, yoyo: true, duration: 90,
        onComplete: () => image.setAngle(0) });
    }
  }

  private showDeliveries(view: View, plans: readonly HexLive[]): void {
    const { scene } = this.ctx;
    const available = (quest: Quest) => plans.find(({ plan }) => plan.giver?.id === quest.giverId)?.plan;
    const pending = view.player.save.quests.filter(({ quest, carrying }) => !carrying && quest.kind === 'deliver');
    for (const [quest, { image }] of view.deliveries) {
      if (pending.some(active => active.quest === quest) && available(quest)) continue;
      image.destroy();
      view.deliveries.delete(quest);
    }
    for (const { quest } of pending) {
      if (view.deliveries.has(quest)) continue;
      const plan = available(quest);
      if (!plan?.giver) continue;
      const at = deliveryPoint(this.ctx.world, plan, view.player.traits);
      const image = scene.add.image(at.x, at.y, questItemTexture(scene, quest.item))
        .setDepth(DEPTH.objects + 1).setDisplaySize(57, 57);
      this.ctx.showOnlyTo(image, view.player);
      view.deliveries.set(quest, { quest, at, image });
    }
  }

  private showFieldItems(): void {
    const { world, scene, players } = this.ctx;
    const centers = players.map(({ move }) => hexKey(world.hexAt(move.x, move.y))).join('|');
    if (centers !== this.centers) {
      this.centers = centers;
      const nearby = nearbyHexes(world, players, 1);
      for (const [key, { items }] of this.fieldItems) {
        if (nearby.has(key)) continue;
        items.forEach(image => image.destroy());
        this.fieldItems.delete(key);
      }
      for (const [key, coord] of nearby) {
        if (this.fieldItems.has(key)) continue;
        const live = world.live(coord);
        const items = new Map(live.plan.items.map(spot => [
          spot.id, scene.add.image(spot.at.x, spot.at.y, questItemTexture(scene, spot.item))
            .setDisplaySize(58, 58).setDepth(DEPTH.objects + 1),
        ]));
        const canopy = live.plan.obstacles.find(prop => prop.kind === 'appleCanopy')?.id;
        this.fieldItems.set(key, { live, items, canopy });
      }
    }
    for (const { live, items, canopy } of this.fieldItems.values()) {
      if (canopy) {
        const apple = this.apples.get(canopy);
        const image = items.get(canopy);
        if (apple && !image) {
          const { x, y } = apple.at;
          const drop = scene.add.image(x, y - 32, questItemTexture(scene, 'apple')).setDisplaySize(44, 44).setDepth(DEPTH.objects + 1);
          scene.tweens.add({ targets: drop, y, duration: 235, ease: 'Bounce.Out' });
          items.set(canopy, drop);
        } else if (!apple && image) {
          image.destroy();
          items.delete(canopy);
        }
      }
      for (const [id, image] of items) image.setVisible(!live.takenItems.has(id));
    }
  }

}
