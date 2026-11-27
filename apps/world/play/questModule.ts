import type Phaser from 'phaser';
import { WORLD_QUEST_HUD as HUD } from '../config';
import { DEPTH, type WorldContext, type WorldModule, type WorldPlayer } from '../core/runtime';
import { QUEST_SLOTS, type ActiveQuest, type HexPlan, type ItemId, type ItemSpot, type Quest } from '../core/types';
import { hexInset } from '../gen/layout';
import { ABadge } from '../hud/aBadge';
import { QuestDialog, padConnected } from '../hud/questDialog';
import { questItemTexture } from '../hud/questItemArt';
import { acceptQuest, completeQuest, nextQuestIndex, pickupDelivery, pickupQuestItem } from '../quests/track';
import { offerAt, questContact, touches } from './questModuleRules';

type View = {
  player: WorldPlayer;
  badge: ABadge;
  items: Phaser.GameObjects.Image[];
  pictured: readonly ItemId[];
  offer?: Quest;
  choice?: 'accept' | 'decline';
};

export default class QuestModule implements WorldModule {
  static order = 190;
  private ctx!: WorldContext;
  private dialog!: QuestDialog;
  private readonly views = new Map<WorldPlayer, View>();
  private offRespawn?: () => void;

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.dialog = new QuestDialog(ctx, (player, choice) => {
      const view = this.views.get(player);
      if (view?.offer) view.choice ??= choice;
    });
    for (const player of ctx.players) {
      this.views.set(player, { player, badge: new ABadge(ctx, player), items: [], pictured: [] });
    }
    this.offRespawn = ctx.bus.on('player:respawn', ({ player }) => {
      const view = this.views.get(player);
      if (view?.offer) this.close(view);
    });
  }

  update(): void {
    for (const view of this.views.values()) {
      view.badge.hide();
      this.step(view);
      view.badge.update();
      this.showCarriedItems(view);
    }
  }

  destroy(): void {
    this.offRespawn?.();
    for (const view of this.views.values()) {
      if (view.offer) this.close(view);
      view.badge.destroy();
      view.items.forEach(image => image.destroy());
    }
    this.views.clear();
    this.dialog.destroy();
  }

  private step(view: View): void {
    const { player, offer } = view;
    const { move, save, controls: { pressed } } = player;
    if (offer) {
      const choice = view.choice ?? (pressed.b || pressed.menu ? 'decline' : pressed.a ? 'accept' : undefined);
      if (!choice) return;
      pressed.a = pressed.b = pressed.x = pressed.y = pressed.menu = false;
      this.close(view);
      if (choice === 'accept') this.accept(player, offer);
      return;
    }
    if (player.busy) return;

    const { world, bus } = this.ctx;
    const plan = world.plan(world.hexAt(move.x, move.y));
    const contact = questContact(plan, move);
    const nearby = hexInset(plan.center, move) < Math.max(HUD.talkRadius, HUD.pickupHintRadius)
      ? world.hexesNear(move.x, move.y, 1).slice(1).map(coord => world.plan(coord))
      : [];
    const giverPlan = contact.giverId ? plan : nearby.find(hex => questContact(hex, move).giverId !== undefined);
    contact.giverId = giverPlan?.giver?.id;
    // Complete first so a player returning a fetch can immediately talk to the same giver.
    for (const { quest } of save.quests) {
      const next = completeQuest(save, quest.id, contact);
      if (next === save) continue;
      this.persistQuests(player, next.quests);
      this.ctx.award(player, quest.stars, quest.id, { x: move.x, y: move.y }, 'quest');
      bus.emit('quest:complete', { player, quest });
      bus.emit('ui:banner', { player, text: 'Quest done!' });
    }

    const pickup = this.fetchSpot(player, [plan, ...nearby]);
    const touchingItem = !!pickup && touches(move, pickup.spot.at, HUD.pickupRadius);
    if (pickup && touchingItem) {
      const next = pickupQuestItem(save, pickup.spot, pickup.plan.biome, player.traits);
      if (next !== save) {
        world.live(pickup.plan.coord).takenItems.add(pickup.spot.id);
        this.pickup(player, next.quests);
      }
    }

    if (giverPlan && contact.giverId) {
      view.badge.show('hand', padConnected());
      if (pressed.a) {
        pressed.a = false;
        this.talk(view, giverPlan, contact.giverId);
      }
    } else if (pickup && !touchingItem) {
      view.badge.show('hand', false);
    }
  }

  private fetchSpot(player: WorldPlayer, plans: HexPlan[]): { spot: ItemSpot; plan: HexPlan } | undefined {
    const fetches = player.save.quests.filter(({ quest, carrying }) => !carrying && quest.kind === 'fetch');
    if (!fetches.length || player.carrying.length >= player.traits.carry) return;
    let best = HUD.pickupHintRadius ** 2;
    let closest: { spot: ItemSpot; plan: HexPlan } | undefined;
    for (const plan of plans) {
      for (const spot of plan.items) {
        const distance = (player.move.x - spot.at.x) ** 2 + (player.move.y - spot.at.y) ** 2;
        if (distance > best || !fetches.some(({ quest }) => quest.item === spot.item && quest.fromBiome === plan.biome)) continue;
        if (this.ctx.world.live(plan.coord).takenItems.has(spot.id)) continue;
        best = distance;
        closest = { spot, plan };
      }
    }
    return closest;
  }

  private talk(view: View, plan: HexPlan, giverId: string): void {
    const { player } = view;
    const { save, reading } = player;
    const dropped = save.quests.find(({ quest, carrying }) => !carrying && quest.kind === 'deliver' && quest.giverId === giverId);
    if (dropped) {
      const next = pickupDelivery(save, dropped.quest.id, giverId, player.traits);
      if (next !== save) this.pickup(player, next.quests);
      else this.ctx.bus.emit('ui:banner', { player, text: 'Your ride is full.' });
      return;
    }
    if (save.quests.length >= QUEST_SLOTS[reading]) {
      this.ctx.bus.emit('ui:banner', { player, text: 'Quest list full.' });
      return;
    }
    const quest = offerAt(this.ctx.world, plan, nextQuestIndex(save, giverId));
    if (!quest || !this.dialog.show(player, quest.text[reading])) return;
    view.offer = quest;
    player.busy = true;
    view.badge.hide();
  }

  private close(view: View): void {
    view.offer = undefined;
    view.choice = undefined;
    view.player.busy = false;
    this.dialog.hide(view.player);
  }

  private accept(player: WorldPlayer, quest: Quest): void {
    const { save } = player;
    const next = acceptQuest(save, quest, player.reading, player.traits);
    if (next === save) {
      this.ctx.bus.emit('ui:banner', { player, text: 'Your ride is full.' });
      return;
    }
    save.questSeq = next.questSeq;
    this.persistQuests(player, next.quests);
    this.ctx.bus.emit('quest:accept', { player, quest });
    if (quest.kind === 'deliver') this.ctx.bus.emit('quest:pickup', { player, quest });
  }

  private pickup(player: WorldPlayer, quests: ActiveQuest[]): void {
    const picked = quests.find((active, index) => active !== player.save.quests[index]);
    this.persistQuests(player, quests);
    if (picked) this.ctx.bus.emit('quest:pickup', { player, quest: picked.quest });
  }

  private persistQuests(player: WorldPlayer, quests: ActiveQuest[]): void {
    player.save.quests = quests;
    player.carrying = quests.filter(active => active.carrying).map(active => active.quest.item);
    this.ctx.save(player);
  }

  private showCarriedItems(view: View): void {
    const { player } = view;
    const { ctx } = this;
    if (view.pictured !== player.carrying) {
      view.items.forEach(image => image.destroy());
      view.pictured = player.carrying;
      view.items = player.carrying.map(item => {
        const image = ctx.scene.add.image(0, 0, questItemTexture(ctx.scene, item)).setDepth(DEPTH.popups);
        ctx.showOnlyTo(image, player);
        return image;
      });
    }
    if (!view.items.length) return;
    const rotation = ctx.viewRotation(player), zoom = player.camera.zoom;
    const { move } = player;
    const size = HUD.carrySize / zoom, lift = HUD.carryLift / zoom;
    const sin = Math.sin(rotation), cos = Math.cos(rotation);
    view.items.forEach((image, i) => {
      const side = (i - (view.items.length - 1) / 2) * size;
      image.setPosition(move.x + side * cos - lift * sin, move.y - side * sin - lift * cos)
        .setRotation(-rotation).setDisplaySize(size, size);
    });
  }
}
