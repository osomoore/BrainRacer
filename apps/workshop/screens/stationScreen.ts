/**
 * station: the configuration menu for ONE aspect (data.aspect). The camera zooms on that part of the model; a strip
 * of swatches scrolls through every available variant and the model previews the highlighted one live. A (or the
 * "Use it!" button) installs it, saves, sparkles and returns to the room; B returns without changing anything.
 */
import type Phaser from 'phaser';
import { WS_ROOM } from '../config';
import type { ModelRig, PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { Button } from '../ui/Button';
import { promptLabel } from '../ui/input';
import { cardColor } from '../ui/screenChrome';
import { COLORS, fitText, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { aspectIconTexture, starTexture } from './room/icons';
import { roomLayout } from './room/layout';
import { currentProgress } from './room/progress';
import { cameraTarget, clampIndex, stationLayout, stripXs, windowStart, withVariant } from './station/layout';
import { swatchTexture } from './station/swatch';

const BAND = 0x232a66;

const stationScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  let timer: Phaser.Time.TimerEvent | undefined;
  let rig: ModelRig | undefined;
  let busy = false;
  let moveBy: (d: number) => void = () => {};
  let doApply: () => void = () => {};
  let doLeave: () => void = () => {};

  return {
    create(c, data) {
      ctx = c;
      const scene = ctx.scene;
      const ws = ctx.workshop ?? 'race';
      const aspect = data.aspect ?? engine.catalog(ws).aspects[0].id;
      const cat = engine.catalog(ws);
      const aspectDef = cat.aspects.find((a) => a.id === aspect) ?? cat.aspects[0];
      const progress = currentProgress(ctx, ws);
      const options = engine.availableFor(ws, progress, aspect);
      const installed = progress.model[aspect];
      const nameOf = (id: string) => cat.variants.find((v) => v.id === id)?.name ?? id;
      let index = Math.max(0, options.indexOf(installed));
      const L = stationLayout(ctx.layout);
      const RL = roomLayout(ctx.layout, cat.aspects.map((a) => a.id));
      ctx.audio.music(ws === 'race' ? 'raceShop' : 'dinoLab');

      // ---- world: room backdrop + model, zoomed like a camera
      const world = scene.add.container(0, 0).setDepth(-500);
      objs.push(world);
      const bg = roomBackdrop(scene, ws, ctx.layout, RL.floorY);
      world.add(scene.add.image(0, 0, bg.key).setOrigin(0));
      rig = ctx.buildRig(scene, ws, progress.model, 'side');
      const setStationPreviewAlpha = () => {
        if (ws !== 'race' || aspect !== 'springs') return;
        for (const part of rig!.parts.wheels ?? []) {
          if ('setAlpha' in part && typeof part.setAlpha === 'function') part.setAlpha(aspect === 'springs' ? 0.4 : 1);
        }
      };
      setStationPreviewAlpha();
      const s0 = Math.min(WS_ROOM.modelScale[ctx.layout], RL.model.maxW / Math.max(1, rig.width), RL.model.maxH / Math.max(1, rig.height));
      rig.root.setPosition(RL.model.x, RL.model.groundY).setScale(s0);
      world.add(rig.root);
      const shade = scene.add.rectangle(0, 0, L.size.w, L.size.h, 0xffffff, 0.28).setOrigin(0).setDepth(-400);
      objs.push(shade);

      const focusWorld = () => {
        const f = rig!.focus(aspect);
        return { x: RL.model.x + f.x * s0, y: RL.model.groundY + f.y * s0, zoom: f.zoom };
      };
      const target = () => {
        const f = focusWorld();
        return cameraTarget(f, f.zoom, L.stage, WS_ROOM.stationMaxScale / s0);
      };
      const zoomTo = (ms: number) => {
        const t = target();
        scene.tweens.killTweensOf(world);
        tweens.push(scene.tweens.add({ targets: world, x: t.x, y: t.y, scaleX: t.scale, scaleY: t.scale, duration: ms, ease: 'Cubic.easeInOut' }));
      };
      zoomTo(WS_ROOM.stationZoomMs);

      // ---- bands
      const topH = L.topBandH;
      const top = scene.add.image(L.size.w / 2, topH, roundedTexture(scene, L.size.w + 80, topH + 60, BAND, { radius: 40, shadow: 0, strokeW: 0, gloss: false }))
        .setOrigin(0.5, 1).setDepth(10);
      const botH = L.size.h - L.strip.bandY;
      const bot = scene.add.image(L.size.w / 2, L.strip.bandY, roundedTexture(scene, L.size.w + 80, botH + 60, BAND, { radius: 40, shadow: 0, strokeW: 0, gloss: false }))
        .setOrigin(0.5, 0).setDepth(10);
      objs.push(top, bot);

      const aspectText = makeText(scene, L.aspect.x + 40, L.aspect.y, aspectDef.label, { size: L.aspect.size, color: COLORS.yellow, stroke: COLORS.ink }).setDepth(12);
      const aspectIcon = scene.add.image(L.aspect.x - aspectText.width / 2 - 34, L.aspect.y, aspectIconTexture(scene, ws, aspect)).setScale(0.8).setDepth(12);
      const nameText = makeText(scene, L.name.x, L.name.y, '', { size: L.name.size, color: COLORS.paper, stroke: COLORS.ink }).setDepth(12);
      objs.push(aspectText, aspectIcon, nameText);

      // ---- swatches
      const swatches = options.map((v, i) => {
        const b = new Button(scene, { x: 0, y: L.strip.y, w: L.strip.swatch, h: L.strip.swatch, color: cardColor(i + 2), onClick: () => {
          if (busy) return;
          if (i === index) apply(); else select(i);
        } });
        b.add(scene.add.image(0, 0, swatchTexture(ctx, ws, progress.model, aspect, v, L.strip.swatch - 24)));
        if (v === installed) {
          const chip = scene.add.image(0, L.strip.swatch / 2 - 30, roundedTexture(scene, 150, 56, COLORS.green, { radius: 28, shadow: 0, strokeW: 4, gloss: false })).setOrigin(0.5, roundedOriginY(56, 0));
          b.add([chip, makeText(scene, 0, L.strip.swatch / 2 - 30, '✓ Now', { size: 40, color: COLORS.paper })]);
        }
        b.setDepth(14);
        return b;
      });
      objs.push(...swatches);
      const arrow = (x: number, label: string, dir: number) => {
        const b = new Button(scene, { x, y: L.strip.y, w: L.strip.arrowW, h: 150, label, fontSize: 72, color: COLORS.yellow, onClick: () => { if (!busy) select(index + dir); } });
        b.setDepth(14);
        objs.push(b);
        return b;
      };
      const left = arrow(L.strip.arrowL, '<', -1);
      const right = arrow(L.strip.arrowR, '>', 1);

      const use = new Button(scene, { x: L.use.x, y: L.use.y, w: L.use.w, h: L.use.h, label: 'Use it!', fontSize: 64, color: COLORS.green, textColor: COLORS.paper, badge: promptLabel(ctx.input, 'confirm'), onClick: () => apply() });
      const back = new Button(scene, { x: L.back.x, y: L.back.y, w: L.back.w, h: L.back.h, label: 'Back', fontSize: 52, color: 0xffb3b3, badge: promptLabel(ctx.input, 'back'), onClick: () => leave() });
      use.setDepth(16); back.setDepth(16);
      objs.push(use, back);

      const refresh = () => {
        const start = windowStart(options.length, index, L.strip.visible);
        const xs = stripXs(L.strip.xs, options.length);
        swatches.forEach((b, i) => {
          const slot = i - start;
          const vis = slot >= 0 && slot < L.strip.visible;
          b.setVisible(vis);
          if (vis) b.x = xs[slot];
          b.setFocused(i === index && !ctx.input.touch);
          b.setEnabled(true);
        });
        // mark the selection on touch as well: a ring-less highlight via scale
        swatches.forEach((b, i) => { if (ctx.input.touch) b.setScale(i === index ? 1.08 : 1); });
        left.setEnabled(index > 0).setVisible(options.length > 1);
        right.setEnabled(index < options.length - 1).setVisible(options.length > 1);
        const v = options[index];
        nameText.setText(nameOf(v) + (v === installed ? '  ✓' : ''));
        nameText.setFontSize(L.name.size);
        fitText(nameText, L.name.maxW);
      };

      const preview = () => {
        rig!.setModel(withVariant(progress.model, aspect, options[index]));
        setStationPreviewAlpha();
        zoomTo(260);
      };
      const select = (i: number) => {
        const n = clampIndex(i, options.length);
        if (n === index) return;
        index = n;
        ctx.audio.sfx('click');
        refresh();
        preview();
      };
      const leave = () => {
        if (busy) return;
        busy = true;
        ctx.audio.sfx('back');
        ctx.go('room', { from: aspect });
      };
      const apply = () => {
        if (busy) return;
        const variant = options[index];
        if (variant === installed) { leave(); return; }
        busy = true;
        const next = engine.setPart(ws, progress, aspect, variant);
        const cur = ctx.save();
        ctx.commit({ ...cur, workshops: { ...cur.workshops, [ws]: next } });
        ctx.audio.sfx('pop');
        ctx.audio.sfx('sparkle');
        rig!.play('happy');
        const star = starTexture(scene, 56);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const st = scene.add.image(L.stage.cx, L.stage.cy, star).setDepth(20).setScale(0.3);
          objs.push(st);
          tweens.push(scene.tweens.add({
            targets: st, x: L.stage.cx + Math.cos(a) * (240 + (i % 3) * 60), y: L.stage.cy + Math.sin(a) * (180 + (i % 3) * 40),
            scale: 1.1, alpha: 0, angle: 180, duration: WS_ROOM.stationConfirmMs, ease: 'Quad.easeOut',
          }));
        }
        timer = scene.time.delayedCall(WS_ROOM.stationConfirmMs, () => ctx.go('room', { from: aspect }));
      };

      moveBy = (d) => select(index + d); doApply = apply; doLeave = leave;
      refresh();
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (busy) continue;
        if (a === 'left') moveBy(-1);
        else if (a === 'right') moveBy(1);
        else if (a === 'confirm') doApply();
        else if (a === 'back') doLeave();
      }
    },
    destroy() {
      timer?.remove(false);
      tweens.forEach((t) => t.remove());
      tweens.length = 0;
      rig?.destroy();
      rig = undefined;
      objs.forEach((o) => { if (o.scene) o.destroy(); });
      objs.length = 0;
    },
  };
};

export default stationScreen;
