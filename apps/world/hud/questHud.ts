import type Phaser from 'phaser';
import { BUTTONS, WORLD, WORLD_QUEST_HUD as HUD } from '../config';
import { DEPTH, type WorldContext, type WorldEvents, type WorldPlayer } from '../core/runtime';
import { QUEST_SLOTS, type ActiveQuest, type Vec } from '../core/types';
import { bakeDisc, bakeIcons, bakePlate, iconKey } from './icons';
import { questTarget, targetAngle } from './questTarget';

const D = BUTTONS.depth;
const WIDTH = HUD.questCardWidth;
const HEIGHT = HUD.questCardHeights[2];
const FONT = 'Arial, sans-serif';
const CARD = 'world-tracked-quest';
const QUEST_LIST_TOP = 222;
const QUEST_LIST_HEIGHT = QUEST_SLOTS.hard * HEIGHT + (QUEST_SLOTS.hard - 1) * HUD.questCardGap;
const plateKey = (height: number) => `${CARD}:${height}`;

type Card = {
  root: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  arrow: Phaser.GameObjects.Image;
  disc: Phaser.GameObjects.Image;
  target?: Vec;
};
type Toast = { text: string; until: number };
type View = {
  x: number;
  width: number;
  stars: Phaser.GameObjects.Text;
  starPlate: Phaser.GameObjects.Image;
  banner: Phaser.GameObjects.Container;
  bannerText: Phaser.GameObjects.Text;
  empty: Phaser.GameObjects.Text;
  cards: Card[];
  quests?: ActiveQuest[];
  refreshAt: number;
  refreshFrom?: Vec;
};
type Popup = { label: Phaser.GameObjects.Text; at: Vec; player: WorldPlayer; since: number };

export class QuestHud {
  private readonly views = new Map<WorldPlayer, View>();
  private readonly banners = new Map<WorldPlayer, Toast>();
  private readonly popups: Popup[] = [];
  private readonly off: (() => void)[];

  constructor(private readonly ctx: WorldContext) {
    this.off = [
      ctx.bus.on('ui:banner', ({ player, text, seconds }) => {
        this.banners.set(player, { text, until: ctx.time + (seconds ?? HUD.bannerSeconds) });
      }),
      ctx.bus.on('ui:popup', event => this.popup(event)),
      ctx.bus.on('quest:pickup', () => {
        // Item spots are shared. A partner's pickup can move this player's arrow.
        for (const view of this.views.values()) view.refreshFrom = undefined;
      }),
      ctx.bus.on('stars:award', ({ player, at, stars }) => {
        ctx.bus.emit('ui:popup', { player, at, text: `+${stars}` });
      }),
    ];
  }

