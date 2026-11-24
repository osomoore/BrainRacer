/**
 * room: the workshop. The player's model stands in the middle, ten station signs ring the edges, the challenge board
 * hangs bottom-center. Picking a destination (pad focus + A, keyboard, or a tap) makes the little character walk
 * there, then the station / board screen opens. B goes back to the workshop picker.
 */
import type Phaser from 'phaser';
import { WS_ROOM } from '../config';
import type { ModelRig, PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { cardColor } from '../ui/screenChrome';
import { COLORS, makeText } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { Character } from './room/Character';
import { aspectIconTexture, bubbleTexture, starTexture } from './room/icons';
import { currentProgress } from './room/progress';
import { dist, roomLayout, standOf, type Point } from './room/layout';

const roomScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let group: FocusGroup;
  let character: Character | undefined;
  let rig: ModelRig | undefined;
  let busy = false;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];

  const walkThen = (stand: Point, then: () => void) => {
    if (busy || !character) return;
    busy = true;
    if (dist(character.position, stand) < 2) { then(); return; }
    character.walkTo(stand, then);
  };

  return {
    create(c, data) {
      ctx = c;
      const ws = ctx.workshop ?? 'race';
      const scene = ctx.scene;
      ctx.audio.music(ws === 'race' ? 'raceShop' : 'dinoLab');
      const progress = currentProgress(ctx, ws);
      const cat = engine.catalog(ws);
      const L = roomLayout(ctx.layout, cat.aspects.map((a) => a.id));

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
      const s = Math.min(WS_ROOM.modelScale[ctx.layout], L.model.maxW / Math.max(1, rig.width), L.model.maxH / Math.max(1, rig.height));
      objs.push(scene.add.ellipse(L.model.x, L.model.groundY + 6, Math.min(L.model.maxW, rig.width * s * 1.05), 40, 0x000000, 0.22).setDepth(90));
      rig.root.setPosition(L.model.x, L.model.groundY).setScale(s).setDepth(100);
      rig.play('idle');

      // stations
      const signs: Button[] = [];
      L.stations.forEach((st, i) => {
        const def = cat.aspects.find((a) => a.id === st.aspect)!;
        const b = new Button(scene, { x: st.x, y: st.y, w: st.w, h: st.h, color: cardColor(i), onClick: () => {
          ctx.audio.sfx('select');
          walkThen(st.stand, () => ctx.go('station', { aspect: st.aspect }));
        } });
        const icon = scene.add.image(0, -36, aspectIconTexture(scene, ws, st.aspect)).setScale(0.85);
        const label = makeText(scene, 0, 52, def.label, { size: 44, color: COLORS.ink });
        b.add([icon, label]);
        signs.push(b);
      });

      // challenge board
      const board = new Button(scene, {
        x: L.board.x, y: L.board.y, w: L.board.w, h: L.board.h, color: COLORS.yellow,
        label: 'Test', fontSize: 64,
        onClick: () => {
          ctx.audio.sfx('select');
          walkThen(L.board.stand, () => ctx.go('board'));
        },
      });
      const starL = scene.add.image(-L.board.w / 2 + 52, 0, starTexture(scene, 64)).setAngle(-12);
      const starR = scene.add.image(L.board.w / 2 - 52, 0, starTexture(scene, 64)).setAngle(12);
      board.add([starL, starR]);
      objs.push(...signs, board);

      // character
      const player = ctx.index === 0 ? COLORS.p1 : COLORS.p2;
      character = new Character(scene, player, standOf(L, data.from), () => ctx.audio.sfx('step', { volume: 0.5 }));
      objs.push(character.root);

      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      group.set([...signs, board]);
      const from = data.from;
      const fi = L.stations.findIndex((st) => st.aspect === from);
      group.focus(fi >= 0 ? signs[fi] : board);
    },
    update(dt) {
      character?.update(dt);
      const actions = ctx.input.poll();
      if (busy) return;
      for (const a of actions) {
        if (a === 'back') { ctx.audio.sfx('back'); ctx.go('pickWorkshop'); return; }
        group.handle(a);
      }
    },
    destroy() {
      group?.destroy();
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
