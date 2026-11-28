import type Phaser from 'phaser';
import { BUTTONS, WORLD, WORLD_CARRY_HUD as CARRY, WORLD_QUEST_HUD as HUD } from '../config';
import { DEPTH, type WorldContext, type WorldEvents, type WorldPlayer } from '../core/runtime';
import { QUEST_SLOTS, type ItemId, type Vec } from '../core/types';
import { bakeIcons, bakePlate, iconKey } from './icons';
import { questItemTexture } from './questItemArt';
import { itemDisplayName } from './interactionNames';

const D = BUTTONS.depth;
const WIDTH = HUD.questCardWidth;
const HEIGHT = HUD.questCardHeights[2];
const FONT = 'Arial, sans-serif';
const CARD = 'world-tracked-quest';
const QUEST_LIST_TOP = 222;
const QUEST_LIST_HEIGHT = 542;
const PICKER_Y = 672;
const plateKey = (height: number) => `${CARD}:${height}`;

type Card = {
  root: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
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
  picker: Phaser.GameObjects.Container;
  pageLabel: Phaser.GameObjects.Text;
  page: number;
  pages: number;
  carry: Phaser.GameObjects.Container;
  carried: readonly ItemId[];
  carryKind?: 'car' | 'dino';
};
type Popup = { label: Phaser.GameObjects.Text; at: Vec; player: WorldPlayer; since: number };

