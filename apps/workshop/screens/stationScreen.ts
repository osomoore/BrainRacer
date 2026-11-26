/**
 * station: the configuration menu for ONE aspect (data.aspect). The camera zooms on that part of the model; a strip
 * of swatches shows owned parts and the next shop offers. The model previews the highlighted part live.
 */
import Phaser from 'phaser';
import { buildDetail } from '../art';
import { ensureCurrencyIcon, ensurePriceTagIcon } from '../art/icons';
import { playWorkshopSfx } from '../audio';
import { WS_ROOM } from '../config';
import type { ModelRig, PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { visibleAspectIds } from '../logic/aspects';
import { showBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Confirm } from '../ui/Confirm';
import { promptLabel } from '../ui/input';
import { cardColor } from '../ui/screenChrome';
import { COLORS, fitText, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { aspectIconTexture, starTexture } from './room/icons';
import { roomLayout } from './room/layout';
import { currentProgress } from './room/progress';
import { guardBackAfterPreview, isBackGuarded } from './backGuard';
import { cameraTarget, clampIndex, stationLayout, stripOffset, swatchLeft, withVariant } from './station/layout';
import { swatchTexture } from './station/swatch';
import { roomReferenceFit } from './modelFit';

const BAND = 0x232a66;

function fitDetail(detail: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number): void {
  const bounds = detail.getBounds();
  const scale = Math.min(w / bounds.width, h / bounds.height);
  detail.setScale(scale).setPosition(x - bounds.centerX * scale, y - bounds.centerY * scale);
}

const stationScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  let timer: Phaser.Time.TimerEvent | undefined;
  let rig: ModelRig | undefined;
  let detail: Phaser.GameObjects.Container | null = null;
  let busy = false;
  let popup: Confirm | undefined;
  let moveBy: (d: number) => void = () => {};
  let doApply: () => void = () => {};
  let doLeave: () => void = () => {};
  let cleanSwatches: () => void = () => {};

  return {
    create(c, data) {
      ctx = c;
      const scene = ctx.scene;
      const ws = ctx.workshop ?? 'race';
      const cat = engine.catalog(ws);
      let progress = currentProgress(ctx, ws);
      const shown = visibleAspectIds(cat, progress);
      const aspect = data.aspect && shown.includes(data.aspect) ? data.aspect : shown[0];
      const springsCloseup = ws === 'race' && aspect === 'springs';
      const aspectDef = cat.aspects.find((a) => a.id === aspect) ?? cat.aspects[0];
      let owned = engine.availableFor(ws, progress, aspect);
      let offers = ctx.adminMode ? [] : engine.shopOffers(ws, progress, aspect);
      let options = [...owned, ...offers.map((offer) => offer.variant)];
      const installed = progress.model[aspect];
      const nameOf = (id: string) => cat.variants.find((v) => v.id === id)?.name ?? id;
      let index = Math.max(0, options.indexOf(installed));
      let lastTouchTap: number | undefined;
      const L = stationLayout(ctx.layout);
      const RL = roomLayout(ctx.layout, shown);
      ctx.audio.music(ws === 'race' ? 'raceShop' : 'dinoLab');

      // ---- world: room backdrop + model, zoomed like a camera
      const world = scene.add.container(0, 0).setDepth(-500);
      objs.push(world);
      const bg = roomBackdrop(scene, ws, ctx.layout, RL.floorY);
      world.add(scene.add.image(0, 0, bg.key).setOrigin(0));
      const shade = scene.add.rectangle(0, 0, L.size.w, L.size.h, 0xffffff, 0.28).setOrigin(0).setDepth(-400);
      objs.push(shade);

      const candidate = () => withVariant(progress.model, aspect, options[index]);
      const revealSprings = (modelRig: ModelRig) => {
        for (const wheel of modelRig.parts.wheels as Phaser.GameObjects.Image[]) wheel.setAlpha(WS_ROOM.stationSpringsWheelAlpha);
      };
      const placeDetail = (preview: Phaser.GameObjects.Container) => {
        fitDetail(preview, L.stage.cx, L.stage.cy, Math.min(1100, L.size.w - 120), L.strip.bandY - L.topBandH - 36);
        preview.setDepth(-300);
      };

      let zoomTo = (_ms: number) => {};
      /** Reverses the entry zoom back to the room's framing (the world container at identity); no-op without a zoomed rig. */
      const zoomOut = (): number => {
        if (!rig) return 0;
        scene.tweens.killTweensOf(world);
        tweens.push(scene.tweens.add({ targets: world, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: WS_ROOM.stationZoomMs, ease: 'Cubic.easeInOut' }));
        return WS_ROOM.stationZoomMs;
      };
      detail = buildDetail(scene, ws, candidate(), aspect);
      if (detail) {
        placeDetail(detail);
      } else {
        const modelRig = rig = ctx.buildRig(scene, ws, progress.model, 'side');
        const baseW = modelRig.width; // measured before the root is scaled (setModel re-measures including the scale)
        const largestModel = { ...progress.model, size: ws === 'dino' ? 'size.huge' : 'size.big' };
        const largestRig = ctx.buildRig(scene, ws, largestModel, 'side');
        const largestBounds = largestRig.root.getBounds();
        largestRig.destroy();
        const roomBounds = { x: largestBounds.x, y: largestBounds.y, width: largestBounds.width, height: largestBounds.height };
        let s0 = roomReferenceFit(roomBounds, RL, ctx.layout, ws, ctx.input.touch).scale;
        if (aspect === 'size') {
          const availableW = L.size.w - 2 * WS_ROOM.modelTopClearancePx;
          const availableH = L.strip.bandY - L.topBandH - 2 * WS_ROOM.modelTopClearancePx;
          s0 = Math.min(s0, availableW / largestBounds.width, availableH / largestBounds.height);
        }
        let springsFrame: { x: number; y: number; scale: number } | undefined;
        if (springsCloseup) {
          // Measure unscaled previews once so swapping springs keeps the wheel and raised body in the same frame.
          const bounds = modelRig.root.getBounds();
          for (const { id: option } of cat.variants.filter((v) => v.aspect === aspect)) {
            if (option === installed) continue;
            modelRig.setModel(withVariant(progress.model, aspect, option));
            Phaser.Geom.Rectangle.Union(bounds, modelRig.root.getBounds(), bounds);
          }
          modelRig.setModel(candidate());
          revealSprings(modelRig);
          const margin = WS_ROOM.stationSpringsMarginPx;
          const scale = Math.min(
            (L.size.w - 2 * margin) / bounds.width,
            (L.strip.bandY - L.topBandH - 2 * margin) / bounds.height,
            WS_ROOM.stationMaxScale,
          );
          springsFrame = { x: bounds.centerX, y: bounds.centerY, scale };
          s0 = Math.min(s0, scale);
        }
        modelRig.root.setPosition(RL.model.x, RL.model.groundY).setScale(s0);
        world.add(modelRig.root);
        zoomTo = (ms) => {
          const f = { ...modelRig.focus(aspect) };
          if (springsFrame) {
            f.x = springsFrame.x;
            f.y = springsFrame.y;
            f.zoom = springsFrame.scale / s0;
          } else if (ws === 'race' && aspect === 'bumpers') {
            // Both bumpers must be visible: centre on the car and zoom just enough to fit its whole length.
            f.x = 0;
            f.zoom = (L.size.w - 2 * WS_ROOM.stationBumperMarginPx) / ((baseW + 2 * WS_ROOM.stationBumperPadPx) * s0);
          } else if (aspect === 'size') {
            // Keep the largest option visible between the chrome bands; the same frame serves every size.
            f.x = roomBounds.x + roomBounds.width / 2;
            f.y = roomBounds.y + roomBounds.height / 2;
            f.zoom = 1;
          }
          const focus = { x: RL.model.x + f.x * s0, y: RL.model.groundY + f.y * s0 };
          const stage = springsFrame || aspect === 'size'
            ? { cx: L.stage.cx, cy: (L.topBandH + L.strip.bandY) / 2 }
            : L.stage;
          const t = cameraTarget(focus, f.zoom, stage, WS_ROOM.stationMaxScale / s0);
          scene.tweens.killTweensOf(world);
          tweens.push(scene.tweens.add({ targets: world, x: t.x, y: t.y, scaleX: t.scale, scaleY: t.scale, duration: ms, ease: 'Cubic.easeInOut' }));
        };
        zoomTo(WS_ROOM.stationZoomMs);
      }

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
      const status = makeText(scene, L.size.w / 2, topH - 25, '', { size: 40, color: COLORS.yellow, stroke: COLORS.ink }).setDepth(12);
      const currency = ws === 'race' ? 'Coins' : 'Bio Juice';
      objs.push(aspectText, aspectIcon, nameText, status);

      // ---- swatches
      let swatches: Button[] = [];
      const buildSwatches = () => options.map((v, i) => {
        const offer = offers[i - owned.length];
        const b = new Button(scene, { x: 0, y: L.strip.y, w: L.strip.swatch, h: L.strip.swatch, color: offer ? (offer.affordable ? 0xffe4b8 : 0xe3dce5) : cardColor(i + 2), onClick: () => {
          if (busy) return;
          if (popup) return;
          if (ctx.input.touch) {
            if (lastTouchTap !== i) {
              if (i !== index) select(i);
              lastTouchTap = i;
              return;
            }
            apply('equip', true);
            return;
          }
          if (i !== index) select(i);
          if (i === index || i >= owned.length) apply();
        } });
        const swatchSize = L.strip.swatch - 24;
        const detailSwatch = buildDetail(scene, ws, withVariant(progress.model, aspect, v), aspect);
        if (detailSwatch) {
          fitDetail(detailSwatch, 0, offer ? -20 : 0, swatchSize, offer ? swatchSize - 56 : swatchSize);
          b.add(detailSwatch);
        } else {
          const size = offer ? swatchSize - 36 : swatchSize;
          b.add(scene.add.image(0, offer ? -20 : 0, swatchTexture(ctx, ws, progress.model, aspect, v, size)));
        }
        if (offer) {
          const y = L.strip.swatch / 2 - 30;
          const tag = scene.add.image(0, y, ensurePriceTagIcon(scene)).setDisplaySize(150, 74);
          const coin = scene.add.image(-11, y, ensureCurrencyIcon(scene, ws)).setDisplaySize(48, 48);
          const price = makeText(scene, 29, y, String(offer.price), { size: 40, color: COLORS.ink });
          b.add([tag, coin, price]);
        }
        if (v === installed) {
          const chip = scene.add.image(0, L.strip.swatch / 2 - 30, roundedTexture(scene, 150, 56, COLORS.green, { radius: 28, shadow: 0, strokeW: 4, gloss: false })).setOrigin(0.5, roundedOriginY(56, 0));
          b.add([chip, makeText(scene, 0, L.strip.swatch / 2 - 30, '✓ Now', { size: 40, color: COLORS.paper })]);
        }
        b.setDepth(14);
        return b;
      });
      const arrow = (x: number, label: string, dir: number) => {
        const b = new Button(scene, { x, y: L.strip.arrowY, w: L.strip.arrowW, h: L.strip.arrowH, label, fontSize: 72, color: COLORS.yellow, onClick: () => { if (!busy) select(index + dir); } });
        b.setDepth(15);
        objs.push(b);
        return b;
      };
      const left = arrow(L.strip.arrowL, '<', -1);
      const right = arrow(L.strip.arrowR, '>', 1);

      const use = new Button(scene, { x: L.use.x, y: L.use.y, w: L.use.w, h: L.use.h, label: 'Use it!', fontSize: 64, color: COLORS.green, textColor: COLORS.paper, badge: promptLabel(ctx.input, 'confirm'), onClick: () => apply('equip', ctx.input.touch) });
      const back = new Button(scene, { x: L.back.x, y: L.back.y, w: L.back.w, h: L.back.h, label: 'Back', fontSize: 52, color: 0xffb3b3, badge: promptLabel(ctx.input, 'back'), onClick: () => leave() });
      use.setDepth(16); back.setDepth(16);
      objs.push(use, back);

      // Scrolling row: every option sits at its content x minus the scroll offset; the camera clips the half-visible
      // neighbours at the pane edge and the arrows (drawn above) cover the inset.
      const geom = () => ({ count: options.length, swatch: L.strip.swatch, gap: L.strip.gap, windowW: L.size.w - 2 * L.strip.inset, peek: WS_ROOM.swatchPeek });
      let scroll = 0;
      let scrollTween: Phaser.Tweens.Tween | undefined;
      const placeSwatches = () => {
        const reach = L.strip.swatch / 2 + 4;
        swatches.forEach((b, i) => {
          b.x = L.strip.inset + swatchLeft(geom(), i) + L.strip.swatch / 2 - scroll;
          b.setVisible(b.x + reach > 0 && b.x - reach < L.size.w);
        });
      };
      const scrollTo = (animate: boolean) => {
        placeSwatches();
        const target = stripOffset(geom(), index, scroll);
        scrollTween?.remove();
        scrollTween = undefined;
        if (!animate || target === scroll) { scroll = target; placeSwatches(); return; }
        const state = { o: scroll };
        scrollTween = scene.tweens.add({ targets: state, o: target, duration: WS_ROOM.swatchScrollMs, ease: 'Quad.easeOut',
          onUpdate: () => { scroll = state.o; placeSwatches(); },
          onComplete: () => { scroll = target; placeSwatches(); scrollTween = undefined; } });
        tweens.push(scrollTween);
      };
      let firstRefresh = true;
      const refresh = () => {
        scrollTo(!firstRefresh);
        firstRefresh = false;
        swatches.forEach((b, i) => {
          b.setFocused(i === index);
          b.setEnabled(true);
        });
        left.setEnabled(index > 0).setVisible(options.length > 1);
        right.setEnabled(index < options.length - 1).setVisible(options.length > 1);
        const v = options[index];
        const offer = offers[index - owned.length];
        use.setLabel(ctx.input.touch ? (offer ? `Buy ${offer.price}` : 'OK') : (offer ? `Buy for ${offer.price}` : 'Use it!'));
        status.setText(ctx.input.touch ? (offer ? `Price: ${offer.price} ${currency}` : 'Owned') : '');
        nameText.setText(nameOf(v) + (v === installed ? '  ✓' : ''));
        nameText.setFontSize(L.name.size);
        fitText(nameText, L.name.maxW);
      };

      const preview = () => {
        const model = candidate();
        const nextDetail = buildDetail(scene, ws, model, aspect);
        if (nextDetail) {
          detail?.destroy();
          detail = nextDetail;
          placeDetail(detail);
        } else if (rig) {
          rig.setModel(model);
          if (springsCloseup) revealSprings(rig);
          zoomTo(260);
        }
      };
      const select = (i: number) => {
        const n = clampIndex(i, options.length);
        if (n === index) return;
        lastTouchTap = undefined;
        index = n;
        ctx.audio.sfx('click');
        refresh();
        preview();
      };
      const leave = (viaBack = true) => {
        if (busy || (viaBack && isBackGuarded(ctx, scene.time.now))) return;
        busy = true;
        ctx.audio.sfx('back');
        if (viaBack) guardBackAfterPreview(ctx, scene.time.now);
        timer = scene.time.delayedCall(zoomOut(), () => ctx.go('room', { from: aspect }));
      };
      const apply = (cue: 'equip' | 'buy' = 'equip', touchConfirm = false) => {
        if (busy) return;
        const variant = options[index];
        if (index >= owned.length) {
          const offer = offers[index - owned.length];
          if (!offer || popup) return;
          const open = (text: string, single: boolean, onYes: () => void) => {
            popup = new Confirm(scene, {
              cx: L.size.w / 2, cy: L.size.h / 2, w: Math.min(L.size.w - 80, 900), text, single, defaultYes: true,
              audio: ctx.audio, touch: ctx.input.touch, depth: 500,
              onYes: () => { popup = undefined; onYes(); },
              onNo: () => { popup = undefined; },
            });
          };
          if (!offer.affordable) {
            playWorkshopSfx(ctx.audio, 'notEnough');
            open(`You have ${currentProgress(ctx, ws).wallet} ${currency}. You need ${offer.price}.`, true, () => {});
          } else if (touchConfirm) {
            buy(variant);
          } else {
            ctx.audio.sfx('select');
            open(`Pay ${offer.price} ${currency}?`, false, () => buy(variant));
          }
          return;
        }
        if (variant === installed) { leave(false); return; }
        busy = true;
        const next = engine.setPart(ws, progress, aspect, variant);
        const cur = ctx.save();
        ctx.commit({ ...cur, workshops: { ...cur.workshops, [ws]: next } });
        playWorkshopSfx(ctx.audio, cue);
        rig?.play('happy');
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
        timer = scene.time.delayedCall(Math.max(WS_ROOM.stationConfirmMs, zoomOut()), () => ctx.go('room', { from: aspect, partChanged: true }));
      };
      const buy = (variant: string) => {
        if (busy) return;
        {
          const purchase = engine.purchase(ws, currentProgress(ctx, ws), aspect, variant);
          if (purchase.status !== 'bought') {
            playWorkshopSfx(ctx.audio, 'notEnough');
            use.pulse();
            return;
          }
          const save = ctx.save();
          progress = purchase.progress;
          ctx.commit({ ...save, workshops: { ...save.workshops, [ws]: progress } });
          owned = engine.availableFor(ws, progress, aspect);
          offers = engine.shopOffers(ws, progress, aspect);
          options = [...owned, ...offers.map((offer) => offer.variant)];
          index = owned.indexOf(variant);
          swatches.forEach((b) => b.destroy());
          swatches = buildSwatches();
          refresh();
          preview();
          objs.push(showBanner(scene, { x: L.stage.cx, y: topH + 76, text: 'Bought!', color: 0xa8e6a1, ms: 900 }));
          apply('buy'); // buying also equips the new variant, like pressing "Use it!"
        }
      };

      moveBy = (d) => select(index + d); doApply = apply; doLeave = leave;
      swatches = buildSwatches();
      cleanSwatches = () => swatches.forEach((b) => b.destroy());
      refresh();
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (popup) { popup.handle(a); continue; }
        if (busy) continue;
        if (a === 'left') moveBy(-1);
        else if (a === 'right') moveBy(1);
        else if (a === 'confirm') doApply();
        else if (a === 'back') doLeave();
      }
    },
    destroy() {
      popup?.destroy();
      popup = undefined;
      cleanSwatches();
      timer?.remove(false);
      tweens.forEach((t) => t.remove());
      tweens.length = 0;
      rig?.destroy();
      rig = undefined;
      detail?.destroy();
      detail = null;
      objs.forEach((o) => { if (o.scene) o.destroy(); });
      objs.length = 0;
    },
  };
};

export default stationScreen;
