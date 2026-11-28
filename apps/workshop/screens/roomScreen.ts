/**
 * room: the workshop. The player's model and buddy stand in the middle, station signs ring the room, the challenge board
 * hangs bottom-center. Picking a destination (pad focus + A, keyboard, or a tap) makes the little character walk
 * there, then the station / board screen opens. B goes back to the workshop picker.
 */
import type Phaser from 'phaser';
import { animateBuddyIdle, bakeBuddyTextures } from '../../../shared/buddies';
import { playWorkshopSfx } from '../audio';
import { WS_BUDDIES, WS_UI } from '../config';
import type { ModelRig, PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { visibleAspectIds } from '../logic/aspects';
import { Button } from '../ui/Button';
import { Confirm } from '../ui/Confirm';
import { FocusGroup } from '../ui/FocusGroup';
import { addTouchBackButton, cardColor } from '../ui/screenChrome';
import { COLORS, makeText } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { buddyBar, buddyCelebration, buddyImage, flyBuddy } from './room/buddyDisplay';
import { perchFor } from './room/buddyFlight';
import { Character } from './room/Character';
import { aspectIconTexture, bubbleTexture, starTexture } from './room/icons';
import { currentProgress } from './room/progress';
import { dist, roomLayout, standOf, type Point } from './room/layout';
import { isBackGuarded } from './backGuard';
import { shell } from '../shell/shell';
import { goToWorld } from '../shell/worldSwap';
import { roomReferenceFit } from './modelFit';

const roomScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let group: FocusGroup;
  let character: Character | undefined;
  let rig: ModelRig | undefined;
  let celebration: Phaser.GameObjects.Container | undefined;
  let celebrationTimer: Phaser.Time.TimerEvent | undefined;
  let updateBuddyFocus: (() => void) | undefined;
  let buddyTween: Phaser.Tweens.Tween | undefined;
  let busy = false;
  let popup: Confirm | undefined;
  let requestLeave: () => void = () => {};
  const objs: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];

  const walk = (stand: Point, then: () => void) => {
    if (!character) return;
    if (dist(character.position, stand) < 2) { then(); return; }
    character.walkTo(stand, then);
  };

  const walkThen = (stand: Point, then: () => void) => {
    if (busy) return;
    busy = true;
    ctx.audio.sfx('select');
    walk(stand, then);
  };

  const goToPicker = () => {
    if (busy) return;
    busy = true;
    popup = undefined;
    ctx.audio.sfx('back');
    ctx.go('pickWorkshop');
  };

  return {
    create(c, data) {
      ctx = c;
      const ws = ctx.workshop ?? 'race';
      const scene = ctx.scene;
      ctx.audio.music(ws === 'race' ? 'raceShop' : 'dinoLab');
      const progress = currentProgress(ctx, ws);
      const cat = engine.catalog(ws);
      const L = roomLayout(ctx.layout, visibleAspectIds(cat, progress));
      bakeBuddyTextures(scene);

      const bg = roomBackdrop(scene, ws, ctx.layout, L.floorY);
      objs.push(scene.add.image(0, 0, bg.key).setOrigin(0).setDepth(-900));
      const bubble = bubbleTexture(scene);
      for (const t of bg.tanks) {
        // two bubbles per tank (each looping tween costs per-frame work, and the 2P room runs two scenes)
        for (let i = 0; i < 2; i++) {
          const img = scene.add.image(t.x + 20 + ((i * 74) % Math.max(20, t.w - 40)), t.y + t.h - 60, bubble).setDepth(-800).setScale(0.5 + ((i * 2) % 3) * 0.2).setAlpha(0);
          objs.push(img);
          tweens.push(scene.tweens.add({ targets: img, y: t.y + t.h * 0.34, alpha: { from: 0.9, to: 0 }, duration: 1800 + i * 700, delay: i * 1040, repeat: -1 }));
        }
      }

      // model
      rig = ctx.buildRig(scene, ws, progress.model, 'side');
      const largestModel = { ...progress.model, size: ws === 'dino' ? 'size.huge' : 'size.big' };
      const largestRig = ctx.buildRig(scene, ws, largestModel, 'side');
      const largestBounds = largestRig.root.getBounds();
      largestRig.destroy();
      // The root is grounded at y=0, so clamp by the silhouette's height above that anchor.
      const referenceBounds = { x: largestBounds.x, y: largestBounds.y, width: largestBounds.width, height: largestBounds.height };
      const roomFit = roomReferenceFit(referenceBounds, L, ctx.layout, ws, ctx.input.touch);
      const s = roomFit.scale;
      objs.push(scene.add.ellipse(L.model.x, L.model.groundY + 6, Math.min(roomFit.width, rig.width * s * 1.05), 40, 0x000000, 0.22).setDepth(90));
      rig.root.setPosition(L.model.x, L.model.groundY).setScale(s).setDepth(100);
      rig.play('idle');
      const home = { x: L.buddy.x, y: L.buddy.y - L.buddy.size / 2 };
      const buddy = buddyImage(scene, progress.buddies.selected, home.x, home.y, L.buddy.size);
      const buddyPose = { ...home, angle: 0 };
      objs.push(buddy.setDepth(110).setName('workshop-buddy'), buddyBar(scene, L.buddyBar, progress.buddies));
      animateBuddyIdle(scene, buddy, buddyPose);
      // Keep the wing animation, but leave position and heading to the path while the buddy moves.
      const applyMovingPose = () => {
        if (buddyTween?.isPlaying()) buddy.setPosition(buddyPose.x, buddyPose.y).setAngle(buddyPose.angle);
      };
      scene.events.on('postupdate', applyMovingPose);
      buddy.once('destroy', () => scene.events.off('postupdate', applyMovingPose));
      const drift = (at: Point, lean = 0, pointAt?: Point) => {
        buddyTween?.remove();
        buddyTween = flyBuddy(scene, buddy, buddyPose, at, pointAt ? { pointAt } : { endAngle: lean, endFlipX: lean < 0 ? true : undefined });
      };
      const allTiles = [...L.stations, L.buddyStation, L.board];
      const peekAt = (st: { x: number; y: number; w: number; h: number }) => drift(perchFor(st, L.size, L.buddy.size, allTiles), 0, { x: st.x, y: st.y });
      const peekBoard = () => peekAt(L.board);

      // stations
      const signs: Button[] = [];
      L.stations.forEach((st, i) => {
        const def = cat.aspects.find((a) => a.id === st.aspect)!;
        const b = new Button(scene, { x: st.x, y: st.y, w: st.w, h: st.h, color: cardColor(i), onClick: () => {
          if (busy) return;
          peekAt(st);
          walkThen(st.stand, () => ctx.go('station', { aspect: st.aspect }));
        } }).setDepth(130);
        const icon = scene.add.image(0, -36, aspectIconTexture(scene, ws, st.aspect)).setScale(0.85);
        const label = makeText(scene, 0, 52, def.label, { size: 44, color: COLORS.ink });
        b.add([icon, label]);
        signs.push(b);
      });
      const buddies = new Button(scene, { ...L.buddyStation, color: cardColor(signs.length), onClick: () => {
        if (busy) return;
        peekAt(L.buddyStation);
        walkThen(L.buddyStation.stand, () => ctx.go('buddyStation'));
      } }).setDepth(130);
      buddies.add([
        buddyImage(scene, 'dino', 0, -24, 58),
        makeText(scene, 0, 34, 'Buddies', { size: 44, color: COLORS.ink }),
      ]);

      // challenge board
      const board = new Button(scene, {
        x: L.board.x, y: L.board.y, w: L.board.w, h: L.board.h, color: COLORS.yellow,
        label: 'Test', fontSize: 64,
        onClick: () => {
          if (busy) return;
          busy = true;
          ctx.audio.sfx('boing', { volume: 0.55, rate: 1.3 });
          buddyTween?.remove();
          buddyTween = scene.tweens.add({
            targets: buddyPose, y: buddyPose.y - L.buddy.size * 0.55, angle: -12,
            duration: WS_BUDDIES.hopMs, ease: 'Quad.easeOut', yoyo: true,
            onComplete: () => {
              playWorkshopSfx(ctx.audio, 'land', { volume: 0.45, rate: 1.2 });
              walk(L.board.stand, () => ctx.go('board'));
            },
          });
        },
      }).setDepth(130);
      const starL = scene.add.image(-L.board.w / 2 + 52, 0, starTexture(scene, 64)).setAngle(-12);
      const starR = scene.add.image(L.board.w / 2 - 52, 0, starTexture(scene, 64)).setAngle(12);
      board.add([starL, starR]);
      objs.push(...signs, buddies, board);

      // character
      const player = ctx.index === 0 ? COLORS.p1 : COLORS.p2;
      character = new Character(scene, player, standOf(L, data.from), () => ctx.audio.sfx('step', { volume: 0.5 }));
      objs.push(character.root);

      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      const fromWorld = new URLSearchParams(location.search).get('from') === 'world';
      const swap = () => {
        if (busy || popup) return;
        if (shell.count < 2) { goToWorld(); return; }
        popup = new Confirm(scene, {
          cx: ctx.size.w / 2, cy: ctx.size.h / 2, w: Math.min(ctx.size.w - 80, 900),
          text: 'Take both players to the World?', yes: 'Yes', no: 'No', defaultYes: true,
          audio: ctx.audio, touch: ctx.input.touch, depth: 500,
          onYes: () => { popup = undefined; goToWorld(); },
          onNo: () => { popup = undefined; },
        });
      };
      const wb = WS_UI.worldButton;
      const returnButton = addTouchBackButton(scene, swap,
        { x: ctx.layout === 'tall' ? ctx.size.w - wb.w / 2 - 20 : ctx.size.w - 180, y: ctx.layout === 'tall' ? wb.y - 10 : wb.y, w: wb.w, h: wb.h, fontSize: wb.fontSize },
        fromWorld ? 'Back to World' : 'Go to World').setDepth(140);
      objs.push(returnButton);
      group.set([...signs, buddies, board, returnButton]);
      const from = data.from;
      const fi = L.stations.findIndex((st) => st.aspect === from);
      group.focus(from === 'buddies' ? buddies : fi >= 0 ? signs[fi] : board);
      const stops = [...L.stations, L.buddyStation];
      const stationButtons = [...signs, buddies];
      let lastFocus: Button | undefined;
      updateBuddyFocus = () => {
        const focused = group.focused;
        if (focused === lastFocus) return;
        lastFocus = focused;
        if (focused === board) { peekBoard(); return; }
        const st = focused && stops[stationButtons.indexOf(focused)];
        if (!st) { drift(home); return; }
        peekAt(st);
      };
      if (data.partChanged) {
        lastFocus = group.focused;
        drift({ x: L.model.x + rig.width * s / 2 + L.buddy.size * 0.25, y: home.y - L.buddy.size * 0.25 }, -24);
      } else {
        updateBuddyFocus();
      }

      const celebrateNext = () => {
        const kind = ctx.takeBuddyUnlock(ws);
        if (!kind) return;
        celebration = buddyCelebration(scene, L.model.x, 430, kind);
        ctx.audio.sting('unlock');
        celebrationTimer = scene.time.delayedCall(WS_BUDDIES.celebrationMs, () => {
          celebration?.destroy();
          celebration = undefined;
          celebrationTimer = undefined;
          celebrateNext();
        });
      };
      celebrateNext();

      const leave = () => {
        if (popup) return;
        popup = new Confirm(scene, {
          cx: ctx.size.w / 2, cy: ctx.size.h / 2, w: Math.min(ctx.size.w - 80, 900),
          text: 'Leave the workshop?', yes: 'Yes', no: 'No', defaultYes: false,
          audio: ctx.audio, touch: ctx.input.touch, depth: 500,
          onYes: goToPicker,
          onNo: () => { popup = undefined; },
        });
      };
      requestLeave = leave;
      if (ctx.input.touch) {
        objs.push(addTouchBackButton(scene, goToPicker, WS_UI.roomBack).setDepth(140));
      }
    },
    update(dt) {
      character?.update(dt);
      const actions = ctx.input.poll();
      if (busy) return;
      if (popup) {
        for (const a of actions) popup?.handle(a);
        return;
      }
      for (const a of actions) {
        if (a === 'back') {
          if (isBackGuarded(ctx, ctx.scene.time.now)) continue;
          requestLeave();
          return;
        }
        if (a === 'confirm') {
          const target = group.focused;
          if (target?.isEnabled) {
            target.pulse();
            target.activate();
          }
          return;
        }
        group.handle(a);
      }
      if (!busy) updateBuddyFocus?.();
    },
    destroy() {
      group?.destroy();
      popup?.destroy();
      popup = undefined;
      requestLeave = () => {};
      celebrationTimer?.remove(false);
      celebration?.destroy();
      buddyTween?.remove();
      updateBuddyFocus = undefined;
      tweens.forEach((t) => t.remove());
      tweens.length = 0;
      rig?.destroy();
      rig = undefined;
      character = undefined;
      objs.forEach((o) => { if (o.scene) o.destroy(); });
      objs.length = 0;
    },
  };
};

export default roomScreen;