export class QuestHud {
  private scene!: Phaser.Scene;
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
      ctx.bus.on('stars:award', ({ player, at, stars }) => {
        ctx.bus.emit('ui:popup', { player, at, text: `+${stars}` });
      }),
    ];
  }

  build(scene: Phaser.Scene, touch: boolean): void {
    this.scene = scene;
    const width = WORLD.width / this.ctx.players.length;
    bakeIcons(scene);
    bakePlate(scene, 'world-quest-picker', 140, BUTTONS.card.minTap, 0x284666, 1, 24);
    for (const height of HUD.questCardHeights) {
      bakePlate(scene, plateKey(height), WIDTH, height, 0x152640, 0.98, 24, 0x85a0bc);
    }
    bakePlate(scene, 'world-star-counter', 168, 78, 0x152640, 0.98, 24, 0xffdf66);
    bakePlate(scene, 'world-quest-banner', WIDTH, 108, 0x152640, 0.98, 24, 0xffdf66);
    bakePlate(scene, 'world-carry-chip', CARRY.carryChipWidth, CARRY.carryChipHeight, 0x152640, 0.98, 22, 0xffdf66);
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
        const text = scene.add.text(24, HEIGHT / 2, '', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.questFont}px`, color: '#fff8df',
          wordWrap: { width: WIDTH - 48, useAdvancedWrap: true },
        }).setOrigin(0, 0.5);
        const root = scene.add.container(0, 0, [plate, text]).setVisible(false);
        return { root, plate, text };
      });
      const picker = scene.add.container(x + width / 2, PICKER_Y).setDepth(D + 4).setVisible(false);
      const pickerText = (at: number, text: string) => scene.add.text(at, 0, text, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: `${HUD.questFont}px`, color: '#fff8df',
      }).setOrigin(0.5);
      const pageLabel = pickerText(0, '');
      picker.add(pageLabel);
      for (const dir of [-1, 1] as const) {
        const at = dir * 160;
        const button = scene.add.image(at, 0, 'world-quest-picker').setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => { if (picker.visible) this.cycle(player, dir); });
        picker.add([button, pickerText(at, dir < 0 ? '‹' : '›')]);
      }
      const carry = scene.add.container(x + width - 24, CARRY.carryChipY).setDepth(D + 2).setVisible(false);
      this.views.set(player, { x, width, stars, starPlate, banner, bannerText, empty, cards, picker, pageLabel, page: 0, pages: 0,
        carry, carried: [] });
    }
  }

  updatePlayer(player: WorldPlayer, cardState: 'closed' | 'pause' | 'lab' | 'quests'): void {
    const view = this.views.get(player);
    if (!view) return;
    const { time } = this.ctx;
    const { quests, stars } = player.save;
    this.updateCarry(player, view, cardState);
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

    const heights = quests.map(({ quest }, index) => {
      const card = view.cards[index];
      const text = quest.text[player.reading];
      if (card.text.text !== text) card.text.setText(text);
      return HUD.questCardHeights.find(height => height >= card.text.height + 20) ?? HEIGHT;
    });
    const listHeight = heights.reduce((sum, height) => sum + height, 0) + Math.max(quests.length - 1, 0) * HUD.questCardGap;
    view.pages = open && listHeight > QUEST_LIST_HEIGHT ? quests.length : 0;
    if (!view.pages || view.page >= view.pages) view.page = 0;
    view.picker.setVisible(view.pages > 0);
    if (view.pages) view.pageLabel.setText(`${view.page + 1} / ${view.pages}`);
    let y = open ? QUEST_LIST_TOP + (QUEST_LIST_HEIGHT - listHeight) / 2 : 126;
    view.cards.forEach((card, index) => {
      const height = heights[index];
      const show = visible && height !== undefined && (!view.pages || view.page === index);
      card.root.setVisible(show);
      if (!show) return;
      card.plate.setTexture(plateKey(height));
      card.text.y = height / 2;
      card.root.setDepth(open ? D + 4 : D).setPosition(
        open ? view.x + (view.width - WIDTH) / 2 : view.x + 24,
        view.pages ? QUEST_LIST_TOP + (PICKER_Y - QUEST_LIST_TOP - BUTTONS.card.minTap / 2 - height) / 2 : y,
      );
      y += height + HUD.questCardGap;
    });
  }

  private updateCarry(player: WorldPlayer, view: View, cardState: 'closed' | 'pause' | 'lab' | 'quests'): void {
    const items = player.carrying;
    if (items !== view.carried || player.traits.kind !== view.carryKind) {
      view.carried = items;
      view.carryKind = player.traits.kind;
      view.carry.removeAll(true);
      if (items.length) {
        const header = player.traits.kind === 'dino' ? 'On the Dino' : 'In the Car';
        const title = this.scene.add.text(-CARRY.carryChipWidth / 2, 8, header, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: `${CARRY.carryFont}px`, color: '#fff8df', align: 'center',
          wordWrap: { width: CARRY.carryChipWidth - 20, useAdvancedWrap: true },
        }).setOrigin(0.5, 0);
        view.carry.add(title);
        let y = 12 + title.height;
        items.forEach(item => {
          const text = this.scene.add.text(-CARRY.carryChipWidth + 55, y, itemDisplayName(item), {
            fontFamily: FONT, fontStyle: 'bold', fontSize: `${CARRY.carryFont}px`, color: '#ffffff',
            wordWrap: { width: CARRY.carryChipWidth - 68, useAdvancedWrap: true },
          }).setOrigin(0, 0);
          const height = Math.max(42, text.height);
          const icon = this.scene.add.image(-CARRY.carryChipWidth + 30, y + height / 2, questItemTexture(this.scene, item))
            .setDisplaySize(42, 42);
          view.carry.add([icon, text]);
          y += height + 6;
        });
        const height = Math.max(CARRY.carryChipHeight, y + 4);
        const plate = this.scene.add.image(0, 0, 'world-carry-chip').setOrigin(1, 0)
          .setDisplaySize(CARRY.carryChipWidth, height);
        view.carry.addAt(plate, 0);
      }
    }
    view.carry.setVisible(items.length > 0 && cardState === 'closed' && !player.busy);
  }

  cycle(player: WorldPlayer, dir: -1 | 1): boolean {
    const view = this.views.get(player);
    if (!view?.pages) return false;
    view.page = (view.page + dir + view.pages) % view.pages;
    return true;
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