  build(scene: Phaser.Scene, touch: boolean): void {
    const width = WORLD.width / this.ctx.players.length;
    bakeIcons(scene);
    bakeDisc(scene, 'world-quest-direction', 37, 0x253b57, 0x7790ac);
    for (const height of HUD.questCardHeights) {
      bakePlate(scene, plateKey(height), WIDTH, height, 0x152640, 0.98, 24, 0x85a0bc);
    }
    bakePlate(scene, 'world-star-counter', 168, 78, 0x152640, 0.98, 24, 0xffdf66);
    bakePlate(scene, 'world-quest-banner', WIDTH, 108, 0x152640, 0.98, 24, 0xffdf66);
    for (const player of this.ctx.players) {
      const x = player.index * width;
      const starX = x + (touch ? 140 : 24);
      const starPlate = scene.add.image(starX, 24, 'world-star-counter').setOrigin(0).setDepth(D);
      scene.add.image(starX + 43, 62, iconKey('star')).setDisplaySize(60, 60).setDepth(D + 1);
      const stars = scene.add.text(starX + 81, 64, '0', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.starFont}px`, color: '#fff8df',
      }).setOrigin(0, 0.5).setDepth(D + 1);
      const bannerText = scene.add.text(0, 0, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.questFont}px`, color: '#fff8df', align: 'center',
        wordWrap: { width: WIDTH - 56, useAdvancedWrap: true },
      }).setOrigin(0.5);
      const banner = scene.add.container(x + width / 2, 906, [
        scene.add.image(0, 0, 'world-quest-banner'), bannerText,
      ]).setDepth(D).setVisible(false);
      const empty = scene.add.text(x + width / 2, WORLD.height / 2, 'No quests yet.', {
        fontFamily: FONT, fontSize: `${HUD.questFont}px`, color: '#fff8df',
      }).setOrigin(0.5).setDepth(D + 4).setVisible(false);
      const cards = Array.from({ length: QUEST_SLOTS.hard }, (): Card => {
        const plate = scene.add.image(0, 0, plateKey(HEIGHT)).setOrigin(0);
        const disc = scene.add.image(WIDTH - 66, HEIGHT / 2, 'world-quest-direction');
        const arrow = scene.add.image(disc.x, disc.y, iconKey('direction')).setDisplaySize(61, 61);
        const text = scene.add.text(24, HEIGHT / 2, '', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.questFont}px`, color: '#fff8df',
          wordWrap: { width: WIDTH - 145, useAdvancedWrap: true },
        }).setOrigin(0, 0.5);
        const root = scene.add.container(0, 0, [plate, text, disc, arrow]).setVisible(false);
        return { root, plate, text, disc, arrow };
      });
      this.views.set(player, { x, width, stars, starPlate, banner, bannerText, empty, cards, refreshAt: 0 });
    }
  }

  updatePlayer(player: WorldPlayer, cardState: 'closed' | 'pause' | 'lab' | 'quests'): void {
    const view = this.views.get(player);
    if (!view) return;
    const { time, world } = this.ctx;
    const { quests, stars } = player.save;
    const value = String(stars);
    if (view.stars.text !== value) {
      view.stars.setText(value);
      view.starPlate.displayWidth = Math.max(168, 111 + view.stars.width);
    }
    const open = cardState === 'quests';
    const visible = open || (cardState === 'closed' && !player.busy);
    view.empty.setVisible(open && !quests.length);
    const banner = this.banners.get(player);
    if (banner && time >= banner.until) this.banners.delete(player);
    const showBanner = !!banner && time < banner.until && cardState === 'closed' && !player.busy;
    view.banner.setVisible(showBanner);
    if (showBanner && view.bannerText.text !== banner.text) view.bannerText.setText(banner.text);

    const { move } = player;
    const searched = view.refreshFrom;
    const moved = !!searched && Math.hypot(searched.x - move.x, searched.y - move.y) >= HUD.targetRefreshDistance;
    const refresh = visible && (view.quests !== quests || !searched || (moved && time >= view.refreshAt));
    if (refresh) {
      view.refreshAt = time + HUD.targetRefreshSeconds;
      view.refreshFrom = { x: move.x, y: move.y };
      view.quests = quests;
    }
    const rotation = this.ctx.viewRotation(player);
    const openHeight = quests.length * HEIGHT + Math.max(quests.length - 1, 0) * HUD.questCardGap;
    let y = open ? QUEST_LIST_TOP + (QUEST_LIST_HEIGHT - openHeight) / 2 : 126;
    view.cards.forEach((card, index) => {
      const active = quests[index];
      card.root.setVisible(visible && !!active);
      if (!visible || !active) return;
      if (refresh) card.target = questTarget(world, player.move, player.profileId, active);
      const text = active.quest.text[player.reading];
      if (card.text.text !== text) card.text.setText(text);
      const height = open ? HEIGHT : HUD.questCardHeights.find(height => height >= card.text.height + 24) ?? HEIGHT;
      card.plate.setTexture(plateKey(height));
      card.text.y = card.arrow.y = card.disc.y = height / 2;
      card.root.setDepth(open ? D + 4 : D).setPosition(
        open ? view.x + (view.width - WIDTH) / 2 : view.x + 24,
        y,
      );
      y += height + HUD.questCardGap;
      card.disc.setVisible(!!card.target);
      card.arrow.setVisible(!!card.target);
      if (card.target) card.arrow.setRotation(targetAngle(player.move, card.target, rotation));
    });
  }

  update(): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const { label, at, player, since } = this.popups[i];
      const progress = (this.ctx.time - since) / HUD.popupSeconds;
      if (progress >= 1) {
        label.destroy();
        this.popups.splice(i, 1);
        continue;
      }
      const rotation = this.ctx.viewRotation(player);
      const zoom = player.camera.zoom;
      const rise = (HUD.popupLift + HUD.popupRise * progress) / zoom;
      label.setPosition(at.x - rise * Math.sin(rotation), at.y - rise * Math.cos(rotation))
        .setRotation(-rotation).setScale(1 / zoom).setAlpha(Math.min(1, 2 * (1 - progress)));
    }
  }

  destroy(): void {
    this.off.forEach(off => off());
    this.popups.forEach(({ label }) => label.destroy());
    this.popups.length = 0;
    this.views.clear();
    this.banners.clear();
  }

  private popup({ at, text, player }: WorldEvents['ui:popup']): void {
    if (!/^[+-]\d+$/.test(text)) return;
    for (const viewer of player ? [player] : this.ctx.players) {
      const label = this.ctx.scene.add.text(at.x, at.y, text, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.starFont}px`, color: '#ffdf66', stroke: '#152640', strokeThickness: 9,
      }).setOrigin(0.5).setDepth(DEPTH.popups);
      this.ctx.showOnlyTo(label, viewer);
      this.popups.push({ label, at: { ...at }, player: viewer, since: this.ctx.time });
    }
  }
}
