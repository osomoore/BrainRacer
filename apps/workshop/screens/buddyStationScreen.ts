/** Buddy station: choose an owned companion for this workshop. */
import type Phaser from 'phaser';
import { animateBuddyIdle, bakeBuddyTextures, BUDDY_KINDS, buddyName, buddyTexture, type BuddyKind } from '../../../shared/buddies';
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { playWorkshopSfx } from '../audio';
import { engine } from '../logic';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { cardColor } from '../ui/screenChrome';
import { COLORS, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { currentProgress } from './room/progress';

const BAND = 0x232a66;

const buddyStationScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let group: FocusGroup;
  let busy = false;
  let page = 0;
  const objs: Phaser.GameObjects.GameObject[] = [];
  let cards: Button[] = [];
  let pager: Pager | undefined;
  let back: Button | undefined;

  const returnRoom = () => {
    if (busy) return;
    busy = true;
    ctx.audio.sfx('back');
    ctx.go('room', { from: 'buddies' });
  };

  return {
    create(c) {
      ctx = c;
      const scene = ctx.scene;
      const ws = ctx.workshop ?? 'race';
      const progress = currentProgress(ctx, ws);
      const size = ctx.size;
      const wide = ctx.layout === 'wide';
      const pageSize = wide ? 5 : 3;
      const cardW = wide ? 300 : 280;
      const cardH = wide ? 350 : 400;
      const cardY = wide ? 565 : 610;
      const gapX = 24;
      const bg = roomBackdrop(scene, ws, ctx.layout, 713);
      objs.push(scene.add.image(0, 0, bg.key).setOrigin(0).setDepth(-900));
      objs.push(scene.add.rectangle(0, 0, size.w, size.h, 0xffffff, 0.5).setOrigin(0).setDepth(-800));
      const bandH = wide ? 215 : 360;
      objs.push(scene.add.image(size.w / 2, bandH, roundedTexture(scene, size.w + 60, bandH + 56, BAND, { radius: 36, shadow: 0, strokeW: 0, gloss: false })).setOrigin(0.5, 1).setDepth(5));
      objs.push(makeText(scene, size.w / 2, wide ? 62 : 245, 'Buddy Station', { size: wide ? 76 : 64, color: COLORS.paper, stroke: COLORS.ink }).setDepth(8));
      bakeBuddyTextures(scene);
      ctx.audio.music(ws === 'race' ? 'raceShop' : 'dinoLab');

      const ownedKinds = BUDDY_KINDS.filter((kind) => progress.buddies.unlocked.includes(kind));
      const pageCount = Math.ceil(ownedKinds.length / pageSize);
      const selectBuddy = (kind: BuddyKind) => {
        if (busy) return;
        busy = true;
        const updated = engine.setBuddy(progress, kind);
        const save = ctx.save();
        ctx.commit({ ...save, workshops: { ...save.workshops, [ws]: updated } });
        playWorkshopSfx(ctx.audio, 'equip');
        ctx.go('room', { from: 'buddies' });
      };

      const drawPage = (newPage: number, focusKind: BuddyKind) => {
        page = newPage;
        group.set([]);
        cards.forEach((b) => b.destroy());
        cards = [];
        const kinds = ownedKinds.slice(page * pageSize, (page + 1) * pageSize);
        kinds.forEach((kind, local) => {
          const x = size.w / 2 + (local - (kinds.length - 1) / 2) * (cardW + gapX);
          const chosen = progress.buddies.selected === kind;
          const card = new Button(scene, {
            x, y: cardY, w: cardW, h: cardH,
            color: chosen ? 0xffe08a : cardColor(page * pageSize + local),
            onClick: () => selectBuddy(kind),
          });
          card.setDepth(12);
          const sprite = scene.add.image(0, -cardH * 0.15, buddyTexture(kind));
          const scale = Math.min(cardW * 0.42 / sprite.width, cardH * 0.46 / sprite.height);
          sprite.setScale(scale);
          card.add(sprite);
          animateBuddyIdle(scene, sprite);
          const label = makeText(scene, 0, cardH * 0.28, buddyName(kind), { size: 40, color: COLORS.ink, wrap: cardW - 22 });
          card.add(label);
          if (chosen) {
            const chipY = -cardH / 2 + 35;
            card.add([
              scene.add.image(0, chipY, roundedTexture(scene, 190, 54, COLORS.green, { radius: 26, shadow: 0, strokeW: 3, gloss: false })).setOrigin(0.5, roundedOriginY(54, 0)),
              makeText(scene, 0, chipY, 'Selected', { size: 40, color: COLORS.ink }),
            ]);
          }
          cards.push(card);
        });

        group.set([...cards, ...(pager?.buttons ?? []), ...(back ? [back] : [])]);
        group.focus(cards[Math.max(0, kinds.indexOf(focusKind))]);
      };
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      const navY = size.h - 90;
      back = new Button(scene, { x: wide ? 150 : 130, y: navY, w: 210, h: 100, label: 'Back', fontSize: 48, color: 0xffb3b3, onClick: returnRoom }).setDepth(15);
      const startPage = Math.floor(ownedKinds.indexOf(progress.buddies.selected) / pageSize);
      pager = new Pager(scene, { x: size.w / 2, y: navY, pages: pageCount, page: startPage, gap: wide ? 145 : 90, onChange: (target) => {
        const focusAt = target > page ? 0 : pageSize - 1;
        drawPage(target, ownedKinds[target * pageSize + focusAt]);
      } });
      drawPage(startPage, progress.buddies.selected);
    },
    update() {
      if (busy) return;
      for (const action of ctx.input.poll()) {
        if (action === 'back') returnRoom();
        else group.handle(action);
      }
    },
    destroy() {
      group?.destroy();
      cards.forEach((b) => b.destroy());
      pager?.destroy(); back?.destroy();
      objs.forEach((o) => { if (o.scene) o.destroy(); });
      objs.length = 0;
    },
  };
};

export default buddyStationScreen;
